/**
 * cosmoAnimDirector.ts — Wave 21 (2026-05-04)
 *
 * Procedural animation director for the CosmoV2 hybrid rig. Wires the
 * 7 always-on / state-driven life signs that make Cosmo *alive* on screen
 * regardless of what the state-machine in `CosmoAgent` is doing.
 *
 * Why a separate director (not more methods on CosmoAgent)
 * --------------------------------------------------------
 * CosmoAgent owns the discrete-state machine (idle / walking / jumping /
 * ducking / dancing / falling / walking-to / bouncing — all from Sprint 17D
 * lineage). That code drives Cosmo's *position* and *story*. The director
 * drives the *life signs* — breath, blink, head-track, antenna-bob, walk-
 * stride disc oscillation, jump squash-stretch, climb-rotation. They are
 * additive: every animation here LAYERS on top of whatever the state machine
 * already wrote for the frame, never replacing it.
 *
 * The split keeps CosmoAgent focused on state transitions and the director
 * focused on procedural visuals. Future biomes can install their own
 * director-extensions (e.g. underwater-bob) without touching CosmoAgent.
 *
 * Composability rules
 * -------------------
 *  - idle-breath + blink + antenna-bob + head-track ALL stack — they touch
 *    different transforms (root.scale.y vs eye-decal.scale.y vs antenna-
 *    bone.quaternion vs head-bone.quaternion).
 *  - walk and jump-arc are mutually exclusive — jump preempts walk. Walk
 *    only oscillates when velocity is above threshold AND not jumping AND
 *    not climbing.
 *  - climb preempts everything except blink. (Climbing in 90°-rotation,
 *    you still want him alive.) Idle-breath is suspended during climb.
 *
 * deltaTime contract
 * ------------------
 * tick(dt, ctx) is called once per frame. dt is in SECONDS. Animations are
 * frame-rate independent: amplitudes/frequencies are in their natural units
 * (Hz, m/s, rad/s) and integrated against dt.
 *
 * Stateless where possible — internal state is only:
 *  - blink timers (one per eye, with offset)
 *  - antenna spring (lagged head-track)
 *  - walk phase accumulator
 *  - jump-arc phase accumulator (when isJumping)
 *  - resting quaternions captured at construct-time
 *
 * Brand contract (NORTH-STAR §3): the world breathes, doesn't shake. Every
 * amplitude here is calibrated to *calm baseline*. Anything that pushes
 * Cosmo into "constant trippy" foreground is an anti-pattern.
 */
import * as THREE from 'three';
import type { CosmoV2Rig } from './cosmoV2';

// ── Tunables (calm baseline) ──────────────────────────────────────────────
const IDLE_BREATH_HZ = 0.4;
const IDLE_BREATH_AMPL = 0.02; // ±2%
const BLINK_INTERVAL_MIN_S = 4.0;
const BLINK_INTERVAL_MAX_S = 7.0;
const BLINK_DURATION_S = 0.12;
/** Lerp factor toward focusPoint orientation (per frame at 60fps). dt-corrected. */
const HEAD_TRACK_LERP_RATE = 6.0;
/** Head yaw is clamped — Cosmo doesn't owl-rotate. */
const HEAD_YAW_MAX_RAD = 0.55; // ~31°
const HEAD_PITCH_MAX_RAD = 0.30; // ~17°
/** Antenna spring: critically damped, lags head by ~80ms. */
const ANTENNA_SPRING_RATE = 12.0;
const ANTENNA_SPRING_DAMP = 7.0;
const ANTENNA_LAG_AMPL = 0.45; // how strongly antenna copies head-yaw
/** Walk: per-disc Y-bob amplitude + base frequency, scaled by velocity. */
const WALK_DISC_AMPL = 0.06; // m
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
/** Climb: full-body 90° rotation. Discs oscillate vertically (hand-walk). */
const CLIMB_DISC_AMPL = 0.07;
const CLIMB_DISC_FREQ = 5.0;

