/**
 * RoomHost — owns room-scope lifecycle per architect §3.1 + §3.2.
 *
 *   Owns: the four per-room drivers (background, inhabitants, interactables,
 *   audio), the per-room camera bounds, the Room-to-Room transition selection.
 *   Cosmo state-machine + AI live one level up (UniverseHost) so they survive
 *   room hops; only `room.anchor` repositions the agent on enter.
 */
import type {
  AreaSpec,
  AudioHandle,
  AssetEntry,
  BackgroundHandle,
  InhabitantHandle,
  InteractableHandle,
  Manifest,
  ResolvedMood,
  RoomSpec,
  SubstrateCtx,
  UniverseBehavior,
} from './contracts/BehaviorContract';
import { DefaultBackground } from './drivers/DefaultBackground';
import { defaultAudio } from './drivers/DefaultAudio';
import type { GlobalUniforms } from '../core/globalUniforms';
import type { ParallaxScene } from '../three/parallaxScene';

export interface RoomHostBootCtx {
  manifest: Manifest;
  area: AreaSpec;
  room: RoomSpec;
  mood: ResolvedMood;
  behavior: UniverseBehavior | null;
  universeRel: string;
  assets: readonly AssetEntry[];
  /** Shared parallax instance owned by SubstrateLoader. Default background
   *  driver swaps biomes on it instead of constructing its own. */
  parallax: ParallaxScene;
}

export class RoomHost {
  private background: BackgroundHandle | null = null;
  private inhabitants: InhabitantHandle[] = [];
  private interactables: InteractableHandle[] = [];
  private audio: AudioHandle | null = null;

  constructor(
    private ctx: SubstrateCtx,
    private boot: RoomHostBootCtx,
  ) {}

  /** Construct all four drivers. Called by AreaHost on room enter. */
  enter(): void {
    const ctx = this.ctx;
    const behavior = this.boot.behavior;

    // Background — author override or DefaultBackground (which wraps the
    // shared ParallaxScene). The author's hook gets the same SubstrateCtx
    // that ships with `canvas` + `audioBridge` + `motion` (punch-list #6) so
    // it can construct its own parallax-equivalent if it wants — but the
    // default path uses the shared instance to honour the one-renderer-per-canvas
    // invariant.
    this.background =
      behavior?.background?.(ctx) ??
      new DefaultBackground(ctx, this.boot.room, this.boot.parallax);

    // Inhabitants — author returns array, default is empty.
    this.inhabitants = behavior?.inhabitants?.(ctx) ?? [];

    // Interactables — author returns array, default is empty.
    this.interactables = behavior?.interactables?.(ctx) ?? [];

    // Audio — author or default-silence-with-bed.
    this.audio = behavior?.audio?.(ctx) ?? defaultAudio(ctx, this.boot.assets, this.boot.universeRel, this.boot.room);
    this.audio.enter();
  }

  tick(dt: number, u: GlobalUniforms): void {
    // The background handle configures the SHARED parallax (adds planes, or
    // swaps the biome) but does NOT render it — rendering the parallax is the
    // RoomHost's job so it happens for EVERY universe, not just the ones that
    // use DefaultBackground. Without this, a universe with a custom
    // behavior.background() (chart void, ink-ocean water, dunes composition)
    // adds its planes to parallax.scene but they never paint, leaving only the
    // renderer's clear colour. One render per frame, here, for all of them.
    this.background?.update(dt, u);
    this.boot.parallax.update(u, this.ctx.motion);
    for (const inh of this.inhabitants) inh.update(dt, u);
    for (const i of this.interactables) i.update(dt, u);
    this.audio?.update(dt);
  }

  exit(fadeMs = 200): void {
    this.audio?.exit(fadeMs);
  }

  dispose(): void {
    this.background?.dispose();
    for (const inh of this.inhabitants) inh.dispose();
    for (const i of this.interactables) i.dispose();
    this.audio?.dispose();
    this.background = null;
    this.inhabitants = [];
    this.interactables = [];
    this.audio = null;
  }

  /** Read-only handles (used by UniverseHost when wiring InteractionManager). */
  getInteractables(): readonly InteractableHandle[] {
    return this.interactables;
  }
}
