/**
 * DeepTripMode — Sprint 15B
 *
 * 5-second post-FX peak engaged when VibeMeter hits 1.0. Fires:
 *   - kaleido + bloom + fluid uniforms ramped to 1.0 (then fade out)
 *   - hallucination overlay-track via audioBridge.startHallucination
 *   - Cosmo enters dance-anim (CosmoAgent.enterDance — surprise reward;
 *     player did NOT activate the dance directly)
 *
 * The mode is a one-shot — once triggered, the VibeMeter resets to 0 and a
 * cooldown of COOLDOWN_S prevents back-to-back firings even if the player
 * sustains a maxed meter.
 */
import type { GlobalUniforms } from '../../core/globalUniforms';
import type { AudioFFTBridge } from '../../audio/audioFFTBridge';
import { HALLUCINATION_PEAKS } from '../../audio/audioFFTBridge';
import type { CosmoAgent } from './CosmoAgent';
import type { VibeMeter } from './VibeMeter';

const DURATION_S = 5;
const COOLDOWN_S = 8;
const PEAK_KALEIDO = 1.0;

export class DeepTripMode {
  private uniforms: GlobalUniforms;
  private audio: AudioFFTBridge;
  private agent: CosmoAgent;
  private vibe: VibeMeter;

  /** -Infinity until first trigger. */
  private engagedSince = -Infinity;
  /** Cooldown end-time in uniforms.time. */
  private cooldownUntil = 0;

  constructor(uniforms: GlobalUniforms, audio: AudioFFTBridge, agent: CosmoAgent, vibe: VibeMeter) {
    this.uniforms = uniforms;
    this.audio = audio;
    this.agent = agent;
    this.vibe = vibe;
  }

  /** Per-frame. Auto-engages on vibe.fullEdge. */
  update(_dt: number): void {
    const tNow = this.uniforms.time;
    const engaged = tNow - this.engagedSince < DURATION_S;

    if (this.vibe.fullEdge && tNow >= this.cooldownUntil) {
      this.engage(tNow);
    }

    if (engaged) {
      // Push uniforms to peak; AudioFFTBridge already pulses bloom etc, so
      // here we mostly raise the kaleidoTrigger which decays naturally.
      this.uniforms.kaleidoTrigger = PEAK_KALEIDO;
    }
  }

  private engage(tNow: number): void {
    this.engagedSince = tNow;
    this.cooldownUntil = tNow + DURATION_S + COOLDOWN_S;
    this.uniforms.kaleidoTrigger = PEAK_KALEIDO;
    this.audio.startHallucination(HALLUCINATION_PEAKS);
    this.agent.enterDance();
    // Reset meter so the player has a fresh vibe-build cycle on the other side.
    this.vibe.decay(1);
  }

  isEngaged(): boolean {
    return this.uniforms.time - this.engagedSince < DURATION_S;
  }
}
