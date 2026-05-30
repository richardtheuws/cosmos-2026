/**
 * cosmoAnimDirector.ts — Wave 21.2 (2026-05-05) — billboard-cosmo anim set
 *
 * After the Wave 21.2 pivot (NORTH-STAR §6, second 2026-05-05 entry), Cosmo is
 * a single billboard plane carrying the canonical hero-PNG. The director's
 * 7-anim set collapses to **4 surviving anims** that depend only on the root
 * Group's transforms:
 *
 *  - idle-breath   →  root.scale.y pulse (calm breath)
 *  - walk-sway     →  plane.rotation.z ±0.03 rad (replaces the dead disc-Y bob)
 *  - jump-arc      →  root.scale.y squash → stretch → settle
 *  - climb         →  root.rotation.z = π/2  (Wave 22+ climb-state)
 *
 * Retired anims (would have needed bones that no longer exist):
 *  - blink         →  needed eye-decal-plane Y-scale; no eye decal exists.
 *                     Eyes are painted into the hero. Future option: an
 *                     overlay plane that pulses alpha (deferred to Wave 22+).
 *  - head-track    →  needed head-bone quaternion. Future option: subtle UV-
 *                     offset for "looking at you" parallax (deferred).
 *  - antenna-bob   →  needed antenna-bone. Antenna lives inside the hero's
 *                     painted silhouette and rides idle-breath naturally.
 *
 * The Director still ticks every frame and is responsible for calling the rig's
 * billboard update at the END of its tick, so the plane faces the camera with
 * the freshly-written transforms (squash-stretch / climb rotation / etc).
 *
 * Composability — what stacks vs preempts:
 *  - idle-breath + walk-sway can stack (different transforms, additive).
 *  - jump-arc preempts walk-sway (root.scale.y is owned by jump while jumping).
 *  - climb preempts walk-sway and jump-arc (root rotates 90°; nothing else
 *    runs meaningfully in that orientation).
 *
 * Brand contract (NORTH-STAR §3): the world breathes, doesn't shake.
 */
import * as THREE from 'three';
import type { CosmoV2Rig } from './cosmoV2';

// ── Tunables (calm baseline) ──────────────────────────────────────────────
const IDLE_BREATH_HZ = 0.45;
const IDLE_BREATH_AMPL = 0.035; // ±3.5% — Wave 22: the old ±2% read as static on
// the billboard (Richard, 2026-05-30: "geen smooth movement"). Still calm.
/** Walk-sway amplitude on plane.rotation.z. Tiny — replaces the dead disc bob
 *  with a barely-perceptible shoulder-tilt. */
const WALK_SWAY_AMPL = 0.03; // rad (~1.7°)
const WALK_FREQ_PER_VEL = 6.0; // rad/s per m/s velocity
const WALK_FREQ_MIN = 4.0;
const WALK_FREQ_MAX = 12.0;
const WALK_VEL_THRESHOLD_SQ = 0.0025; // |v|² > 0.05²
/** Jump-arc 3-phase scripted timeline (seconds). */
const JUMP_ANTICIPATION_S = 0.15;
const JUMP_LAUNCH_S = 0.40;
const JUMP_SETTLE_S = 0.25;
const JUMP_TOTAL_S = JUMP_ANTICIPATION_S + JUMP_LAUNCH_S + JUMP_SETTLE_S; // 0.80s
const JUMP_ANTICIP_SQUASH = 0.85;
const JUMP_LAUNCH_STRETCH = 1.05;
const JUMP_SETTLE_BOUNCE = 0.95;

// ── Per-frame context the host passes in ──────────────────────────────────
export interface AnimCtx {
  /** Cosmo's current world-space velocity. Length below threshold → idle. */
  velocity: THREE.Vector3;
  /** What Cosmo is looking at. World-space. Kept for API stability — the
   *  billboard ignores it (no head-track in 21.2). May come back later as a
   *  UV-parallax cue. */
  focusPoint: THREE.Vector3 | null;
  /** True while CosmoAgent state-machine is in 'jumping'. */
  isJumping: boolean;
  /** True while CosmoAgent is mid trampoline-bounce ('bouncing' state). Drives
   *  the same squash→stretch→settle arc as a jump (Wave 22). */
  isBouncing?: boolean;
  /** True while a wall-cling/climb mode is active. */
  isClimbing: boolean;
  /** Camera the billboard should face. The director calls rig.update(camera)
   *  at the end of each tick so the plane orientation reflects the same
   *  transforms written this frame. */
  camera: THREE.Camera;
}

/**
 * Procedural animation director for CosmoV2 (billboard variant).
 *
 * Construct once per rig instance. Call `tick(dt, ctx)` once per frame.
 */
export class CosmoAnimDirector {
  private rig: CosmoV2Rig;

  // Captured rest-pose at construct time. Additive composition keeps host-
  // written transforms (e.g. CosmoAgent's facing scale.x) from being clobbered.
  private rootRestScaleY: number;
  private planeRestRotZ: number;

  // ── Walk phase ────────────────────────────────────────────────────────
  private walkPhase = 0;

  // ── Jump-arc internal phase (s since enter) ───────────────────────────
  private jumpT = -1; // -1 = not jumping
  private wasJumpingLastFrame = false;

  // ── Time accumulator ──────────────────────────────────────────────────
  private t = 0;

  constructor(rig: CosmoV2Rig) {
    this.rig = rig;
    this.rootRestScaleY = rig.root.scale.y;
    this.planeRestRotZ = rig.plane.rotation.z;
  }

