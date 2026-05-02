/**
 * ObstacleManager — Sprint 15B + 16E.
 *
 * Spawns obstacles ahead of Cosmo (≈ 6 world-units ahead) into the THREE.Scene
 * the CosmoStage owns. Recycles a pool of MAX_POOL_SIZE so we never allocate
 * per-spawn after the first 12 are warm.
 *
 * Until Sprint 15C delivers the obstacle-asset library, each obstacle is a
 * canvas-drawn primitive (a low-poly mesh with the saffron/rose palette). The
 * exposed factory is `setObstacleFactory()` so 15C can swap in real GLBs
 * without touching this file.
 *
 * Spawn timing
 *   - Loosely beat-coupled: we read `audioBridge.musicCurrentTime()` and
 *     spawn on bar-edges (BPM-derived) when one is due. If audioCurrentTime
 *     hasn't moved in 0.3s (paused / pre-gesture), we fall back to a 2.4-3.8s
 *     drift-loose timer so onboarding still has obstacles.
 *
 * Sprint 16E — spawn-balance:
 *   - Spacing bumped from 1.6-2.4s → 2.4-3.8s (felt overrun on mobile).
 *   - Beat-loose period bumped 4 beats → 6 beats (~4.2s @ 86 BPM).
 *   - Per-kind cooldown: 'tall' max once per 8s (mouth-pillar/tree dominated).
 *   - Anti-repeat: never spawn the same obstacle id more than 2× in a row.
 */
import * as THREE from 'three';

const MAX_POOL_SIZE = 12;
const SPAWN_AHEAD_X = 6.0;
/** Distance behind Cosmo a recycled obstacle is "off-screen". */
const RECYCLE_BEHIND_X = 4.0;
/** Drift-loose fallback spawn period (Sprint 16E — was 1.6-2.4s). */
const FALLBACK_SPAWN_MIN_S = 2.4;
const FALLBACK_SPAWN_MAX_S = 3.8;
const ASSUMED_BPM = 86; // matches slow-bloom default; doesn't need to be exact
/** Sprint 16E — minimum gap between two 'tall' spawns (audio-clock seconds). */
const TALL_COOLDOWN_S = 8.0;
/** Sprint 16E — anti-repeat: max consecutive spawns of the same obstacle id. */
const MAX_SAME_ID_RUN = 2;
/** Sprint 16E — bounded re-pick attempts so we never busy-loop on a degenerate pool. */
const MAX_REPICK_ATTEMPTS = 4;

export type ObstacleKind = 'low' | 'tall' | 'gap';

export interface Obstacle {
  /** World-space root. */
  group: THREE.Group;
  /** "alive" means in-scene and ahead of Cosmo. */
  alive: boolean;
  /** Kind hint — InteractionManager uses this to pick jump-vs-duck on tap. */
  kind: ObstacleKind;
  /** World-X of the obstacle's centre. */
  x: number;
}

export type ObstacleFactory = (kind: ObstacleKind) => THREE.Group;

/**
 * Sprint 16E — anti-repeat protocol. Factories may attach an optional
 * `lastSpawnedId` getter so ObstacleManager can know which weirdo was just
 * picked from a weighted pool (without unwrapping the THREE.Group). Standard
 * `ObstacleFactory` instances without this field are tolerated — anti-repeat
 * just degrades to kind-level (still useful, since tall+gap each have one
 * heavy item).
 */
type FactoryWithIdReadout = ObstacleFactory & {
  lastSpawnedId?: () => string | null;
};

