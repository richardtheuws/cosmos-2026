/**
 * ObstacleManager — Sprint 17D compat-shim.
 *
 * The runner-style spawn-pool that powered Sprint 15B-16E is GONE. With the
 * companion-mode pivot (Sprint 17B+) Cosmo is anchored at biome-centre and the
 * world stays static around him. Player-actions are delivered via
 * `TrampolineSpots` (fixed in-biome spots, raycaster-tap), not a runner-style
 * obstacle pool. So there's nothing left to spawn.
 *
 * Why we keep this file:
 *   - 17F (asset-decoration placement) will reuse the shim as an
 *     `EnvironmentDecorator` for scene-static objects (lampposts, ambient
 *     creatures) parked at fixed (x, y, z) per biome.
 *   - Existing call-sites still type-reference `ObstacleManager`, `Obstacle`,
 *     `ObstacleKind`, `closestAhead()`, `liveObstacles()`,
 *     `setObstacleFactory()` and the `paused` flag (OnboardingDirector +
 *     CosmoScene). Stripping the type would force a churn-PR; instead we keep
 *     the surface and route every method to a no-op pool.
 *   - Tests / debug overlays still introspect `liveObstacles()`. Returning an
 *     empty list is the safest default.
 *
 * What changed vs Sprint 16E:
 *   - `update()` is a no-op (no audio-clock spawn, no fallback timer, no recycle).
 *   - `pickKind`, `pickWeighted`, anti-repeat bookkeeping — all removed.
 *   - `paused` flag still respected (onboarding flips it) but has no effect
 *     since there's no spawn-loop.
 *   - `closestAhead()` still walks the (now usually empty) pool, so the
 *     HintGlyph anchoring code in CosmoScene degrades to "park above Cosmo".
 *
 * Deliberately NOT renamed to `EnvironmentDecorator` yet — that's a 17F
 * concern. Renaming now would force every import-site to update. Instead
 * we'll alias-export when 17F lands.
 */
import * as THREE from 'three';

export type ObstacleKind = 'low' | 'tall' | 'gap';

export interface Obstacle {
  /** World-space root. */
  group: THREE.Group;
  /** "alive" means in-scene. With the spawn-loop gone, this stays empty until
   *  17F starts placing static decorations. */
  alive: boolean;
  /** Kind hint — historically used by InteractionManager.tap to pick
   *  jump-vs-duck. With the runner-mechanic gone the field is informational. */
  kind: ObstacleKind;
  /** World-X of the obstacle's centre. */
  x: number;
}

export type ObstacleFactory = (kind: ObstacleKind) => THREE.Group;

export interface ObstacleManagerHooks {
  /** Read the audio-clock — historically used to align spawn-times to bar
   *  edges. Kept on the hook-surface for 17F (decoration-pulse, beat-driven
   *  ambient creatures) but currently unused. */
  audioNow(): number;
}

/**
 * Minimal compat-shim. Empty pool, no spawn-loop. Constructor + every method
 * preserved so existing call-sites keep compiling without churn.
 */
export class ObstacleManager {
  private scene: THREE.Scene;
  private hooks: ObstacleManagerHooks;
  /** Sprint 17F will populate this when decorations are placed. */
  private pool: Obstacle[] = [];
  /** Compat — factories from 15C-16E still register here. 17F may use them
   *  to build decorations. Currently unused. */
  private factory: ObstacleFactory | null = null;
  /** Onboarding still flips this; with no spawn-loop it has no effect. */
  paused = false;

  constructor(scene: THREE.Scene, hooks: ObstacleManagerHooks) {
    this.scene = scene;
    this.hooks = hooks;
  }

  /** Compat. 17F will use the registered factory to place decorations. */
  setObstacleFactory(f: ObstacleFactory): void {
    this.factory = f;
  }

  /** Compat — read-only accessor for 17F decorator consumption. Returns null
   *  until a factory is registered. */
  getObstacleFactory(): ObstacleFactory | null {
    return this.factory;
  }

  /** All currently-live obstacles. With the spawn-loop gone this is empty
   *  until 17F lands; tests and HUDs that introspect rely on the empty case. */
  liveObstacles(): readonly Obstacle[] {
    return this.pool.filter((o) => o.alive);
  }

  /** Per-frame tick — no-op. Signature preserved so main.ts doesn't need
   *  changing; the call still flows through. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number, _uniformsTime: number, _cosmoX: number): void {
    // intentional no-op — see file header
    void this.hooks; // keep ref so the audio-now reader stays alive for 17F
  }

  /** Find the closest obstacle ahead of `cosmoX` within `tapWindow`. With an
   *  empty pool returns null — InteractionManager's tap-handler degrades
   *  gracefully (see refactored handleTap). */
  closestAhead(cosmoX: number, tapWindow = 3.5): Obstacle | null {
    let best: Obstacle | null = null;
    let bestDx = Infinity;
    for (const o of this.pool) {
      if (!o.alive) continue;
      const dx = o.x - cosmoX;
      if (dx > 0 && dx < tapWindow && dx < bestDx) {
        best = o;
        bestDx = dx;
      }
    }
    return best;
  }

  destroy(): void {
    for (const o of this.pool) {
      if (o.group.parent) o.group.parent.remove(o.group);
    }
    this.pool = [];
    void this.scene;
  }
}
