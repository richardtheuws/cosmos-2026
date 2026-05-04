/**
 * BiomeManager — Sprint 13C
 *
 * Owns the active biome (track + post-FX intensity targets + parallax tint),
 * crossfades between biomes over `CROSSFADE_S` and auto-cycles when the active
 * track ends. Player can long-hold-3s (Sprint 13A's gesture) to force-switch.
 *
 * State machine
 * ─────────────
 *   IDLE        — no active biome (pre-boot only)
 *   ACTIVE      — `current` is playing, `intensity` matches its curve
 *   CROSSFADE   — lerp from `current` curve to `next` curve over CROSSFADE_S;
 *                 the *track* swap happens at the START of the crossfade so the
 *                 audio analyser gets the new music while visuals still settle.
 *
 * Outputs:
 *   - writes `globalUniforms.biomeIntensity` every tick (postFX reads it)
 *   - controls a single HTMLAudioElement piped through the AudioFFTBridge's
 *     biome-bus (analyser sees the same signal post-volume).
 *   - emits 'biome-change' events so UI (share-card + day-streak pill) can
 *     re-render the biome-name without polling.
 *
 * Track lifecycle
 *   - Each biome track loops in place (audioFFTBridge `audioEl.loop = true`).
 *     Sprint 16D revert: the original "auto-cycle on track-end" plan turned
 *     out to be a regression — when an `<audio>` element fires `ended`, the
 *     follow-up `setMusicTrack(nextUrl)` call frequently fails to autoplay
 *     (autoplay-policy reset) and the music drops out entirely. Auto-cycle
 *     is now driven EXCLUSIVELY by `requestPlayerSwitch()` (long-hold-3s
 *     gesture, Sprint 13A drift-loose mode). `notifyTrackEnded()` is kept
 *     as a no-op shim for backwards compatibility, but no longer advances.
 */

import type { GlobalUniforms } from '../core/globalUniforms';
import {
  BIOMES,
  BIOME_CYCLE_ORDER,
  type Biome,
  type BiomeId,
  type BiomePostFXCurve,
} from '../data/biomePresets';

const CROSSFADE_S = 4.0;
/** Long-hold gesture threshold (Sprint 13A wires the pointer-down/up to call requestPlayerSwitch()). */
export const PLAYER_SWITCH_HOLD_S = 3.0;

type State =
  | { kind: 'idle' }
  | { kind: 'active'; biome: Biome }
  | { kind: 'crossfade'; from: Biome; to: Biome; t: number }
  /** Wave 21 — substrate Room↔Room crossfade. Same lerp machinery as the
   *  biome-cycle crossfade but operates on arbitrary mood-curves instead of
   *  registered biomes, with a per-call duration and a resolve handle so the
   *  caller awaits completion. */
  | { kind: 'mood-crossfade'; from: BiomePostFXCurve; to: BiomePostFXCurve; t: number; durationS: number; resolve: () => void };

type Listener = (biome: Biome) => void;

export interface BiomeManagerHooks {
  /**
   * Called when the BiomeManager wants its track swapped on the audio bridge.
   * The bridge owns `<audio>` elements; the manager only knows URLs.
   * The hook should fade-in the new track at gain ≈ 0.55 and fade-out the
   * previous one over `CROSSFADE_S`. If `previousUrl` is null this is the
   * first activation (cold-start fade-in only).
   */
  onTrackSwap(nextUrl: string, previousUrl: string | null): void;

  /**
   * Sprint 16D: removed. Tracks now loop in place via `audioEl.loop = true`,
   * and biome cycling is driven only by player long-hold-3s gestures. Kept
   * the field name reserved (commented) so a future host that wants to
   * resurrect auto-cycling has a known callsite to wire.
   */
  // onTrackEnded?(): void;
}

export class BiomeManager {
  private state: State = { kind: 'idle' };
  private uniforms: GlobalUniforms;
  private hooks: BiomeManagerHooks;
  private cycleIdx = 0;
  /** Cached lerp endpoints so we don't reread BIOMES every tick. */
  private fromCurve: BiomePostFXCurve = { bloom: 1, kaleido: 1, fluid: 1, chroma: 1 };
  private toCurve: BiomePostFXCurve = { bloom: 1, kaleido: 1, fluid: 1, chroma: 1 };
  /** Last-emitted biome id, used to dedupe change-listener fires. */
  private lastEmitted: BiomeId | null = null;
  private listeners: Listener[] = [];

  constructor(uniforms: GlobalUniforms, hooks: BiomeManagerHooks) {
    this.uniforms = uniforms;
    this.hooks = hooks;
  }

  /** Boot the manager on the first biome in the cycle (PRD: slow-bloom opener). */
  start(initial: BiomeId = BIOME_CYCLE_ORDER[0]): void {
    this.cycleIdx = Math.max(0, BIOME_CYCLE_ORDER.indexOf(initial));
    const biome = BIOMES[initial];
    this.applyCurveImmediate(biome.postFXCurve);
    this.state = { kind: 'active', biome };
    this.hooks.onTrackSwap(biome.trackUrl, null);
    this.emitChange(biome);
  }

  /** Subscribe to biome changes. Returns an unsubscribe fn. */
  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Current biome object (or `null` if idle). */
  current(): Biome | null {
    if (this.state.kind === 'active') return this.state.biome;
    if (this.state.kind === 'crossfade') return this.state.to;
    return null;
  }

