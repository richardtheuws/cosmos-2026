/**
 * weirdoObstacleFactory — Sprint 15E + 16C + 16E.
 *
 * Replaces ObstacleManager's canvas-primitive defaults with the 8 fal.ai-
 * generated weirdo objects from Sprint 15C. Each obstacle kind picks a
 * *weighted-random* pool member so the playthrough never feels repetitive
 * AND gameplay-anchors (trampoline) show up regularly.
 *
 * Per-kind weighted pool (Sprint 16E):
 *   low   → organic-flesh-trampoline (40%, gameplay-anchor) | floating-star (60%)
 *   tall  → eyeball-sentry (33%) | upside-down-tree (33%) | mouth-pillar (34%)
 *   gap   → breathing-portal (50%) | melting-clock-bubble (50%)
 *           + secret-crystal (weight 30) — ONLY appended when kaleidoTrigger > 0.8
 *
 * `secret-crystal` is the trippy-peak Easter egg. Per spec it must NOT appear
 * during normal play — only when DeepTripMode/power-up has pushed
 * `kaleidoTrigger` above 0.8. The factory therefore reads the live
 * GlobalUniforms (via `getKaleidoTrigger` callback) at the moment of each
 * spawn and conditionally rebuilds the gap-pool. If the callback is omitted
 * the crystal is permanently hidden.
 *
 * Sprint 16C — mouth-pillar uses a 1024×512 4-frame horizontal sprite-sheet
 * (256×512 per frame: closed → quarter → half → open). We clone the texture
 * and use `repeat.x = 0.25 + offset.x = frame * 0.25` so only one frame is
 * visible at a time, cycled on the beat (BPM-derived).
 *
 * Textures are loaded once at boot via THREE.TextureLoader and cached. Each
 * obstacle is a billboarded plane with the texture mapped on it — keeps the
 * 3D scene mobile-fast while letting the watercolor weirdness read clearly.
 */
import * as THREE from 'three';
import { assetPath } from '../../core/assetPath';
import type { ObstacleKind, ObstacleFactory } from './ObstacleManager';

interface ObstacleSpec {
  url: string;
  width: number;
  height: number;
  yOffset: number;
  /** Sprint 16C — when set, treat the texture as a horizontal sprite-sheet. */
  sheet?: {
    frames: number;
    /** Cycle period in beats — full open-close cycle (0→1→2→3→2→1→0 = 6 steps). */
    beatsPerCycle: number;
  };
}

interface WeightedEntry {
  id: string;
  weight: number;
}

/** Spec per asset (file → 3D plane size in world-units, anchored to ground). */
const SPECS: Record<string, ObstacleSpec> = {
  // low (crouchable / collectible) — short ground-anchored items
  'organic-flesh-trampoline': { url: 'assets/objects/organic-flesh-trampoline.png', width: 1.0, height: 0.6, yOffset: 0.3 },
  'floating-star': { url: 'assets/objects/floating-star.png', width: 0.5, height: 0.5, yOffset: 0.6 },
  // tall (jumpable) — pillar/tree/sentry
  'eyeball-sentry': { url: 'assets/objects/eyeball-sentry.png', width: 0.7, height: 0.7, yOffset: 1.1 },
  'upside-down-tree': { url: 'assets/objects/upside-down-tree.png', width: 1.0, height: 1.6, yOffset: 0.8 },
  'mouth-pillar': {
    url: 'assets/objects/mouth-pillar-sheet.png',
    width: 0.7,
    height: 1.5,
    yOffset: 0.75,
    // 4 frames; full open-close ping-pong (closed→quarter→half→open→half→quarter)
    // takes 6 sub-steps. At beatsPerCycle=6 we step 1 frame per beat → at
    // 92 BPM that's ~3.9s per full breath, smooth and ritmic without flicker.
    sheet: { frames: 4, beatsPerCycle: 6 },
  },
  // gap (visual cue mid-air) — portals and crystals
  'breathing-portal': { url: 'assets/objects/breathing-portal.png', width: 1.0, height: 1.0, yOffset: 0.7 },
  'secret-crystal': { url: 'assets/objects/secret-crystal.png', width: 0.6, height: 0.6, yOffset: 0.6 },
  'melting-clock-bubble': { url: 'assets/objects/melting-clock-bubble.png', width: 0.8, height: 0.8, yOffset: 0.9 },
};

/** Sprint 16E weighted pools — see file header for rationale.
 *  `secret-crystal` is intentionally absent here; it's appended at spawn-time
 *  when `kaleidoTrigger > 0.8` (see KALEIDO_REVEAL_THRESHOLD below). */
const WEIGHTED_POOL: Record<ObstacleKind, readonly WeightedEntry[]> = {
  low: [
    { id: 'organic-flesh-trampoline', weight: 40 },
    { id: 'floating-star', weight: 60 },
  ],
  tall: [
    { id: 'eyeball-sentry', weight: 33 },
    { id: 'upside-down-tree', weight: 33 },
    { id: 'mouth-pillar', weight: 34 },
  ],
  gap: [
    { id: 'breathing-portal', weight: 50 },
    { id: 'melting-clock-bubble', weight: 50 },
  ],
};

/** Threshold for unlocking the hidden secret-crystal in the gap pool. */
const KALEIDO_REVEAL_THRESHOLD = 0.8;
/** Weight of secret-crystal when it becomes available (relative to the base 100 of gap pool). */
const SECRET_CRYSTAL_WEIGHT = 30;

