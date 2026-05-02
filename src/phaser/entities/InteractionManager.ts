/**
 * InteractionManager — Sprint 15B
 *
 * Listens to gestures from the global InputController and translates them into
 * suggestions for CosmoAgent. NOT a controller — Cosmo's RNG decides if the
 * suggestion sticks. This file is the boundary where "player intent" becomes
 * "agency RNG roll". The brief explicitly forbids a deterministic
 * voorspelbare-mode toggle, so this manager has no `force` param anywhere.
 *
 * Gesture vocabulary
 * ──────────────────
 *   swipe-up     → spawn trampoline under Cosmo, queue jump-decision (80% commit)
 *   swipe-down   → spawn duck-mushroom platform, queue duck-decision (80% commit)
 *   tap         → if a tap-window obstacle exists, queue tap-decision (50/50 jump/duck)
 *   longHold    → trigger wave + vibe-meter +25%
 *   holdEnd 350+ms → no-op for 15B (was platformer shockwave; doesn't fit weirdo-runner)
 *
 * Trampoline + mushroom platforms
 *   Spawned as transient THREE.Group meshes, lifetime ≈ 1.4s. They fade out
 *   after Cosmo is past them. They're cosmetic, not collision — Cosmo's RNG
 *   does the actual jump/duck decision; the platform is just a hint to the
 *   player that their input registered.
 *
 * Failure detection
 *   Per the brief: "Cosmo valt off-platform → nevel-portal opent". We
 *   detect a "tall" obstacle that Cosmo didn't jump over (because RNG-
 *   ignored) and trigger forceFall(). 10% vibe-meter decay is the cost.
 */
import * as THREE from 'three';
import type { GestureEvent, InputController } from '../../core/inputController';
import type { CosmoAgent } from './CosmoAgent';
import type { Obstacle, ObstacleManager } from './ObstacleManager';
import type { VibeMeter } from './VibeMeter';

const TRAMPOLINE_LIFETIME_S = 1.4;
const MUSHROOM_LIFETIME_S = 1.4;
const TAP_WINDOW_AHEAD = 3.5;
const FAILURE_VIBE_DECAY = 0.1;
const SUCCESS_VIBE_GAIN = 0.18;
const WAVE_VIBE_GAIN = 0.25;
/** How close (world-X) Cosmo must be to a "tall" obstacle to fail-on-no-jump. */
const COLLISION_X_TOLERANCE = 0.45;

interface TransientPlatform {
  group: THREE.Group;
  spawnT: number;
  lifetime: number;
  /** World-X — used to decide "Cosmo passed it, fade out." */
  x: number;
}

export class InteractionManager {
  private input: InputController;
  private agent: CosmoAgent;
  private obstacles: ObstacleManager;
  private vibe: VibeMeter;
  /** THREE.Scene where trampolines / mushrooms get added. */
  private scene: THREE.Scene;

  /** Live transient platforms (trampolines + mushrooms). */
  private platforms: TransientPlatform[] = [];
  private offGesture: (() => void) | null = null;
  /** Track which obstacles we've already evaluated (to avoid double-fail). */
  private evaluatedObstacles = new WeakSet<Obstacle>();

  constructor(
    input: InputController,
    agent: CosmoAgent,
    obstacles: ObstacleManager,
    vibe: VibeMeter,
    scene: THREE.Scene,
  ) {
    this.input = input;
    this.agent = agent;
    this.obstacles = obstacles;
    this.vibe = vibe;
    this.scene = scene;
  }

  attach(): void {
    this.offGesture = this.input.onGesture((e) => this.onGesture(e));
  }

  detach(): void {
    this.offGesture?.();
    this.offGesture = null;
    for (const p of this.platforms) {
      if (p.group.parent) p.group.parent.remove(p.group);
    }
    this.platforms = [];
  }

