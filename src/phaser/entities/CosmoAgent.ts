/**
 * CosmoAgent — Sprint 15B
 *
 * Wraps the 3D Cosmo (cosmo.glb from Sprint 15A) inside a state-machine with
 * RANDOM AGENCY. This is the WEIRDO-brief enforcer: Cosmo is not a remote-
 * controlled puppet. Player gestures suggest actions; Cosmo decides whether
 * to comply (RNG-gated). On top of that, his idle tick rolls a small random
 * chance for self-initiated weirdness (knipoog, walk-backward, eigen-jump,
 * antenne-bloem-petal-spew). The "voorspelbare modus" is by design impossible.
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
import { assetPath } from '../../core/assetPath';

// ─── Tunables ────────────────────────────────────────────────────────────────
/** World-units / second. Tuned so 60s of idle walking covers ~12 obstacles. */
export const WALK_SPEED = 0.85;
const BACKWARD_SPEED = 0.55;
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

// ─── Types ───────────────────────────────────────────────────────────────────
export type CosmoState =
  | 'idle'
  | 'walking'
  | 'walking-backward'
  | 'jumping'
  | 'falling'
  | 'ducking'
  | 'dancing'
  | 'looking';

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
      this.root.position.set(this.worldX, this.worldY, 0);
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
      this.root.position.set(this.worldX, this.worldY, 0);
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
      const air = uniforms.audioFFT[5] ?? 0;
      this.mixer.timeScale = 1 + air * 0.1;
      this.mixer.update(dt);
    }

    // Apply position to root.
    this.root.position.set(this.worldX, this.worldY, 0);
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

  // ── Screen-projection helpers used by HUD ────────────────────────────────

  worldPositionVec(): THREE.Vector3 {
    // Aim for the middle of Cosmo's body (~0.75 above feet).
    return new THREE.Vector3(this.worldX, this.worldY + 0.75, 0);
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
    switch (this.state) {
      case 'idle':
        this.worldY = this.groundY;
        break;
      case 'walking':
        this.worldX += WALK_SPEED * dt * this.facing;
        this.worldY = this.groundY;
        if (this.facing !== 1) this.facing = 1; // recover from walk-backward
        break;
      case 'walking-backward':
        this.worldX -= BACKWARD_SPEED * dt;
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) {
          this.facing = 1;
          this.setState('walking');
        }
        break;
      case 'jumping': {
        // Parabolic arc; X still advances.
        const phase = 1 - Math.max(0, (this.stateUntil - this.t) / JUMP_DURATION_S);
        this.worldX += WALK_SPEED * dt * this.facing;
        this.worldY = this.groundY + Math.sin(phase * Math.PI) * JUMP_HEIGHT;
        if (this.t >= this.stateUntil) {
          this.worldY = this.groundY;
          this.setState('walking');
        }
        break;
      }
      case 'ducking':
        // X still advances (squash-and-slide).
        this.worldX += WALK_SPEED * dt * this.facing * 0.7;
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'dancing':
        // Locks position, but bobs vertically with the music.
        this.worldY = this.groundY + Math.sin(this.t * 6) * 0.18;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'looking':
        this.worldY = this.groundY;
        if (this.t >= this.stateUntil) this.setState('walking');
        break;
      case 'falling':
        // Drift down + sideways while opacity goes to 0.
        this.worldY -= 0.6 * dt;
        this.worldX += WALK_SPEED * dt * 0.4 * this.facing;
        if (this.t >= this.stateUntil) {
          // Schedule respawn.
          this.respawnAt = this.t + RESPAWN_DELAY_S;
          this.setState('idle');
          this.opacity = 0;
        }
        break;
    }

    // Respawn after fall delay.
    if (this.opacity === 0 && this.t >= this.respawnAt && this.respawnAt > 0) {
      this.respawn();
    }
  }

  private respawn(): void {
    // Land in a random offset ahead of camera. The InteractionManager listens
    // via onRespawn and may shift the camera or obstacle-pool accordingly.
    const newX = this.worldX + 2 + Math.random() * 2;
    this.worldX = newX;
    this.worldY = this.groundY;
    this.opacity = 0;
    this.respawnAt = 0;
    this.setState('idle');
    this.stateUntil = this.t + 0.6;
    this.events.onRespawn?.(newX);
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

  destroy(): void {
    if (this.root.parent) this.root.parent.remove(this.root);
    if (this.fallback2D) this.disposeFallback(this.root);
    this.mixer = null;
    this.clips.clear();
    this.pendingActions = [];
  }

  // Loading helper for tests
  isLoaded(): boolean {
    return !this.loading;
  }
}
