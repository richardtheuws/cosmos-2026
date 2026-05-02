/**
 * OnboardingDirector — Sprint 15D + 16F.
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
 *   MINI_FLASH     → Sprint 16F: return-user mini-portal. NebulaPortal flashes
 *                    open for 0.6s and closes. No wave, no arrival-tween — Cosmo
 *                    is already at full scale. Sells "we're starting" without
 *                    repeating the full magical opening.
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
 *
 * Sprint 16F — force-show + version-reset:
 *   - URL-param `?onboard=1` overrides the LS skip-flag → ALWAYS run the full
 *     sequence (handy for live demo's that need to show portal+wave).
 *   - LS-flag is now a JSON object `{version, completedAt}`. If the stored
 *     version != ONBOARDING_VERSION the flag is treated as stale → full
 *     sequence runs and the new version is written on COMPLETE. Backwards-
 *     compatible: a legacy `"true"` string is treated as old-version → reset.
 *   - Return-users (LS valid + no force-param) get a 0.6s NebulaPortal flash
 *     via MINI_FLASH state, then walking + hint. No portal at all = jarring;
 *     full sequence = boring on second visit. Mini-flash is the goldilocks.
 *
 * The host scene (CosmoScene v15B) injects this via constructor and:
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
  | 'MINI_FLASH'
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
  /**
   * Sprint 16F mini-flash: 0.6s NebulaPortal flash for return-users. Cosmo
   * stays at full scale (no arrival tween). Provides a "we're starting"
   * cue without re-running the full magical opening.
   */
  flashMiniPortal(durationMs: number): void;
}

const LS_KEY = 'cosmosOnboardingComplete';

/**
 * Sprint 16F — bump this when the onboarding sequence changes meaningfully.
 * Older stored versions will trigger a full re-run of the onboarding so
 * existing players get to see new content (e.g. updated portal, new wave clip).
 */
export const ONBOARDING_VERSION = 'v1.2';

/** Sprint 16F — query-string override. Demo's: `?onboard=1` forces the full
 *  portal+arrival+wave sequence regardless of LS state. */
const FORCE_QUERY_PARAM = 'onboard';

interface StoredCompletion {
  version: string;
  completedAt: number;
}

/** Timing checkpoints (seconds). All measured relative to state-enter. */
const PORTAL_OPEN_S = 1.5;
const COSMO_ARRIVE_S = 1.5;
const BONDING_S = 1.0;
const MINI_FLASH_S = 0.6;
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
    // Sprint 16F: URL-param `?onboard=1` is the loudest signal — overrides
    // both the explicit opts.skipPortal and the LS flag. Demo / press kit
    // / live-stream paths use this to guarantee the magical opening shows.
    if (this.readForceFromUrl()) {
      this.skipPortal = false;
    } else if (opts.skipPortal !== undefined) {
      this.skipPortal = opts.skipPortal;
    } else {
      this.skipPortal = this.readSkipFlag();
    }
  }

  /** Boot — call once after the host scene is ready. */
  start(): void {
    if (this.skipPortal) {
      // Return-visit: still want a tiny portal flash so the start of the
      // experience feels intentional. Cosmo is already on stage at full
      // scale (spawnCosmoSkipPortal in MINI_FLASH.enter), portal flashes
      // 0.6s then we land in WALKING_FIRST_HINT.
      this.transitionTo('MINI_FLASH');
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
      case 'MINI_FLASH':
        if (this.stateT >= MINI_FLASH_S) this.transitionTo('WALKING_FIRST_HINT');
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
      case 'MINI_FLASH':
        // Sprint 16F: return-user mini-portal. Cosmo lands on stage at full
        // scale immediately (no arrival tween) and the portal flashes briefly
        // around him. Boot-overlay also fades — the flash itself owns the
        // visual centre during this state.
        this.hooks.hideBootOverlay();
        this.hooks.spawnCosmoSkipPortal();
        this.hooks.flashMiniPortal(MINI_FLASH_S * 1000);
        break;
      case 'WALKING_FIRST_HINT':
        // First-visit path: spawnCosmoSkipPortal was NOT called (we came via
        // BONDING with a real arrival tween). For the MINI_FLASH return-user
        // path, spawnCosmoSkipPortal ran on MINI_FLASH.enter so Cosmo is
        // already on stage — no double-spawn.
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

  /**
   * Sprint 16F — version-aware skip-read. Stored as JSON `{version, completedAt}`
   * so we can invalidate on onboarding changes (bump ONBOARDING_VERSION). A
   * legacy `"true"` string is treated as old-version → return false (full
   * sequence runs and rewrites with the new shape on COMPLETE).
   */
  private readSkipFlag(): boolean {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return false;
      // Backwards-compat: legacy string-flag from Sprint 15D.
      if (raw === 'true') return false;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'version' in parsed &&
        (parsed as StoredCompletion).version === ONBOARDING_VERSION
      ) {
        return true;
      }
      // Stored but on old version → treat as not-completed.
      return false;
    } catch {
      return false;
    }
  }

  private writeSkipFlag(): void {
    try {
      const payload: StoredCompletion = {
        version: ONBOARDING_VERSION,
        completedAt: Date.now(),
      };
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      /* private mode / sandboxed — ignore */
    }
  }

  /**
   * Sprint 16F — `?onboard=1` URL param forces a full-sequence run. Used by
   * live demo links so the portal-arrival + wave-uncanny moment always plays
   * for the audience even on a returning device. Any truthy value (`1`,
   * `true`, `force`) counts.
   */
  private readForceFromUrl(): boolean {
    try {
      if (typeof window === 'undefined' || !window.location) return false;
      const params = new URLSearchParams(window.location.search);
      const v = params.get(FORCE_QUERY_PARAM);
      if (v === null) return false;
      return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'force';
    } catch {
      return false;
    }
  }
}