// ── Per-frame context the host passes in ──────────────────────────────────
export interface AnimCtx {
  /** Cosmo's current world-space velocity. Length below threshold → idle. */
  velocity: THREE.Vector3;
  /** What Cosmo is looking at. World-space. null → idle-orient. */
  focusPoint: THREE.Vector3 | null;
  /** True while CosmoAgent state-machine is in 'jumping'. Director runs the
   *  squash-stretch arc on top of the existing position-Y parabola. */
  isJumping: boolean;
  /** True while a wall-cling/climb mode is active. Wave 21 plumbing — no
   *  state-machine entry exists yet; flag stays false until Wave 22 climb. */
  isClimbing: boolean;
}

/**
 * Procedural animation director for CosmoV2.
 *
 * Construct once per rig instance. Call `tick(dt, ctx)` once per frame.
 * Call `dispose()` only when the rig is being destroyed; the director itself
 * holds no GPU resources but releases its bone references.
 */
export class CosmoAnimDirector {
  private rig: CosmoV2Rig;

  // ── Captured rest-pose ────────────────────────────────────────────────
  // We capture rest at construct-time so additive animations can compose
  // by quaternion-multiply rather than overwriting state set by upstream
  // (e.g. CosmoAgent.applyAI head-yaw). Director's contribution is layered
  // *on top* of whatever CosmoAgent left in the bone after its update().
  private headRestQuat: THREE.Quaternion;
  private antennaRestQuat: THREE.Quaternion;
  private bodyRestQuat: THREE.Quaternion;
  private rootRestScaleY: number;
  private discLRestY: number;
  private discRRestY: number;
  // Eye-decal plane references — when split decals are wired (Wave 21+),
  // these point at the eye planes. When still composite (legacy), they
  // remain null and the blink falls back to the face-decal global blink.
  private eyeDecalL: THREE.Mesh | null = null;
  private eyeDecalR: THREE.Mesh | null = null;

  // ── Blink timers (independent per eye) ────────────────────────────────
  private blinkLNextAt: number;
  private blinkRNextAt: number;
  private blinkLPhase = -1; // -1 = closed, in [0..BLINK_DURATION_S] = animating
  private blinkRPhase = -1;

  // ── Antenna spring state ──────────────────────────────────────────────
  private antennaYaw = 0;
  private antennaYawVel = 0;

  // ── Walk phase ────────────────────────────────────────────────────────
  private walkPhase = 0;

  // ── Jump-arc internal phase (s since enter) ───────────────────────────
  private jumpT = -1; // -1 = not jumping
  private wasJumpingLastFrame = false;

  // ── Time accumulator ──────────────────────────────────────────────────
  private t = 0;

  // ── Working scratch (avoid per-frame allocations) ─────────────────────
  private scratchQuat = new THREE.Quaternion();
  private scratchEuler = new THREE.Euler();
  private scratchVec = new THREE.Vector3();

  constructor(rig: CosmoV2Rig) {
    this.rig = rig;
    this.headRestQuat = rig.head.quaternion.clone();
    this.antennaRestQuat = rig.antennaBase.quaternion.clone();
    this.bodyRestQuat = rig.body.quaternion.clone();
    this.rootRestScaleY = rig.root.scale.y;
    this.discLRestY = rig.discL.position.y;
    this.discRRestY = rig.discR.position.y;

    // Schedule first blinks. Right eye fires slightly later — a sub-100ms
    // offset so the eyes don't blink in lockstep (the lockstep-blink reads
    // robotic).
    this.blinkLNextAt = nextBlinkAt(0);
    this.blinkRNextAt = nextBlinkAt(0) + 0.08;
  }

  /** Wire in split eye-decal planes (Wave 21 cosmoV2 update). When set,
   *  blink scales eye plane Y individually. When null, blink falls back to
   *  scaling the composite face-decal Y (legacy behavior). */
  setEyeDecals(left: THREE.Mesh | null, right: THREE.Mesh | null): void {
    this.eyeDecalL = left;
    this.eyeDecalR = right;
  }

