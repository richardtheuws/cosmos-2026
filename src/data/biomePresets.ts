/**
 * biomePresets.ts — biome definitions consumed by ParallaxScene and BiomeManager.
 *
 * Sprint 14B (background dedup): each biome now points at ONE pre-rendered 4K
 * image rather than a 4-layer slow-bloom stack. The earlier per-layer parallax
 * existed to fake depth from a flat skybox; the new 4K assets already paint
 * their own depth, so we only need a single plane per biome with a soft
 * camera-driven drift. Goodbye white-fringe blend-ghost.
 *
 * Differentiation between biomes is now: 4K image + ambient tint + post-FX curve.
 *
 * The legacy `slow-bloom-v2/`, `inkpool-hollow/`, etc. layer-set folders are
 * left in `public/` for now — they're not loaded anymore, but kept in dist
 * until a follow-up sprint cleans them out so we can roll back if needed.
 */

import { assetPath } from '../core/assetPath';

export interface BiomePostFXCurve {
  bloom: number;
  kaleido: number;
  fluid: number;
  chroma: number;
}

export interface Biome {
  id: BiomeId;
  label: string;
  /** Hex ambient tint (clear-color + ambient-plane). */
  ambient: number;
  /** Track BPM, used for autoplay-driven beat snapping in BeatScene (13B). */
  bpm: number;
  /** Public path of the music track (mp3). Read by BiomeManager. */
  trackUrl: string;
  /** Public path of the single 4K background image. */
  bgUrl: string;
  /** Soft horizontal drift multiplier — single plane, single value. */
  parallax: number;
  /** Vertical scale of the background plane (relative to ortho half-height). */
  scaleY: number;
  /** Post-FX intensity envelope per PRD §5. BiomeManager lerps these. */
  postFXCurve: BiomePostFXCurve;
}

export type BiomeId = 'slow-bloom' | 'inkpool' | 'cathedral' | 'boss';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Biome definitions                                                          */
/*                                                                             */
/*  Each biome has its own pre-rendered 4K image. Parallax + scaleY are tuned  */
/*  identically because the 4K crops are framed the same — tweak per-biome     */
/*  later if a particular asset frames tighter or looser than the others.      */
/* ────────────────────────────────────────────────────────────────────────── */

const PARALLAX_DRIFT = 0.30;
const PLANE_SCALE_Y = 1.2;

const SLOW_BLOOM: Biome = {
  id: 'slow-bloom',
  label: 'Slow Bloom',
  ambient: 0x1a1330,
  bpm: 86,
  trackUrl: assetPath('assets/audio/music/slow-bloom-loop.mp3'),
  bgUrl: assetPath('assets/backgrounds/biome-slow-bloom-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.6, kaleido: 0.2, fluid: 0.3, chroma: 0.5 },
};

const INKPOOL_HOLLOW: Biome = {
  id: 'inkpool',
  label: 'Inkpool Hollow',
  ambient: 0x140a26,
  bpm: 78,
  trackUrl: assetPath('assets/audio/music/inkpool-loop.mp3'),
  bgUrl: assetPath('assets/backgrounds/biome-inkpool-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.4, kaleido: 0.8, fluid: 0.7, chroma: 0.6 },
};

const CLOUD_CATHEDRAL: Biome = {
  id: 'cathedral',
  label: 'Cloud Cathedral',
  ambient: 0x2a1a4a,
  bpm: 92,
  trackUrl: assetPath('assets/audio/music/title-theme.mp3'),
  bgUrl: assetPath('assets/backgrounds/biome-cathedral-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 1.0, kaleido: 0.6, fluid: 0.4, chroma: 0.7 },
};

const BOSS_STINGER: Biome = {
  id: 'boss',
  label: 'Boss Stinger',
  ambient: 0x3a1232,
  bpm: 96,
  trackUrl: assetPath('assets/audio/music/boss-stinger.mp3'),
  bgUrl: assetPath('assets/backgrounds/biome-boss-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.8, kaleido: 0.5, fluid: 0.6, chroma: 1.0 },
};

export const BIOMES = {
  'slow-bloom': SLOW_BLOOM,
  'inkpool': INKPOOL_HOLLOW,
  'cathedral': CLOUD_CATHEDRAL,
  'boss': BOSS_STINGER,
} as const;

/** Default cycle order. PRD §13.1 — slow-bloom opens (rustigste), title as climax. */
export const BIOME_CYCLE_ORDER: readonly BiomeId[] = [
  'slow-bloom',
  'inkpool',
  'cathedral',
  'boss',
];
