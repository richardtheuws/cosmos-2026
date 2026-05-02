/**
 * MotionController — Sprint 17B
 *
 * Single source of truth for "where is the user looking right now?" The output
 * is a smoothed, normalised pan-vector in [-1..1] for X/Y plus a 0..1 zoom
 * channel. CosmoStage consumes pan-XY to drive the camera within biome-bounds;
 * CosmoAgent consumes the same vector to nudge Cosmo's head-yaw/pitch.
 *
 * Source order (highest priority first)
 * ─────────────────────────────────────
 *   1. DeviceOrientationEvent (mobile gyro). On iOS 13+ this requires an
 *      explicit `requestPermission()` call from a user-gesture handler — the
 *      controller exposes that via `requestPermission()`. Android Chrome and
 *      iOS 12 attach the listener directly with no prompt.
 *   2. Pointermove (desktop / touch fallback). Cursor position normalised to
 *      viewport drives panX/Y. Always attached so the controller works without
 *      gyro permission.
 *   3. Companion auto-drift. After 8 seconds without ANY input (no gesture,
 *      no pointermove, no gyro tilt above the deadband) the controller takes
 *      over and emits a slow sin-wave pan. This is the always-alive feeling —
 *      Cosmo's world breathes even when the user puts the phone down.
 *
 * Permission flow (iOS 13+)
 *   - On first user-gesture (touchstart / click) we check for the
 *     `requestPermission()` static method on `DeviceOrientationEvent`.
 *   - We surface a small toast (callable from outside via `requestPermission()`
 *     returning the granted-flag) so the host UI can render its own prompt.
 *   - If the user grants → attach the gyro listener and start emitting from
 *     the gyro source.
 *   - If the user denies / dismisses → fallback stays active. We never re-prompt.
 *   - The toast (host UI) shows a one-time info note "we use cursor-tracking
 *     ipv beweging" so the player understands why the world reacts to mouse.
 *
 * Gyro mapping
 *   - alpha (compass yaw) — unused; rotating-the-phone-flat shouldn't pan.
 *   - beta  (front-back tilt, -180..180) — useful range 30..60 → panY.
 *     Holding the phone in portrait at ~45° feels neutral (panY=0); tilting
 *     forward (beta increases) pans Y toward +1, backward toward -1.
 *   - gamma (left-right tilt, -90..90) — straight gamma → panX. Tilting the
 *     phone left (gamma negative) pans X toward -1, right toward +1.
 *   - Zoom is unused for now; reserved 0..1 channel for future pinch-driven
 *     biome-zoom (Sprint 18+).
 *
 * Companion-drift formula
 *   panX = sin(t * 0.21) * 0.6
 *   panY = sin(t * 0.18) * 0.4
 *   The two frequencies are intentionally non-rational so the trajectory
 *   never repeats exactly within a viewing-session. Amplitudes are chosen
 *   so the camera never hits its biome-bounds clamp during companion-mode.
 *
 * Testing notes
 *   - The class is fully constructable in node (no DOM) — `attach()` is the
 *     only method that touches `window`. Keep it that way for unit tests.
 *   - `tick()` must be called every frame from main.ts — it advances the
 *     companion-drift timer and the no-input watchdog.
 */

const NO_INPUT_TIMEOUT_S = 8;
const COMPANION_DRIFT_FREQ_X = 0.21;
const COMPANION_DRIFT_FREQ_Y = 0.18;
const COMPANION_DRIFT_AMP_X = 0.6;
const COMPANION_DRIFT_AMP_Y = 0.4;
const PAN_LERP = 0.12;
/** Beta range mapped to panY = -1..1. Center at 45° for portrait grip. */
const BETA_NEUTRAL = 45;
const BETA_RANGE = 30; // ±30° around 45° → -1..1
/** Gamma range mapped to panX = -1..1. */
const GAMMA_RANGE = 45;
/** Tilt magnitude that counts as "user is providing motion input." Below this,
 *  small breathing-noise from the gyro doesn't reset the companion-mode timer. */
const GYRO_INPUT_DEADBAND = 0.04;

export type MotionSource = 'gyro' | 'pointer' | 'companion' | 'none';

export interface MotionControllerOptions {
  /** Override window for tests. Defaults to global `window` at attach-time. */
  win?: Window;
  /** Skip the iOS permission-gate even if available. Useful in tests. */
  skipPermission?: boolean;
}

