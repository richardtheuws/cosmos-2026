#!/usr/bin/env python3
"""
extract_beatmap.py — Sprint 13B onset-detector for the rhythm-tap rebuild.

Walks `public/assets/audio/music/<track>.mp3`, runs an offline ffmpeg + numpy
onset-detector, and writes `public/assets/beatmaps/<track>.json` matching the
JSON-DSL parsed by `src/audio/beatmap.ts`.

NO librosa dependency — librosa is heavyweight (numba, sndfile…) and we only
need a robust kick/snare detector. We use:

  1. ffmpeg → 22050 Hz mono PCM-f32 stream (decoded entirely in memory)
  2. numpy STFT (frame=2048, hop=512 → ~23 ms resolution)
  3. Spectral-flux onset envelope, low-band-weighted (kick/snare emphasis)
  4. Adaptive peak-pick: local-max + threshold = mean + k * std over a window
  5. Min-spacing filter so we don't dump 8 events on a single transient

Output → JSON-DSL with sensible defaults:
  - x ∈ [0.2, 0.8] alternating left/right (variation: small jitter)
  - y = 1.0 (bottom-edge spawn → BeatTarget drifts upward)
  - type = "tap" for every event (manual fine-tune adds "hold"/"swipe" later)
  - combo = 1
  - telegraph = 1.5

Usage:
    cd ~/Documents/games/cosmos-cosmic-adventure-2026
    python3 scripts/sprint13b/extract_beatmap.py                  # all 4 base tracks
    python3 scripts/sprint13b/extract_beatmap.py title-theme      # single track
    python3 scripts/sprint13b/extract_beatmap.py --bpm 92 title-theme

Will overwrite existing JSONs UNLESS the existing file has `manualTuned: true`,
in which case it is left alone (the title-theme manual fine-tune is precious).

Requires: ffmpeg + python3 + numpy. Verified on macOS Python 3.9 / numpy 2.0.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Paths + defaults
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]
MUSIC_DIR = REPO_ROOT / "public" / "assets" / "audio" / "music"
BEATMAP_DIR = REPO_ROOT / "public" / "assets" / "beatmaps"

# Tracks we ship beatmaps for. Pulled from `_SUNO_PROMPTS.md`. Each entry:
#   filename stem, default BPM (informational), tap-density-target (events/min)
DEFAULT_TRACKS: list[tuple[str, int, int]] = [
    ("title-theme", 92, 14),       # warm folktronica, drums @ 1:00 onwards
    ("slow-bloom-loop", 88, 12),   # ambient, sparse plucks → fewer events
    ("inkpool-loop", 78, 10),      # cave drone, hand-drum heartbeat
    ("boss-stinger", 110, 18),     # ominous build-up, denser tension
]

# DSP constants — chosen for percussive-folk material like our Suno tracks.
SAMPLE_RATE = 22_050
FRAME_LEN = 2048
HOP_LEN = 512
HOP_S = HOP_LEN / SAMPLE_RATE                    # ≈ 23.2 ms per frame
LOW_BIN_END = 32                                 # ~344 Hz @ 22.05 kHz, FFT=2048 — kick/bass band
MID_BIN_END = 96                                 # ~1.03 kHz — snare body band
PEAK_WINDOW_S = 1.5                              # local-stat window for adaptive threshold
PEAK_K = 0.85                                    # multiplier on std for peak threshold
MIN_GAP_S = 0.18                                 # ~330 ms between events — keeps it tappable
TELEGRAPH_S = 1.5
DEFAULT_TYPE = "tap"
DEFAULT_COMBO = 1
DEFAULT_Y = 1.0
X_MIN, X_MAX = 0.2, 0.8

# ─────────────────────────────────────────────────────────────────────────────
# ffmpeg → numpy
# ─────────────────────────────────────────────────────────────────────────────


def decode_mp3_to_mono(mp3_path: Path) -> np.ndarray:
    """Decode mp3 to mono float32 PCM at SAMPLE_RATE via ffmpeg subprocess."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not on PATH — install via Homebrew: `brew install ffmpeg`")
    if not mp3_path.exists():
        raise FileNotFoundError(mp3_path)
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(mp3_path),
        "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-",
    ]
    proc = subprocess.run(cmd, check=True, capture_output=True)
    return np.frombuffer(proc.stdout, dtype=np.float32)


def probe_duration(mp3_path: Path) -> float:
    """Use ffprobe for the canonical duration — matches AudioFFTBridge's view."""
    if shutil.which("ffprobe") is None:
        raise RuntimeError("ffprobe not on PATH — comes with ffmpeg in Homebrew")
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(mp3_path),
    ]
    proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return float(proc.stdout.strip())


