/**
 * CosmoAgent — Sprint 15B + Sprint 17B refactor
 *
 * Wraps the 3D Cosmo (cosmo.glb from Sprint 15A) inside a state-machine with
 * RANDOM AGENCY. This is the WEIRDO-brief enforcer: Cosmo is not a remote-
 * controlled puppet. Player gestures suggest actions; Cosmo decides whether
 * to comply (RNG-gated). On top of that, his idle tick rolls a small random
 * chance for self-initiated weirdness (knipoog, walk-backward, eigen-jump,
 * antenne-bloem-petal-spew). The "voorspelbare modus" is by design impossible.
 *
 * Sprint 17B — runner-mechanic OFF
 *   The auto-runner X-progression is stripped. Cosmo no longer auto-walks the
 *   world from left to right; he stays anchored at biome-centre (worldX=0).
 *   The camera does the moving (driven by MotionController, see CosmoStage.
 *   panCamera). State-machine still ticks (jumping/ducking/dancing remain
 *   useful for response-feel), but `walking` and `walking-backward` only
 *   change facing + animation-clip — no X-translation.
 *
 *   `applyMotion(motion)` per-frame nudges the head-bone yaw/pitch so Cosmo
 *   visibly reacts to the player's gyro/cursor. Falls back gracefully when
 *   no head-bone is found (2D fallback, or GLB without skeleton).
 *
 * State machine
 * ─────────────
 *   walking         — default. Auto-runner; X advances at WALK_SPEED.
 *   walking-backward — random self-event, lasts ~3s, X regresses.
 *   idle            — pre-spawn (looks at camera 1.2s) and post-respawn.
 *   jumping         — apex-then-fall; clip 'jump'.
 *   falling         — losing platform; into nevel-portal fade.
 *   ducking         — under low obstacle; clip 'duck'.
 *   dancing         — DeepTripMode 5s.
 *   looking         — micro-event: stop, look at camera, knipoog, resume.
 *
 * Agency RNG (PRD 15B brief)
 *   - random-event tick: 0.5% per frame at 60fps (≈ once every 3.3s avg).
 *     When fired, picks one of: knipoog, walk-backward, eigen-jump, petal-spew.
 *   - action-RNG: when player swipes/taps, the input is queued with a logged
 *     spawn-time. After ACTION_DECISION_DELAY_MS (~120-280ms random) Cosmo
 *     ROLLS to either commit (~80%) or ignore (~20%) — looks at the spawned
 *     trampoline/mushroom/obstacle and walks past with a deliberate "nope".
 *   - tap on obstacle: 50/50 jump-vs-duck regardless of obstacle type.
 *
 * FFT-driven mixer blends
 *   We don't have explicit FFT-attenuation tracks in the GLB; we instead
 *   modulate the AnimationMixer time-scale and a per-bone subtle pulse on
 *   the body root via THREE.Object3D.scale. This is intentionally subtle —
 *   the agency-events do the heavy character work; the FFT stays cosmetic.
 *
 * Graceful 2D fallback
 *   If `cosmo.glb` is missing/404, we substitute a Sprite-style billboard
 *   plane textured with `cosmo-hero-4k.png` (already in repo). The state
 *   machine still runs (jumping = vertical translate, ducking = scale-Y,
 *   walking = no anim-clip needed). Asset-files NEVER required at boot.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GlobalUniforms } from '../../core/globalUniforms';
import type { MotionController } from '../../core/motionController';
import { assetPath } from '../../core/assetPath';
import type { CosmoAI, AIDirective } from './CosmoAI';

// ─── Sprint 17B head-track tunables ──────────────────────────────────────────
/** Max head-yaw sweep (rad). Maps motion.panX in [-1..1] → [-MAX..MAX]. */
const HEAD_YAW_MAX = 0.4;
/** Max head-pitch sweep (rad). Maps motion.panY in [-1..1] → [-MAX..MAX]. */
const HEAD_PITCH_MAX = 0.2;
/** Lerp factor — head smoothing on top of MotionController smoothing. */
const HEAD_LERP = 0.18;
/** Common bone-name patterns we treat as the head for head-track. */
const HEAD_BONE_NAMES = ['head', 'Head', 'HEAD', 'mixamorigHead', 'Bip01_Head', 'head_bone'];

// ─── Tunables ────────────────────────────────────────────────────────────────
/** World-units / second. Tuned so 60s of idle walking covers ~12 obstacles. */
export const WALK_SPEED = 0.85;
/** Per-frame chance of random agency-event firing (at 60fps). */
const RANDOM_EVENT_CHANCE_PER_FRAME = 0.005;
/** Cooldown so an event-burst doesn't smash 3 events in 0.5s. */
const RANDOM_EVENT_COOLDOWN_S = 4.5;
/** Action-RNG: probability that Cosmo commits to a swipe-spawned platform. */
const ACTION_COMMIT_CHANCE_TRAMPOLINE = 0.8;
const ACTION_COMMIT_CHANCE_MUSHROOM = 0.8;
/** Tap-on-obstacle is 50/50 jump-or-duck regardless of obstacle hint. */
const ACTION_TAP_JUMP_CHANCE = 0.5;
/** Delay between gesture and Cosmo's reaction. */
const ACTION_DECISION_DELAY_MIN_MS = 120;
const ACTION_DECISION_DELAY_MAX_MS = 280;
const JUMP_DURATION_S = 0.85;
const JUMP_HEIGHT = 1.4;
const DUCK_DURATION_S = 0.6;
const LOOKING_DURATION_S = 1.2;
const WALK_BACKWARD_DURATION_S = 3.0;
const DANCE_DURATION_S = 5.0;
const PETAL_SPEW_DURATION_S = 2.0;
const FALL_FADE_DURATION_S = 1.2;
const RESPAWN_DELAY_S = 1.5;

// ─── Sprint 17D — trampoline / pet tunables ─────────────────────────────────
/** Walk-to navigation duration (s). Brief: ~1.5s ease-in/out toward target. */
const WALK_TO_DURATION_S = 1.5;
/** Trampoline-bounce duration — sin-wave 0 → BOUNCE_HEIGHT → 0. */
const BOUNCE_DURATION_S = 0.8;
/** Bounce apex (world-units). Brief: 0 → 0.6 → 0. */
const BOUNCE_HEIGHT = 0.6;
/** Pet-affect total duration — saffron blush + heart-emote tilt + petal-spew. */
const PET_AFFECT_DURATION_S = 0.8;
/** Heart-emote: peak antenne yaw deviation during pet (rad ≈ ±20°). */
const PET_ANTENNA_TILT_RAD = 0.35;
/** Bone-name patterns we treat as "antenne" for the pet heart-emote. */
const ANTENNA_BONE_NAMES = ['antenne', 'antenna', 'antennae', 'Antenne', 'Antenna', 'antenne_bone'];
/** Probability of a hallucination-overlay firing on a successful trampoline-bounce. */
const BOUNCE_HALLUCINATION_CHANCE = 0.3;
/** Kaleido-trigger spike applied on every bounce. */
const BOUNCE_KALEIDO_SPIKE = 0.6;
/** Saffron tint applied to the body material during pet-affect (emissive). */
const PET_BLUSH_COLOR = 0xf4a261;
const PET_BLUSH_INTENSITY = 0.3;

// ─── Types ───────────────────────────────────────────────────────────────────
export type CosmoState =
  | 'idle'
  | 'walking'
  | 'walking-backward'
  | 'walking-to'
  | 'jumping'
  | 'falling'
  | 'ducking'
  | 'dancing'
  | 'looking'
  | 'bouncing'
  | 'petted';

