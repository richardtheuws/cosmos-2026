/**
 * peakDetector.ts — Sprint 13C
 *
 * Watches the live FFT (lows) + combo state and fires a "synesthesia peak"
 * event the moment the player + the music align hard enough to deserve a
 * share-card.
 *
 * Heuristic (PRD §6 + §7.2):
 *   • lows-avg > 0.7  AND
 *   • that condition has been sustained for ≥ SUSTAIN_S seconds  AND
 *   • combo > COMBO_GATE  OR  current biome is the boss-stinger
 *
 * After a fire we enforce a 30s cooldown so peaks feel rare. Without the
 * cooldown the boss-stinger biome would spam captures every kick drum.
 *
 * Why "sustained" instead of "just spike":
 *   A single transient kick lasts <50ms and produces lows ≈ 1.0 every beat at
 *   78–96 BPM. We want the moment where the *bass + bloom + crowd taps* line
 *   up, which is more like a 0.5s ridge than a single peak.
 *
 * The detector is callback-based, not event-emitter-based, so it doesn't
 * pull in EventEmitter polyfills — keeps us at zero new deps per Sprint 13C
 * rules.
 */

import type { GlobalUniforms } from '../core/globalUniforms';
import type { BiomeManager } from '../three/biomeManager';

const LOWS_THRESHOLD = 0.7;
/** How long the lows-condition must hold before a peak qualifies. */
const SUSTAIN_S = 0.5;
const COMBO_GATE = 5;
const COOLDOWN_S = 30;

export interface PeakEvent {
  t: number;
  combo: number;
  biomeId: string;
  trackName: string;
  lowsAvg: number;
}

export type PeakListener = (event: PeakEvent) => void;

export class PeakDetector {
  private uniforms: GlobalUniforms;
  private biomeMgr: BiomeManager;
  private getCombo: () => number;
  /** Wall-clock seconds the lows have continuously been above threshold. */
  private sustainAccum = 0;
  /** Earliest u.time we may fire again. */
  private cooldownUntil = 0;
  private listeners: PeakListener[] = [];

  constructor(uniforms: GlobalUniforms, biomeMgr: BiomeManager, getCombo: () => number) {
    this.uniforms = uniforms;
    this.biomeMgr = biomeMgr;
    this.getCombo = getCombo;
  }

  /** Register a listener; returns an unsubscribe fn. */
  onPeak(listener: PeakListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Per-frame. Cheap: 2 array-reads + a few comparisons. */
  update(dt: number): void {
    const u = this.uniforms;
    const f = u.audioFFT;
    const lows = (f[0] + f[1]) * 0.5;

    if (lows >= LOWS_THRESHOLD) {
      this.sustainAccum += dt;
    } else {
      // Slow decay so a single transient dip doesn't reset the build-up.
      this.sustainAccum = Math.max(0, this.sustainAccum - dt * 2);
    }

    if (u.time < this.cooldownUntil) return;
    if (this.sustainAccum < SUSTAIN_S) return;

    const combo = this.getCombo();
    const biome = this.biomeMgr.current();
    const isBoss = biome?.id === 'boss';
    if (combo < COMBO_GATE && !isBoss) return;

    // Fire!
    const ev: PeakEvent = {
      t: u.time,
      combo,
      biomeId: biome?.id ?? 'unknown',
      trackName: biome?.label ?? 'unknown',
      lowsAvg: lows,
    };
    this.cooldownUntil = u.time + COOLDOWN_S;
    this.sustainAccum = 0;
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[peakDetector] listener threw', err);
      }
    }
  }

  /** Force a peak (for testing or for the long-hold-3s deep-trip share). */
  forceFire(): void {
    const u = this.uniforms;
    const f = u.audioFFT;
    const lows = (f[0] + f[1]) * 0.5;
    const biome = this.biomeMgr.current();
    const ev: PeakEvent = {
      t: u.time,
      combo: this.getCombo(),
      biomeId: biome?.id ?? 'unknown',
      trackName: biome?.label ?? 'unknown',
      lowsAvg: lows,
    };
    this.cooldownUntil = u.time + COOLDOWN_S;
    this.sustainAccum = 0;
    for (const l of this.listeners) l(ev);
  }
}
