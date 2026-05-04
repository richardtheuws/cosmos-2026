/**
 * DefaultBackground — wraps the SHARED ParallaxScene per architect §6.2 + §7.1.
 *
 * Architect §6.2 says DefaultBackground constructs its own ParallaxScene. In
 * practice that conflicts with WebGLRenderer's "one renderer per canvas"
 * constraint: main.ts already constructs a ParallaxScene + renderer that
 * CosmoStage uses. Constructing a second ParallaxScene on the same canvas
 * would collide. Resolution: the substrate accepts a ParallaxScene reference
 * via `SubstrateCtx`-adjacent boot context (passed through SubstrateLoader)
 * and swaps biomes via `loadBiome()` instead of re-instantiating. This
 * preserves the architect's intent (DefaultBackground IS the parallax driver
 * for the substrate) without breaking the renderer-ownership invariant.
 *
 * Two biome-resolution paths:
 *   - room.biomeKey present → look up `BIOMES[room.biomeKey]` and call
 *     parallax.loadBiome(...) (matches the legacy `/play/` rendering quality).
 *   - else → fall back to slow-bloom so the scene paints something.
 *     A future wave 22 will synthesize a biome from manifest assets for
 *     fully-custom rooms.
 *
 * dispose() does NOT destroy the ParallaxScene — it's shared infra owned by
 * SubstrateLoader. Per-room cleanup is just unloading the room's specific
 * decorations, which the next loadBiome() handles automatically.
 */
import type { ParallaxScene } from '../../three/parallaxScene';
import { BIOMES, type Biome, type BiomeId } from '../../data/biomePresets';
import type { GlobalUniforms } from '../../core/globalUniforms';
import type { BackgroundHandle, SubstrateCtx, RoomSpec } from '../contracts/BehaviorContract';

export class DefaultBackground implements BackgroundHandle {
  private ready = false;

  constructor(
    private ctx: SubstrateCtx,
    private room: RoomSpec,
    private parallax: ParallaxScene,
  ) {
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      await this.parallax.loadBiome(this.activeBiome());
      this.ready = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[substrate/background] biome load failed', err);
    }
  }

  private activeBiome(): Biome {
    const key = this.room.biomeKey;
    if (key && (key as BiomeId) in BIOMES) return BIOMES[key as BiomeId];
    return BIOMES['slow-bloom'];
  }

  update(_dt: number, u: GlobalUniforms): void {
    if (!this.ready) return;
    this.parallax.update(u, this.ctx.motion);
  }

  dispose(): void {
    // Shared parallax — never destroyed by the room driver. The next room's
    // DefaultBackground will call loadBiome() to swap. SubstrateLoader.dispose()
    // owns the actual destroy.
    this.ready = false;
  }
}