export type ActionKind = 'jump' | 'duck' | 'ignore';

interface PendingAction {
  /** When (in ms-monotonic) the action should resolve. */
  fireAt: number;
  /** What to do once the delay elapses. Set after RNG roll at queue-time. */
  resolved: ActionKind;
}

export interface CosmoAgentEvents {
  /** Cosmo started a self-initiated weirdo event. UI may telegraph (none). */
  onRandomEvent?: (kind: 'wink' | 'walk-backward' | 'eigen-jump' | 'petal-spew') => void;
  /** Cosmo entered the falling state — InteractionManager may trigger nevel-portal. */
  onFalling?: () => void;
  /** Cosmo respawned at a new X. */
  onRespawn?: (newX: number) => void;
  /** Petal-spew is firing — particle system can hook here. */
  onPetalSpew?: () => void;
  /** Sprint 17D — Cosmo just bounced off a trampoline. Fires at apex
   *  (peak of the parabola). Hosts can hook kaleido-spike + maybe-hallucination. */
  onBounce?: (info: { rollHallucination: boolean }) => void;
  /** Sprint 17D — Player long-held on Cosmo → pet-affect engaged. Hosts hook
   *  particle-spew + audio cue. */
  onPet?: () => void;
}

// ─── Implementation ──────────────────────────────────────────────────────────
export class CosmoAgent {
  private parentGroup: THREE.Group;
  private events: CosmoAgentEvents;

  /** Root Object3D for Cosmo (either the GLB scene root or fallback plane). */
  root: THREE.Object3D;
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Map<string, THREE.AnimationClip> = new Map();
  private currentClipName: string | null = null;
  private fallback2D = false;
  /** When true, the asset is still loading; act like fallback until it lands. */
  private loading = true;

  // ── World position ────────────────────────────────────────────────────────
  /** World-space X, advances on WALK_SPEED * dt. */
  worldX = 0;
  /** World-space Y, 0 = ground level. */
  worldY = 0;
  /** Initial-Y baseline (recomputed on respawn). */
  private groundY = 0;
  private facing: 1 | -1 = 1;

  // ── State machine ─────────────────────────────────────────────────────────
  state: CosmoState = 'idle';
  private stateUntil = 0;
  /** Time accumulator (seconds, monotonic). */
  private t = 0;
  private lastRandomEventT = -Infinity;
  /** Pending action queue — gestures are RNG-resolved with a delay. */
  private pendingActions: PendingAction[] = [];

  // ── Falling / respawn ──────────────────────────────────────────────────────
  private respawnAt = 0;
  /** Opacity 0..1 for the nevel-portal fade. Falls 1→0 during fall, 0→1 on respawn. */
  opacity = 1;

  // ── Magic-moment intro: looks at camera 1.2s before walking ───────────────
  private introCompleteAt = 0;
  private introFinished = false;

  // ── Sprint 15D — onboarding gate ──────────────────────────────────────────
  /** While true, update() short-circuits — keeps Cosmo in a frozen idle
   *  during AWAIT_TOUCH / PORTAL_OPENING / COSMO_ARRIVING / BONDING. The
   *  OnboardingDirector flips this to false at WALKING_FIRST_HINT. */
  paused = false;

  // ── Sprint 17B — head-track ───────────────────────────────────────────────
  /** Cached reference to the head-bone (or fallback Object3D). Resolved once
   *  after the GLB loads; null if no match is found. */
  private headBone: THREE.Object3D | null = null;
  /** Smoothed head-yaw (rad). Lerped per-frame in applyMotion(). */
  private headYaw = 0;
  private headPitch = 0;
  /** Resting rotation captured the first time we touch the head-bone, so
   *  applying yaw/pitch is additive rather than overwriting clip animation. */
  private headRestQuat: THREE.Quaternion | null = null;

  // ── Sprint 17D — trampoline navigation + pet-affect ──────────────────────
  /** When the active walking-to interpolation should land. */
  private walkToUntil = 0;
  /** Start (worldX, worldZ) for the walking-to interpolation. */
  private walkFromX = 0;
  private walkFromZ = 0;
  /** Target for the walking-to interpolation. */
  private walkTargetX = 0;
  private walkTargetZ = 0;
  /** What to do once we arrive. 'bounce' = trigger bounce. 'idle' = settle. */
  private walkArrivalAction: 'bounce' | 'idle' = 'idle';
  /** World-Z (depth) — separate from worldY which is jump-height. Defaults 0. */
  worldZ = 0;
  /** True while a bounce is in progress. */
  private bouncingUntil = 0;
  /** Antenne-bone reference for the heart-emote during pet-affect. */
  private antennaBone: THREE.Object3D | null = null;
  private antennaRestQuat: THREE.Quaternion | null = null;
  /** Pet-affect end-time. */
  private pettingUntil = 0;
  /** Body material refs cached at GLB-load time so the saffron-blush tint can
   *  be applied/restored cheaply without traversing on every frame. */
  private bodyMaterials: THREE.MeshStandardMaterial[] = [];

  // ── Sprint 17E — companion-mode AI bridge ────────────────────────────────
  /** Optional CosmoAI handle — exposed read-only for diagnostics + tests.
   *  Per-frame the host calls cosmoAgent.applyAI(cosmoAI) directly; this
   *  field is just a back-reference set by attachAI(). */
  ai: CosmoAI | null = null;
  /** Cached spine-bone for AI's spineBendHint (sniff state). */
  private spineBone: THREE.Object3D | null = null;
  private spineRestQuat: THREE.Quaternion | null = null;
  /** Smoothed AI head-yaw (rad). Lerped per-frame in applyAI(). */
  private aiHeadYaw = 0;
  private aiSpineBend = 0;
  /** Sprint 17G — AI's contribution to mixer.timeScale (slow-breath = sleep).
   *  Lerped here in applyAI(), then multiplied by the FFT-driven factor in
   *  update(). Prior to 17G this field didn't exist and applyAI wrote
   *  mixer.timeScale directly; the next update() then overwrote it from
   *  raw FFT, killing slow-breath sleep entirely. */
  private aiTimeScaleBase = 1;
  /** Lerp factor for AI-driven worldX/Z chase. */
  private static readonly AI_POS_LERP = 0.04;
  /** Lerp factor for AI-driven head-yaw / spine-bend. */
  private static readonly AI_BONE_LERP = 0.08;

  // ── Wave 19 — eye-melt fix fallback path ─────────────────────────────────
  /** When true, fixSkinWeights() decided NOT to reparent the eye-bones (IBM
   *  caveat). Each frame we copy bone_head's quaternion onto bone_eye_l/_r
   *  inside applyAIBoneHints() so they yaw/pitch with the head. Default OFF —
   *  reparent is the cleaner path; this is only a fallback. */
  private eyeFrameCopyEnabled = false;
  private eyeBoneL: THREE.Object3D | null = null;
  private eyeBoneR: THREE.Object3D | null = null;

  constructor(parentGroup: THREE.Group, events: CosmoAgentEvents = {}) {
    this.parentGroup = parentGroup;
    this.events = events;
    this.root = this.makeFallbackRoot();
    this.parentGroup.add(this.root);
    // Magic moment: 1.2s of looking before he starts walking.
    this.state = 'idle';
    this.introCompleteAt = LOOKING_DURATION_S;
    this.kickOffGLBLoad();
  }