interface DeviceOrientationEventStatic {
  /** iOS 13+ adds this static method. */
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

export class MotionController {
  // Public smoothed output.
  private panX = 0;
  private panY = 0;
  private zoom = 0;

  // Source state.
  private rawPanX = 0;
  private rawPanY = 0;
  private hasGyroPermission = false;
  private gyroAttached = false;
  private pointerAttached = false;
  private currentSource: MotionSource = 'none';

  // No-input watchdog.
  private lastInputT = 0;
  private t = 0;

  // Window override (for tests).
  private win: Window | null = null;
  private skipPermission: boolean;

  // Listener references — kept so detach() can clean up.
  private onOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
  private onPointerMove: ((e: PointerEvent) => void) | null = null;
  private onAnyInput: (() => void) | null = null;

  constructor(opts: MotionControllerOptions = {}) {
    this.win = opts.win ?? null;
    this.skipPermission = opts.skipPermission ?? false;
  }

  /** Attach the always-on listeners. Pointermove + a generic "any input"
   *  watchdog wire up immediately. The gyro listener attaches lazily on
   *  `requestPermission()` (iOS) or on first call to `attachGyroFree()`
   *  (Android, where no permission is required). */
  attach(): void {
    if (typeof window === 'undefined' && !this.win) return;
    const w = this.win ?? window;
    this.win = w;

    // Pointermove → pan + reset no-input timer.
    this.onPointerMove = (e: PointerEvent): void => {
      const nx = (e.clientX / Math.max(1, w.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, w.innerHeight)) * 2 - 1;
      this.rawPanX = clamp(nx, -1, 1);
      this.rawPanY = clamp(ny, -1, 1);
      this.lastInputT = this.t;
      // Pointer wins over companion-drift but loses to active gyro.
      if (this.currentSource !== 'gyro') {
        this.currentSource = 'pointer';
      }
    };

    // Generic "user is here" watchdog — reset companion-mode on ANY signal.
    this.onAnyInput = (): void => {
      this.lastInputT = this.t;
    };

    w.addEventListener('pointermove', this.onPointerMove, { passive: true });
    w.addEventListener('touchstart', this.onAnyInput, { passive: true });
    w.addEventListener('keydown', this.onAnyInput, { passive: true });
    w.addEventListener('click', this.onAnyInput, { passive: true });
    this.pointerAttached = true;

    // On Android Chrome and older iOS, gyro doesn't need permission — attach now.
    if (!this.needsPermissionGate()) {
      this.attachGyroFree();
    }
  }

  detach(): void {
    const w = this.win;
    if (!w) return;
    if (this.onPointerMove) {
      w.removeEventListener('pointermove', this.onPointerMove);
    }
    if (this.onAnyInput) {
      w.removeEventListener('touchstart', this.onAnyInput);
      w.removeEventListener('keydown', this.onAnyInput);
      w.removeEventListener('click', this.onAnyInput);
    }
    if (this.onOrientation) {
      w.removeEventListener('deviceorientation', this.onOrientation);
    }
    this.onPointerMove = null;
    this.onAnyInput = null;
    this.onOrientation = null;
    this.gyroAttached = false;
    this.pointerAttached = false;
  }

  /** iOS 13+ permission-gated attach. Must be invoked from a user-gesture
   *  handler (touchstart/click) or the browser will reject the prompt.
   *  Returns true if the gyro is now feeding the controller. */
  async requestPermission(): Promise<boolean> {
    if (this.hasGyroPermission || this.gyroAttached) return true;
    if (this.skipPermission) return false;

    const w = this.win ?? (typeof window !== 'undefined' ? window : null);
    if (!w) return false;
    const ctor = (w as unknown as { DeviceOrientationEvent?: DeviceOrientationEventStatic })
      .DeviceOrientationEvent;
    const reqFn = ctor?.requestPermission;
    if (typeof reqFn !== 'function') {
      // No permission gate on this platform — attach directly.
      this.attachGyroFree();
      return this.gyroAttached;
    }

    try {
      const result = await reqFn.call(ctor);
      if (result === 'granted') {
        this.hasGyroPermission = true;
        this.attachGyroFree();
        return this.gyroAttached;
      }
      return false;
    } catch {
      // User dismissed / iOS WebView with no manifest. Fallback stays active.
      return false;
    }
  }