  /** Per-frame tick. Called from CosmoAgent.tickAnimDirector AFTER state-
   *  machine has written position/state, so director's transforms layer last.
   *  At the end of the tick, the rig's billboard `update(camera)` is called
   *  so the plane faces the camera with the freshly-written transforms. */
  tick(dt: number, ctx: AnimCtx): void {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    this.t += dt;

    const isClimbing = ctx.isClimbing;
    // Wave 22 — a trampoline bounce animates with the same squash-stretch arc as
    // a jump. Both last 0.8s, so the scripted timeline lines up with the worldY
    // sin-arc the state-machine drives.
    const isJumping = ctx.isJumping || ctx.isBouncing === true;

    // ── 1. idle-breath ──────────────────────────────────────────────────
    // Suppressed during jump (squash-stretch owns root.scale.y) and climb.
    const isIdleBreathActive =
      !isJumping &&
      !isClimbing &&
      ctx.velocity.lengthSq() < WALK_VEL_THRESHOLD_SQ;
    if (isIdleBreathActive) {
      const breath = Math.sin(this.t * IDLE_BREATH_HZ * Math.PI * 2);
      this.rig.root.scale.y = this.rootRestScaleY * (1 + breath * IDLE_BREATH_AMPL);
    } else if (!isJumping) {
      // Quick relaxation toward rest (avoid sudden snap when state changes).
      this.rig.root.scale.y +=
        (this.rootRestScaleY - this.rig.root.scale.y) * Math.min(1, dt * 8);
    }

    // ── 2. walk-sway ────────────────────────────────────────────────────
    // Mutually exclusive with jump and climb. Replaces the dead disc-Y bob.
    if (!isJumping && !isClimbing) {
      this.tickWalkSway(dt, ctx.velocity);
    } else {
      // Decay sway back to rest so the next idle frame doesn't pop.
      this.relaxSway(dt);
    }

    // ── 3. jump-arc ─────────────────────────────────────────────────────
    if (isJumping) {
      if (!this.wasJumpingLastFrame) this.jumpT = 0;
      this.tickJumpArc(dt);
    } else if (this.wasJumpingLastFrame) {
      // Just landed — relax root.scale.y.
      this.jumpT = -1;
      this.rig.root.scale.y = this.rootRestScaleY;
    }
    this.wasJumpingLastFrame = isJumping;

    // ── 4. climb ────────────────────────────────────────────────────────
    if (isClimbing) {
      this.rig.root.rotation.z = Math.PI / 2;
    } else if (Math.abs(this.rig.root.rotation.z) > 1e-4) {
      // Relax root rotation back to upright when climb releases.
      this.rig.root.rotation.z +=
        (0 - this.rig.root.rotation.z) * Math.min(1, dt * 6);
    }

    // ── billboard ───────────────────────────────────────────────────────
    // Plane lookAt camera with up-vector locked to world-up.
    this.rig.update(ctx.camera);
  }

  // ── walk-sway ────────────────────────────────────────────────────────
  private tickWalkSway(dt: number, velocity: THREE.Vector3): void {
    const v2 = velocity.lengthSq();
    if (v2 < WALK_VEL_THRESHOLD_SQ) {
      this.relaxSway(dt);
      return;
    }
    const speed = Math.sqrt(v2);
    const freq = clamp(speed * WALK_FREQ_PER_VEL, WALK_FREQ_MIN, WALK_FREQ_MAX);
    this.walkPhase += freq * dt;
    const sway = Math.sin(this.walkPhase) * WALK_SWAY_AMPL;
    this.rig.plane.rotation.z = this.planeRestRotZ + sway;
  }

  private relaxSway(dt: number): void {
    const k = Math.min(1, dt * 8);
    this.rig.plane.rotation.z +=
      (this.planeRestRotZ - this.rig.plane.rotation.z) * k;
  }

  // ── jump-arc ─────────────────────────────────────────────────────────
  private tickJumpArc(dt: number): void {
    const t = (this.jumpT += dt);
    let scaleY = 1;
    if (t < JUMP_ANTICIPATION_S) {
      // Squash phase: 1 → JUMP_ANTICIP_SQUASH over 0.15s
      const p = t / JUMP_ANTICIPATION_S;
      scaleY = lerp(1, JUMP_ANTICIP_SQUASH, p);
    } else if (t < JUMP_ANTICIPATION_S + JUMP_LAUNCH_S) {
      // Launch phase: anticip → stretch → 1 (sin half-arc)
      const p = (t - JUMP_ANTICIPATION_S) / JUMP_LAUNCH_S;
      scaleY = lerp(JUMP_ANTICIP_SQUASH, JUMP_LAUNCH_STRETCH,
        Math.sin(p * Math.PI));
    } else if (t < JUMP_TOTAL_S) {
      // Settle phase: 1 → settle-bounce → 1
      const p = (t - JUMP_ANTICIPATION_S - JUMP_LAUNCH_S) / JUMP_SETTLE_S;
      scaleY = lerp(1, JUMP_SETTLE_BOUNCE, Math.sin(p * Math.PI));
    } else {
      // Beyond scripted arc — relax to rest (state-machine clears isJumping
      // shortly; this is the safety hold-position).
      scaleY = 1;
    }
    this.rig.root.scale.y = this.rootRestScaleY * scaleY;
  }

  /** Release references. The director holds no GPU resources of its own —
   *  the rig owns the meshes and disposes them itself. */
  dispose(): void {
    /* nothing to release in 21.2 */
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