  /** Async-load the GLB. On failure, keeps the 2D fallback we already added. */
  private async kickOffGLBLoad(): Promise<void> {
    const url = assetPath('assets/3d/cosmo.glb');
    try {
      const loader = new GLTFLoader();
      const gltf: GLTF = await loader.loadAsync(url);
      // Replace the fallback plane with the loaded scene.
      this.parentGroup.remove(this.root);
      this.disposeFallback(this.root);
      this.root = gltf.scene;
      this.parentGroup.add(this.root);
      this.root.position.set(this.worldX, this.worldY, this.worldZ);
      // Normalise scale — GLBs vary; we want Cosmo at ~30-40% screen height.
      // PerspectiveCamera FOV 35, distance 6 → 1 world unit ≈ ~30% portrait.
      this.root.scale.setScalar(1.1);

      this.mixer = new THREE.AnimationMixer(this.root);
      for (const clip of gltf.animations) {
        this.clips.set(clip.name.toLowerCase(), clip);
      }
      this.fallback2D = false;
      this.loading = false;
      this.playClip('idle', true);
      // Sprint 17B — try to find a head-bone for head-track. Falls back
      // gracefully (headBone stays null) if the rig uses an unfamiliar
      // naming scheme, in which case applyMotion is a no-op.
      this.resolveHeadBone();
      // Sprint 17D — resolve antenne-bone for pet heart-emote + cache body
      // MeshStandardMaterials for saffron-blush tint during petAffect().
      this.resolveAntennaBone();
      this.cacheBodyMaterials();
      // Sprint 17E — resolve spine-bone for AI sniff bend-forward hint.
      this.resolveSpineBone();
      // Wave 19 — fix the eye-melting weight-bleed (1519 face/eye verts at
      // 50/50 head+eye weight). Reparents eye-bones under bone_head so they
      // inherit yaw/pitch instead of sitting siblings under cosmo_armature.
      this.fixSkinWeights();
      // Wave 19 — expose a debug yaw-sweep on window so visual QA can verify
      // the fix without booting the input pipeline. Call from devtools:
      //   __debugRigYawSweep()
      // This sweeps head-yaw 0 → +0.7 → -0.7 → 0 over 3s.
      (globalThis as unknown as { __debugRigYawSweep?: () => void }).__debugRigYawSweep =
        () => this.debugRigYawSweep();
    } catch (err) {
      // GLB missing / decode-fail — stay on 2D fallback. Quiet warn so dev
      // sees it, ship-mode users never notice.
      // eslint-disable-next-line no-console
      console.warn('[cosmo-agent] cosmo.glb missing or failed to load — using 2D fallback', err);
      this.fallback2D = true;
      this.loading = false;
    }
  }