  /** Per-frame tick. Called from CosmoAgent.update() AFTER state-machine
   *  has written position/state, so director's transforms layer last. */
  tick(dt: number, ctx: AnimCtx): void {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    this.t += dt;

    const isClimbing = ctx.isClimbing;
    const isJumping = ctx.isJumping;

    // ── 1. idle-breath ──────────────────────────────────────────────────
    // Suppressed during jump (squash-stretch owns root.scale.y) and climb.
    const isIdleBreathActive = !isJumping && !isClimbing
      && ctx.velocity.lengthSq() < WALK_VEL_THRESHOLD_SQ;
    if (isIdleBreathActive) {
      const breath = Math.sin(this.t * IDLE_BREATH_HZ * Math.PI * 2);
      this.rig.root.scale.y = this.rootRestScaleY * (1 + breath * IDLE_BREATH_AMPL);
    } else if (!isJumping) {
      // Quick relaxation toward rest (avoid sudden snap when state changes).
      this.rig.root.scale.y += (this.rootRestScaleY - this.rig.root.scale.y)
        * Math.min(1, dt * 8);
    }

    // ── 2. blink ────────────────────────────────────────────────────────
    // Always runs (even during climb/jump — eyes blink regardless).
    this.tickBlink(dt);

    // ── 3. head-track ───────────────────────────────────────────────────
    // Suspended during climb (head locked to wall-orientation).
    if (!isClimbing) {
      this.tickHeadTrack(dt, ctx.focusPoint);
    }

    // ── 4. antenna-bob ──────────────────────────────────────────────────
    // Always runs — antenna feels alive even at rest.
    this.tickAntenna(dt);

    // ── 5. walk ─────────────────────────────────────────────────────────
    // Mutually exclusive with jump and climb.
    if (!isJumping && !isClimbing) {
      this.tickWalk(dt, ctx.velocity);
    } else {
      // Decay disc Y back to rest so the next idle frame doesn't pop.
      this.relaxDiscs(dt);
    }

    // ── 6. jump-arc ─────────────────────────────────────────────────────
    if (isJumping) {
      if (!this.wasJumpingLastFrame) this.jumpT = 0;
      this.tickJumpArc(dt);
    } else if (this.wasJumpingLastFrame) {
      // Just landed — relax root.scale.y.
      this.jumpT = -1;
      this.rig.root.scale.y = this.rootRestScaleY;
    }
    this.wasJumpingLastFrame = isJumping;

    // ── 7. climb ────────────────────────────────────────────────────────
    if (isClimbing) {
      this.tickClimb(dt);
    } else {
      // Relax body rotation back to rest.
      const cur = this.rig.body.quaternion;
      cur.slerp(this.bodyRestQuat, Math.min(1, dt * 6));
    }
  }

  // ── 2. blink ──────────────────────────────────────────────────────────
  private tickBlink(dt: number): void {
    void dt;
    // Left eye scheduling
    if (this.blinkLPhase < 0 && this.t >= this.blinkLNextAt) {
      this.blinkLPhase = 0;
    }
    if (this.blinkLPhase >= 0) {
      this.blinkLPhase += dt;
      const s = blinkScaleY(this.blinkLPhase);
      this.applyEyeBlinkScaleL(s);
      if (this.blinkLPhase >= BLINK_DURATION_S) {
        this.blinkLPhase = -1;
        this.applyEyeBlinkScaleL(1);
        this.blinkLNextAt = nextBlinkAt(this.t);
      }
    }
    // Right eye (independent timer)
    if (this.blinkRPhase < 0 && this.t >= this.blinkRNextAt) {
      this.blinkRPhase = 0;
    }
    if (this.blinkRPhase >= 0) {
      this.blinkRPhase += dt;
      const s = blinkScaleY(this.blinkRPhase);
      this.applyEyeBlinkScaleR(s);
      if (this.blinkRPhase >= BLINK_DURATION_S) {
        this.blinkRPhase = -1;
        this.applyEyeBlinkScaleR(1);
        this.blinkRNextAt = nextBlinkAt(this.t);
      }
    }
  }

