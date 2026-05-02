/**
 * biomePresets.ts — biome definitions consumed by ParallaxScene and BiomeManager.
 *
 * Sprint 13C scope: 4 biomes per PRD §5, each with a track URL + post-FX
 * intensity envelope (bloom/kaleido/fluid/chroma 0..1 multipliers) so the
 * BiomeManager can crossfade `globalUniforms.biomeIntensity` between them.
 *
 * Note on backgrounds: pitch-D's asset-audit decided to ship a single
 * parallax base (`slow-bloom-v2/*`) and let post-FX do the biome differentiation.
 * To still give Inkpool/Cathedral/Boss-Stinger a distinct mood we attach a
 * subtle hue-shift tint per biome (used by ParallaxScene as a clear-color +
 * ambientPlane multiplier). Asset-set duplication is a 13D follow-up if needed.
 */

import { assetPath } from '../core/assetPath';

export interface BiomeLayer {
  url: string;
  parallax: number;
  depth: number;
  scaleY: number;
  blend?: 'normal' | 'multiply' | 'additive';
}

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
  sky?: BiomeLayer;
  far: BiomeLayer;
  mid: BiomeLayer;
  near: BiomeLayer;
  /** Post-FX intensity envelope per PRD §5. BiomeManager lerps these. */
  postFXCurve: BiomePostFXCurve;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared parallax stack                                                      */
/*                                                                             */
/*  All 4 biomes use the same 4-layer slow-bloom-v2 set; differentiation comes */
/*  from `ambient` tint + post-FX curve. Each biome's layer-set is a fresh     */
/*  object so future per-biome tweaks (e.g. boss biome on a different image)   */
/*  don't have to refactor the data shape.                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function baseLayers(): {
  sky: BiomeLayer;
  far: BiomeLayer;
  mid: BiomeLayer;
  near: BiomeLayer;
} {
  return {
    sky: {
      url: '/assets/backgrounds/slow-bloom-v2/bg-sky.png',
      parallax: 0.10,
      depth: -14,
      scaleY: 1.8,
    },
    far: {
      url: '/assets/backgrounds/slow-bloom-v2/bg-far.png',
      parallax: 0.25,
      depth: -10,
      scaleY: 1.5,
    },
    mid: {
      url: '/assets/backgrounds/slow-bloom-v2/bg-mid.png',
      parallax: 0.50,
      depth: -5,
      scaleY: 1.25,
    },
    near: {
      url: '/assets/backgrounds/slow-bloom-v2/bg-near-v2.png',
      parallax: 0.85,
      depth: -2,
      scaleY: 0.85,
    },
  };
}

const SLOW_BLOOM: Biome = {
  id: 'slow-bloom',
  label: 'Slow Bloom',
  ambient: 0x1a1330,
  bpm: 86,
  trackUrl: assetPath('assets/audio/music/slow-bloom-loop.mp3'),
  ...baseLayers(),
  postFXCurve: { bloom: 0.6, kaleido: 0.2, fluid: 0.3, chroma: 0.5 },
};

const INKPOOL_HOLLOW: Biome = {
  id: 'inkpool',
  label: 'Inkpool Hollow',
  ambient: 0x140a26,
  bpm: 78,
  trackUrl: assetPath('assets/audio/music/inkpool-loop.mp3'),
  ...baseLayers(),
  postFXCurve: { bloom: 0.4, kaleido: 0.8, fluid: 0.7, chroma: 0.6 },
};

const CLOUD_CATHEDRAL: Biome = {
  id: 'cathedral',
  label: 'Cloud Cathedral',
  ambient: 0x2a1a4a,
  bpm: 92,
  trackUrl: assetPath('assets/audio/music/title-theme.mp3'),
  ...baseLayers(),
  postFXCurve: { bloom: 1.0, kaleido: 0.6, fluid: 0.4, chroma: 0.7 },
};

const BOSS_STINGER: Biome = {
  id: 'boss',
  label: 'Boss Stinger',
  ambient: 0x3a1232,
  bpm: 96,
  trackUrl: assetPath('assets/audio/music/boss-stinger.mp3'),
  ...baseLayers(),
  postFXCurve: { bloom: 0.8, kaleido: 0.5, fluid: 0.6, chroma: 1.0 },
};

export const BIOMES = {
  'slow-bloom': SLOW_BLOOM,
  'inkpool': INKPOOL_HOLLOW,
  'cathedral': CLOUD_CATHEDRAL,
  'boss': BOSS_STINGER,
} as const;

export type BiomeId = 'slow-bloom' | 'inkpool' | 'cathedral' | 'boss';

/** Default cycle order. PRD §13.1 — slow-bloom opens (rustigste), title as climax. */
export const BIOME_CYCLE_ORDER: readonly BiomeId[] = [
  'slow-bloom',
  'inkpool',
  'cathedral',
  'boss',
];