  /** Build the 2D-fallback Object3D — a billboarded plane with the hero PNG. */
  private makeFallbackRoot(): THREE.Object3D {
    const group = new THREE.Group();
    const tex = new THREE.TextureLoader().load(assetPath('assets/sprites/cosmo-hero-4k.png'));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Plane sized ~1.5 world-units tall, matching the GLB target.
    const geo = new THREE.PlaneGeometry(1.0, 1.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.75; // origin at feet
    group.add(mesh);
    this.fallback2D = true;
    return group;
  }

  private disposeFallback(o: THREE.Object3D): void {
    o.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
      else m?.dispose();
    });
  }

  /** Per-frame tick. */
  update(uniforms: GlobalUniforms, dt: number): void {
    if (this.paused) {
      // Sprint 15D — keep Cosmo idle-rendered while onboarding is running.
      // We still apply position/scale so the portal-arrival tween (driven
      // externally via cosmoArrivalScale on the parent group) renders,
      // and we still update opacity (post-fall fade-in). But the state-
      // machine, RNG agency, and pendingActions all freeze.
      this.root.position.set(this.worldX, this.worldY, this.worldZ);
      this.applyOpacity();
      return;
    }
    this.t += dt;

    // Intro magic-moment: stay looking for 1.2s, then transition to walking.
    if (!this.introFinished) {
      if (this.t >= this.introCompleteAt) {
        this.introFinished = true;
        this.setState('walking');
      }
    }

    // Resolve pending actions whose decision-delay has elapsed.
    this.resolvePendingActions();

    // Random agency-events.
    this.tickRandomAgency();

    // State-driven motion.
    this.advanceState(dt);

    // FFT cosmetic blend on the body — sub-band slight pulse.
    const sub = uniforms.audioFFT[0] ?? 0;
    const pulse = 1 + sub * 0.04;
    this.root.scale.y = (this.fallback2D ? 1 : 1.1) * pulse * this.duckScaleY();

    // Mixer drives loaded GLB animations.
    if (this.mixer) {
      // High-mid band makes the animation a touch snappier — gives Cosmo
      // a very subtle "feeling the music" without ruining clip phrasing.
      // Sprint 17G — multiply (instead of overwrite) so AI's sleep-state
      // slow-breath time-scale (lerp toward 0.4 in applyAI) is preserved
      // across the FFT-driven adjust. Prior to 17G, applyAI's slow-breath
      // was clobbered every frame the next CosmoAgent.update() ran.
      const air = uniforms.audioFFT[5] ?? 0;
      const fftFactor = 1 + air * 0.1;
      this.mixer.timeScale = this.aiTimeScaleBase * fftFactor;
      this.mixer.update(dt);
    }

    // Apply position to root.
    this.root.position.set(this.worldX, this.worldY, this.worldZ);
    this.root.scale.x = (this.fallback2D ? 1 : 1.1) * this.facing;

    // Fade for nevel-portal.
    this.applyOpacity();

    // Update uniforms so post-FX / Phaser HUD know where Cosmo is.
    uniforms.cosmoFacing = this.facing;
    uniforms.cosmoState = this.state === 'jumping'
      ? 'jump'
      : this.state === 'falling'
      ? 'fall'
      : this.state === 'walking' || this.state === 'walking-backward'
      ? 'run'
      : 'idle';
  }

  // ── Public API consumed by InteractionManager ────────────────────────────

  /** Player wants Cosmo to react to a swipe-up trampoline. RNG-gated. */
  queueTrampolineDecision(): void {
    if (!this.canQueueAction()) return;
    const commit = Math.random() < ACTION_COMMIT_CHANCE_TRAMPOLINE;
    this.queueAction(commit ? 'jump' : 'ignore');
  }

  /** Player wants Cosmo to duck under a swipe-down mushroom. RNG-gated. */
  queueMushroomDecision(): void {
    if (!this.canQueueAction()) return;
    const commit = Math.random() < ACTION_COMMIT_CHANCE_MUSHROOM;
    this.queueAction(commit ? 'duck' : 'ignore');
  }

  /** Tap on visible obstacle — 50/50 jump-or-duck. */
  queueTapDecision(): void {
    if (!this.canQueueAction()) return;
    const action: ActionKind = Math.random() < ACTION_TAP_JUMP_CHANCE ? 'jump' : 'duck';
    this.queueAction(action);
  }

  /** Long-hold center 3s → wave + vibe boost. Resolves immediately. */
  triggerWave(): void {
    if (this.state === 'falling' || this.state === 'dancing') return;
    this.setState('looking');
    this.stateUntil = this.t + LOOKING_DURATION_S;
    this.playClip('wave', false);
    this.events.onRandomEvent?.('wink');
  }

  /** Engage DeepTripMode dance for DANCE_DURATION_S. */
  enterDance(): void {
    if (this.state === 'falling') return;
    this.setState('dancing');
    this.stateUntil = this.t + DANCE_DURATION_S;
    this.playClip('dance', true);
  }

  /** Force-fall via missed platform — InteractionManager triggers this. */
  forceFall(): void {
    if (this.state === 'falling') return;
    this.setState('falling');
    this.stateUntil = this.t + FALL_FADE_DURATION_S;
    this.events.onFalling?.();
  }

  // ── Sprint 17D — trampoline navigation + bounce + pet-affect ────────────

  /**
   * Sprint 17D — interpolate Cosmo's worldX/Z toward (targetX, targetZ) over
   * ~1.5s ease-in/out. On arrival the agent triggers `bounce()` so the player
   * sees one continuous "walk → spring" motion. While walking, the 'walk'
   * clip plays (or 'idle' fallback if the rig has no walk clip).
   *
   * Safe to call repeatedly — re-target supersedes the previous walk-to.
   * Cosmo refuses new walk-to calls during 'falling' / 'dancing' / 'petted'
   * so onboarding/dance/pet state stays uninterrupted.
   */
  walkTo(targetX: number, targetZ: number, action: 'bounce' | 'idle' = 'bounce'): void {
    if (this.state === 'falling' || this.state === 'dancing' || this.state === 'petted') return;
    this.walkFromX = this.worldX;
    this.walkFromZ = this.worldZ;
    this.walkTargetX = targetX;
    this.walkTargetZ = targetZ;
    this.walkToUntil = this.t + WALK_TO_DURATION_S;
    this.walkArrivalAction = action;
    this.setState('walking-to');
    // Prefer 'walk' clip when the rig provides it; fall back to looping 'idle'.
    if (this.clips.has('walk')) this.playClip('walk', true);
    else this.playClip('idle', true);
  }

  /**
   * Sprint 17D — trigger a one-shot trampoline-bounce in place. Plays the
   * 'stretch' clip as the spring-up animation (per Sprint 17A rig spec) and
   * runs a sin-arc 0 → 0.6 → 0 in worldY over BOUNCE_DURATION_S. The bounce
   * fires the `onBounce` event with a pre-rolled `rollHallucination` flag
   * (30% chance per the brief) so the host can decide to start a hallucination
   * overlay-track in parallel with the kaleido-spike.
   *
   * Public so tests/scripts can poke it; gameplay reaches it via walkTo's
   * arrival callback.
   */
  bounce(): void {
    this.startBounce();
  }

  /**
   * Sprint 17D — engage the pet-affect for PET_AFFECT_DURATION_S. Fires:
   *   - rose-petal spew (via `onPet` event so the host scene can hook
   *     particle-systems with their own canvas-drawn primitives).
   *   - heart-emote: antenne-bone yaws ±PET_ANTENNA_TILT_RAD over a
   *     half-sine on top of clip animation.
   *   - blush-tint: saffron emissive flush across the body materials.
   *   - on release: 'wave' clip plays + state returns to walking.
   *
   * Refuses while bouncing/falling/dancing — those windows take priority.
   */
  petAffect(): void {
    if (
      this.state === 'falling' ||
      this.state === 'dancing' ||
      this.state === 'bouncing'
    ) {
      return;
    }
    this.setState('petted');
    this.pettingUntil = this.t + PET_AFFECT_DURATION_S;
    this.events.onPet?.();
    // Apply blush tint immediately; per-frame `applyPetAffect()` keeps it
    // alive + wiggles the antenne for the duration.
    this.beginPetAffect();
  }

  /** Internal: start a bounce in place. Called by walkTo's arrival action and
   *  by the public `bounce()`. Idempotent during an active bounce. */
  private startBounce(): void {
    if (this.state === 'bouncing') return;
    if (this.state === 'falling' || this.state === 'dancing') return;
    this.setState('bouncing');
    this.bouncingUntil = this.t + BOUNCE_DURATION_S;
    this.playClip('stretch', false);
    const rollHallucination = Math.random() < BOUNCE_HALLUCINATION_CHANCE;
    this.events.onBounce?.({ rollHallucination });
  }

  /** Total kaleido-spike per bounce — host applies on event. */
  static readonly BOUNCE_KALEIDO_SPIKE = BOUNCE_KALEIDO_SPIKE;

  // ── Screen-projection helpers used by HUD ────────────────────────────────

  worldPositionVec(): THREE.Vector3 {
    // Aim for the middle of Cosmo's body (~0.75 above feet).
    return new THREE.Vector3(this.worldX, this.worldY + 0.75, this.worldZ);
  }

  // ── State machine internals ──────────────────────────────────────────────

  private setState(s: CosmoState): void {
    if (this.state === s) return;
    this.state = s;
  }

  private canQueueAction(): boolean {
    if (this.state === 'falling' || this.state === 'dancing') return false;
    return this.pendingActions.length < 2;
  }

  private queueAction(kind: ActionKind): void {
    const delayMs =
      ACTION_DECISION_DELAY_MIN_MS +
      Math.random() * (ACTION_DECISION_DELAY_MAX_MS - ACTION_DECISION_DELAY_MIN_MS);
    const fireAt = this.t + delayMs / 1000;
    this.pendingActions.push({ fireAt, resolved: kind });
  }

  private resolvePendingActions(): void {
    if (!this.pendingActions.length) return;
    const ready: PendingAction[] = [];
    const remaining: PendingAction[] = [];
    for (const a of this.pendingActions) {
      if (this.t >= a.fireAt) ready.push(a);
      else remaining.push(a);
    }
    this.pendingActions = remaining;
    for (const a of ready) {
      if (a.resolved === 'jump') this.startJump();
      else if (a.resolved === 'duck') this.startDuck();
      // 'ignore' → do nothing. Cosmo deliberate-walks past the spawned platform.
    }
  }

  private startJump(): void {
    if (this.state === 'falling') return;
    this.setState('jumping');
    this.stateUntil = this.t + JUMP_DURATION_S;
    this.playClip('jump', false);
  }

  private startDuck(): void {
    if (this.state === 'falling') return;
    this.setState('ducking');
    this.stateUntil = this.t + DUCK_DURATION_S;
    this.playClip('duck', false);
  }

  /** Random self-initiated weirdo events. */
  private tickRandomAgency(): void {
    if (this.state !== 'walking') return; // only roll while plain walking
    if (this.t - this.lastRandomEventT < RANDOM_EVENT_COOLDOWN_S) return;
    if (Math.random() > RANDOM_EVENT_CHANCE_PER_FRAME) return;

    this.lastRandomEventT = this.t;
    const roll = Math.random();
    if (roll < 0.25) {
      // Knipoog
      this.setState('looking');
      this.stateUntil = this.t + 0.6;
      this.playClip('wink', false);
      this.events.onRandomEvent?.('wink');
    } else if (roll < 0.55) {
      // Walk-backward 3s
      this.setState('walking-backward');
      this.stateUntil = this.t + WALK_BACKWARD_DURATION_S;
      this.facing = -1;
      this.events.onRandomEvent?.('walk-backward');
    } else if (roll < 0.85) {
      // Eigen-jump (no platform requested)
      this.startJump();
      this.events.onRandomEvent?.('eigen-jump');
    } else {
      // Antenne-bloem petal-spew
      this.events.onPetalSpew?.();
      this.events.onRandomEvent?.('petal-spew');
      // Brief look-up so the player notices.
      this.setState('looking');
      this.stateUntil = this.t + PETAL_SPEW_DURATION_S;
    }
  }

  private advanceState(dt: number): void {
    // Sprint 17B — runner-mechanic disabled. worldX is locked at the biome
    // centre (initial 0); state-machine only drives Y, animation-clip, and
    // facing. The previous WALK_SPEED * dt translations are removed; each
    // case below sets worldX = 0 (anchored). The camera (CosmoStage.panCamera)
    // and head-bone (applyMotion) supply ALL on-screen motion.
    switch (this.state) {
      case 'idle':
        this.worldY = this.groundY;
        break;
      case 'walking':
        // Anchored — only the walk animation-clip and facing register here.
        this.worldY = this.groundY;
        if (this.facing !== 1) this.facing = 1;
        void dt;
        break;
      case 'walking-backward':
        // Cosmo "moonwalks" in place during the random walk-backward event.
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) {
          this.facing = 1;
          this.setState('walking');
        }
        break;
      case 'jumping': {
        // Parabolic arc — Y only, anchored X.
        const phase = 1 - Math.max(0, (this.stateUntil - this.t) / JUMP_DURATION_S);
        this.worldY = this.groundY + Math.sin(phase * Math.PI) * JUMP_HEIGHT;
        if (this.t >= this.stateUntil) {
          this.worldY = this.groundY;
          this.setState('walking');
        }
        break;
      }
      case 'ducking':
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'dancing':
        this.worldY = this.groundY + Math.sin(this.t * 6) * 0.18;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'looking':
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'falling':
        // Drift down only (no sideways translation now that the world is fixed).
        this.worldY -= 0.6 * dt;
        if (this.t >= this.stateUntil) {
          // Schedule respawn.
          this.respawnAt = this.t + RESPAWN_DELAY_S;
          this.setState('idle');
          this.opacity = 0;
        }
        break;
      case 'walking-to': {
        // Sprint 17D — interpolate worldX/Z toward (walkTargetX, walkTargetZ).
        // Ease-in-out cubic for a natural step-toward feeling. On arrival,
        // either trigger bounce or settle to idle/walking depending on
        // walkArrivalAction.
        const remaining = this.walkToUntil - this.t;
        const dur = WALK_TO_DURATION_S;
        const phase = remaining <= 0 ? 1 : 1 - Math.max(0, Math.min(1, remaining / dur));
        const eased = phase < 0.5
          ? 4 * phase * phase * phase
          : 1 - Math.pow(-2 * phase + 2, 3) / 2;
        this.worldX = this.walkFromX + (this.walkTargetX - this.walkFromX) * eased;
        this.worldZ = this.walkFromZ + (this.walkTargetZ - this.walkFromZ) * eased;
        this.worldY = this.groundY;
        // Face the direction of travel.
        const dx = this.walkTargetX - this.walkFromX;
        if (Math.abs(dx) > 0.01) this.facing = dx >= 0 ? 1 : -1;
        if (phase >= 1) {
          this.worldX = this.walkTargetX;
          this.worldZ = this.walkTargetZ;
          if (this.walkArrivalAction === 'bounce') {
            this.startBounce();
          } else {
            this.setState('walking');
          }
        }
        break;
      }
      case 'bouncing': {
        // Sprint 17D — sin-arc parabola 0 → BOUNCE_HEIGHT → 0 over BOUNCE_DURATION_S.
        // worldX / worldZ stay locked at the trampoline-spot during the bounce.
        const remaining = this.bouncingUntil - this.t;
        const dur = BOUNCE_DURATION_S;
        const phase = remaining <= 0 ? 1 : 1 - Math.max(0, Math.min(1, remaining / dur));
        this.worldY = this.groundY + Math.sin(phase * Math.PI) * BOUNCE_HEIGHT;
        if (phase >= 1) {
          this.worldY = this.groundY;
          this.setState('walking');
        }
        break;
      }
      case 'petted': {
        // Sprint 17D — pet-affect plays a saffron-blush tint + antenne tilt
        // for PET_AFFECT_DURATION_S, then crossfades to 'wave' clip on release
        // and returns to walking. The tint/tilt application happens in
        // applyPetAffect() which is called every frame regardless of state.
        this.worldY = this.groundY;
        this.worldX = 0;
        this.worldZ = 0;
        if (this.t >= this.pettingUntil) {
          // Crossfade into the wave clip on release per the brief.
          this.playClip('wave', false);
          this.clearPetAffect();
          this.setState('walking');
        }
        break;
      }
    }

    // Sprint 17D — pet-affect tint+tilt is driven each frame from the pet
    // window even outside the 'petted' branch above (so the antenna keeps
    // wiggling smoothly into the wave-clip transition).
    this.applyPetAffect();

    // Anchored worldX (only the new walking-to / bouncing / petted states
    // override this above). All other states keep Cosmo at biome-centre.
    if (
      this.state !== 'walking-to' &&
      this.state !== 'bouncing' &&
      this.state !== 'petted'
    ) {
      this.worldX = 0;
      this.worldZ = 0;
    }

    // Respawn after fall delay.
    if (this.opacity === 0 && this.t >= this.respawnAt && this.respawnAt > 0) {
      this.respawn();
    }
  }

  private respawn(): void {
    // Sprint 17B — Cosmo respawns at the biome centre (worldX=0). The earlier
    // "drift ahead by random offset" only made sense for the auto-runner; in
    // the companion-mode pivot we just fade Cosmo back in at his anchor.
    this.worldX = 0;
    this.worldY = this.groundY;
    this.opacity = 0;
    this.respawnAt = 0;
    this.setState('idle');
    this.stateUntil = this.t + 0.6;
    this.events.onRespawn?.(0);
    // Fade back in over 0.6s; applyOpacity handles the lerp.
  }

  private applyOpacity(): void {
    let target = 1;
    if (this.state === 'falling') {
      const phase = (this.stateUntil - this.t) / FALL_FADE_DURATION_S;
      target = Math.max(0, phase);
    } else if (this.opacity < 1) {
      // Respawn fade-in.
      target = Math.min(1, this.opacity + 0.04);
    }
    this.opacity = target;
    this.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.Material | undefined;
      if (mat && 'opacity' in mat) {
        (mat as THREE.MeshBasicMaterial).transparent = true;
        (mat as THREE.MeshBasicMaterial).opacity = target;
      }
    });
  }

  /** Squash-and-stretch from ducking, returns Y-multiplier. */
  private duckScaleY(): number {
    if (this.state !== 'ducking') return 1;
    return 0.65;
  }

  /** Cross-fade to a clip if it exists. Loaded GLB only — no-op on 2D. */
  private playClip(name: string, loop: boolean): void {
    if (!this.mixer) return;
    const clip = this.clips.get(name.toLowerCase());
    if (!clip) return;
    if (this.currentClipName === name) return;
    // Crossfade out previous, fade in new.
    if (this.currentClipName) {
      const prev = this.clips.get(this.currentClipName.toLowerCase());
      if (prev) {
        const prevAction = this.mixer.existingAction(prev);
        if (prevAction) prevAction.fadeOut(0.18);
      }
    }
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.18).play();
    this.currentClipName = name;
  }

  // ── Sprint 17B — head-track ──────────────────────────────────────────────

  /** Walk the GLB scene-graph looking for a head-bone (or any bone whose
   *  lowercased name contains "head"). Caches it + its rest-quaternion so
   *  applyMotion can additively rotate it on top of clip animation. */
  private resolveHeadBone(): void {
    if (this.fallback2D) return;
    let found: THREE.Object3D | null = null;
    this.root.traverse((child) => {
      if (found) return;
      if (HEAD_BONE_NAMES.includes(child.name)) {
        found = child;
      } else if (child.name && child.name.toLowerCase().includes('head')) {
        found = child;
      }
    });
    if (found) {
      this.headBone = found;
      this.headRestQuat = (found as THREE.Object3D).quaternion.clone();
    } else {
      this.headBone = null;
      this.headRestQuat = null;
    }
  }

  // ── Sprint 17D — antenne-bone + body-materials resolution ───────────────

  /** Walk the GLB scene-graph for an antenne-bone (Sprint 17A rig labels it
   *  `antenne` per cosmo-rig-spec.json; we tolerate variants). Caches its
   *  rest-quat so applyPetAffect can additively rotate it. */
  private resolveAntennaBone(): void {
    if (this.fallback2D) return;
    let found: THREE.Object3D | null = null;
    this.root.traverse((child) => {
      if (found) return;
      if (ANTENNA_BONE_NAMES.includes(child.name)) {
        found = child;
      } else if (child.name && child.name.toLowerCase().includes('antenn')) {
        found = child;
      }
    });
    if (found) {
      this.antennaBone = found;
      this.antennaRestQuat = (found as THREE.Object3D).quaternion.clone();
    } else {
      this.antennaBone = null;
      this.antennaRestQuat = null;
    }
  }

  /** Cache MeshStandardMaterial refs on the body — used by pet-affect to
   *  apply a saffron blush via emissive without traversing every frame. */
  private cacheBodyMaterials(): void {
    if (this.fallback2D) return;
    this.bodyMaterials = [];
    this.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(m) ? m : m ? [m] : [];
      for (const mat of list) {
        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          this.bodyMaterials.push(mat as THREE.MeshStandardMaterial);
        }
      }
    });
  }

  /** Stash original emissive colour/intensity per material so clearPetAffect
   *  can restore them. Stored on the material itself via userData so we don't
   *  need a parallel map. */
  private beginPetAffect(): void {
    for (const mat of this.bodyMaterials) {
      if (mat.userData.cosmoPetOrigEmissiveSet) continue;
      mat.userData.cosmoPetOrigEmissiveSet = true;
      mat.userData.cosmoPetOrigEmissive = mat.emissive.clone();
      mat.userData.cosmoPetOrigEmissiveIntensity = mat.emissiveIntensity ?? 1;
    }
  }

  /** Per-frame: apply blush tint + antenne tilt while pet-affect is active.
   *  Outside the window this is a no-op (and clears stale tint if needed). */
  private applyPetAffect(): void {
    const remaining = this.pettingUntil - this.t;
    if (remaining <= 0) return;
    // Phase 0..1 across PET_AFFECT_DURATION_S.
    const phase = 1 - Math.max(0, Math.min(1, remaining / PET_AFFECT_DURATION_S));
    // Sine-bell intensity profile so blush fades in + out gracefully.
    const bell = Math.sin(phase * Math.PI);

    // Blush: lerp emissive toward saffron + scale intensity by bell.
    for (const mat of this.bodyMaterials) {
      const origCol = mat.userData.cosmoPetOrigEmissive as THREE.Color | undefined;
      const origInt = (mat.userData.cosmoPetOrigEmissiveIntensity as number | undefined) ?? 1;
      if (!origCol) continue;
      mat.emissive.copy(origCol).lerp(new THREE.Color(PET_BLUSH_COLOR), bell);
      mat.emissiveIntensity = origInt + PET_BLUSH_INTENSITY * bell;
    }

    // Antenne tilt: ±PET_ANTENNA_TILT_RAD oscillating 2× per pet-window so the
    // emote reads as a "happy nod". 2 cycles = sin(2*PI*phase).
    if (this.antennaBone && this.antennaRestQuat) {
      const tilt = Math.sin(phase * Math.PI * 2) * PET_ANTENNA_TILT_RAD;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      this.antennaBone.quaternion.copy(this.antennaRestQuat).multiply(q);
    }
  }

  /** Restore body-material emissive + antenne rest-pose at end-of-pet. */
  private clearPetAffect(): void {
    for (const mat of this.bodyMaterials) {
      const origCol = mat.userData.cosmoPetOrigEmissive as THREE.Color | undefined;
      const origInt = (mat.userData.cosmoPetOrigEmissiveIntensity as number | undefined) ?? 1;
      if (origCol) {
        mat.emissive.copy(origCol);
        mat.emissiveIntensity = origInt;
      }
      mat.userData.cosmoPetOrigEmissiveSet = false;
    }
    if (this.antennaBone && this.antennaRestQuat) {
      this.antennaBone.quaternion.copy(this.antennaRestQuat);
    }
  }

  /** Apply MotionController-driven head-yaw/pitch on top of the current clip
   *  rotation. Called per-frame from main.ts. Safe to call when paused or
   *  when no head-bone was found — both branches are no-ops. */
  applyMotion(motion: MotionController): void {
    if (this.paused) return;
    const targetYaw = motion.getPanX() * HEAD_YAW_MAX;
    const targetPitch = -motion.getPanY() * HEAD_PITCH_MAX;
    this.headYaw += (targetYaw - this.headYaw) * HEAD_LERP;
    this.headPitch += (targetPitch - this.headPitch) * HEAD_LERP;

    if (this.headBone && this.headRestQuat) {
      // Compose: rest-quat * yaw(Y) * pitch(X). Mixer has already written
      // its clip-driven rotation into headBone before this call (mixer.update
      // happens earlier in update()), so we replace it with rest-derived
      // base. The clip-pose is acceptable to lose for the head specifically
      // because most idle clips barely animate the head.
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.headYaw);
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.headPitch);
      this.headBone.quaternion.copy(this.headRestQuat).multiply(yawQ).multiply(pitchQ);
    } else if (this.fallback2D) {
      // 2D fallback — rotate the entire root very subtly so the player still
      // gets a "Cosmo is looking at me" cue. Half magnitude so it doesn't
      // look like he's spinning.
      this.root.rotation.y = this.headYaw * 0.5;
      this.root.rotation.x = this.headPitch * 0.5;
    }
  }

  // ── Sprint 17E — AI bridge ──────────────────────────────────────────────

  /** Wire a CosmoAI to this agent. The AI ticks externally; CosmoAgent reads
   *  its directive each frame via applyAI(). Pass `null` to detach. */
  attachAI(ai: CosmoAI | null): void {
    this.ai = ai;
  }

  /** Per-frame AI consumer. Called from main.ts AFTER cosmoAgent.update() so
   *  the AI's directive lerps Cosmo's worldX/Z toward the goal smoothly,
   *  on top of the state-machine's own pose work. The AI never overrides
   *  Sprint 17D's special states (walking-to / bouncing / petted) or
   *  Sprint 15B's falling state — those own Cosmo exclusively.
   *
   *  The `ai` argument is optional — when omitted we read from the AI
   *  attached via `attachAI()`. The argument-form is preserved for tests
   *  that stub a fake AI. */
  applyAI(ai?: CosmoAI): void {
    if (this.paused) return;
    const source = ai ?? this.ai;
    if (!source) return;
    const d: AIDirective = source.getDirective();
    if (!d.active) {
      // Decay AI bone hints back toward 0 so we don't leave a stale tilt
      // when the user comes back.
      this.aiHeadYaw += (0 - this.aiHeadYaw) * CosmoAgent.AI_BONE_LERP;
      this.aiSpineBend += (0 - this.aiSpineBend) * CosmoAgent.AI_BONE_LERP;
      // Sprint 17G — also decay the slow-breath base back to 1 so the mixer
      // returns to normal speed when the user comes back from sleep.
      this.aiTimeScaleBase += (1 - this.aiTimeScaleBase) * 0.05;
      this.applyAIBoneHints();
      return;
    }

    // Bail out of AI-driven position chase if a Sprint 17D / 15B special
    // state owns the agent — those own X/Z exclusively.
    const ownedByOtherSprint =
      this.state === 'walking-to' ||
      this.state === 'bouncing' ||
      this.state === 'petted' ||
      this.state === 'falling' ||
      this.state === 'jumping' ||
      this.state === 'ducking' ||
      this.state === 'dancing';

    if (!ownedByOtherSprint) {
      // Lerp worldX/Z toward AI target (anchored Y; jumping is owned elsewhere).
      const dx = d.targetX - this.worldX;
      const dz = d.targetZ - this.worldZ;
      this.worldX += dx * CosmoAgent.AI_POS_LERP;
      this.worldZ += dz * CosmoAgent.AI_POS_LERP;
      // Face direction of travel so the walk-cycle reads correctly.
      if (Math.abs(dx) > 0.005) this.facing = dx >= 0 ? 1 : -1;
      // Crossfade to AI's clip suggestion. playClip is a no-op if the
      // requested clip is already current.
      this.playClip(d.clip, d.clip === 'idle' || d.clip === 'sit');
      // Slow-breath = sleep state — quarter-speed the mixer. We write to
      // aiTimeScaleBase (not mixer.timeScale) so update()'s FFT factor can
      // multiply on top without overwriting the AI contribution next frame.
      const targetTimeScale = d.slowBreath ? 0.4 : 1;
      this.aiTimeScaleBase += (targetTimeScale - this.aiTimeScaleBase) * 0.05;
    }

    // Smooth AI head-yaw + spine-bend on top of the bone rest-quaternion.
    this.aiHeadYaw += (d.headYawHint - this.aiHeadYaw) * CosmoAgent.AI_BONE_LERP;
    this.aiSpineBend += (d.spineBendHint - this.aiSpineBend) * CosmoAgent.AI_BONE_LERP;
    this.applyAIBoneHints();
  }

  /** Apply the smoothed AI head-yaw + spine-bend on top of clip animation.
   *  Called from applyAI() — head-bone may have already been touched by
   *  applyMotion() this frame, so we additively compose: rest * motionYaw *
   *  aiYaw. To avoid double-application, we read off the current quaternion
   *  produced by applyMotion (rest * motionYaw * motionPitch) and multiply
   *  the AI yaw on top of it. */
  private applyAIBoneHints(): void {
    if (Math.abs(this.aiHeadYaw) > 1e-4 && this.headBone) {
      // Multiplicative additive yaw on top of whatever applyMotion wrote.
      const yawQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.aiHeadYaw,
      );
      this.headBone.quaternion.multiply(yawQ);
    }
    if (this.spineBone && this.spineRestQuat && Math.abs(this.aiSpineBend) > 1e-4) {
      const bendQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        this.aiSpineBend,
      );
      // Spine writes from rest each frame because clips barely animate the
      // spine in idle/sit/wave/stretch — losing clip-spine-pose is acceptable.
      this.spineBone.quaternion.copy(this.spineRestQuat).multiply(bendQ);
    }

    // Wave 19 fallback path — only active when fixSkinWeights() opted out of
    // the reparent (IBM problem). Mirrors bone_head's world-space rotation
    // onto bone_eye_l/_r so the eyes follow head yaw/pitch even though they
    // remained siblings under cosmo_armature.
    if (this.eyeFrameCopyEnabled && this.headBone && this.eyeBoneL && this.eyeBoneR) {
      this.eyeBoneL.quaternion.copy(this.headBone.quaternion);
      this.eyeBoneR.quaternion.copy(this.headBone.quaternion);
    }
  }

  /** Walk the GLB scene-graph for a spine-bone (cosmo-rig-spec.json names it
   *  `bone_spine`). Falls back to any bone whose name contains "spine". */
  private resolveSpineBone(): void {
    if (this.fallback2D) return;
    let found: THREE.Object3D | null = null;
    this.root.traverse((child) => {
      if (found) return;
      if (child.name === 'bone_spine' || child.name === 'spine' || child.name === 'Spine') {
        found = child;
      } else if (child.name && child.name.toLowerCase().includes('spine')) {
        found = child;
      }
    });
    if (found) {
      this.spineBone = found;
      this.spineRestQuat = (found as THREE.Object3D).quaternion.clone();
    }
  }

  // ── Wave 19 — eye-melt rig fix ───────────────────────────────────────────
  /**
   * Wave 19 fix for Cosmo's "melting alien eyes" — diagnosed in
   * `.claude/brainstorm/wave19/01-rig-diagnosis.md`. The GLB ships with two
   * structural defects in the rig that combine to shear the face shell on
   * head-yaw/pitch:
   *
   *   1. **Weight bleed**: 1 519 face/eye verts carry near-50/50 weights to
   *      `bone_head` AND `bone_eye_l`/`bone_eye_r`. When applyMotion +
   *      applyAIBoneHints rotate `bone_head` while the eye-bones stay at
   *      rest, linear-blend skinning averages a rotated head matrix with an
   *      identity eye matrix → those verts move at half-yaw → black pupils
   *      stretch/drip downward. Fix: zero the head-slot weight on each
   *      bleed-vert, renormalise the remaining 3 weights to sum=1.
   *   2. **Bad parenting**: `bone_eye_l/_r` sit as siblings of `bone_root`
   *      directly under `cosmo_armature`, so they don't inherit head
   *      rotation. Fix: `bone_head.attach(bone_eye_l/_r)` — Three.js's
   *      `attach()` recomputes local transform from world, preserving
   *      rest-pose visually while making the eyes follow head rotations.
   *
   * IBM caveat (open Q #2 from the diagnosis): if the GLB inverseBindMatrices
   * for the eye-bones were baked against `cosmo_armature` (sibling parent)
   * rather than `bone_head`, `attach()` may displace the rest-pupils. If
   * that happens visually, flip `USE_REPARENT` to false below — the agent
   * then falls back to a frame-by-frame quaternion copy from head→eyes
   * (handled at the end of applyAIBoneHints once the flag-state is read).
   *
   * Pure post-load runtime fix; the GLB asset is never modified.
   */
  private fixSkinWeights(): void {
    if (this.fallback2D) return;
    // Cleaner reparent path is the default. Flip to false ONLY if the
    // pupils visibly slide off the face after attach(). The fallback
    // branch (frame-copy quaternion) lives in `applyAIBoneHints()` via
    // the `eyeFrameCopyEnabled` flag this helper sets.
    // Flipped to false 2026-05-03 after live UAT: reparent path produced
    // misplaced eye-spheres at chin level (IBMs were baked against
    // cosmo_armature, not bone_head — open Q #2 confirmed). Frame-copy
    // fallback keeps eye-bones at their original armature-space rest-pose
    // and copies head's quaternion onto them every frame in applyAIBoneHints.
    const USE_REPARENT = false;

    // 1) Locate the SkinnedMesh + its skeleton.
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    this.root.traverse((child) => {
      if (skinnedMesh) return;
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMesh = child as THREE.SkinnedMesh;
      }
    });
    if (!skinnedMesh) {
      // eslint-disable-next-line no-console
      console.warn('[cosmo-agent] fixSkinWeights: no SkinnedMesh found — skipping rig fix');
      return;
    }
    // Cast through unknown so TS treats the local as the narrow type
    // even though it was assigned via a callback closure.
    const mesh = skinnedMesh as unknown as THREE.SkinnedMesh;
    const skeleton = mesh.skeleton;
    if (!skeleton) {
      // eslint-disable-next-line no-console
      console.warn('[cosmo-agent] fixSkinWeights: SkinnedMesh has no skeleton — skipping');
      return;
    }

    // 2) Resolve bone indices by name. mesh.skeleton.bones is the joint
    //    array Three.js uses to interpret skinIndex slots.
    const bones = skeleton.bones;
    const headIdx = bones.findIndex((b) => b.name === 'bone_head');
    const eyeLIdx = bones.findIndex((b) => b.name === 'bone_eye_l');
    const eyeRIdx = bones.findIndex((b) => b.name === 'bone_eye_r');
    if (headIdx < 0 || eyeLIdx < 0 || eyeRIdx < 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[cosmo-agent] fixSkinWeights: missing expected bones',
        { headIdx, eyeLIdx, eyeRIdx, names: bones.map((b) => b.name) },
      );
      return;
    }

    // 3) Walk geometry.attributes.skinWeight + skinIndex (4 entries / vert).
    const geom = mesh.geometry;
    const skinWeightAttr = geom.attributes.skinWeight as THREE.BufferAttribute;
    const skinIndexAttr = geom.attributes.skinIndex as THREE.BufferAttribute;
    if (!skinWeightAttr || !skinIndexAttr) {
      // eslint-disable-next-line no-console
      console.warn('[cosmo-agent] fixSkinWeights: skin attributes missing on geometry');
      return;
    }
    const weights = skinWeightAttr.array as Float32Array;
    const indices = skinIndexAttr.array as Uint16Array | Uint8Array;
    const vertCount = skinWeightAttr.count;

    let modified = 0;
    for (let v = 0; v < vertCount; v++) {
      const o = v * 4;
      const i0 = indices[o];
      const i1 = indices[o + 1];
      const i2 = indices[o + 2];
      const i3 = indices[o + 3];
      const w0 = weights[o];
      const w1 = weights[o + 1];
      const w2 = weights[o + 2];
      const w3 = weights[o + 3];

      // Find the head + eye slot weights for this vertex.
      let headSlot = -1;
      let headW = 0;
      let eyeLW = 0;
      let eyeRW = 0;
      const slots = [i0, i1, i2, i3];
      const ws = [w0, w1, w2, w3];
      for (let s = 0; s < 4; s++) {
        const idx = slots[s];
        const w = ws[s];
        if (idx === headIdx) {
          headSlot = s;
          headW = w;
        } else if (idx === eyeLIdx) {
          eyeLW = w;
        } else if (idx === eyeRIdx) {
          eyeRW = w;
        }
      }

      // Trigger criterion: any vertex with non-trivial weight on either
      // eye-bone gets that weight redirected to bone_head. The eye-bones in
      // the shipped GLB sit at armature origin (0,0,0) — NOT at face level —
      // so any verts they influence get pulled to ground when head moves.
      // Solution: route all eye-bone influence to the head-bone, which is
      // positioned at the face. Face-shell + eye-shell verts then move
      // rigidly with head. Eye-bones become decorative (no weights left).
      const eyeWeightTotal = eyeLW + eyeRW;
      if (eyeWeightTotal <= 0.05) continue;

      // Zero both eye slots, dump their weight onto the head-slot. If this
      // vertex has no head-slot yet, claim an empty slot (one with weight 0)
      // and put bone_head there. If all 4 slots are occupied non-trivially,
      // fall back to overwriting the smallest-weight non-eye slot.
      let targetSlot = headSlot;
      if (targetSlot < 0) {
        // Find an empty slot (weight ~0) to convert into a head-slot.
        for (let s = 0; s < 4; s++) {
          if (ws[s] < 1e-6) {
            targetSlot = s;
            indices[o + s] = headIdx;
            break;
          }
        }
      }
      if (targetSlot < 0) {
        // All 4 slots non-empty; pick the smallest non-eye slot.
        let smallestS = -1;
        let smallestW = Infinity;
        for (let s = 0; s < 4; s++) {
          if (slots[s] === eyeLIdx || slots[s] === eyeRIdx) continue;
          if (ws[s] < smallestW) {
            smallestW = ws[s];
            smallestS = s;
          }
        }
        if (smallestS >= 0) {
          targetSlot = smallestS;
          indices[o + smallestS] = headIdx;
        }
      }

      // Apply: zero eye slots, write all eye-weight + existing head-weight
      // onto the target slot, leave non-eye non-head slots untouched.
      for (let s = 0; s < 4; s++) {
        if (slots[s] === eyeLIdx || slots[s] === eyeRIdx) {
          weights[o + s] = 0;
        }
      }
      if (targetSlot >= 0) {
        weights[o + targetSlot] = headW + eyeWeightTotal;
      }
      // Renormalise the 4 weights to sum to 1.
      const sum = weights[o] + weights[o + 1] + weights[o + 2] + weights[o + 3];
      if (sum > 1e-6) {
        const inv = 1 / sum;
        weights[o] *= inv;
        weights[o + 1] *= inv;
        weights[o + 2] *= inv;
        weights[o + 3] *= inv;
      }
      modified++;
    }

    skinWeightAttr.needsUpdate = true;
    skinIndexAttr.needsUpdate = true;

    // eslint-disable-next-line no-console
    console.info(`[cosmo-agent] fixSkinWeights: redirected eye-bone weights to bone_head on ${modified} verts (expected ~1621 = 1519 bleed + 102 clean eye-shell)`);
    if (modified === 0 || modified > 3000) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cosmo-agent] fixSkinWeights: vertex count ${modified} is outside the expected ~1621 — rig may have changed`,
      );
    }

    // 4) Reparent eye-bones under bone_head so head-yaw/pitch propagates.
    //    Three.js attach() recomputes local transform from world matrices,
    //    preserving the rest-pose pupil position visually.
    if (USE_REPARENT) {
      const headBone = bones[headIdx];
      const eyeL = bones[eyeLIdx];
      const eyeR = bones[eyeRIdx];
      // Ensure world matrices are current before attach() reads them.
      headBone.updateMatrixWorld(true);
      eyeL.updateMatrixWorld(true);
      eyeR.updateMatrixWorld(true);
      headBone.attach(eyeL);
      headBone.attach(eyeR);
    }
    // No frame-copy needed: eye-bones now have zero weight on every vertex
    // (their entire influence was redirected to bone_head above), so they
    // can stay decorative at armature origin without affecting the mesh.
    this.eyeFrameCopyEnabled = false;
  }

  /** Wave 19 debug helper — sweep head-yaw 0 → +0.7 → -0.7 → 0 over ~3s so
   *  the user can visually verify the eye-melt fix. Exposed on the window
   *  global as `__debugRigYawSweep()` once the GLB has loaded. */
  debugRigYawSweep(): void {
    if (!this.headBone || !this.headRestQuat) {
      // eslint-disable-next-line no-console
      console.warn('[cosmo-agent] debugRigYawSweep: head-bone not resolved yet');
      return;
    }
    const startMs = performance.now();
    const durationMs = 3000;
    const tick = (): void => {
      const t = (performance.now() - startMs) / durationMs;
      if (t >= 1) {
        // Restore — let applyMotion / applyAI take back over next frame.
        return;
      }
      // Triangle wave: 0 → +0.7 → 0 → -0.7 → 0 across the 3 s window.
      let yaw: number;
      if (t < 0.25) yaw = (t / 0.25) * 0.7;
      else if (t < 0.5) yaw = 0.7 - ((t - 0.25) / 0.25) * 0.7;
      else if (t < 0.75) yaw = -((t - 0.5) / 0.25) * 0.7;
      else yaw = -0.7 + ((t - 0.75) / 0.25) * 0.7;
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.headBone!.quaternion.copy(this.headRestQuat!).multiply(yawQ);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.root.parent) this.root.parent.remove(this.root);
    if (this.fallback2D) this.disposeFallback(this.root);
    this.mixer = null;
    this.clips.clear();
    this.pendingActions = [];
    this.headBone = null;
    this.headRestQuat = null;
    this.antennaBone = null;
    this.antennaRestQuat = null;
    this.bodyMaterials = [];
    this.spineBone = null;
    this.spineRestQuat = null;
    this.ai = null;
  }

  // Loading helper for tests
  isLoaded(): boolean {
    return !this.loading;
  }
}
