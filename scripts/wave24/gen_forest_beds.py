#!/usr/bin/env python3
"""
gen_forest_beds.py — Wave 24 Phase 1: the two Mushroom-Forest ambient beds.

Generates the per-room music beds from the design canvas (.claude/brainstorm/
wave24/00-FIRST-SETUP.md §3) via the existing sunoapi.org client, downloads +
transcodes them to public/assets/audio/ for the room `audioBed` field.

Run:  set -a; . ~/Documents/games/.env; set +a
      python3 scripts/wave24/gen_forest_beds.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "sprint8b"))
from suno_client import SunoClient  # type: ignore  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "public/assets/audio"

# Beatless, loopable, no-melody-hook — calm baseline. Verbatim from canvas §3.
BEDS = [
    {
        "filename": "slow-bloom-loop.mp3",
        "title": "Slow Bloom (Clearing)",
        "style": (
            "Beatless warm ambient drone, ~52 bpm felt-pulse, felted vibraphone, "
            "breathy low flute, distant wood-chimes, sun-through-leaves, welcoming, "
            "Hayao-Miyazaki calm watercolor mood, seamless loop, no melody hook, no percussion"
        ),
    },
    {
        "filename": "deep-grove-loop.mp3",
        "title": "Deep Grove (Underglow)",
        "style": (
            "Beatless low ambient drone, ~46 bpm, bowed double-bass harmonic, "
            "glass-bowl resonance, distant reverbed dripping water, underground hush, "
            "cool luminous, Moebius-calm, sub-bass warmth, seamless loop, no melody, no percussion"
        ),
    },
]


def main() -> int:
    client = SunoClient()
    balance = client.get_credits()
    print(f"credits available: {balance}")
    needed = 8 * len(BEDS)
    if balance < needed:
        print(f"ERROR: insufficient credits — have {balance}, need ~{needed}.", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    ok, fail = [], []
    for i, b in enumerate(BEDS, 1):
        print(f"\n[{i}/{len(BEDS)}] {b['filename']}")
        out_path = OUT / b["filename"]
        try:
            task_id = client.generate(title=b["title"], style=b["style"])
            print(f"  taskId={task_id}")
            result = client.wait_for_task(task_id)
            if not result.tracks:
                raise RuntimeError("no tracks in response")
            pick = result.tracks[0]
            tmp = out_path.with_suffix(".raw.mp3")
            client.download(pick.audio_url, tmp)
            client.transcode_to_mp3(tmp, out_path, bitrate="112k")
            tmp.unlink(missing_ok=True)
            print(f"  OK saved {out_path.name} ({pick.duration_s:.1f}s)")
            ok.append(b["filename"])
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED: {exc}", file=sys.stderr)
            fail.append((b["filename"], str(exc)))

    print(f"\nsummary: {len(ok)}/{len(BEDS)} beds generated -> {OUT}")
    for n in ok:
        print(f"  OK {n}")
    for n, e in fail:
        print(f"  FAIL {n}: {e}")
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())