  private applyEyeBlinkScaleL(scale: number): void {
    if (this.eyeDecalL) {
      this.eyeDecalL.scale.y = scale;
      return;
    }
    // Fallback: composite face decal — both eyes blink together.
    this.rig.faceDecal.scale.y = scale;
  }
  private applyEyeBlinkScaleR(scale: number): void {
    if (this.eyeDecalR) {
      this.eyeDecalR.scale.y = scale;
      return;
    }
    // Fallback: composite face decal handled by left eye path; no-op here.
  }

  // ── 3. head-track ─────────────────────────────────────────────────────
  private tickHeadTrack(dt: number, focusPoint: THREE.Vector3 | null): void {
    let targetYaw = 0;
    let targetPitch = 0;
    if (focusPoint) {
      // Compute head-relative direction. The head sits on root → body → head;
      // for tracking we use root-space, which is "good enough" for the kid-
      // alien proportions (head is co-located with root.x at slight Y offset).
      this.scratchVec.copy(focusPoint).sub(this.rig.root.position);
      const dx = this.scratchVec.x;
      const dy = this.scratchVec.y;
      const dz = this.scratchVec.z;
      const horizDist = Math.hypot(dx, dz);
      targetYaw = Math.atan2(dx, dz === 0 ? 0.0001 : dz);
      targetPitch = Math.atan2(dy, horizDist === 0 ? 0.0001 : horizDist);
      // Clamp — Cosmo doesn't owl-rotate.
      targetYaw = clamp(targetYaw, -HEAD_YAW_MAX_RAD, HEAD_YAW_MAX_RAD);
      targetPitch = clamp(targetPitch, -HEAD_PITCH_MAX_RAD, HEAD_PITCH_MAX_RAD);
    }

    // Build target quaternion as rest * yaw * pitch.
    this.scratchEuler.set(-targetPitch, targetYaw, 0, 'YXZ');
    this.scratchQuat.setFromEuler(this.scratchEuler);
    const targetQ = this.scratchQuat.clone().premultiply(this.headRestQuat);

    // Lerp factor frame-rate corrected.
    const k = 1 - Math.exp(-HEAD_TRACK_LERP_RATE * dt);
    this.rig.head.quaternion.slerp(targetQ, k);

    // Memo for antenna spring — store target yaw for the lag.
    this.lastTargetHeadYaw = targetYaw;
  }
  private lastTargetHeadYaw = 0;

  // ── 4. antenna-bob ────────────────────────────────────────────────────
  private tickAntenna(dt: number): void {
    // Critically damped spring toward (lastTargetHeadYaw * ANTENNA_LAG_AMPL).
    // The mass-less spring is integrated with semi-implicit Euler.
    const target = this.lastTargetHeadYaw * ANTENNA_LAG_AMPL;
    const accel = ANTENNA_SPRING_RATE * (target - this.antennaYaw)
      - ANTENNA_SPRING_DAMP * this.antennaYawVel;
    this.antennaYawVel += accel * dt;
    this.antennaYaw += this.antennaYawVel * dt;

    // Add a faint always-on shimmer (saffron-glow ambient life sign).
    const shimmer = Math.sin(this.t * 1.7) * 0.025 + Math.sin(this.t * 0.9) * 0.012;

    // Apply as an additive yaw on top of the antenna's rest quaternion.
    this.scratchEuler.set(0, this.antennaYaw + shimmer, 0, 'YXZ');
    this.scratchQuat.setFromEuler(this.scratchEuler);
    this.rig.antennaBase.quaternion.copy(this.antennaRestQuat).multiply(this.scratchQuat);
  }