  /** True iff currently mid-crossfade. */
  isCrossfading(): boolean {
    return this.state.kind === 'crossfade';
  }

  /**
   * Player-trigger from the long-hold-3s gesture (Sprint 13A). Cycles to the
   * next biome immediately if not already crossfading. No-op during fade so a
   * spam-hold doesn't stack queued switches.
   */
  requestPlayerSwitch(): void {
    if (this.state.kind !== 'active') return;
    this.advance();
  }

  /**
   * Track-end hook — Sprint 16D: NO-OP.
   *
   * The `<audio>` element loops in place (`audioEl.loop = true` in
   * audioFFTBridge.createStreamedTrack), so this method should not actually
   * fire under normal playback. Even if a host wires it up defensively, we
   * deliberately do NOT auto-advance: Sprint 16D found that re-loading the
   * track on `ended` race-conditions with autoplay-policy and silently kills
   * the music. Biome cycling is now driven exclusively by
   * `requestPlayerSwitch()` (long-hold-3s gesture).
   */
  notifyTrackEnded(): void {
    /* intentionally empty — see jsdoc above */
  }

  /** Per-frame tick: drives crossfade lerp + writes biomeIntensity. */
  update(dt: number): void {
    const bi = this.uniforms.biomeIntensity;
    if (this.state.kind === 'crossfade') {
      this.state.t = Math.min(1, this.state.t + dt / CROSSFADE_S);
      const k = this.state.t;
      bi.bloom = lerp(this.fromCurve.bloom, this.toCurve.bloom, k);
      bi.kaleido = lerp(this.fromCurve.kaleido, this.toCurve.kaleido, k);
      bi.fluid = lerp(this.fromCurve.fluid, this.toCurve.fluid, k);
      bi.chroma = lerp(this.fromCurve.chroma, this.toCurve.chroma, k);
      // Parallax-stack stays fully visible during crossfade — we don't dim
      // backgrounds because both biomes share the same parallax assets; the
      // ambient-tint shift carries the change visually.
      bi.parallaxAlpha = 1;
      if (k >= 1) {
        const arrived = this.state.to;
        this.state = { kind: 'active', biome: arrived };
        this.emitChange(arrived);
      }
    } else if (this.state.kind === 'mood-crossfade') {
      this.state.t = Math.min(1, this.state.t + dt / Math.max(0.01, this.state.durationS));
      const k = this.state.t;
      bi.bloom = lerp(this.state.from.bloom, this.state.to.bloom, k);
      bi.kaleido = lerp(this.state.from.kaleido, this.state.to.kaleido, k);
      bi.fluid = lerp(this.state.from.fluid, this.state.to.fluid, k);
      bi.chroma = lerp(this.state.from.chroma, this.state.to.chroma, k);
      bi.parallaxAlpha = 1;
      if (k >= 1) {
        const resolve = this.state.resolve;
        // Return to active state on the previously-active biome (or stay
        // idle if we were idle when the mood-crossfade fired).
        const prev = this.lastEmitted ? BIOMES[this.lastEmitted] : null;
        this.state = prev ? { kind: 'active', biome: prev } : { kind: 'idle' };
        resolve();
      }
    }
  }

  /**
   * Wave 21 — substrate Room↔Room mood crossfade.
   *
   * Crossfades `globalUniforms.biomeIntensity` from `from` to `to` over
   * `durationS`, independent of the registered BIOMES. Used by the
   * BiomeBlendTransition driver. Resolves when t ≥ 1.
   *
   * If a biome-cycle crossfade is in flight, the mood-crossfade is rejected
   * (the cycle takes priority — biome cycling is a higher-tier event). In
   * normal substrate operation the cycle is paused, so this is rare.
   */
  startMoodCrossfade(from: BiomePostFXCurve, to: BiomePostFXCurve, durationS: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.state.kind === 'crossfade') {
        // Biome-cycle has priority; resolve immediately so the caller doesn't hang.
        resolve();
        return;
      }
      this.state = {
        kind: 'mood-crossfade',
        from: { ...from },
        to: { ...to },
        t: 0,
        durationS,
        resolve,
      };
    });
  }

  /* ── private ──────────────────────────────────────────────────────────── */

  private advance(): void {
    if (this.state.kind !== 'active') return;
    const fromBiome = this.state.biome;
    this.cycleIdx = (this.cycleIdx + 1) % BIOME_CYCLE_ORDER.length;
    const toId = BIOME_CYCLE_ORDER[this.cycleIdx];
    const toBiome = BIOMES[toId];
    this.fromCurve = { ...fromBiome.postFXCurve };
    this.toCurve = { ...toBiome.postFXCurve };
    this.state = { kind: 'crossfade', from: fromBiome, to: toBiome, t: 0 };
    this.hooks.onTrackSwap(toBiome.trackUrl, fromBiome.trackUrl);
  }

  private applyCurveImmediate(curve: BiomePostFXCurve): void {
    const bi = this.uniforms.biomeIntensity;
    bi.bloom = curve.bloom;
    bi.kaleido = curve.kaleido;
    bi.fluid = curve.fluid;
    bi.chroma = curve.chroma;
    bi.parallaxAlpha = 1;
    this.fromCurve = { ...curve };
    this.toCurve = { ...curve };
  }

  private emitChange(biome: Biome): void {
    if (this.lastEmitted === biome.id) return;
    this.lastEmitted = biome.id;
    for (const l of this.listeners) {
      try {
        l(biome);
      } catch {
        /* listener errors must not poison the cycle */
      }
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
