/**
 * urlSeed.ts — Sprint 13C
 *
 * "Friend-pass-the-trip" link helpers (PRD §7.4):
 *   • encode the current daily seed (and optional combo) into a sharable URL;
 *   • decode an incoming URL into a seed for BeatScene's beatmap-shuffle so
 *     two friends opening the link on the same day get the *same* bubble
 *     pattern.
 *
 * Seed default = today's `YYYYMMDD`. Same number every call within the same
 * local day → deterministic shuffle for the same friend-link.
 *
 * The seed is converted to a 32-bit integer via `mulberry32`-friendly hashing,
 * which BeatScene (Sprint 13A/13B) can plug directly into a deterministic RNG.
 */

import { todayKey } from './dailyStreak';

export interface ShareLinkParams {
  /** YYYYMMDD seed; defaults to today. */
  seed?: string;
  /** Combo to brag about; emitted as `&combo=NN`. */
  combo?: number;
}

const SEED_PARAM = 'seed';
const COMBO_PARAM = 'combo';

/** Read seed from `window.location.search`. Returns today's seed if absent. */
export function readSeedFromUrl(loc: Location = window.location): string {
  try {
    const sp = new URLSearchParams(loc.search);
    const v = sp.get(SEED_PARAM);
    if (v && /^\d{8}$/.test(v)) return v;
  } catch {
    /* SSR-safety: fall through */
  }
  return todayKey();
}

/** Read combo from `window.location.search`, NaN-safe. */
export function readComboFromUrl(loc: Location = window.location): number | null {
  try {
    const sp = new URLSearchParams(loc.search);
    const raw = sp.get(COMBO_PARAM);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

/** Build the share URL for the current page. */
export function buildShareUrl(
  base: string = window.location.origin + window.location.pathname,
  params: ShareLinkParams = {},
): string {
  const seed = params.seed ?? todayKey();
  const sp = new URLSearchParams();
  sp.set(SEED_PARAM, seed);
  if (typeof params.combo === 'number' && Number.isFinite(params.combo) && params.combo > 0) {
    sp.set(COMBO_PARAM, String(Math.floor(params.combo)));
  }
  return `${base}?${sp.toString()}`;
}

/**
 * Hash a YYYYMMDD seed string to a 32-bit unsigned int. Deterministic — same
 * input always produces the same output. Used by BeatScene to seed its
 * Mulberry32 / xorshift RNG so the bubble-shuffle is identical for everyone
 * opening the link on a given day.
 *
 * Implementation: simple xorshift-multiply on the 8 ASCII bytes — adequate
 * randomness for shuffling ≤256 beatmap entries; not crypto-grade.
 */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Splash to spread bits.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
