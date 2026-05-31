/**
 * DefaultAudio — architect §7.6, Wave 24 wired.
 *
 * Picks an ambient music bed and swaps to it on room-enter via the existing
 * AudioFFTBridge. Bed selection: the room's `audioBed` (a universe-relative
 * asset path) if declared, else the manifest's first `preload:true` audio
 * (legacy behavior). Silence if neither exists.
 *
 * Gesture-gating is handled inside the bridge: `setMusicTrack` creates the
 * source even before the audio context is unlocked; the next user-gesture's
 * `ensureRunning()` (wired in main.ts) plays it (the Sprint 11D retry path).
 * This is a source swap, not a gain crossfade — same as the legacy
 * BiomeManager `onTrackSwap`; the visual biome-blend covers the change, and
 * sibling room beds are authored to share DNA so the swap is unobtrusive.
 */
import { PreloadManager } from '../PreloadManager';
import type { AssetEntry, AudioHandle, RoomSpec, SubstrateCtx } from '../contracts/BehaviorContract';

export class DefaultAudio implements AudioHandle {
  private trackUrl: string | null = null;
  private readonly bridge: SubstrateCtx['audioBridge'];

  constructor(
    ctx: SubstrateCtx,
    assets: readonly AssetEntry[],
    universeRel: string,
    room?: RoomSpec,
  ) {
    this.bridge = ctx.audioBridge;

    if (room?.audioBed) {
      this.trackUrl = PreloadManager.resolveAssetUrl(room.audioBed, universeRel);
      return;
    }
    const audio = assets.find((a) => a.type === 'audio' && a.preload);
    this.trackUrl = audio ? PreloadManager.resolveAssetUrl(audio.path, universeRel) : null;
  }

  enter(): void {
    if (!this.trackUrl) return;
    this.bridge.setMusicTrack(this.trackUrl);
  }

  exit(_fadeMs: number): void {
    /* Leave the bed playing; the next room's enter() swaps it. A true
     * gain-crossfade is a future bridge enhancement (canvas O4 follow-up). */
  }

  update(_dt: number): void {
    /* The bridge ticks itself via main.ts manager.register. */
  }

  dispose(): void {
    /* The bridge owns the audio graph; nothing owned at this scope. */
  }
}

export function defaultAudio(
  ctx: SubstrateCtx,
  assets: readonly AssetEntry[],
  universeRel: string,
  room?: RoomSpec,
): AudioHandle {
  return new DefaultAudio(ctx, assets, universeRel, room);
}
