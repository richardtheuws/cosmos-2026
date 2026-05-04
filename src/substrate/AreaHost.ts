/**
 * AreaHost — owns area-scope lifecycle per architect §3.1.
 *
 *   Owns: resolved mood (universe + areaOverrides merge), the area-to-area
 *   path-experience driver, the active room-graph subgraph. Constructs +
 *   tears down RoomHost as the user navigates within the area.
 */
import type { GlobalUniforms } from '../core/globalUniforms';
import type { ParallaxScene } from '../three/parallaxScene';
import type {
  AreaSpec,
  AssetEntry,
  Manifest,
  ResolvedMood,
  RoomSpec,
  RoomsManifest,
  SubstrateCtx,
  UniverseBehavior,
} from './contracts/BehaviorContract';
import { resolveMood } from './ResolveMood';
import { RoomHost } from './RoomHost';

export interface AreaHostBootCtx {
  manifest: Manifest;
  area: AreaSpec;
  rooms: RoomsManifest;
  behavior: UniverseBehavior | null;
  universeRel: string;
  assets: readonly AssetEntry[];
  parallax: ParallaxScene;
}

export class AreaHost {
  private currentRoomHost: RoomHost | null = null;
  private currentRoom: RoomSpec | null = null;
  private currentMood: ResolvedMood;

  constructor(
    private ctx: SubstrateCtx,
    private boot: AreaHostBootCtx,
  ) {
    this.currentMood = resolveMood(boot.manifest, boot.area);
  }

  /** Enter a specific room. Disposes previous RoomHost first. */
  enterRoom(room: RoomSpec): void {
    this.currentRoom?.id;
    if (this.currentRoomHost) {
      this.currentRoomHost.exit();
      this.currentRoomHost.dispose();
      this.currentRoomHost = null;
    }
    this.currentRoom = room;

    // Update the substrate ctx room-fields so behavior receives current state.
    this.ctx.room = {
      id: room.id,
      displayName: room.displayName,
      anchor: room.anchor,
    };

    const roomHost = new RoomHost(this.ctx, {
      manifest: this.boot.manifest,
      area: this.boot.area,
      room,
      mood: this.currentMood,
      behavior: this.boot.behavior,
      universeRel: this.boot.universeRel,
      assets: this.boot.assets,
      parallax: this.boot.parallax,
    });
    roomHost.enter();
    this.currentRoomHost = roomHost;
  }

  tick(dt: number, u: GlobalUniforms): void {
    this.currentRoomHost?.tick(dt, u);
  }

  getMood(): ResolvedMood {
    return this.currentMood;
  }

  getCurrentRoom(): RoomSpec | null {
    return this.currentRoom;
  }

  getCurrentRoomHost(): RoomHost | null {
    return this.currentRoomHost;
  }

  dispose(): void {
    if (this.currentRoomHost) {
      this.currentRoomHost.exit();
      this.currentRoomHost.dispose();
      this.currentRoomHost = null;
    }
    this.currentRoom = null;
  }
}
