/**
 * Biome → 3-layer parallax background config. Per level the scene picks one
 * biome and feeds the file paths into ParallaxScene.loadBiome().
 *
 * Each layer has a parallax multiplier (camera-x scaling) and a scaleY hint
 * for how big the plane should render in the orthographic view.
 */

export type BlendMode = 'normal' | 'multiply' | 'additive';

export interface BiomeLayer {
  url: string;
  parallax: number;
  depth: number;
  scaleY: number;
  /** Compositing mode. `multiply` lets light centers fade to transparent — used
   *  for foreground frame layers that have white-ish empty centers around dark
   *  edge silhouettes. */
  blend?: BlendMode;
}

export interface Biome {
  id: string;
  label: string;
  /** Tint colour applied to the Three.js clear-color when no layers cover. */
  ambient: number;
  /** Optional sky layer at the back — slowest parallax, no transparency. */
  sky?: BiomeLayer;
  far: BiomeLayer;
  mid: BiomeLayer;
  near: BiomeLayer;
}

const SLOW_BLOOM: Biome = {
  id: 'slow-bloom',
  label: 'Slow Bloom — Bloomroot Veld',
  ambient: 0x1a1330,
  sky: {
    url: '/assets/backgrounds/slow-bloom-v2/bg-sky.png',
    parallax: 0.10,
    depth: -14,
    scaleY: 1.8,
    blend: 'normal',
  },
  far: {
    url: '/assets/backgrounds/slow-bloom-v2/bg-far.png',
    parallax: 0.25,
    depth: -10,
    scaleY: 1.5,
    blend: 'normal',
  },
  mid: {
    url: '/assets/backgrounds/slow-bloom-v2/bg-mid.png',
    parallax: 0.50,
    depth: -5,
    scaleY: 1.25,
    blend: 'normal',
  },
  near: {
    url: '/assets/backgrounds/slow-bloom-v2/bg-near.png',
    parallax: 0.85,
    depth: -2,
    scaleY: 1.1,
    blend: 'normal',
  },
};

const INKPOOL_HOLLOW: Biome = {
  id: 'inkpool-hollow',
  label: 'Inkpool Hollow',
  ambient: 0x2a2238,
  far: {
    url: '/assets/backgrounds/inkpool-hollow/bg-far.png',
    parallax: 0.18,
    depth: -10,
    scaleY: 1.6,
    blend: 'normal',
  },
  mid: {
    url: '/assets/backgrounds/inkpool-hollow/bg-mid.png',
    parallax: 0.42,
    depth: -5,
    scaleY: 1.3,
    blend: 'normal',
  },
  near: {
    url: '/assets/backgrounds/inkpool-hollow/bg-near.png',
    parallax: 0.78,
    depth: -2,
    scaleY: 1.1,
    blend: 'normal',
  },
};

const CLOUD_CATHEDRAL: Biome = {
  id: 'cloud-cathedral',
  label: 'Cloud Cathedral',
  ambient: 0xc4d4eb,
  far: {
    url: '/assets/backgrounds/cloud-cathedral/bg-far.png',
    parallax: 0.18,
    depth: -10,
    scaleY: 1.6,
    blend: 'normal',
  },
  mid: {
    url: '/assets/backgrounds/cloud-cathedral/bg-mid.png',
    parallax: 0.42,
    depth: -5,
    scaleY: 1.3,
    blend: 'normal',
  },
  near: {
    url: '/assets/backgrounds/cloud-cathedral/bg-near.png',
    parallax: 0.78,
    depth: -2,
    scaleY: 1.1,
    blend: 'normal',
  },
};

export const BIOMES = {
  'slow-bloom': SLOW_BLOOM,
  'inkpool-hollow': INKPOOL_HOLLOW,
  'cloud-cathedral': CLOUD_CATHEDRAL,
} as const;

export type BiomeId = keyof typeof BIOMES;

/** Mapping from level index to its biome. Per PRD §4.2. */
export const LEVEL_TO_BIOME: Record<number, BiomeId> = {
  1: 'slow-bloom',
  2: 'slow-bloom',
  3: 'slow-bloom',
  4: 'inkpool-hollow',
  5: 'inkpool-hollow',
  6: 'inkpool-hollow',
  7: 'cloud-cathedral',
  8: 'cloud-cathedral',
  9: 'cloud-cathedral',
  10: 'cloud-cathedral',
};