  // ── 5. walk ───────────────────────────────────────────────────────────
  private tickWalk(dt: number, velocity: THREE.Vector3): void {
    const v2 = velocity.lengthSq();
    if (v2 < WALK_VEL_THRESHOLD_SQ) {
      this.relaxDiscs(dt);
      return;
    }
    const speed = Math.sqrt(v2);
    const freq = clamp(speed * WALK_FREQ_PER_VEL, WALK_FREQ_MIN, WALK_FREQ_MAX);
    this.walkPhase += freq * dt;

    // Opposing phase — left and right discs alternate.
    const ampl = WALK_DISC_AMPL;
    const sL = Math.sin(this.walkPhase) * ampl;
    const sR = Math.sin(this.walkPhase + Math.PI) * ampl;
    this.rig.discL.position.y = this.discLRestY + sL;
    this.rig.discR.position.y = this.discRRestY + sR;
  }

  private relaxDiscs(dt: number): void {
    const k = Math.min(1, dt * 8);
    this.rig.discL.position.y += (this.discLRestY - this.rig.discL.position.y) * k;
    this.rig.discR.position.y += (this.discRRestY - this.rig.discR.position.y) * k;
  }

  // ── 6. jump-arc ───────────────────────────────────────────────────────
  private tickJumpArc(dt: number): void {
    void dt;
    const t = this.jumpT += dt;
    let scaleY = 1;
    if (t < JUMP_ANTICIPATION_S) {
      // Squash phase: 1 → JUMP_ANTICIP_SQUASH over 0.15s
      const p = t / JUMP_ANTICIPATION_S;
      scaleY = lerp(1, JUMP_ANTICIP_SQUASH, p);
    } else if (t < JUMP_ANTICIPATION_S + JUMP_LAUNCH_S) {
      // Launch phase: anticip → stretch → 1 (sin half-arc)
      const p = (t - JUMP_ANTICIPATION_S) / JUMP_LAUNCH_S;
      // Use sin-arc so we get squash → stretch → returning, not linear.
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

  // ── 7. climb ──────────────────────────────────────────────────────────
  private tickClimb(dt: number): void {
    void dt;
    // Body rotates 90° on Z so Cosmo "stands on the wall". Use an euler so
    // we don't accumulate drift by re-multiplying every frame.
    this.scratchEuler.set(0, 0, Math.PI / 2, 'YXZ');
    this.scratchQuat.setFromEuler(this.scratchEuler);
    this.rig.body.quaternion.copy(this.bodyRestQuat).multiply(this.scratchQuat);

    // Disc hand-walk: oscillate disc-Y (which is now horizontal in screen-
    // space due to the 90° rotation) so the discs read as alternating wall-
    // grips.
    this.walkPhase += CLIMB_DISC_FREQ * dt;
    const sL = Math.sin(this.walkPhase) * CLIMB_DISC_AMPL;
    const sR = Math.sin(this.walkPhase + Math.PI) * CLIMB_DISC_AMPL;
    this.rig.discL.position.y = this.discLRestY + sL;
    this.rig.discR.position.y = this.discRRestY + sR;
  }

  /** Release references. The director holds no GPU resources of its own —
   *  the rig owns the meshes and disposes them itself. */
  dispose(): void {
    this.eyeDecalL = null;
    this.eyeDecalR = null;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Schedule the next blink (random in [4..7]s after the given epoch). */
function nextBlinkAt(epochS: number): number {
  return epochS + BLINK_INTERVAL_MIN_S
    + Math.random() * (BLINK_INTERVAL_MAX_S - BLINK_INTERVAL_MIN_S);
}

/** Eye-decal Y scale for blink. phase=0 closed-start → 1.0 ; phase=mid → 0
 *  ; phase=BLINK_DURATION_S → 1.0 . Eased so the snap is soft. */
function blinkScaleY(phase: number): number {
  const p = clamp(phase / BLINK_DURATION_S, 0, 1);
  // 1 → 0 → 1 over phase. Use 1 - (1-cos(2π·p))/2 = (1 + cos(2π·p))/2
  // → starts at 1, dips to 0 at p=0.5, returns to 1 at p=1.
  return (1 + Math.cos(2 * Math.PI * p)) * 0.5;
}
