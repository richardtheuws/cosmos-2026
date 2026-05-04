/**
 * Mood resolver per architect §1.2 + §3.2.
 *
 * Universe-default mood ← manifest.post (preset → palette + intensity curve).
 * Area-override mood    ← areas[i].moodOverrides (partial — keys absent inherit).
 * Room-override mood    ← (future, currently always inherit).
 *
 * Output is a fully-resolved `ResolvedMood` the substrate writes to
 * `globalUniforms.biomeIntensity` on room enter.
 */
import type {
  AreaMoodOverrides,
  AreaSpec,
  Manifest,
  PostFXIntensity,
  PostPreset,
  ResolvedMood,
  RoomSpec,
} from './contracts/BehaviorContract';

/**
 * Preset-derived defaults. The architect doc anchors these to the locked
 * palette in NORTH-STAR §3 — saffron-glow / faded-rose / ink-aubergine are
 * the principal accents per preset. The substrate carries these so a JSON-only
 * universe with `post.preset = 'calm-baseline'` still gets a real palette.
 */
const PRESET_PALETTES: Record<PostPreset, { ambient: string; primary: string; intensity: PostFXIntensity }> = {
  'calm-baseline': {
    ambient: '#F5EDD8',
    primary: '#D8A4B5',
    intensity: { bloom: 1.0, kaleido: 0.85, fluid: 0.9, chroma: 1.0 },
  },
  'deep-trip': {
    ambient: '#1B0F2A',
    primary: '#3D2E4A',
    intensity: { bloom: 1.4, kaleido: 1.3, fluid: 1.2, chroma: 1.4 },
  },
  neutral: {
    ambient: '#2A1A4A',
    primary: '#9FC6FF',
    intensity: { bloom: 1.0, kaleido: 1.0, fluid: 1.0, chroma: 1.0 },
  },
};

export function resolveMood(manifest: Manifest, area: AreaSpec, _room?: RoomSpec): ResolvedMood {
  const preset = manifest.post.preset;
  const palette = PRESET_PALETTES[preset] ?? PRESET_PALETTES['calm-baseline'];
  const universeIntensity: PostFXIntensity = {
    ...palette.intensity,
    ...(manifest.post.intensityCurve ?? {}),
  };

  const overrides: AreaMoodOverrides = area.moodOverrides ?? {};
  const ambient = overrides.ambient ?? palette.ambient;
  const primary = overrides.primary ?? palette.primary;
  const post: PostFXIntensity = {
    bloom: overrides.post?.bloom ?? universeIntensity.bloom,
    kaleido: overrides.post?.kaleido ?? universeIntensity.kaleido,
    fluid: overrides.post?.fluid ?? universeIntensity.fluid,
    chroma: overrides.post?.chroma ?? universeIntensity.chroma,
  };

  // Room-level overrides reserved for a later wave — RoomSpec has no
  // moodOverrides field today, but the substrate is plumbed for it.
  void _room;

  return { ambient, primary, post };
}
