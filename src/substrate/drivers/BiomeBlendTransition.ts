/**
 * Room↔Room transition — architect §4.1.
 *
 * Drives `BiomeManager.startMoodCrossfade(fromCurve, toCurve, durationS)`
 * (BiomeManager API extension lives in src/three/biomeManager.ts). The
 * substrate awaits the returned promise; the manager already ticks itself
 * via main.ts manager.register, so we don't need a per-driver tick.
 *
 * TODO (Wave 22, deferred per punch-list #9): paint a spore-mote drift
 * overlay during the crossfade so the path between rooms reads as content,
 * not a CSS-style fade. Today: pure intensity-curve crossfade (visually
 * identical to BiomeManager's existing biome-cycle).
 */
import type { BiomeManager } from '../../three/biomeManager';
import type { BiomePostFXCurve } from '../../data/biomePresets';
import type { ResolvedMood, TransitionDriver } from '../contracts/BehaviorContract';

export class BiomeBlendTransition implements TransitionDriver {
  constructor(
    private biomeMgr: BiomeManager,
    private fromMood: ResolvedMood,
    private toMood: ResolvedMood,
    private durationS = 2.0,
  ) {}

  async run(_dt: number): Promise<void> {
    void _dt;
    const fromCurve = moodToCurve(this.fromMood);
    const toCurve = moodToCurve(this.toMood);
    await this.biomeMgr.startMoodCrossfade(fromCurve, toCurve, this.durationS);
    // TODO (wave22): spore-mote drift overlay during crossfade.
  }

  dispose(): void {
    /* No GPU resources owned. */
  }
}

function moodToCurve(mood: ResolvedMood): BiomePostFXCurve {
  return {
    bloom: mood.post.bloom,
    kaleido: mood.post.kaleido,
    fluid: mood.post.fluid,
    chroma: mood.post.chroma,
  };
}