  /** Attach the gyro listener without prompting. Safe to call multiple times. */
  private attachGyroFree(): void {
    if (this.gyroAttached) return;
    const w = this.win;
    if (!w) return;
    if (typeof (w as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent === 'undefined') {
      return;
    }
    this.onOrientation = (e: DeviceOrientationEvent): void => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? BETA_NEUTRAL;
      const px = clamp(gamma / GAMMA_RANGE, -1, 1);
      const py = clamp((beta - BETA_NEUTRAL) / BETA_RANGE, -1, 1);
      // Magnitude-gate: only register as "input" if the player is actually
      // tilting; otherwise the no-input timer wouldn't fire on a phone-on-table.
      const magnitude = Math.hypot(px, py);
      if (magnitude > GYRO_INPUT_DEADBAND) {
        this.lastInputT = this.t;
        this.currentSource = 'gyro';
        this.rawPanX = px;
        this.rawPanY = py;
      } else {
        // Sub-deadband phone-noise → don't write raw, decay toward 0 instead.
        // This kills the visible jitter on a phone-on-table while keeping
        // companion-drift fully alive.
        this.rawPanX *= 0.92;
        this.rawPanY *= 0.92;
      }
    };
    w.addEventListener('deviceorientation', this.onOrientation, { passive: true });
    this.gyroAttached = true;
  }

  /** Returns true if this platform is iOS 13+ where requestPermission is needed. */
  needsPermissionGate(): boolean {
    if (this.skipPermission) return false;
    const w = this.win ?? (typeof window !== 'undefined' ? window : null);
    if (!w) return false;
    const ctor = (w as unknown as { DeviceOrientationEvent?: DeviceOrientationEventStatic })
      .DeviceOrientationEvent;
    return typeof ctor?.requestPermission === 'function';
  }

  /** Per-frame tick — advances the companion-drift timer and smoothing.
   *  `dt` in seconds. Call once per frame from main.ts. */
  tick(dt: number): void {
    this.t += dt;

    let targetX = this.rawPanX;
    let targetY = this.rawPanY;

    // Companion-mode override after 8s of no-input.
    const idle = this.t - this.lastInputT > NO_INPUT_TIMEOUT_S;
    if (idle) {
      targetX = Math.sin(this.t * COMPANION_DRIFT_FREQ_X) * COMPANION_DRIFT_AMP_X;
      targetY = Math.sin(this.t * COMPANION_DRIFT_FREQ_Y) * COMPANION_DRIFT_AMP_Y;
      this.currentSource = 'companion';
    } else if (this.currentSource === 'companion') {
      // Just woke up from companion-mode — fall back to whatever source we had.
      this.currentSource = this.gyroAttached ? 'gyro' : (this.pointerAttached ? 'pointer' : 'none');
    }

    // Smooth toward target so abrupt gyro spikes don't snap-pan the camera.
    this.panX += (targetX - this.panX) * PAN_LERP;
    this.panY += (targetY - this.panY) * PAN_LERP;
  }

  // ── Public read API ─────────────────────────────────────────────────────

  /** Smoothed pan-X in [-1..1]. Negative = look left. */
  getPanX(): number {
    return this.panX;
  }
  /** Smoothed pan-Y in [-1..1]. Negative = look up. */
  getPanY(): number {
    return this.panY;
  }
  /** Smoothed zoom in [0..1]. Reserved for future pinch-driven biome-zoom. */
  getZoom(): number {
    return this.zoom;
  }
  /** Current active source — handy for HUD diagnostics + tests. */
  getSource(): MotionSource {
    return this.currentSource;
  }
  /** True when companion auto-drift is currently driving the camera. */
  isCompanionActive(): boolean {
    return this.currentSource === 'companion';
  }

  // ── Test/host helpers ───────────────────────────────────────────────────

  /** Force-reset the no-input timer — call this from any non-listened input
   *  surface (e.g. a synthetic gesture from the OnboardingDirector). */
  notifyInput(): void {
    this.lastInputT = this.t;
  }

  /** Test hook — directly inject raw pan values. */
  _setRawForTest(x: number, y: number): void {
    this.rawPanX = clamp(x, -1, 1);
    this.rawPanY = clamp(y, -1, 1);
    this.lastInputT = this.t;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
