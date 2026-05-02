/**
 * OnboardingDirector — Sprint 15D.
 *
 * First-3-seconds magic-moment director. Drives a strict timing-precision
 * sequence the moment the page becomes interactive:
 *
 *   AWAIT_TOUCH    → boot-overlay shows "tik om te ontwaken", waits for first
 *                    user-gesture (autoplay-policy unlock).
 *   PORTAL_OPENING → boot-overlay fades, NebulaPortal expands at screen-centre
 *                    (1.5s saffron→ink-aubergine concentric rings).
 *   COSMO_ARRIVING → Cosmo emerges from portal Z=-2 → 0, scale 0.1 → 1.0 over
 *                    1.5s. Lands centre-screen.
 *   BONDING        → Cosmo plays "wave-uncanny" (15A clip): too slow, eyes
 *                    locked on camera, antenne-bloem opens for 0.8s. Halluci-
 *                    nation particle-trail. Audio-stinger 1 (gibberish-coo).
 *   WALKING_FIRST_HINT → Cosmo starts walking right (CosmoAgent.start()).
 *                    First obstacle approaches; HintGlyph "veeg omhoog"
 *                    floats next to it. Pulses harder if no swipe within 5s.
 *                    AutoVJ-equivalent demo-swipe at 8s.
 *   COMPLETE       → localStorage flag persists; full gameplay loop active.
 *
 * The WEIRDO-brief: this isn't onboarding-cliché. It's "alsof Cosmo wakker
 * wordt en JOU ontdekt". The wave-uncanny is intentionally too-slow / too-
 * locked — cosmic uncanny-valley energy.
 *
 * Architecture:
 *   - State machine with enter() / update(dt) / exit() per state.
 *   - Pure logic — emits hooks for the host scene to drive visuals/audio.
 *   - Listens for one-shot events (firstGesture, firstSwipe) via notify*().
 *   - localStorage `cosmosOnboardingComplete` skips portal+arrival on
 *     return-visits. Hint still shows once for re-orientation.
 *
 * The host scene (BeatScene v15D / CosmoScene v15B) injects this via
 * constructor and:
 *   - Calls update(dt) per frame.
 *   - Forwards `tap`/`swipe` gestures via notifyGesture().
 *   - Implements the OnboardingHooks (portal open/close, audio stingers,
 *     pause/resume of obstacle-spawn, Cosmo wave + walk-start).
 */

export type OnboardingState =
  | 'AWAIT_TOUCH'
  | 'PORTAL_OPENING'
  | 'COSMO_ARRIVING'
  | 'BONDING'
  | 'WALKING_FIRST_HINT'
  | 'COMPLETE';

export interface OnboardingHooks {
  /** Show "tik om te ontwaken" sub-text + breathing mic-icon on boot overlay. */
  showAwaitTouchUI(): void;
  /** Fade-out the boot-overlay (800ms). */
  hideBootOverlay(): void;
  /** Open the NebulaPortal at centre-screen (duration ms). */
  openPortal(durationMs: number): void;
  /** Dispose the NebulaPortal — Cosmo has fully arrived. */
  closePortal(): void;
  /** Spawn Cosmo from Z=-2 → 0 with scale 0.1 → 1.0 over `durationMs`. */
  spawnCosmoFromPortal(durationMs: number): void;
  /** Trigger the canonical wave-uncanny animation on the rig (15A clip). */
  playWaveUncanny(): void;
  /** Show a 1.0s hallucination particle-trail around Cosmo. */
  emitHallucinationTrail(): void;
  /** Play audio-stinger 1: gibberish-coo (3-syllable kid-alien babble). */
  playGibberishCoo(): void;
  /** Play audio-stinger 2: short cosmic-chirp (after first-swipe success). */
  playCosmicChirp(): void;
  /** Pause obstacle-spawning (15C ObstacleManager). No-op if not yet wired. */
  pauseObstacleSpawn(): void;
  /** Resume obstacle-spawning. */
  resumeObstacleSpawn(): void;
  /** Begin auto-runner walk-cycle. CosmoAgent.start() in 15B world. */
  startCosmoWalk(): void;
  /** Show the HintGlyph "veeg omhoog" anchored to the next obstacle. */
  showFirstHint(): void;
  /** Hide the HintGlyph (fade-out 400ms). */
  hideFirstHint(): void;
  /** Pulse the hint harder (no-input feedback at 5s). */
  intensifyHint(): void;
  /** Self-demo swipe — auto-trampoline-spawn cadence kicks in. */
  triggerAutoDemoSwipe(): void;
  /** Vibe-meter +20% + saffron-glow ring pulse on first-swipe success. */
  rewardFirstSwipe(): void;
  /** Skip-path: Cosmo appears directly in walking-state, no portal. */
  spawnCosmoSkipPortal(): void;
}

const LS_KEY = 'cosmosOnboardingComplete';

/** Timing checkpoints (seconds). All measured relative to state-enter. */
const PORTAL_OPEN_S = 1.5;
const COSMO_ARRIVE_S = 1.5;
const BONDING_S = 1.0;
const HINT_NO_INPUT_PULSE_S = 5;
const HINT_AUTO_DEMO_S = 8;

export class OnboardingDirector {
  private state: OnboardingState = 'AWAIT_TOUCH';
  private stateT = 0;
  private hooks: OnboardingHooks;
  /** Set true once the player has produced any swipe in WALKING_FIRST_HINT. */
  private firstSwipeFired = false;
  /** Set true once intensifyHint fired so we don't spam it per frame. */
  private hintIntensified = false;
  /** Set true once auto-demo kicked in. */
  private autoDemoTriggered = false;
  /** Skip portal+arrival on return-visits. */
  private skipPortal: boolean;