/** Default BPM passed into the mouth-pillar's frame-cycler when the
 *  ObstacleManager doesn't supply a biome-specific BPM via group.userData. */
const DEFAULT_BPM = 92;

const cache = new Map<string, THREE.Texture>();

function loadTextureCached(loader: THREE.TextureLoader, url: string): THREE.Texture {
  const cached = cache.get(url);
  if (cached) return cached;
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(url, tex);
  return tex;
}

/** Cumulative-weight selection over a non-empty entries list. */
function pickWeighted(entries: readonly WeightedEntry[]): string {
  let total = 0;
  for (const e of entries) total += e.weight;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.id;
  }
  // Numerical fallback — very last entry.
  return entries[entries.length - 1].id;
}

/**
 * Sprint 16C — derive sprite-sheet frame index from audio-clock + BPM.
 *
 * 4 frames cycled in a ping-pong pattern (closed → open → closed) so the
 * mouth visually breathes rather than snapping back. 6 sub-steps total:
 *   step:  0  1  2  3  4  5
 *   frame: 0  1  2  3  2  1
 */
function pingPongFrame(audioNow: number, bpm: number, frames: number): number {
  if (audioNow <= 0 || bpm <= 0) return 0;
  const beatPeriod = 60 / bpm;
  // Slow the cycle: 1 frame-step every 2 beats → smooth open/close.
  const step = Math.floor(audioNow / (beatPeriod * 1)) % (frames * 2 - 2);
  // ping-pong: 0,1,2,3,2,1
  return step < frames ? step : frames * 2 - 2 - step;
}

export interface WeirdoFactoryOptions {
  /**
   * Returns the live `kaleidoTrigger` (0..1). When > 0.8 the gap pool unlocks
   * the secret-crystal entry. If omitted, the crystal is permanently hidden.
   */
  getKaleidoTrigger?: () => number;
}

/** Factory return type — same call-shape as ObstacleFactory plus a debug
 *  read-out of the most recently produced asset id (used by ObstacleManager
 *  for anti-repeat). */
export type WeirdoObstacleFactory = ObstacleFactory & {
  lastSpawnedId: () => string | null;
};

/**
 * Returns an ObstacleFactory that produces THREE.Group billboards using
 * the Sprint 15C generated PNGs. The factory pre-loads all textures on first
 * call so per-spawn cost is just a Group + Mesh allocation.
 *
 * Sprint 16E — accepts an options bag with `getKaleidoTrigger` so the gap-
 * pool can conditionally include the hidden secret-crystal. Also exposes
 * `lastSpawnedId()` so ObstacleManager can implement anti-repeat without
 * leaking factory internals.
 */
export function createWeirdoObstacleFactory(
  options: WeirdoFactoryOptions = {},
): WeirdoObstacleFactory {
  const loader = new THREE.TextureLoader();
  // Pre-warm so the very first spawn doesn't pop.
  for (const spec of Object.values(SPECS)) {
    loadTextureCached(loader, assetPath(spec.url));
  }

  let lastId: string | null = null;

  const factory = ((kind: ObstacleKind): THREE.Group => {
    // Build the effective pool. For 'gap', conditionally append secret-crystal
    // when the live kaleidoTrigger has crossed the reveal threshold.
    let pool: readonly WeightedEntry[] = WEIGHTED_POOL[kind];
    if (kind === 'gap' && options.getKaleidoTrigger) {
      const k = options.getKaleidoTrigger();
      if (k > KALEIDO_REVEAL_THRESHOLD) {
        pool = [...pool, { id: 'secret-crystal', weight: SECRET_CRYSTAL_WEIGHT }];
      }
    }

    const id = pickWeighted(pool);
    lastId = id;
    const spec = SPECS[id];
    const baseTex = loadTextureCached(loader, assetPath(spec.url));

    const group = new THREE.Group();
    // Tag the group so external systems (debug overlays) can read which weirdo
    // this is without unwrapping the mesh. ObstacleManager prefers the
    // factory-level lastSpawnedId() callback.
    group.userData.weirdoId = id;
    const geo = new THREE.PlaneGeometry(spec.width, spec.height);

    // Sprint 16C — sheet objects need their OWN texture instance so that
    // repeat/offset doesn't bleed across other live mouth-pillars.
    let mat: THREE.MeshBasicMaterial;
    if (spec.sheet) {
      const tex = baseTex.clone();
      tex.needsUpdate = true;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const inv = 1 / spec.sheet.frames;
      tex.repeat.set(inv, 1);
      tex.offset.set(0, 0);
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
      const sheet = spec.sheet;
      // Per-frame callback used by ObstacleManager.update() — keeps the
      // factory output self-contained (no obstacle-manager-side switch).
      group.userData.mouthFrameUpdate = (audioNow: number, bpm = DEFAULT_BPM): void => {
        const frame = pingPongFrame(audioNow, bpm, sheet.frames);
        tex.offset.x = frame * inv;
      };
    } else {
      mat = new THREE.MeshBasicMaterial({
        map: baseTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = spec.yOffset;
    // Slight random Z-rotation so identical sprites don't read as cloned.
    mesh.rotation.z = (Math.random() - 0.5) * 0.08;
    group.add(mesh);
    return group;
  }) as WeirdoObstacleFactory;

  factory.lastSpawnedId = () => lastId;
  return factory;
}
