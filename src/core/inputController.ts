/**
 * Input controller — Sprint 13A rewrite for the rhythm-trip pivot.
 *
 * Two complementary surfaces:
 *
 * 1. **Legacy keyboard state** (`state`) — kept lean (only the keys the rebuild
 *    actually consumes: arrow-keys for desktop tap-emulation, M for mute, D for
 *    debug). The platformer flags (jump/bomb/pan) are gone.
 *
 * 2. **Gesture event-bus** (`onGesture`) — BeatScene + CosmoRig + AutoVJ
 *    subscribe to abstract gestures. The TouchOverlay (mobile) and a desktop
 *    pointer-listener both feed into the same `dispatchGesture()` so the
 *    downstream code never branches on platform.
 *
 * Five gestures per PRD §3:
 *   - tap         (x, y)              — point + release < 200ms, no drag
 *   - holdStart   (x, y)              — pointerdown
 *   - holdEnd     (x, y, ms)          — pointerup after holdStart, used for
 *                                       crouch+release shockwave
 *   - swipe       (dx, dy)            — horizontal sweep > 60px in <250ms
 *   - pinch       (scale)             — two-finger zoom delta (0.5..2.0)
 *   - longHold    (x, y)              — single-touch held > 3000ms in centre
 *                                       (deep-trip trigger, gated by progression)
 *
 * The controller doesn't *interpret* gestures (no game state inside) — it just
 * recognises them from raw pointer events and broadcasts. The scene decides
 * what each gesture means.
 */

export type GestureName =
  | 'tap'
  | 'holdStart'
  | 'holdEnd'
  | 'swipe'
  | 'pinch'
  | 'longHold';

export interface GestureEvent {
  name: GestureName;
  /** Screen-x in CSS pixels at the moment the gesture fired. */
  x?: number;
  y?: number;
  /** Hold duration in ms (holdEnd, longHold only). */
  durationMs?: number;
  /** Delta-x for swipe (positive = right). */
  dx?: number;
  dy?: number;
  /** Pinch scale (relative to gesture-start). */
  scale?: number;
}

type GestureListener = (e: GestureEvent) => void;

/** Minimal keyboard snapshot — the rebuild only needs muting + debug. */
export interface InputState {
  /** Legacy field — kept for API compatibility with code that hasn't been
   *  rewritten yet (touch-overlay still pushes left/right but BeatScene
   *  ignores them). */
  left: boolean;
  right: boolean;
  jump: boolean;
  bomb: boolean;
  /** True the frame `M` is pressed. Consumer must call postFrame() to clear. */
  mutePressed: boolean;
}

export interface VirtualInput {
  left?: boolean;
  right?: boolean;
  jump?: boolean;
  bomb?: boolean;
}

const TAP_MAX_MS = 220;
const TAP_MAX_MOVE_PX = 14;
const SWIPE_MIN_PX = 60;
const SWIPE_MAX_MS = 280;
const LONG_HOLD_MS = 3000;
const LONG_HOLD_CENTER_TOLERANCE = 0.25; // ±25% of viewport width/height

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  startedAt: number;
  longHoldFired: boolean;
  longHoldTimer: number | null;
  /** Did this pointer trigger a holdStart already? Used to fire holdEnd on up. */
  holdStartFired: boolean;
}

export class InputController {
  state: InputState = {
    left: false,
    right: false,
    jump: false,
    bomb: false,
    mutePressed: false,
  };

  private listeners = new Set<GestureListener>();
  private pointers = new Map<number, ActivePointer>();
  /** Pinch baseline distance (px) when the second pointer goes down. */
  private pinchBaseDist = 0;
  /** Horizontal-swipe ignore-window after a pinch ends, prevents double-fire. */
  private swipeBlockUntil = 0;

  attach(): void {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    for (const p of this.pointers.values()) {
      if (p.longHoldTimer !== null) window.clearTimeout(p.longHoldTimer);
    }
    this.pointers.clear();
  }

  onGesture(fn: GestureListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Sprint 13A — synthesise a gesture from outside (e.g. touch-overlay's tap
   *  buttons can call this after their own debounce). Useful for tests too. */
  setVirtualGesture(e: GestureEvent): void {
    this.dispatch(e);
  }

  /** Compatibility shim — TouchOverlay v1 still pushes virtual key-states.
   *  The rebuild ignores these, but we keep the method so the overlay doesn't
   *  crash if someone leaves the d-pad wired up. */
  setVirtualInput(v: VirtualInput): void {
    if (v.left !== undefined) this.state.left = v.left;
    if (v.right !== undefined) this.state.right = v.right;
    if (v.jump !== undefined) this.state.jump = v.jump;
    if (v.bomb !== undefined) this.state.bomb = v.bomb;
  }

  postFrame(): void {
    this.state.mutePressed = false;
  }

  // ---- Gesture recognition ----

  private dispatch(e: GestureEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[input] gesture listener threw:', err);
      }
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    const p: ActivePointer = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      startedAt: performance.now(),
      longHoldFired: false,
      longHoldTimer: null,
      holdStartFired: false,
    };
    this.pointers.set(e.pointerId, p);

