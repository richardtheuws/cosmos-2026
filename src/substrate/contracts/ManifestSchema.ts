/**
 * Hand-rolled Manifest validator. No external schema lib — small surface, the
 * substrate only ever validates a handful of shapes. Strict-mode and
 * lenient-mode behavior are split per architect §8.5 + punch-list #1: dev-mode
 * fills sensible defaults and warns; prod-mode throws so the SubstrateLoader
 * can fall back to forest with a logged error.
 */
import type { Manifest, AssetEntry, PostFXIntensity, PostPreset } from './BehaviorContract';

export interface ValidateOptions {
  /** When true, missing/invalid fields trigger console.warn + defaults. When
   *  false, every problem throws. Per architect §8.5: dev = lenient,
   *  prod = strict. */
  lenient: boolean;
  /** Logging context — embedded in warnings/errors. */
  source: string;
}

export function validateManifest(raw: unknown, opts: ValidateOptions): Manifest {
  const r = asObject(raw, opts, 'manifest');

  const version = asString(r.version, opts, `${opts.source}.version`, '1.1');
  if (!/^1\./.test(version)) {
    throwOrWarn(opts, `manifest version '${version}' is not a 1.x major — substrate may misbehave`);
  }

  const name = asString(r.name, opts, `${opts.source}.name`, 'unknown');
  const displayName = asString(r.displayName, opts, `${opts.source}.displayName`, name);
  const displayNameEn = optString(r.displayNameEn);
  const summaryEn = optString(r.summaryEn);
  const author = asString(r.author, opts, `${opts.source}.author`, 'unknown');
  const license = asString(r.license, opts, `${opts.source}.license`, 'MIT');
  const behaviorModule = typeof r.behaviorModule === 'boolean' ? r.behaviorModule : false;
  const defaultArea = asString(r.defaultArea, opts, `${opts.source}.defaultArea`, 'entry');
  const brandDeviation = typeof r.brandDeviation === 'string' ? r.brandDeviation : null;

  const assets = asArray(r.assets, opts, `${opts.source}.assets`).map((a, i) =>
    validateAssetEntry(a, { ...opts, source: `${opts.source}.assets[${i}]` }),
  );

  const postRaw = asObject(r.post ?? { preset: 'calm-baseline' }, opts, `${opts.source}.post`);
  const presetRaw = asString(postRaw.preset, opts, `${opts.source}.post.preset`, 'calm-baseline');
  const preset: PostPreset =
    presetRaw === 'deep-trip' || presetRaw === 'neutral' ? presetRaw : 'calm-baseline';
  if (presetRaw !== preset) {
    throwOrWarn(opts, `post.preset '${presetRaw}' is unknown; using 'calm-baseline'`);
  }
  const intensityCurve = postRaw.intensityCurve
    ? validateIntensityCurve(postRaw.intensityCurve, { ...opts, source: `${opts.source}.post.intensityCurve` })
    : undefined;

  return {
    version,
    name,
    displayName,
    displayNameEn,
    summaryEn,
    author,
    license,
    behaviorModule,
    defaultArea,
    brandDeviation,
    assets,
    post: { preset, intensityCurve },
  };
}

function validateAssetEntry(raw: unknown, opts: ValidateOptions): AssetEntry {
  const r = asObject(raw, opts, opts.source);
  const type = asString(r.type, opts, `${opts.source}.type`, 'image');
  const path = asString(r.path, opts, `${opts.source}.path`, '');
  const preload = typeof r.preload === 'boolean' ? r.preload : false;
  return { type, path, preload };
}

function validateIntensityCurve(raw: unknown, opts: ValidateOptions): PostFXIntensity {
  const r = asObject(raw, opts, opts.source);
  return {
    bloom: asNumber(r.bloom, opts, `${opts.source}.bloom`, 1.0),
    kaleido: asNumber(r.kaleido, opts, `${opts.source}.kaleido`, 1.0),
    fluid: asNumber(r.fluid, opts, `${opts.source}.fluid`, 1.0),
    chroma: asNumber(r.chroma, opts, `${opts.source}.chroma`, 1.0),
  };
}

/* ── Primitive helpers (shared across schema files) ─────────────────────── */

export function asObject(raw: unknown, opts: ValidateOptions, source: string): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throwOrWarn(opts, `${source} is not an object`);
  return {};
}

export function asArray(raw: unknown, opts: ValidateOptions, source: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  throwOrWarn(opts, `${source} is not an array`);
  return [];
}

export function asString(raw: unknown, opts: ValidateOptions, source: string, fallback: string): string {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  throwOrWarn(opts, `${source} is missing or not a non-empty string`);
  return fallback;
}

export function optString(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw : undefined;
}

export function asNumber(raw: unknown, opts: ValidateOptions, source: string, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  throwOrWarn(opts, `${source} is missing or not a finite number`);
  return fallback;
}

export function throwOrWarn(opts: ValidateOptions, msg: string): void {
  const full = `[substrate/schema] ${opts.source}: ${msg}`;
  if (opts.lenient) {
    // eslint-disable-next-line no-console
    console.warn(full);
  } else {
    throw new Error(full);
  }
}