  constructor(hooks: OnboardingHooks, opts: { skipPortal?: boolean } = {}) {
    this.hooks = hooks;
    this.skipPortal = opts.skipPortal ?? this.readSkipFlag();
  }

  /** Boot — call once after the host scene is ready. */
  start(): void {
    if (this.skipPortal) {
      // Return-visit: collapse straight to walking state. Hint still shows
      // once so people who forgot the gesture get a re-orientation.
      this.transitionTo('WALKING_FIRST_HINT');
    } else {
      this.transitionTo('AWAIT_TOUCH');
    }
  }

  /** Per-frame tick. */
  update(dt: number): void {
    this.stateT += dt;
    switch (this.state) {
      case 'AWAIT_TOUCH':
        // Idle — waiting for notifyGesture('tap'). UI is owned by hooks.
        break;
      case 'PORTAL_OPENING':
        if (this.stateT >= PORTAL_OPEN_S) this.transitionTo('COSMO_ARRIVING');
        break;
      case 'COSMO_ARRIVING':
        if (this.stateT >= COSMO_ARRIVE_S) this.transitionTo('BONDING');
        break;
      case 'BONDING':
        if (this.stateT >= BONDING_S) this.transitionTo('WALKING_FIRST_HINT');
        break;
      case 'WALKING_FIRST_HINT':
        if (this.firstSwipeFired) {
          this.transitionTo('COMPLETE');
          break;
        }
        if (!this.hintIntensified && this.stateT >= HINT_NO_INPUT_PULSE_S) {
          this.hintIntensified = true;
          this.hooks.intensifyHint();
        }
        if (!this.autoDemoTriggered && this.stateT >= HINT_AUTO_DEMO_S) {
          this.autoDemoTriggered = true;
          this.hooks.hideFirstHint();
          this.hooks.triggerAutoDemoSwipe();
          // Even without a player-swipe, mark complete — the AutoVJ-equivalent
          // takes over. The player can still tap-back-in any time.
          this.transitionTo('COMPLETE');
        }
        break;
      case 'COMPLETE':
        // Terminal. update() is a no-op; host scene runs its normal loop.
        break;
    }
  }

  /** Forward any gesture from the host scene's gesture-bus. */
  notifyGesture(name: 'tap' | 'swipe' | 'holdStart' | 'holdEnd' | 'pinch' | 'longHold', dy?: number): void {
    if (this.state === 'AWAIT_TOUCH' && name === 'tap') {
      // First-touch — unlock audio + open portal.
      this.transitionTo('PORTAL_OPENING');
      return;
    }
    if (this.state === 'WALKING_FIRST_HINT' && name === 'swipe') {
      // Brief: "swipe up". dy negative = upward in screen coords. Accept any
      // swipe so a stray horizontal still progresses (forgiveness). The host
      // scene maps the swipe to its own behaviour separately.
      void dy;
      this.firstSwipeFired = true;
      this.hooks.hideFirstHint();
      this.hooks.rewardFirstSwipe();
      this.hooks.playCosmicChirp();
    }
  }

  /** True until the onboarding state-machine reaches COMPLETE. The host
   *  scene uses this to pause the gameplay-loop (obstacle-spawn, scoring). */
  isActive(): boolean {
    return this.state !== 'COMPLETE';
  }

  /** Current state — exposed for host-scene rendering decisions. */
  current(): OnboardingState {
    return this.state;
  }

  /** Allow the host scene to skip the rest of onboarding (debug / tests). */
  forceComplete(): void {
    if (this.state !== 'COMPLETE') this.transitionTo('COMPLETE');
  }

  // ───────────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────────

  private transitionTo(next: OnboardingState): void {
    this.exit(this.state);
    this.state = next;
    this.stateT = 0;
    this.enter(next);
  }

  private enter(s: OnboardingState): void {
    switch (s) {
      case 'AWAIT_TOUCH':
        this.hooks.showAwaitTouchUI();
        // Pause spawn until we're walking.
        this.hooks.pauseObstacleSpawn();
        break;
      case 'PORTAL_OPENING':
        this.hooks.hideBootOverlay();
        this.hooks.openPortal(PORTAL_OPEN_S * 1000);
        // Cosmo emerges in parallel so he lands the moment portal peaks.
        this.hooks.spawnCosmoFromPortal(COSMO_ARRIVE_S * 1000);
        break;
      case 'COSMO_ARRIVING':
        // Portal stays open through arrival; closes on BONDING enter so the
        // halt + wave land on a settled stage.
        break;
      case 'BONDING':
        this.hooks.closePortal();
        this.hooks.playWaveUncanny();
        this.hooks.emitHallucinationTrail();
        this.hooks.playGibberishCoo();
        break;
      case 'WALKING_FIRST_HINT':
        if (this.skipPortal) {
          this.hooks.spawnCosmoSkipPortal();
        }
        this.hooks.resumeObstacleSpawn();
        this.hooks.startCosmoWalk();
        this.hooks.showFirstHint();
        break;
      case 'COMPLETE':
        this.hooks.hideFirstHint();
        this.writeSkipFlag();
        break;
    }
  }

  private exit(_s: OnboardingState): void {
    // No per-state exit work yet — kept for symmetry + future hooks.
  }

  private readSkipFlag(): boolean {
    try {
      return window.localStorage.getItem(LS_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeSkipFlag(): void {
    try {
      window.localStorage.setItem(LS_KEY, 'true');
    } catch {
      /* private mode / sandboxed — ignore */
    }
  }
}
