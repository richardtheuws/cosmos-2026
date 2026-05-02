/**
 * ObstacleManager — Sprint 15B
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
 *     hasn't moved in 0.3s (paused / pre-gesture), we fall back to a 1.6-2.4s
 *     drift-loose timer so onboarding still has obstacles.
 */
import * as THREE from 'three';

const MAX_POOL_SIZE = 12;
const SPAWN_AHEAD_X = 6.0;
/** Distance behind Cosmo a recycled obstacle is "off-screen". */
const RECYCLE_BEHIND_X = 4.0;
/** Drift-loose fallback spawn period. */
const FALLBACK_SPAWN_MIN_S = 1.6;
const FALLBACK_SPAWN_MAX_S = 2.4;
const ASSUMED_BPM = 86; // matches slow-bloom default; doesn't need to be exact

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
      // Beat-loose mode: spawn on a beat near every 2 bars (8 beats).
      const beatPeriod = 60 / ASSUMED_BPM;
      const spawnPeriod = beatPeriod * 4; // ~2.8s at 86 BPM
      if (audioT - this.lastAudioSpawnAt >= spawnPeriod) {
        this.lastAudioSpawnAt = audioT;
        this.spawnAhead(cosmoX);
      }
    } else {
      // Drift-loose fallback.
      this.fallbackSpawnT += dt;
      if (this.fallbackSpawnT >= this.fallbackNextSpawn) {
        this.spawnAhead(cosmoX);
        this.scheduleNextFallback(this.fallbackSpawnT);
      }
    }

    // Recycle obstacles that have fallen far behind Cosmo.
    for (const o of this.pool) {
      if (o.alive && o.x < cosmoX - RECYCLE_BEHIND_X) {
        this.recycle(o);
      }
    }
  }

  private scheduleNextFallback(now: number): void {
    const interval =
      FALLBACK_SPAWN_MIN_S +
      Math.random() * (FALLBACK_SPAWN_MAX_S - FALLBACK_SPAWN_MIN_S);
    this.fallbackNextSpawn = now + interval;
  }

  private spawnAhead(cosmoX: number): void {
    if (this.aliveCount() >= MAX_POOL_SIZE) return;
    const kinds: ObstacleKind[] = ['low', 'tall', 'gap'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];

    // Try to recycle a dead one, else allocate new.
    let obstacle = this.pool.find((o) => !o.alive);
    if (!obstacle) {
      const group = this.factory(kind);
      obstacle = { group, alive: false, kind, x: 0 };
      this.pool.push(obstacle);
    } else {
      // Replace the kind & visuals — strip old children + repopulate.
      while (obstacle.group.children.length) {
        const c = obstacle.group.children[0];
        obstacle.group.remove(c);
        // Don't dispose geometries — recycled instances are short-lived.
      }
      const fresh = this.factory(kind);
      while (fresh.children.length) obstacle.group.add(fresh.children[0]);
      obstacle.kind = kind;
    }
    obstacle.x = cosmoX + SPAWN_AHEAD_X;
    obstacle.group.position.set(obstacle.x, 0, 0);
    obstacle.alive = true;
    this.scene.add(obstacle.group);
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