    // Fire holdStart immediately so CosmoRig.startCrouch can engage; tap/swipe
    // recognition is decided on pointerup based on duration + travel.
    p.holdStartFired = true;
    this.dispatch({ name: 'holdStart', x: e.clientX, y: e.clientY });

    // Pinch detection — second pointer goes down → start tracking distance.
    if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      this.pinchBaseDist = Math.hypot(a.curX - b.curX, a.curY - b.curY) || 1;
    }

    // Long-hold timer — only the *first* active pointer can trigger it,
    // and only if its start-pos is in the screen-centre-ish region.
    if (this.pointers.size === 1) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const inCentre =
        Math.abs(e.clientX - cx) < window.innerWidth * LONG_HOLD_CENTER_TOLERANCE &&
        Math.abs(e.clientY - cy) < window.innerHeight * LONG_HOLD_CENTER_TOLERANCE;
      if (inCentre) {
        p.longHoldTimer = window.setTimeout(() => {
          if (!this.pointers.has(p.id)) return;
          p.longHoldFired = true;
          this.dispatch({
            name: 'longHold',
            x: p.startX,
            y: p.startY,
            durationMs: LONG_HOLD_MS,
          });
        }, LONG_HOLD_MS);
      }
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.curX = e.clientX;
    p.curY = e.clientY;

    // Cancel pending long-hold if the pointer drifts too far.
    if (p.longHoldTimer !== null) {
      const drift = Math.hypot(p.curX - p.startX, p.curY - p.startY);
      if (drift > TAP_MAX_MOVE_PX) {
        window.clearTimeout(p.longHoldTimer);
        p.longHoldTimer = null;
      }
    }

    // Pinch — emit while two pointers are active.
    if (this.pointers.size === 2 && this.pinchBaseDist > 0) {
      const [a, b] = Array.from(this.pointers.values());
      const dist = Math.hypot(a.curX - b.curX, a.curY - b.curY);
      const scale = dist / this.pinchBaseDist;
      this.dispatch({ name: 'pinch', scale });
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (p.longHoldTimer !== null) {
      window.clearTimeout(p.longHoldTimer);
      p.longHoldTimer = null;
    }

    const dt = performance.now() - p.startedAt;
    const dx = p.curX - p.startX;
    const dy = p.curY - p.startY;
    const dist = Math.hypot(dx, dy);

    const wasPinch = this.pointers.size >= 2;

    // Always close the hold pair.
    if (p.holdStartFired) {
      this.dispatch({
        name: 'holdEnd',
        x: p.curX,
        y: p.curY,
        durationMs: dt,
      });
    }

    // Recognition order: pinch (multi-touch ending) > swipe > tap.
    if (wasPinch) {
      this.swipeBlockUntil = performance.now() + 200;
    } else if (
      !p.longHoldFired &&
      Math.abs(dx) > SWIPE_MIN_PX &&
      dt < SWIPE_MAX_MS &&
      Math.abs(dx) > Math.abs(dy) * 1.4 &&
      performance.now() > this.swipeBlockUntil
    ) {
      this.dispatch({ name: 'swipe', dx, dy });
    } else if (
      !p.longHoldFired &&
      dt < TAP_MAX_MS &&
      dist < TAP_MAX_MOVE_PX
    ) {
      this.dispatch({ name: 'tap', x: p.curX, y: p.curY });
    }

    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchBaseDist = 0;
  };

  private onKey = (e: KeyboardEvent): void => {
    const down = e.type === 'keydown';
    switch (e.code) {
      case 'KeyM':
        if (down && !e.repeat) this.state.mutePressed = true;
        break;
      case 'Space':
        // Desktop tap-emulation — pressing space behaves like a tap on screen-centre.
        if (down && !e.repeat) {
          this.dispatch({
            name: 'tap',
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
        }
        e.preventDefault();
        break;
      case 'ArrowLeft':
        this.state.left = down;
        break;
      case 'ArrowRight':
        this.state.right = down;
        break;
      default:
        return;
    }
  };
}
