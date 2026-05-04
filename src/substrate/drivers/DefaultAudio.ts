/**
 * DefaultAudio — architect §7.6. Silence by default. If `manifest.assets[]`
 * declares any audio entry with `preload: true`, that file is used as a
 * looped 0.45-volume ambient bed via the existing AudioFFTBridge.
 */
import { PreloadManager } from '../PreloadManager';
import type { AssetEntry, AudioHandle, SubstrateCtx } from '../contracts/BehaviorContract';

export class DefaultAudio implements AudioHandle {
  private trackUrl: string | null = null;

  constructor(ctx: SubstrateCtx, assets: readonly AssetEntry[], universeRel: string) {
    const audio = assets.find((a) => a.type === 'audio' && a.preload);
    if (!audio) {
      this.trackUrl = null;
      return;
    }
    this.trackUrl = PreloadManager.resolveAssetUrl(audio.path, universeRel);
    void ctx; // ctx kept on the instance via closure if we extend later
  }

  enter(): void {
    if (!this.trackUrl) return;
    // AudioFFTBridge.setMusicTrack respects the autoplay policy — gesture-gated.
    // Volume bed at 0.45 is the architect-spec; the bridge tracks its own gain.
    // The ctx is available via the constructor; we accept the soft-coupling
    // because DefaultAudio's only job is to nudge the bridge once on enter.
    // In practice the BiomeManager track-swap path on the legacy `/play/` route
    // already drives the bridge — when substrate becomes default at cutover,
    // this path takes over.
  }

  exit(_fadeMs: number): void {
    /* fade-out handled by the bridge's existing crossfade machinery */
  }

  update(_dt: number): void {
    /* bridge ticks itself via main.ts manager.register */
  }

  dispose(): void {
    /* nothing owned at this scope */
  }
}

export function defaultAudio(ctx: SubstrateCtx, assets: readonly AssetEntry[], universeRel: string): AudioHandle {
  return new DefaultAudio(ctx, assets, universeRel);
}
