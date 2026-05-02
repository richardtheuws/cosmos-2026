/**
 * beatmap.ts — Sprint 13B
 *
 * JSON-DSL beatmap loader + scheduler for the rhythm-tap rebuild (PRD v2.0).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * JSON-DSL — `public/assets/beatmaps/<track>.json`
 * ───────────────────────────────────────────────────────────────────────────
 *
 * {
 *   "track": "title-theme",
 *   "bpm": 92,
 *   "duration": 189.6,
 *   "manualTuned": true,             // optional, default false
 *   "events": [
 *     { "t": 4.35, "x": 0.3, "y": 1.0, "type": "tap",  "combo": 1, "telegraph": 1.5 },
 *     { "t": 5.65, "x": 0.7, "y": 1.0, "type": "tap" }
 *   ]
 * }
 *
 *   t          — timestamp in seconds from track-start (synced to HTMLAudioElement.currentTime)
 *   x, y       — 0..1 normalised screen coords. y=1.0 = bottom edge (drift up to tap-band).
 *   type       — "tap" | "hold" | "swipe"   (BeatTarget renderer decides visuals)
 *   combo      — combo-multiplier on perfect-hit (default 1). Used by special targets.
 *   telegraph  — seconds of lead-time the BeatTarget is on screen before `t`.
 *                Default 1.5s. Defines spawn-time = t - telegraph.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Sync model
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The beatmap is timed against `HTMLAudioElement.currentTime` (read from
 * AudioFFTBridge.musicCurrentTime()). Per-frame `update(now)` walks the
 * sorted events list with a cursor `nextIdx`:
 *
 *   1. Spawn any events where `now >= t - telegraph` and not yet spawned
 *      → emit via `onSpawn(event)` callback (BeatScene wires this to BeatTarget creation)
 *   2. Mark expired events where `now > t + missWindow` (default 0.25s) so
 *      missed-but-still-airborne BeatTargets can be cleaned up by the scene.
 *
 * Loop-aware — when audio.currentTime jumps backwards (HTMLAudioElement.loop)
 * the scheduler resets `nextIdx` to 0 and clears `spawned`. The scene's
 * BeatTargets either expire naturally or the scene clears them on loop.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Why HTMLAudioElement.currentTime, not performance.now()?
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Audio playback drifts vs wall-clock (browser-buffer hiccups, page throttle,
 * pause/resume). HTMLAudioElement.currentTime is the ground truth for the
 * audio playhead and is what the player hears, so that's what we sync to.
 * Drift between currentTime and rAF is already smoothed because we re-read
 * it every frame.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Authoring
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Auto-extracted beatmaps come from `scripts/sprint13b/extract_beatmap.py`
 * (ffmpeg + numpy onset-detector). Output has `manualTuned: false`. The
 * title-theme is manually fine-tuned afterwards (timestamps shifted to lock
 * onto the koto motif + brushed-kick on bar-1 of each section, combo-events
 * added on the D-A-F-D motif). Other tracks stay auto-only for v1.0.0.
 */

/** A single tap event in the beatmap. */
export interface BeatEvent {
  /** Timestamp in seconds from track start. */
  t: number;
  /** Normalised X (0=left, 1=right). */
  x: number;
  /** Normalised Y (0=top, 1=bottom). y=1.0 = bottom-edge spawn. */
  y: number;
  /** Tap = simple, hold = build-up, swipe = horizontal flick. */
  type: 'tap' | 'hold' | 'swipe';
  /** Combo-multiplier on perfect-hit. Default 1. */
  combo: number;
  /** Lead-time before `t` the BeatTarget is on screen. Default 1.5s. */
  telegraph: number;
}

/** Parsed beatmap with normalised events (sorted by `t` ascending). */
export interface Beatmap {
  /** Track-key matches the filename without extension (e.g. "title-theme"). */
  track: string;
  /** Tempo (informational; not used by the scheduler). */
  bpm: number;
  /** Track duration in seconds (from ffprobe). Scheduler uses this for loop-detection. */
  duration: number;
  /** True if a human has fine-tuned the timestamps. False = raw onset-detector output. */
  manualTuned: boolean;
  /** Events sorted by `t` ascending. */
  events: ReadonlyArray<BeatEvent>;
}

/** Default telegraph (lead-time) when the JSON omits the field. */
const DEFAULT_TELEGRAPH_S = 1.5;
/** Default combo-multiplier. */
const DEFAULT_COMBO = 1;
/** Window after `t` during which a tap still counts as "miss" (vs "expired silently"). */
const MISS_WINDOW_S = 0.25;

/**
 * Raw JSON-DSL shape — every field optional except `t`. Validation in `parseBeatmap`.
 * Kept loose so authors (human + onset-detector script) can omit defaults.
 */
interface RawBeatmap {
  track?: string;
  bpm?: number;
  duration?: number;
  manualTuned?: boolean;
  events?: Array<RawBeatEvent>;
}

interface RawBeatEvent {
  t?: number;
  x?: number;
  y?: number;
  type?: 'tap' | 'hold' | 'swipe';
  combo?: number;
  telegraph?: number;
}

/**
 * Fetch + parse a beatmap JSON. Throws if the file is unreachable or malformed —
 * caller should `try/catch` and fall back to "no beatmap, music plays without targets".
 */
