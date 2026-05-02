/**
 * biomePresets.ts — biome definitions consumed by ParallaxScene and BiomeManager.
 *
 * Sprint 17F (composition-spec rendering): each biome now declares a
 * `compositionSpecUrl` pointing at a per-biome JSON file (Sprint 17C deliverable)
 * which lists 5-7 layered PNG textures with parallax / scale / offset / blend
 * metadata. ParallaxScene loads the spec at biome-load time and builds a stack
 * of THREE.PlaneGeometry layers from it. The single 4K plane from Sprint 14B is
 * kept as `bgUrl` legacy fallback — if the spec fails to load, we still render
 * the old single-image biome so the app degrades gracefully.
 *
 * Sprint 17F also introduces `decorationSpots` — fixed scene-static placements
 * for the Sprint 15C weirdo objects (mouth-pillar, eyeball-sentry, etc.) so
 * each biome reads as a place rather than a backdrop. These ride alongside the
 * layer-stack on a separate Z plane and don't parallax (they move with the
 * camera so the player feels them as inhabitants of the scene).
 */

import { assetPath } from '../core/assetPath';

export interface BiomePostFXCurve {
  bloom: number;
  kaleido: number;
  fluid: number;
  chroma: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Composition-spec types (mirror of 17C JSON schema)                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type BlendMode = 'normal' | 'additive' | 'multiply';
export type LayerRole = 'sky' | 'distant' | 'mid-a' | 'mid-b' | 'foreground' | 'fg' | 'particle' | 'creature';

/** One parallax-layer record. Field-naming uses camelCase in TS even though
 *  the JSON on disk uses snake_case — `loadBiomeCompositionSpec()` translates. */
export interface BiomeLayer {
  /** File-name relative to the biome folder (e.g. `layer-1_sky-gradient.png`). */
  file: string;
  parallaxMultiplier: number;
  scale: number;
  xOffset: number;
  yOffset: number;
  zPosition: number;
  blendMode: BlendMode;
  opacity: number;
  role: LayerRole;
}

/** Sprint 17F decoration record. Static (no parallax) Sprint 15C weirdo prop
 *  parked at a fixed position in the scene, so each biome has 2-3 inhabitants. */
export interface DecorationSpot {
  /** Sprint 15C weirdo asset id. Matches `weirdoObstacleFactory` SPECS keys. */
  id: 'mouth-pillar' | 'eyeball-sentry' | 'upside-down-tree' | 'breathing-portal' |
      'melting-clock-bubble' | 'secret-crystal' | 'organic-flesh-trampoline' | 'floating-star';
  x: number;
  y: number;
  z: number;
  /** Optional uniform scale multiplier (default 1.0). Useful to e.g. shrink a
   *  background mouth-pillar so it reads as distant. */
  scale?: number;
}

export interface BiomeCompositionSpec {
  biomeId: string;
  frameSize: { width: number; height: number };
  layers: readonly BiomeLayer[];
  /** Sprint 17F — populated from per-biome JSON `decoration_spots[]` if
   *  present; main.ts merges with the code-side defaults so a biome that
   *  hasn't been edited yet still gets sensible inhabitants. */
  decorationSpots?: readonly DecorationSpot[];
}

export interface Biome {
  id: BiomeId;
  label: string;
  /** Hex ambient tint (clear-color + ambient-plane). */
  ambient: number;
  /** Track BPM, used for mouth-pillar frame-cycling and beat snapping. */
  bpm: number;
  /** Public path of the music track (mp3). Read by BiomeManager. */
  trackUrl: string;
  /** Sprint 17F — public path of the composition-spec.json. ParallaxScene
   *  fetches this at load-time. */
  compositionSpecUrl: string;
  /** Legacy fallback — single 4K image, used iff the spec fetch / parse
   *  fails. Kept so an empty `public/assets/backgrounds/biome-{id}/` folder
   *  doesn't paint a black scene during dev. */
  bgUrl: string;
  /** Soft horizontal drift multiplier — fallback for the legacy single plane. */
  parallax: number;
  /** Vertical scale of the legacy fallback plane. */
  scaleY: number;
  /** Post-FX intensity envelope per PRD §5. BiomeManager lerps these. */
  postFXCurve: BiomePostFXCurve;
  /** Sprint 17F — code-side default decoration spots. ParallaxScene appends
   *  these onto whatever the spec JSON defines (spec-defined wins on duplicate
   *  ids). Per the brief, every biome gets 2-3 inhabitants chosen for theme. */
  decorationSpots: readonly DecorationSpot[];
}

export type BiomeId = 'slow-bloom' | 'inkpool' | 'cathedral' | 'boss';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Biome definitions                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const PARALLAX_DRIFT = 0.30;
const PLANE_SCALE_Y = 1.2;

const SLOW_BLOOM: Biome = {
  id: 'slow-bloom',
  label: 'Slow Bloom',
  ambient: 0x1a1330,
  bpm: 86,
  trackUrl: assetPath('assets/audio/music/slow-bloom-loop.mp3'),
  compositionSpecUrl: assetPath('assets/backgrounds/biome-slow-bloom/composition-spec.json'),
  bgUrl: assetPath('assets/backgrounds/biome-slow-bloom-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.6, kaleido: 0.2, fluid: 0.3, chroma: 0.5 },
  decorationSpots: [
    // Brief: linksboven upside-down-tree, rechts diep eyeball-sentry, mid-air floating-star
    { id: 'upside-down-tree', x: -1.6, y: 1.2, z: -2.0 },
    { id: 'eyeball-sentry', x: 1.8, y: 0.6, z: -3.5, scale: 0.85 },
    { id: 'floating-star', x: 0.2, y: 0.9, z: -1.2 },
  ],
};

const INKPOOL_HOLLOW: Biome = {
  id: 'inkpool',
  label: 'Inkpool Hollow',
  ambient: 0x140a26,
  bpm: 78,
  trackUrl: assetPath('assets/audio/music/inkpool-loop.mp3'),
  compositionSpecUrl: assetPath('assets/backgrounds/biome-inkpool/composition-spec.json'),
  bgUrl: assetPath('assets/backgrounds/biome-inkpool-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.4, kaleido: 0.8, fluid: 0.7, chroma: 0.6 },
  decorationSpots: [
    // Brief: achterwand breathing-portal, drift left-right melting-clock-bubble, eyeball-sentry
    { id: 'breathing-portal', x: 0.0, y: 0.6, z: -3.2 },
    { id: 'melting-clock-bubble', x: -1.4, y: 1.0, z: -1.8 },
    { id: 'eyeball-sentry', x: 1.5, y: 0.5, z: -2.5, scale: 0.9 },
  ],
};

const CLOUD_CATHEDRAL: Biome = {
  id: 'cathedral',
  label: 'Cloud Cathedral',
  ambient: 0x2a1a4a,
  bpm: 92,
  trackUrl: assetPath('assets/audio/music/title-theme.mp3'),
  compositionSpecUrl: assetPath('assets/backgrounds/biome-cathedral/composition-spec.json'),
  bgUrl: assetPath('assets/backgrounds/biome-cathedral-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 1.0, kaleido: 0.6, fluid: 0.4, chroma: 0.7 },
  decorationSpots: [
    // Brief: skybox breathing-portal, hangt-vanaf-top upside-down-tree, floating-star
    { id: 'breathing-portal', x: 0.4, y: 1.4, z: -3.6, scale: 1.1 },
    { id: 'upside-down-tree', x: -1.2, y: 1.5, z: -2.2 },
    { id: 'floating-star', x: 1.4, y: 1.1, z: -1.5 },
  ],
};

const BOSS_STINGER: Biome = {
  id: 'boss',
  label: 'Boss Stinger',
  ambient: 0x3a1232,
  bpm: 96,
  trackUrl: assetPath('assets/audio/music/boss-stinger.mp3'),
  compositionSpecUrl: assetPath('assets/backgrounds/biome-boss/composition-spec.json'),
  bgUrl: assetPath('assets/backgrounds/biome-boss-4k.png'),
  parallax: PARALLAX_DRIFT,
  scaleY: PLANE_SCALE_Y,
  postFXCurve: { bloom: 0.8, kaleido: 0.5, fluid: 0.6, chroma: 1.0 },
  decorationSpots: [
    // Brief: secret-crystal hidden tot kaleido > 0.8, mouth-pillar, eyeball-sentry
    { id: 'secret-crystal', x: 0.0, y: 0.9, z: -1.0 },
    { id: 'mouth-pillar', x: -1.5, y: 0.0, z: -2.4 },
    { id: 'eyeball-sentry', x: 1.6, y: 0.7, z: -2.8, scale: 0.9 },
  ],
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Composition-spec loader                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** JSON-on-disk schema (snake_case, matches Sprint 17C output). */
interface CompositionSpecJSON {
  biome_id: string;
  frame_size: { width: number; height: number };
  layers: Array<{
    file: string;
    parallax_multiplier: number;
    scale: number;
    x_offset: number;
    y_offset: number;
    z_position: number;
    blend_mode: string;
    opacity: number;
    role: string;
  }>;
  decoration_spots?: Array<{ id: string; x: number; y: number; z: number; scale?: number }>;
}

/**
 * Fetch & translate a composition-spec.json into the camelCase TS shape.
 * Throws on network / parse errors so the caller can fall back to bgUrl.
 *
 * Folder of the spec is derived from the URL — layer files resolve relative
 * to that folder (`layer-1_sky-gradient.png` → same dir as the spec).
 */
export async function loadBiomeCompositionSpec(specUrl: string): Promise<BiomeCompositionSpec & { folder: string }> {
  const res = await fetch(specUrl, { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`compositionSpec: HTTP ${res.status} on ${specUrl}`);
  }
  const json = (await res.json()) as CompositionSpecJSON;
  // The folder containing the spec — every layer file is sibling to it.
  const folder = specUrl.replace(/\/[^/]+$/, '');
  const layers: BiomeLayer[] = json.layers.map((l) => ({
    file: l.file,
    parallaxMultiplier: l.parallax_multiplier,
    scale: l.scale,
    xOffset: l.x_offset,
    yOffset: l.y_offset,
    zPosition: l.z_position,
    blendMode: normalizeBlend(l.blend_mode),
    opacity: l.opacity,
    role: normalizeRole(l.role),
  }));
  const decorationSpots: DecorationSpot[] | undefined = json.decoration_spots?.map((d) => ({
    id: d.id as DecorationSpot['id'],
    x: d.x,
    y: d.y,
    z: d.z,
    scale: d.scale,
  }));
  return {
    biomeId: json.biome_id,
    frameSize: json.frame_size,
    layers,
    decorationSpots,
    folder,
  };
}

function normalizeBlend(s: string): BlendMode {
  if (s === 'additive') return 'additive';
  if (s === 'multiply') return 'multiply';
  return 'normal';
}

function normalizeRole(s: string): LayerRole {
  switch (s) {
    case 'sky':
    case 'distant':
    case 'mid-a':
    case 'mid-b':
    case 'foreground':
    case 'fg':
    case 'particle':
    case 'creature':
      return s as LayerRole;
    default:
      return 'mid-a';
  }
}
