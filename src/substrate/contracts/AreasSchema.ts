/**
 * Hand-rolled `areas.json` validator. Same dev/prod-split as ManifestSchema.
 *
 * Per punch-list #1 (resolution): unknown `pathExperience.kind` values are
 * tolerated in dev (warning + the runtime falls back to default biome-blend
 * driver), but in prod-strict mode a value outside the canonical list throws
 * so the SubstrateLoader can fall back to forest with a clean error.
 */
import type {
  AreasManifest,
  AreaSpec,
  AreaMoodOverrides,
  PathExperience,
} from './BehaviorContract';
import {
  asArray,
  asNumber,
  asObject,
  asString,
  optString,
  throwOrWarn,
  type ValidateOptions,
} from './ManifestSchema';

const KNOWN_PATH_KINDS = new Set(['mushroom-path', 'burrow-down', 'drift', 'fade']);

export function validateAreasManifest(raw: unknown, opts: ValidateOptions): AreasManifest {
  const r = asObject(raw, opts, opts.source);
  const version = asString(r.version, opts, `${opts.source}.version`, '1.0');
  const entryArea = asString(r.entryArea, opts, `${opts.source}.entryArea`, 'entry');

  const areas = asArray(r.areas, opts, `${opts.source}.areas`).map((a, i) =>
    validateArea(a, { ...opts, source: `${opts.source}.areas[${i}]` }),
  );

  if (areas.length === 0) {
    throwOrWarn(opts, 'areas.json declares zero areas — every Universe needs at least one');
  }

  return { version, entryArea, areas };
}

function validateArea(raw: unknown, opts: ValidateOptions): AreaSpec {
  const r = asObject(raw, opts, opts.source);
  const id = asString(r.id, opts, `${opts.source}.id`, 'area');
  const displayName = asString(r.displayName, opts, `${opts.source}.displayName`, id);
  const displayNameEn = optString(r.displayNameEn);
  const description = optString(r.description);

  const moodOverrides =
    r.moodOverrides == null
      ? null
      : validateMoodOverrides(r.moodOverrides, { ...opts, source: `${opts.source}.moodOverrides` });

  const pathExperience = validatePathExperience(r.pathExperience, {
    ...opts,
    source: `${opts.source}.pathExperience`,
  });

  const rooms = asArray(r.rooms, opts, `${opts.source}.rooms`).map((s, i) =>
    asString(s, opts, `${opts.source}.rooms[${i}]`, ''),
  );

  return { id, displayName, displayNameEn, description, moodOverrides, pathExperience, rooms };
}

function validateMoodOverrides(raw: unknown, opts: ValidateOptions): AreaMoodOverrides {
  const r = asObject(raw, opts, opts.source);
  const out: AreaMoodOverrides = {};
  if (typeof r.ambient === 'string') out.ambient = r.ambient;
  if (typeof r.primary === 'string') out.primary = r.primary;
  if (r.post && typeof r.post === 'object') {
    const p = r.post as Record<string, unknown>;
    out.post = {
      ...(typeof p.bloom === 'number' ? { bloom: p.bloom } : {}),
      ...(typeof p.kaleido === 'number' ? { kaleido: p.kaleido } : {}),
      ...(typeof p.fluid === 'number' ? { fluid: p.fluid } : {}),
      ...(typeof p.chroma === 'number' ? { chroma: p.chroma } : {}),
    };
  }
  return out;
}

function validatePathExperience(raw: unknown, opts: ValidateOptions): PathExperience {
  const r = asObject(raw, opts, opts.source);
  const kindRaw = asString(r.kind, opts, `${opts.source}.kind`, 'fade');
  if (!KNOWN_PATH_KINDS.has(kindRaw)) {
    // Punch-list #1 — dev: warn + accept (substrate maps unknowns to default
    // biome-blend); prod: throw.
    throwOrWarn(
      opts,
      `pathExperience.kind '${kindRaw}' is unknown (known: ${[...KNOWN_PATH_KINDS].join(', ')}). Substrate will use default biome-blend driver.`,
    );
  }
  return {
    kind: kindRaw,
    duration: asNumber(r.duration, opts, `${opts.source}.duration`, 1.6),
    ambient: asString(r.ambient, opts, `${opts.source}.ambient`, '#F5EDD8'),
    description: optString(r.description),
  };
}