export async function loadBeatmap(url: string): Promise<Beatmap> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`[beatmap] fetch ${url} → ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as RawBeatmap;
  return parseBeatmap(raw, url);
}

/**
 * Validate + normalise a raw JSON object into a Beatmap. Defaults applied,
 * events sorted ascending by `t`, invalid events filtered with a console warn.
 *
 * Exported for unit-tests and the offline tooling that may want to round-trip.
 */
export function parseBeatmap(raw: RawBeatmap, source = '<inline>'): Beatmap {
  if (typeof raw.track !== 'string' || raw.track.length === 0) {
    throw new Error(`[beatmap] ${source}: missing/empty "track"`);
  }
  if (typeof raw.duration !== 'number' || raw.duration <= 0) {
    throw new Error(`[beatmap] ${source}: missing/invalid "duration"`);
  }
  const events: BeatEvent[] = [];
  for (const ev of raw.events ?? []) {
    const t = ev.t;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) {
      // eslint-disable-next-line no-console
      console.warn(`[beatmap] ${source}: skipping event with invalid t=${String(t)}`);
      continue;
    }
    const type = ev.type ?? 'tap';
    if (type !== 'tap' && type !== 'hold' && type !== 'swipe') {
      // eslint-disable-next-line no-console
      console.warn(`[beatmap] ${source}: skipping event t=${t} with unknown type=${String(type)}`);
      continue;
    }
    events.push({
      t,
      x: clamp01(ev.x ?? 0.5),
      y: clamp01(ev.y ?? 1.0),
      type,
      combo: typeof ev.combo === 'number' && ev.combo > 0 ? ev.combo : DEFAULT_COMBO,
      telegraph:
        typeof ev.telegraph === 'number' && ev.telegraph > 0 ? ev.telegraph : DEFAULT_TELEGRAPH_S,
    });
  }
  events.sort((a, b) => a.t - b.t);
  return {
    track: raw.track,
    bpm: typeof raw.bpm === 'number' && raw.bpm > 0 ? raw.bpm : 0,
    duration: raw.duration,
    manualTuned: raw.manualTuned === true,
    events,
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Per-frame scheduler. Construct once per beatmap; call `update(audioTime)`
 * every frame from BeatScene. Spawns BeatTargets via `onSpawn` callback at
 * `t - telegraph`, and reports expirations via `onExpire` so the scene can
 * GC airborne targets the player ignored.
 *
 * Single-cursor walk → O(n) over the lifetime of the track. Re-emits cleanly
 * after a loop (audio.currentTime resets to ~0 → cursor resets to 0 too).
 */
export class BeatmapScheduler {
  private readonly beatmap: Beatmap;
  private readonly onSpawn: (event: BeatEvent) => void;
  private readonly onExpire: ((event: BeatEvent) => void) | null;
  /** Cursor into `beatmap.events`. Next event to (potentially) spawn. */
  private nextSpawnIdx = 0;
  /** Cursor into `beatmap.events`. Next event to (potentially) expire. */
  private nextExpireIdx = 0;
  /** Last observed audio-time. Used to detect backward jumps (loop). */
  private lastAudioTime = 0;

  constructor(
    beatmap: Beatmap,
    onSpawn: (event: BeatEvent) => void,
    onExpire?: (event: BeatEvent) => void,
  ) {
    this.beatmap = beatmap;
    this.onSpawn = onSpawn;
    this.onExpire = onExpire ?? null;
  }

  /**
   * Advance the scheduler. Call every frame with the current audio playhead.
   *
   * `audioTime` MUST come from the audio element (HTMLAudioElement.currentTime),
   * NOT performance.now(). See module-level docstring for rationale.
   */
  update(audioTime: number): void {
    // Loop detection — currentTime jumped backwards means the audio element
    // looped. Reset cursors so we re-emit from t=0.
    if (audioTime + 0.5 < this.lastAudioTime) {
      this.reset();
    }
    this.lastAudioTime = audioTime;

    const events = this.beatmap.events;

    // Spawn events whose telegraph window opened.
    while (this.nextSpawnIdx < events.length) {
      const ev = events[this.nextSpawnIdx];
      if (audioTime + 1e-3 < ev.t - ev.telegraph) break;
      this.onSpawn(ev);
      this.nextSpawnIdx++;
    }

    // Expire events past the miss-window — scene cleans up unhit targets.
    while (this.nextExpireIdx < events.length) {
      const ev = events[this.nextExpireIdx];
      if (audioTime <= ev.t + MISS_WINDOW_S) break;
      this.onExpire?.(ev);
      this.nextExpireIdx++;
    }
  }

  /**
   * Hard reset — call when changing tracks or after a manual seek.
   * Loop-detection inside `update()` handles the natural-loop case.
   */
  reset(): void {
    this.nextSpawnIdx = 0;
    this.nextExpireIdx = 0;
    this.lastAudioTime = 0;
  }

  /** Number of events still pending spawn. Useful for HUD/debug. */
  pendingCount(): number {
    return this.beatmap.events.length - this.nextSpawnIdx;
  }
}

/**
 * Resolve the per-track JSON URL given a track-key (matches the mp3 filename
 * without extension). Caller should pass through `assetPath()` so Vite's
 * `base` config is respected — same pattern as audioFFTBridge's MUSIC_TRACK.
 *
 *   import { assetPath } from '../core/assetPath';
 *   import { loadBeatmap, beatmapUrl } from '../audio/beatmap';
 *   const map = await loadBeatmap(assetPath(beatmapUrl('title-theme')));
 */
export function beatmapUrl(trackKey: string): string {
  return `assets/beatmaps/${trackKey}.json`;
}