# ─────────────────────────────────────────────────────────────────────────────
# Onset detection — spectral flux with low/mid weighting
# ─────────────────────────────────────────────────────────────────────────────


def stft_magnitude(samples: np.ndarray) -> np.ndarray:
    """Real-FFT magnitude spectrogram. Returns shape (n_frames, n_bins)."""
    if samples.size < FRAME_LEN:
        samples = np.pad(samples, (0, FRAME_LEN - samples.size))
    n_frames = 1 + (samples.size - FRAME_LEN) // HOP_LEN
    window = np.hanning(FRAME_LEN).astype(np.float32)
    out = np.empty((n_frames, FRAME_LEN // 2 + 1), dtype=np.float32)
    for i in range(n_frames):
        start = i * HOP_LEN
        frame = samples[start:start + FRAME_LEN] * window
        out[i] = np.abs(np.fft.rfft(frame))
    return out


def spectral_flux_envelope(mag: np.ndarray) -> np.ndarray:
    """
    Low+mid-weighted spectral flux. Half-wave-rectified positive differences,
    summed across the kick (0..LOW_BIN_END) and snare (LOW_BIN_END..MID_BIN_END)
    bands. The high-band is ignored — folk tracks have lots of HF tape-hiss
    that confuses naive flux detectors.

    Returns 1D envelope, length = n_frames.
    """
    diff = np.diff(mag, axis=0, prepend=mag[:1])
    pos = np.maximum(diff, 0.0)
    low = pos[:, :LOW_BIN_END].sum(axis=1)
    mid = pos[:, LOW_BIN_END:MID_BIN_END].sum(axis=1) * 0.6
    env = low + mid
    if env.max() > 0:
        env = env / env.max()
    return env.astype(np.float32)


def adaptive_peak_pick(envelope: np.ndarray) -> list[int]:
    """
    Local-max picker with a sliding-window adaptive threshold:
      threshold(i) = mean(window) + PEAK_K * std(window)
    where window spans PEAK_WINDOW_S around frame i. A frame is a peak if it's
    a local max AND above threshold AND at least MIN_GAP_S since the last peak.
    """
    n = envelope.size
    win = max(1, int(PEAK_WINDOW_S / HOP_S))
    min_gap = max(1, int(MIN_GAP_S / HOP_S))
    peaks: list[int] = []
    last_peak = -10**9
    # Cumulative-sum tricks for fast windowed mean/std
    cumsum = np.concatenate(([0.0], np.cumsum(envelope, dtype=np.float64)))
    cumsum_sq = np.concatenate(([0.0], np.cumsum(envelope.astype(np.float64) ** 2)))
    for i in range(1, n - 1):
        lo = max(0, i - win)
        hi = min(n, i + win + 1)
        count = hi - lo
        mean = (cumsum[hi] - cumsum[lo]) / count
        var = max(0.0, (cumsum_sq[hi] - cumsum_sq[lo]) / count - mean * mean)
        std = math.sqrt(var)
        thr = mean + PEAK_K * std
        v = envelope[i]
        if v < thr:
            continue
        if v < envelope[i - 1] or v < envelope[i + 1]:
            continue
        if i - last_peak < min_gap:
            # Only replace if stronger
            if peaks and envelope[i] > envelope[peaks[-1]]:
                peaks[-1] = i
                last_peak = i
            continue
        peaks.append(i)
        last_peak = i
    return peaks


def thin_to_target(peaks: list[int], envelope: np.ndarray, target_count: int) -> list[int]:
    """
    Down-sample to roughly `target_count` peaks if we found too many. Sort
    candidates by envelope-strength descending, take the strongest, then re-sort
    chronologically. If we found fewer, return as-is (caller caps density).
    """
    if len(peaks) <= target_count:
        return peaks
    strongest = sorted(peaks, key=lambda i: float(envelope[i]), reverse=True)[:target_count]
    return sorted(strongest)


# ─────────────────────────────────────────────────────────────────────────────
# Beatmap composition
# ─────────────────────────────────────────────────────────────────────────────


def alternate_x(idx: int) -> float:
    """
    Left/right alternation across the safe-zone X_MIN..X_MAX with a small
    deterministic jitter so consecutive same-side taps drift slightly (avoids
    the visual "rhythm pong" trap when the music has long even/odd runs).
    """
    base = X_MIN if idx % 2 == 0 else X_MAX
    # Pull each successive same-side tap 6% toward the centre — adds an arc.
    pull = (idx // 2) * 0.06
    if base == X_MIN:
        x = base + pull
    else:
        x = base - pull
    # Wrap the pull so we don't crawl past the centre.
    x = max(X_MIN, min(X_MAX, x))
    # Light deterministic jitter (seeded by idx) so the pattern feels organic.
    jitter = ((idx * 2654435761) & 0xFFFFFFFF) / 0xFFFFFFFF * 0.06 - 0.03
    return round(max(X_MIN, min(X_MAX, x + jitter)), 3)


def build_events(peak_times: Iterable[float]) -> list[dict]:
    """Convert peak timestamps → JSON-DSL events list."""
    out: list[dict] = []
    for i, t in enumerate(peak_times):
        out.append({
            "t": round(float(t), 3),
            "x": alternate_x(i),
            "y": DEFAULT_Y,
            "type": DEFAULT_TYPE,
            "combo": DEFAULT_COMBO,
            "telegraph": TELEGRAPH_S,
        })
    return out


def is_manual_tuned(json_path: Path) -> bool:
    """Read a maybe-existing JSON; True if manualTuned: true."""
    if not json_path.exists():
        return False
    try:
        data = json.loads(json_path.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return data.get("manualTuned") is True


def extract_track(track_stem: str, bpm: int, target_per_min: int) -> dict:
    """End-to-end: decode → flux → peaks → JSON dict (caller writes file)."""
    mp3_path = MUSIC_DIR / f"{track_stem}.mp3"
    print(f"  [decode]   ffmpeg → {SAMPLE_RATE} Hz mono")
    samples = decode_mp3_to_mono(mp3_path)
    duration = probe_duration(mp3_path)
    print(f"  [decode]   {samples.size} samples, {duration:.2f}s")

    print(f"  [stft]     frame={FRAME_LEN} hop={HOP_LEN} → {samples.size // HOP_LEN} frames")
    mag = stft_magnitude(samples)
    env = spectral_flux_envelope(mag)
    print(f"  [flux]     envelope built, mean={env.mean():.3f} max={env.max():.3f}")

    peaks_idx = adaptive_peak_pick(env)
    target = max(8, int(target_per_min * duration / 60))
    peaks_idx = thin_to_target(peaks_idx, env, target)
    peak_times = [i * HOP_S for i in peaks_idx]
    print(f"  [peaks]    {len(peak_times)} events (target {target} ≈ {target_per_min}/min)")

    events = build_events(peak_times)
    return {
        "track": track_stem,
        "bpm": bpm,
        "duration": round(duration, 3),
        "manualTuned": False,
        "events": events,
    }


def write_beatmap(beatmap: dict, force: bool = False) -> Path:
    """Write JSON to BEATMAP_DIR. Skips manualTuned files unless force=True."""
    out_path = BEATMAP_DIR / f"{beatmap['track']}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if not force and is_manual_tuned(out_path):
        print(f"  [skip]     {out_path.name} (manualTuned: true) — pass --force to overwrite")
        return out_path
    out_path.write_text(json.dumps(beatmap, indent=2) + "\n")
    print(f"  [write]    {out_path}")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Offline onset-detector → beatmap.json")
    parser.add_argument("tracks", nargs="*", help="Track stems (default: all 4 base tracks)")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite manualTuned JSONs (DESTRUCTIVE — only for dev)")
    parser.add_argument("--bpm", type=int, default=None,
                        help="Override BPM hint for the listed tracks (informational only)")
    parser.add_argument("--density", type=int, default=None,
                        help="Override target events/minute for listed tracks")
    args = parser.parse_args(argv)

    if args.tracks:
        # User supplied stems — look up defaults, fall back to (BPM=100, density=12)
        lookup = {name: (bpm, dens) for (name, bpm, dens) in DEFAULT_TRACKS}
        plan = []
        for stem in args.tracks:
            bpm, dens = lookup.get(stem, (100, 12))
            plan.append((stem, args.bpm or bpm, args.density or dens))
    else:
        plan = [
            (stem, args.bpm or bpm, args.density or dens)
            for (stem, bpm, dens) in DEFAULT_TRACKS
        ]

    print(f"Sprint 13B beatmap-extractor — {len(plan)} track(s)")
    print(f"Music dir:   {MUSIC_DIR}")
    print(f"Beatmap dir: {BEATMAP_DIR}")
    print()

    failed = 0
    for stem, bpm, dens in plan:
        print(f"=== {stem} (bpm={bpm}, density={dens}/min) ===")
        try:
            beatmap = extract_track(stem, bpm, dens)
            write_beatmap(beatmap, force=args.force)
        except Exception as exc:  # noqa: BLE001 — we want full diagnostics in CLI
            print(f"  [ERROR]    {exc}")
            failed += 1
        print()

    if failed:
        print(f"{failed} track(s) failed — see errors above.")
        return 1
    print("All tracks extracted.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
