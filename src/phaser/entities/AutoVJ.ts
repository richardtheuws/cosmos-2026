/**
 * AutoVJ — Sprint 13A.
 *
 * Tracks the wall-clock since the last player tap and engages an auto-VJ mode
 * after `IDLE_BEFORE_AUTO_S` seconds. While engaged the scene asks AutoVJ
 * whether each fresh BeatTarget should be auto-tapped (returning true ⇒ scene
 * resolves the bubble at perfect timing without a visible tap).
 *
 * Per PRD §3 / §9 — "Speler kan WEGLOPEN. 30 min later is alles nog mooi."
 *
 * Disengage happens immediately when the player taps — `notifyPlayerTap()`
 * resets the idle timer and clears the engaged flag. Cosmo's yawn is fired
 * once on engage; further yawns are throttled by the rig itself.
 */

const IDLE_BEFORE_AUTO_S = 8;
const NO_INPUT_LOOK_AROUND_S = 12;
const YAWN_THROTTLE_S = 30;

export interface AutoVJHooks {
  onEngage(): void;
  onDisengage(): void;
  onYawn(): void;
  onLookAround(): void;
}

export class AutoVJ {
  private idleS = 0;
  private engaged = false;
  private lastYawnAt = -Infinity;
  private lookFiredForCurrentIdle = false;
  private hooks: AutoVJHooks;

  constructor(hooks: AutoVJHooks) {
    this.hooks = hooks;
  }

  /** Per-frame tick. */
  update(dt: number): void {
    this.idleS += dt;

    if (!this.engaged && this.idleS >= IDLE_BEFORE_AUTO_S) {
      this.engaged = true;
      this.lookFiredForCurrentIdle = false;
      this.hooks.onEngage();
      this.fireYawnIfDue();
    }

    if (
      !this.lookFiredForCurrentIdle &&
      this.idleS >= NO_INPUT_LOOK_AROUND_S
    ) {
      this.lookFiredForCurrentIdle = true;
      this.hooks.onLookAround();
    }

    if (this.engaged) {
      this.fireYawnIfDue();
    }
  }

  /** True when the scene should auto-tap fresh bubbles. */
  isEngaged(): boolean {
    return this.engaged;
  }

  /** Reset the idle timer when the player interacts. */
  notifyPlayerTap(): void {
    if (this.engaged) {
      this.engaged = false;
      this.hooks.onDisengage();
    }
    this.idleS = 0;
    this.lookFiredForCurrentIdle = false;
  }

  /** Reset the idle timer for any non-tap interaction (swipe / pinch / hold). */
  notifyPlayerInteraction(): void {
    this.idleS = 0;
    this.lookFiredForCurrentIdle = false;
  }

  private fireYawnIfDue(): void {
    if (this.idleS - this.lastYawnAt < YAWN_THROTTLE_S) return;
    this.lastYawnAt = this.idleS;
    this.hooks.onYawn();
  }
}