/** Default canvas-primitive factory. Sprint 15C swaps via setObstacleFactory(). */
function defaultFactory(kind: ObstacleKind): THREE.Group {
  const group = new THREE.Group();
  // Palette-locked colours per CLAUDE.md (no emoji, palette-only).
  const SAFFRON = 0xf4a261;
  const ROSE = 0xb85c7e;
  const INK = 0x3d2e4a;
  if (kind === 'low') {
    // Crouchable — short wide block.
    const geo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: ROSE,
      roughness: 0.7,
      emissive: SAFFRON,
      emissiveIntensity: 0.08,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.2;
    group.add(mesh);
  } else if (kind === 'tall') {
    // Jumpable — tall pillar.
    const geo = new THREE.BoxGeometry(0.4, 1.6, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color: INK,
      roughness: 0.9,
      emissive: ROSE,
      emissiveIntensity: 0.12,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.8;
    group.add(mesh);
  } else {
    // Gap — invisible trigger; we render a faint coloured ring as ground-cue.
    const geo = new THREE.RingGeometry(0.35, 0.55, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: SAFFRON,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    group.add(mesh);
  }
  return group;
}

export interface ObstacleManagerHooks {
  /** Read the audio-clock so spawns gently align to bar edges. Returns 0 pre-gesture. */
  audioNow(): number;
}

export class ObstacleManager {
  private scene: THREE.Scene;
  private hooks: ObstacleManagerHooks;
  private pool: Obstacle[] = [];
  private factory: ObstacleFactory = defaultFactory;
  /** Loose-beat scheduler — when did we last spawn (in audio-seconds). */
  private lastAudioSpawnAt = -Infinity;
  /** Drift-loose fallback timer (uniforms.time domain). */
  private fallbackSpawnT = 0;
  private fallbackNextSpawn = 0;
  /** Last seen audio time, used to detect frozen audio (= pre-gesture). */
  private lastSeenAudioT = -1;
  private audioFrozenSince = -Infinity;
  /** Sprint 15D — onboarding gate. While paused, update() is a no-op so no
   *  obstacles spawn during AWAIT_TOUCH/PORTAL_OPENING/COSMO_ARRIVING/BONDING. */
  paused = false;
  /** Sprint 16E — last 'tall' spawn time (audio-seconds; -Infinity = never).
   *  When audio is frozen we use uniformsTime (passed into update). The two
   *  domains never mix because we only update this field via the active path. */
  private lastTallSpawnAt = -Infinity;
  /** Sprint 16E — anti-repeat tracking (works at the asset-id level when the
   *  factory exposes lastSpawnedId(); otherwise falls back to kind-level). */
  private lastSpawnedId: string | null = null;
  private sameIdRun = 0;
  private lastSpawnedKind: ObstacleKind | null = null;
  private sameKindRun = 0;

  constructor(scene: THREE.Scene, hooks: ObstacleManagerHooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.scheduleNextFallback(0);
  }

  /** Sprint 15C will call this with a GLB-loading factory. */
  setObstacleFactory(f: ObstacleFactory): void {
    this.factory = f;
  }

  /** All currently-live obstacles ahead of `cosmoX`. */
  liveObstacles(): readonly Obstacle[] {
    return this.pool.filter((o) => o.alive);
  }

  /** Per-frame tick. */
  update(dt: number, uniformsTime: number, cosmoX: number): void {
    if (this.paused) return;
    const audioT = this.hooks.audioNow();

    // Detect frozen audio (autoplay-policy not yet unlocked).
    if (audioT === this.lastSeenAudioT) {
      if (this.audioFrozenSince < 0) this.audioFrozenSince = uniformsTime;
    } else {
      this.audioFrozenSince = -Infinity;
      this.lastSeenAudioT = audioT;
    }
    const audioFrozen =
      this.audioFrozenSince > 0 && uniformsTime - this.audioFrozenSince > 0.3;

    if (!audioFrozen && audioT > 0) {
      // Beat-loose mode: spawn on a beat near every ~6 beats (Sprint 16E
      // bumped from 4 → 6 to match the calmer 2.4-3.8s fallback spacing).
      const beatPeriod = 60 / ASSUMED_BPM;
      const spawnPeriod = beatPeriod * 6; // ~4.2s at 86 BPM
      if (audioT - this.lastAudioSpawnAt >= spawnPeriod) {
        this.lastAudioSpawnAt = audioT;
        this.spawnAhead(cosmoX, audioT);
      }
    } else {
      // Drift-loose fallback.
      this.fallbackSpawnT += dt;
      if (this.fallbackSpawnT >= this.fallbackNextSpawn) {
        this.spawnAhead(cosmoX, uniformsTime);
        this.scheduleNextFallback(this.fallbackSpawnT);
      }
    }

    // Recycle obstacles that have fallen far behind Cosmo + Sprint 16C: tick
    // any per-obstacle frame-cyclers (mouth-pillar sprite-sheet) using the
    // shared audio clock so all live mouths breathe in lock-step.
    for (const o of this.pool) {
      if (!o.alive) continue;
      if (o.x < cosmoX - RECYCLE_BEHIND_X) {
        this.recycle(o);
        continue;
      }
      const cycler = o.group.userData.mouthFrameUpdate as
        | ((audioNow: number, bpm?: number) => void)
        | undefined;
      if (cycler) cycler(audioT, ASSUMED_BPM);
    }
  }

  private scheduleNextFallback(now: number): void {
    const interval =
      FALLBACK_SPAWN_MIN_S +
      Math.random() * (FALLBACK_SPAWN_MAX_S - FALLBACK_SPAWN_MIN_S);
    this.fallbackNextSpawn = now + interval;
  }

  /** Pick the next ObstacleKind, honouring the 'tall' cooldown (Sprint 16E).
   *  `now` is whichever clock domain the caller is in (audio or uniforms). */
  private pickKind(now: number): ObstacleKind {
    const kinds: ObstacleKind[] = ['low', 'tall', 'gap'];
    const tallOnCooldown = now - this.lastTallSpawnAt < TALL_COOLDOWN_S;
    const candidates = tallOnCooldown ? kinds.filter((k) => k !== 'tall') : kinds;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Build a fresh THREE.Group from the factory and return both the group
   *  and the asset-id the factory produced (when exposed). */
  private invokeFactory(kind: ObstacleKind): { group: THREE.Group; id: string | null } {
    const group = this.factory(kind);
    const fac = this.factory as FactoryWithIdReadout;
    const id = fac.lastSpawnedId
      ? fac.lastSpawnedId()
      : ((group.userData.weirdoId as string | undefined) ?? null);
    return { group, id };
  }

  /** Sprint 16E spawn pipeline:
   *   1. Pick kind honouring TALL_COOLDOWN_S.
   *   2. Build via factory; if the produced asset-id matches the last >= 2 in
   *      a row, re-roll up to MAX_REPICK_ATTEMPTS. After that we accept the
   *      pick to avoid infinite loops on degenerate pools.
   *   3. Update bookkeeping (lastTallSpawnAt, lastSpawnedId/Kind run-length).
   */
  private spawnAhead(cosmoX: number, now: number): void {
    if (this.aliveCount() >= MAX_POOL_SIZE) return;

    let kind = this.pickKind(now);
    let result = this.invokeFactory(kind);

    // Anti-repeat: re-roll if we'd produce the same id more than MAX_SAME_ID_RUN
    // times in a row. We re-pick the kind too — that gives the loop a real
    // chance to escape (otherwise a single-entry pool would never converge).
    let attempts = 0;
    while (
      attempts < MAX_REPICK_ATTEMPTS &&
      result.id !== null &&
      result.id === this.lastSpawnedId &&
      this.sameIdRun >= MAX_SAME_ID_RUN
    ) {
      // Dispose the rejected group's children references — they were never
      // added to the scene, but we still want the GC to reclaim them quickly.
      while (result.group.children.length) result.group.remove(result.group.children[0]);
      kind = this.pickKind(now);
      result = this.invokeFactory(kind);
      attempts++;
    }

    // Try to recycle a dead one, else allocate new.
    let obstacle = this.pool.find((o) => !o.alive);
    if (!obstacle) {
      obstacle = { group: result.group, alive: false, kind, x: 0 };
      this.pool.push(obstacle);
    } else {
      // Replace the kind & visuals — strip old children + repopulate.
      while (obstacle.group.children.length) {
        const c = obstacle.group.children[0];
        obstacle.group.remove(c);
        // Don't dispose geometries — recycled instances are short-lived.
      }
      while (result.group.children.length) obstacle.group.add(result.group.children[0]);
      // Carry over the per-frame cycler (mouth-pillar) and asset-id tag from
      // the freshly-built group so frame-stepping still works after recycle.
      obstacle.group.userData.mouthFrameUpdate = result.group.userData.mouthFrameUpdate;
      obstacle.group.userData.weirdoId = result.group.userData.weirdoId;
      obstacle.kind = kind;
    }

    obstacle.x = cosmoX + SPAWN_AHEAD_X;
    obstacle.group.position.set(obstacle.x, 0, 0);
    obstacle.alive = true;
    this.scene.add(obstacle.group);

    // Bookkeeping for cooldown + anti-repeat.
    if (kind === 'tall') this.lastTallSpawnAt = now;
    if (result.id !== null) {
      this.sameIdRun = result.id === this.lastSpawnedId ? this.sameIdRun + 1 : 1;
      this.lastSpawnedId = result.id;
    } else {
      // No id readout — reset to 0 so a future id-aware factory starts clean.
      this.sameIdRun = 0;
      this.lastSpawnedId = null;
    }
    this.sameKindRun = kind === this.lastSpawnedKind ? this.sameKindRun + 1 : 1;
    this.lastSpawnedKind = kind;
  }

  private recycle(o: Obstacle): void {
    o.alive = false;
    if (o.group.parent) o.group.parent.remove(o.group);
  }

  private aliveCount(): number {
    let n = 0;
    for (const o of this.pool) if (o.alive) n++;
    return n;
  }

  /** Find the closest obstacle that is ahead of (and within `tapWindow` of) Cosmo. */
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
  }
}