  /** Per-frame tick. Updates transient platforms + collision-fail detection. */
  update(uniformsTime: number, cosmoX: number, cosmoY: number): void {
    // Fade and recycle transient platforms.
    this.platforms = this.platforms.filter((p) => {
      const age = uniformsTime - p.spawnT;
      const alpha = Math.max(0, 1 - age / p.lifetime);
      p.group.traverse((child) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mat && 'opacity' in mat) {
          mat.transparent = true;
          mat.opacity = alpha;
        }
      });
      if (age >= p.lifetime) {
        if (p.group.parent) p.group.parent.remove(p.group);
        return false;
      }
      return true;
    });

    // Collision / failure detection — only "tall" obstacles can knock Cosmo
    // out, and only if Cosmo isn't currently jumping (i.e. ignored the request).
    for (const o of this.obstacles.liveObstacles()) {
      if (this.evaluatedObstacles.has(o)) continue;
      const dx = o.x - cosmoX;
      if (Math.abs(dx) <= COLLISION_X_TOLERANCE && o.kind === 'tall') {
        this.evaluatedObstacles.add(o);
        if (this.agent.state !== 'jumping' && this.agent.state !== 'dancing') {
          // Cosmo collided → fall.
          this.agent.forceFall();
          this.vibe.decay(FAILURE_VIBE_DECAY);
        }
      } else if (dx < -COLLISION_X_TOLERANCE) {
        // Passed without incident — register so we don't re-eval and to
        // grant a small vibe boost for surviving each obstacle.
        this.evaluatedObstacles.add(o);
        this.vibe.gain(SUCCESS_VIBE_GAIN * 0.4);
      }
    }
    void cosmoY; // reserved for vertical collision once gaps are wired
  }

  // ── Gesture dispatch ─────────────────────────────────────────────────────

  private onGesture(e: GestureEvent): void {
    switch (e.name) {
      case 'swipe':
        this.handleSwipe(e.dy ?? 0, e.dx ?? 0);
        break;
      case 'tap':
        this.handleTap();
        break;
      case 'longHold':
        this.handleLongHold();
        break;
      // holdStart / holdEnd / pinch — ignored for 15B (no platformer-style crouch).
    }
  }

  private handleSwipe(dy: number, dx: number): void {
    // Vertical-dominant swipe? Up = trampoline, Down = mushroom.
    if (Math.abs(dy) <= Math.abs(dx) * 1.2) return; // horizontal swipe — ignored
    if (dy < 0) {
      this.spawnTrampoline();
      this.agent.queueTrampolineDecision();
    } else {
      this.spawnMushroom();
      this.agent.queueMushroomDecision();
    }
  }

  private handleTap(): void {
    const o = this.obstacles.closestAhead(this.agent.worldX, TAP_WINDOW_AHEAD);
    if (!o) return;
    this.agent.queueTapDecision();
  }

  private handleLongHold(): void {
    this.agent.triggerWave();
    this.vibe.gain(WAVE_VIBE_GAIN);
  }

  // ── Transient platform meshes ────────────────────────────────────────────

  private spawnTrampoline(): void {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.5, 0.06, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf4a261,
      transparent: true,
      opacity: 0.95,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    const padGeo = new THREE.CircleGeometry(0.5, 24);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0xb85c7e,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    group.add(pad);
    group.position.set(this.agent.worldX, 0, 0);
    this.scene.add(group);
    this.platforms.push({
      group,
      spawnT: performance.now() / 1000,
      lifetime: TRAMPOLINE_LIFETIME_S,
      x: this.agent.worldX,
    });
  }

  private spawnMushroom(): void {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 12);
    const stemMat = new THREE.MeshBasicMaterial({ color: 0xf5edd8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2;
    group.add(stem);
    const capGeo = new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshBasicMaterial({
      color: 0xb85c7e,
      transparent: true,
      opacity: 0.92,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.42;
    group.add(cap);
    group.position.set(this.agent.worldX + 0.3, 0, 0);
    this.scene.add(group);
    this.platforms.push({
      group,
      spawnT: performance.now() / 1000,
      lifetime: MUSHROOM_LIFETIME_S,
      x: this.agent.worldX + 0.3,
    });
  }
}
