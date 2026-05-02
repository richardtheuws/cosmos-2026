/**
 * BeatScene — Sprint 13A.
 *
 * Single-screen mobile-first portrait rhythm scene. Cosmo dead-centre at
 * 40% of the viewport in portrait (30% in landscape). No camera-follow, no
 * world-scroll, no physics (Cosmo is a Container; bubbles are Graphics).
 *
 * Responsibilities:
 *   - own the CosmoRig + AutoVJ + a pool of BeatTargets
 *   - drive a placeholder spawn-loop until the beatmap arrives in 13B
 *   - wire 5 mobile gestures (tap / hold / swipe / pinch / longHold) via the
 *     InputController gesture-bus
 *   - paint a minimal HUD: combo counter (rising-edge fade-in) + version pill
 *   - respect viewport-fit=cover and safe-area-inset on iOS
 *
 * It deliberately ignores legacy keyboard left/right and the d-pad overlay —
 * those are platformer relics. Space / on-screen tap synthesise a centre-tap
 * and that's it.
 */
import Phaser from 'phaser';
import type { GlobalUniforms } from '../../core/globalUniforms';
import type { InputController, GestureEvent } from '../../core/inputController';
import { Progression } from '../../core/progression';
import { CosmoRig } from '../entities/CosmoRig';
import { AutoVJ } from '../entities/AutoVJ';
import {
  BeatTarget,
  type BeatTargetSpawnConfig,
  type BeatTimingResult,
} from '../entities/BeatTarget';
import type { AudioFFTBridge } from '../../audio/audioFFTBridge';
import { HALLUCINATION_PEAKS } from '../../audio/audioFFTBridge';
import {
  loadBeatmap,
  beatmapUrl,
  BeatmapScheduler,
  type BeatEvent,
} from '../../audio/beatmap';
import { assetPath } from '../../core/assetPath';

interface SceneInitData {
  input: InputController;
  uniforms: GlobalUniforms;
  audioBridge: AudioFFTBridge;
  progression: Progression;
  /** Game version — surfaced on the HUD pill (top-right). */
  version: string;
}

const COSMO_PORTRAIT_FRACTION = 0.4;
const COSMO_LANDSCAPE_FRACTION = 0.3;
const COMBO_HALLUCINATION_AT = 8;
const COMBO_KALEIDO_AT = 16;
const COMBO_VIBE_PEAK_AT = 32;
/** Default placeholder spawn period until 13B beatmap. */
const SPAWN_INTERVAL_MIN_S = 1.4;
const SPAWN_INTERVAL_MAX_S = 2.4;
/** Max simultaneous bubbles on-screen. */
const MAX_ACTIVE_BEATS = 4;
/** Tap-to-bubble hit-radius scale (× bubble radius). */
const TAP_HIT_SCALE = 1.4;
/** Tempo-shift state — Howler.rate ±10% for 4s. */
const TEMPO_SHIFT_AMOUNT = 0.1;
const TEMPO_SHIFT_DURATION_S = 4;
/** Sprint 14C — drift-loose default. The user can opt into beat-lock via
 *  localStorage `cosmosBeatLockMode` or URL `?mode=beat`. */
const BEAT_LOCK_LS_KEY = 'cosmosBeatLockMode';
/** Default beatmap track-key when beat-lock mode is enabled. Matches the
 *  filename in `public/assets/beatmaps/<track>.json` and the music track
 *  served by AudioFFTBridge.MUSIC_TRACK. */
const BEAT_LOCK_DEFAULT_TRACK = 'title-theme';
/** Saffron ring radius (× cosmoH) used by the beat-lock visual feedback. */
const BEAT_LOCK_RING_RADIUS_FRACTION = 0.62;

export class BeatScene extends Phaser.Scene {
  private inputCtl!: InputController;
  private uniforms!: GlobalUniforms;
  private audioBridge!: AudioFFTBridge;
  private progression!: Progression;
  private version = '0.0.0';

  private cosmo!: CosmoRig;
  private autoVJ!: AutoVJ;
  private targets: BeatTarget[] = [];

  /** Combo state (PRD §6 — perfect-only, hard reset on miss). */
  private _combo = 0;
  /** Sprint 13E — public read for share/captureScreen/peakDetector. */
  get combo(): number { return this._combo; }
  private set combo(v: number) { this._combo = v; }
  private versionPillEl: HTMLDivElement | null = null;
  private comboTextEl: HTMLDivElement | null = null;
  private comboHasShown = false;

  // ─────────────────────────────────────────────────────────────────────────
  // Sprint 14D — invisible-by-default HUD state-machine
  //
  //   combo:    opacity 0 → tap → fade-in 240ms → hold 0.6s @1 → fade-out 1.2s
  //             miss      → scale-pulse 1.12→1, opacity 1 → 0.85 → 0
  //   version:  visible 4s after boot (intro), then fade-out 800ms → 0
  //             pinch-zoom-out re-fades it in for 4s (debug-mode reveal)
  //   top-nav:  default opacity 0.25 (CSS), hover/focus/touch reveals
  //             AutoVJ engaged → .is-autovj-hidden on #hud-root → opacity 0
  // ─────────────────────────────────────────────────────────────────────────
  /** uniforms.time when the combo was last activated (for hold + fade-out). */
  private comboShowAt = -Infinity;
  /** uniforms.time at HUD boot — drives the version-pill intro 4s window. */
  private hudBootT = -Infinity;
  /** uniforms.time until which the version-pill stays revealed (debug). */
  private versionRevealUntil = 0;
  /** AutoVJ engagement edge-detector for one-shot DOM toggles. */
  private wasAutoVJEngaged = false;
  /** Reference to the top-nav .hud root in play/index.html. */
  private hudRootEl: HTMLElement | null = null;
  /** uniforms.time until which the mobile tap-reveal class persists. */
  private hudRevealUntil = 0;
  /** Cleanup hook for the mobile reveal-zone touchstart listener. */
  private offRevealZone: (() => void) | null = null;
  /** uniforms.time until which the combo runs the "miss" pulse animation. */
  private comboMissPulseUntil = 0;
  /** Cached camera-zoom from the previous frame to detect pinch-zoom-out. */
  private prevCamZoom = 1;

  /** Spawn-loop accumulator. */
  private spawnT = 0;
  private nextSpawnAt = 0;

  /** Sprint 14C — drift-loose vs beat-lock mode.
   *
   *  Default ervaring is HYPNOSE: bubbles spawn op een 1.4-2.4s autonomous
   *  ritme (placeholder spawn-loop). Beat-lock is OPT-IN — gebruiker zet het
   *  expliciet aan via `?mode=beat` URL param of `B` debug-key. Het FFT-bridge
   *  blijft post-FX driven (lows→bloom etc) — dat staat los van deze toggle.
   */
  private beatLockMode = false;
  /** Loaded beatmap scheduler — only constructed when beatLockMode flips on. */
  private scheduler: BeatmapScheduler | null = null;
  /** True once a beatmap-load has been kicked off, so we don't refetch. */
  private beatmapLoadStarted = false;
  /** Saffron-glow ring around Cosmo, only drawn when beatLockMode is on. */
  private beatLockRing: Phaser.GameObjects.Graphics | null = null;
  /** Hotkey-listener cleanup. */
  private offHotkey: (() => void) | null = null;

  /** Tempo-shift remaining time in seconds. */
  private tempoShiftRemaining = 0;
  /** The base playbackRate of the music element. Restored when shift ends. */
  private tempoBaseRate = 1.0;

  /** Pinch-baseline used to clamp pinch.scale into the 0.5–0.8 viewport range
   *  (PRD §3). The current camera zoom is read back from the camera itself. */
  private pinchBase = 1.0;

  /** Gesture-listener unsubscribe hook so we tear down on shutdown. */
  private offGesture: (() => void) | null = null;

  constructor() {
    super({ key: 'BeatScene' });
  }

  init(data: SceneInitData): void {
    this.inputCtl = data.input;
    this.uniforms = data.uniforms;
    this.audioBridge = data.audioBridge;
    this.progression = data.progression;
    this.version = data.version;

    // Sprint 14C — resolve beat-lock mode. URL takes precedence over LS so a
    // shared link can demo beat-mode without polluting the visitor's storage.
    this.beatLockMode = this.resolveBeatLockMode();
  }

  /** Resolve the initial beat-lock state. URL `?mode=beat` overrides LS;
   *  LS `cosmosBeatLockMode === 'true'` is the persisted opt-in. */
  private resolveBeatLockMode(): boolean {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'beat') return true;
    } catch {
      // Non-browser env or sandboxed iframe — fall through to LS.
    }
    try {
      return window.localStorage.getItem(BEAT_LOCK_LS_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Persist beat-lock state. Failures (private mode, sandboxed) swallowed —
   *  the toggle still works for the current session. */
  private persistBeatLockMode(on: boolean): void {
    try {
      window.localStorage.setItem(BEAT_LOCK_LS_KEY, on ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }

  preload(): void {
    CosmoRig.preload(this);
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Cosmo — dead centre.
    const cosmoH = this.computeCosmoHeight();
    this.cosmo = new CosmoRig(this, w / 2, h / 2, {
      displayHeight: cosmoH,
      textureKey: 'cosmo-canonical',
    });

    this.autoVJ = new AutoVJ({
      onEngage: () => {
        this.cosmo.yawn();
      },
      onDisengage: () => {
        // No-op; the rig falls back to idle micro-acts naturally.
      },
      onYawn: () => this.cosmo.yawn(),
      onLookAround: () => this.cosmo.lookAround(),
    });

    this.scheduleNextSpawn(0);

    // Wire gestures from the global input bus.
    this.offGesture = this.inputCtl.onGesture((e) => this.onGesture(e));

    // Build minimal HUD overlay (DOM, not Phaser-text — easier to fade with CSS).
    this.buildHUD();

    // Sprint 14C — saffron ring graphics, hidden unless beat-lock active.
    this.beatLockRing = this.add.graphics();
    this.beatLockRing.setDepth(7); // beneath BeatTargets (depth 8) but above bg
    this.beatLockRing.setVisible(this.beatLockMode);

    // Sprint 14C — `B` debug hotkey toggles beat-lock at runtime.
    this.offHotkey = this.installHotkey();

    // Sprint 14C — if booting in beat-lock mode (URL or persisted LS), kick
    // off the beatmap load. Drift-loose mode skips this entirely.
    if (this.beatLockMode) {
      void this.ensureBeatmapLoaded();
    }
    // Keep a single source of truth in console for QA.
    // eslint-disable-next-line no-console
    console.log(`[cosmos] beat-lock: ${this.beatLockMode ? 'on' : 'off'} (default = drift-loose)`);

    // React to viewport changes — keep Cosmo centered + sized correctly.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);

    // Sprint 14C — timing source depends on mode:
    //   - drift-loose (default): rAF-driven uniforms.time. Spawn-timing is
    //     autonomous (1.4-2.4s placeholder loop), so audio-clock precision
    //     is irrelevant. uniforms.time is fine here.
    //   - beat-lock (opt-in): the BeatmapScheduler MUST sync to the audio
    //     playhead (HTMLAudioElement.currentTime), which we read via
    //     audioBridge.musicCurrentTime(). The bubbles' hitTime is still
    //     compared against uniforms.time for a stable rAF-aligned ±150ms
    //     combo-window — that delta tracks the audio clock implicitly.
    const tNow = this.uniforms.time;

    this.cosmo.update(this.uniforms, dt);
    this.autoVJ.update(dt);
    this.progression.tick();

    if (this.beatLockMode && this.scheduler) {
      // Beat-lock: scheduler emits onSpawn at t-telegraph. We don't fall
      // back to the placeholder loop while the beatmap is driving spawns.
      this.scheduler.update(this.audioBridge.musicCurrentTime());
    } else {
      // Drift-loose (default) — autonomous spawn cadence. No beat alignment.
      this.spawnT += dt;
      if (this.spawnT >= this.nextSpawnAt && this.targets.length < MAX_ACTIVE_BEATS) {
        this.spawnPlaceholderTarget(tNow);
        this.scheduleNextSpawn(tNow);
      }
    }

    // Update + cull targets. Auto-VJ resolves bubbles at perfect timing if
    // engaged the moment they cross their hitTime.
    for (const t of this.targets) {
      const stillAlive = t.update(tNow, dt);
      if (this.autoVJ.isEngaged() && !t.resolved) {
        if (Math.abs(tNow - t.cfg.hitTime) < 0.05) {
          t.applyTap('perfect');
          this.recordHit('perfect');
        }
      }
      if (!stillAlive && t.getResult() === 'miss') {
        this.recordMiss();
      }
    }
    this.targets = this.targets.filter((t) => {
      if (t.alive) return true;
      t.destroy();
      return false;
    });

    // Tempo-shift recovery.
    if (this.tempoShiftRemaining > 0) {
      this.tempoShiftRemaining -= dt;
      if (this.tempoShiftRemaining <= 0) {
        this.applyTempoRate(this.tempoBaseRate);
      }
    }

    // Push uniforms — center-stage Cosmo lives at viewport-centre.
    this.uniforms.cosmoX = this.scale.width / 2;
    this.uniforms.cosmoY = this.scale.height / 2;
    this.uniforms.cosmoState = 'beat';

    // HUD updates — combo counter + version pill (cheap text-set + class toggle).
    this.updateHUD();
    this.updateBeatLockRing();
    this.inputCtl.postFrame();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Gestures (PRD §3)
  // ───────────────────────────────────────────────────────────────────────────

  private onGesture(e: GestureEvent): void {
    switch (e.name) {
      case 'tap':
        this.handleTap(e.x ?? this.scale.width / 2, e.y ?? this.scale.height / 2);
        break;
      case 'holdStart':
        this.cosmo.startCrouch();
        break;
      case 'holdEnd':
        this.cosmo.endCrouch();
        if ((e.durationMs ?? 0) >= 350) {
          this.fireShockwave();
        }
        this.autoVJ.notifyPlayerInteraction();
        break;
      case 'swipe':
        this.handleSwipe(e.dx ?? 0);
        this.autoVJ.notifyPlayerInteraction();
        break;
      case 'pinch':
        this.handlePinch(e.scale ?? 1);
        this.autoVJ.notifyPlayerInteraction();
        break;
      case 'longHold':
        this.tryDeepTrip();
        this.autoVJ.notifyPlayerInteraction();
        break;
    }
  }

  private handleTap(x: number, y: number): void {
    this.autoVJ.notifyPlayerTap();
    this.progression.recordTap();

    // Find closest active target within hit-radius.
    let best: BeatTarget | null = null;
    let bestDist = Infinity;
    for (const t of this.targets) {
      if (t.resolved) continue;
      const d = t.distanceTo(x, y);
      const radius = t.cfg.radius * TAP_HIT_SCALE;
      if (d <= radius && d < bestDist) {
        best = t;
        bestDist = d;
      }
    }
    if (!best) return;
    const result = best.evaluateTap(this.uniforms.time);
    best.applyTap(result);
    if (result === 'miss') {
      this.recordMiss();
    } else {
      this.recordHit(result);
    }
  }

  private handleSwipe(dx: number): void {
    const sign = dx > 0 ? 1 : -1;
    const newRate = this.tempoBaseRate * (1 + sign * TEMPO_SHIFT_AMOUNT);
    this.applyTempoRate(newRate);
    this.tempoShiftRemaining = TEMPO_SHIFT_DURATION_S;
  }

  private handlePinch(scale: number): void {
    if (scale <= 0) return;
    const target = Phaser.Math.Clamp(this.pinchBase * scale, 0.5, 0.8 + 0.001);
    // Phaser camera dolly — zoom > 1 zooms in, < 1 zooms out. For "50%-80%
    // screen" we map [0.5..0.8] of full screen → camera.zoom 1.25..2.0.
    const camZoom = 1 / Phaser.Math.Clamp(target, 0.5, 1);
    this.cameras.main.setZoom(camZoom);
  }

  private tryDeepTrip(): void {
    if (!this.progression.isDeepTripUnlocked()) {
      // Locked — give a tiny visual nudge but don't trigger.
      this.cosmo.triggerBlink();
      return;
    }
    this.uniforms.kaleidoTrigger = 1.0;
    this.audioBridge.startHallucination(HALLUCINATION_PEAKS);
  }

  private fireShockwave(): void {
    // Quick post-FX kaleido bump + auto-tap any bubble within a generous radius.
    this.uniforms.kaleidoTrigger = Math.min(1, this.uniforms.kaleidoTrigger + 0.6);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const r = Math.min(cx, cy) * 0.9;
    for (const t of this.targets) {
      if (t.resolved) continue;
      if (t.distanceTo(cx, cy) <= r) {
        t.applyTap('good');
        this.recordHit('good');
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Placeholder spawn-loop (13B replaces with beatmap)
  // ───────────────────────────────────────────────────────────────────────────

  private scheduleNextSpawn(tNow: number): void {
    const interval =
      SPAWN_INTERVAL_MIN_S +
      Math.random() * (SPAWN_INTERVAL_MAX_S - SPAWN_INTERVAL_MIN_S);
    this.nextSpawnAt = this.spawnT + interval;
    void tNow; // 13B will use tNow for beatmap-look-ahead
  }

  private spawnPlaceholderTarget(tNow: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const radius = Math.min(w, h) * 0.06;
    // Bias x left/right of centre so bubbles drift past Cosmo, not through.
    const side = Math.random() > 0.5 ? 1 : -1;
    const lane = w / 2 + side * (w * (0.18 + Math.random() * 0.18));
    const cfg: BeatTargetSpawnConfig = {
      x: lane,
      yStart: h + radius * 2,
      yEnd: -radius * 2,
      hitTime: tNow + 1.6,
      spawnTime: tNow,
      travelS: 3.2,
      radius,
    };
    this.targets.push(new BeatTarget(this, cfg));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Combo + events
  // ───────────────────────────────────────────────────────────────────────────

  private recordHit(result: BeatTimingResult): void {
    if (result === 'perfect') {
      this.combo += 1;
    } else if (result === 'good') {
      this.combo += 1;
    }
    this.progression.recordCombo(this.combo);
    this.comboHasShown = true;
    // Sprint 14D — re-arm the fade-in/hold/fade-out window. Each fresh tap
    // resets the show-at, so a rapid streak keeps the combo visible at 1.
    this.comboShowAt = this.uniforms.time;

    // Combo-event triggers (PRD §6).
    if (this.combo === COMBO_HALLUCINATION_AT) {
      this.audioBridge.startHallucination(HALLUCINATION_PEAKS);
    }
    if (this.combo === COMBO_KALEIDO_AT) {
      this.uniforms.kaleidoTrigger = 1.0;
    }
    if (this.combo === COMBO_VIBE_PEAK_AT) {
      // Sprint 13C will hook this into the share-card capture.
      this.uniforms.kaleidoTrigger = 1.0;
    }
  }

  private recordMiss(): void {
    if (this.combo > 0) {
      this.combo = 0;
    }
    // Sprint 14D — hostile-tap pulse: scale 1.12 → 1, opacity 1 → 0.85 → 0
    // over 0.4s. Fires regardless of prior combo so the player gets feedback
    // on a stray tap. updateHUD() owns the actual interpolation.
    this.comboMissPulseUntil = this.uniforms.time + 0.4;
    this.comboHasShown = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HUD (DOM overlay; Phaser stays uncluttered)
  // ───────────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const root = document.body;

    // ── version pill (bottom-right of viewport, near combo). Sprint 14D:
    //    visible during the first 4s after boot (intro), then fades out.
    //    A pinch-zoom-out gesture re-fades it in for `versionRevealUntil`.
    const versionPill = document.createElement('div');
    versionPill.className = 'cosmos-version-pill';
    versionPill.textContent = `v${this.version}`;
    Object.assign(versionPill.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
      padding: '4px 10px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      color: 'rgba(245, 237, 216, 0.85)',
      background: 'rgba(61, 46, 74, 0.55)',
      borderRadius: '999px',
      letterSpacing: '0.04em',
      pointerEvents: 'none',
      zIndex: '100',
      opacity: '0',
      transition: 'opacity 800ms ease-out',
      backdropFilter: 'blur(4px)',
    } satisfies Partial<CSSStyleDeclaration>);
    root.appendChild(versionPill);
    this.versionPillEl = versionPill;

    // ── combo counter (bottom-right). Sprint 14D: opacity 0 default, fade-in
    //    on first hit, hold 0.6s @ opacity 1, then fade-out 1.2s back to 0.
    const combo = document.createElement('div');
    combo.className = 'cosmos-combo';
    combo.textContent = '0';
    Object.assign(combo.style, {
      position: 'fixed',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
      right: 'calc(env(safe-area-inset-right, 0px) + 18px)',
      padding: '4px 10px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: 'rgba(244, 162, 97, 0.95)',
      background: 'rgba(61, 46, 74, 0.55)',
      borderRadius: '999px',
      letterSpacing: '0.06em',
      pointerEvents: 'none',
      zIndex: '100',
      opacity: '0',
      transform: 'scale(1)',
      transition: 'opacity 1200ms ease-out, transform 240ms ease-out',
      backdropFilter: 'blur(4px)',
    } satisfies Partial<CSSStyleDeclaration>);
    root.appendChild(combo);
    this.comboTextEl = combo;

    // ── boot-time anchor for the version-pill intro fade-in/out.
    this.hudBootT = this.uniforms.time;

    // ── top-nav root (CSS-driven; we only toggle classes from JS).
    this.hudRootEl =
      (document.getElementById('hud-root') as HTMLElement | null) ??
      (document.querySelector('.hud') as HTMLElement | null);

    // ── mobile tap-to-reveal: tapping anywhere in the top 80px viewport-strip
    //    toggles `.is-revealed` for 3s. Desktop hover handles itself via CSS.
    const zone =
      (document.getElementById('hud-reveal-zone') as HTMLElement | null) ?? null;
    if (zone) {
      const onZoneTap = (): void => {
        // Persist for 3s of uniforms.time. updateHUD() clears the class once
        // the timer expires, so we don't need a setTimeout here.
        this.hudRevealUntil = this.uniforms.time + 3;
      };
      zone.addEventListener('touchstart', onZoneTap, { passive: true });
      zone.addEventListener('mousedown', onZoneTap);
      this.offRevealZone = (): void => {
        zone.removeEventListener('touchstart', onZoneTap);
        zone.removeEventListener('mousedown', onZoneTap);
      };
    }
  }

  private updateHUD(): void {
    const tNow = this.uniforms.time;

    // ── combo counter ─────────────────────────────────────────────────────
    if (this.comboTextEl) {
      this.comboTextEl.textContent = String(this.combo);

      // AutoVJ engaged → force opacity 0 regardless of prior state.
      const autoHidden = this.autoVJ?.isEngaged() ?? false;

      // Miss-pulse: a separate 1-shot animation that overrides the
      // tap-fade-out for ~0.4s. Drops opacity from 1 → 0.85 → 0.
      const inMissPulse = tNow < this.comboMissPulseUntil;

      // Tap-fade window: fade-in 240ms, hold 0.6s, fade-out 1.2s.
      const sinceShow = tNow - this.comboShowAt;
      const FADE_IN_S = 0.24;
      const HOLD_S = 0.6;
      const FADE_OUT_S = 1.2;
      const visibleWindow = sinceShow >= 0 && sinceShow <= FADE_IN_S + HOLD_S + FADE_OUT_S;

      let opacity = 0;
      let scale = 1;
      let transitionMs = 1200;

      if (autoHidden) {
        opacity = 0;
        scale = 1;
        transitionMs = 600;
      } else if (inMissPulse) {
        // 0.4s pulse: scale 1.12 → 1, opacity 1 → 0.85 → 0.
        const t = (this.comboMissPulseUntil - tNow) / 0.4; // 1 → 0
        scale = 1 + 0.12 * Math.max(0, t);
        opacity = t > 0.5 ? 1 : 0.85 * (t * 2);
        transitionMs = 80;
      } else if (visibleWindow && this.comboHasShown) {
        if (sinceShow < FADE_IN_S) {
          opacity = sinceShow / FADE_IN_S; // 0 → 1
          scale = 1.12 - 0.12 * (sinceShow / FADE_IN_S);
          transitionMs = 240;
        } else if (sinceShow < FADE_IN_S + HOLD_S) {
          opacity = 1;
          scale = 1;
          transitionMs = 240;
        } else {
          // Fade-out — let the long CSS transition do the work.
          opacity = 0;
          scale = 1;
          transitionMs = 1200;
        }
      } else {
        opacity = 0;
        scale = 1;
        transitionMs = 1200;
      }

      // Only update transition-duration when it changes — avoids style thrash.
      const wantTransition = `opacity ${transitionMs}ms ease-out, transform 240ms ease-out`;
      if (this.comboTextEl.style.transition !== wantTransition) {
        this.comboTextEl.style.transition = wantTransition;
      }
      this.comboTextEl.style.opacity = String(opacity);
      this.comboTextEl.style.transform = `scale(${scale.toFixed(3)})`;
    }

    // ── version pill ──────────────────────────────────────────────────────
    if (this.versionPillEl) {
      const sinceBoot = tNow - this.hudBootT;
      const autoHidden = this.autoVJ?.isEngaged() ?? false;
      const intro = sinceBoot >= 0 && sinceBoot <= 4; // visible 4s post-boot
      const debugReveal = tNow < this.versionRevealUntil;
      const visible = !autoHidden && (intro || debugReveal);
      this.versionPillEl.style.opacity = visible ? '1' : '0';
    }

    // ── top-nav (.hud root) ──────────────────────────────────────────────
    if (this.hudRootEl) {
      const autoHidden = this.autoVJ?.isEngaged() ?? false;
      const revealActive = tNow < this.hudRevealUntil;

      // Edge-detect AutoVJ transitions to avoid touching the DOM every frame.
      if (autoHidden !== this.wasAutoVJEngaged) {
        this.hudRootEl.classList.toggle('is-autovj-hidden', autoHidden);
        this.wasAutoVJEngaged = autoHidden;
      }
      // Mobile reveal-class is also edge-set (idempotent toggle, but cheap).
      const hasRevealed = this.hudRootEl.classList.contains('is-revealed');
      if (revealActive && !hasRevealed) {
        this.hudRootEl.classList.add('is-revealed');
      } else if (!revealActive && hasRevealed) {
        this.hudRootEl.classList.remove('is-revealed');
      }
    }

    // ── pinch-zoom-out → debug version-pill reveal (4s) ──────────────────
    const camZoom = this.cameras.main.zoom;
    if (camZoom > this.prevCamZoom + 0.01) {
      // camera.zoom > 1 means the world is zoomed in — i.e. user pinched OUT
      // (display fraction shrank). See handlePinch() for the mapping.
      this.versionRevealUntil = tNow + 4;
    }
    this.prevCamZoom = camZoom;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Layout helpers
  // ───────────────────────────────────────────────────────────────────────────

  private computeCosmoHeight(): number {
    const w = this.scale.width;
    const h = this.scale.height;
    const portrait = h >= w;
    const fraction = portrait ? COSMO_PORTRAIT_FRACTION : COSMO_LANDSCAPE_FRACTION;
    // Anchor on the shorter axis so we don't hog the screen on very tall
    // portrait phones (16:9.5+).
    return Math.min(w, h) * fraction;
  }

  private handleResize(): void {
    this.cosmo.setDisplayHeight(this.computeCosmoHeight());
    this.cosmo.setPosition(this.scale.width / 2, this.scale.height / 2);
  }

  private cleanup(): void {
    this.offGesture?.();
    this.offGesture = null;
    this.offRevealZone?.();
    this.offRevealZone = null;
    this.offHotkey?.();
    this.offHotkey = null;
    this.versionPillEl?.remove();
    this.comboTextEl?.remove();
    this.versionPillEl = null;
    this.comboTextEl = null;
    this.beatLockRing?.destroy();
    this.beatLockRing = null;
    // Sprint 14D — drop any HUD classes we set so a re-mount starts clean.
    if (this.hudRootEl) {
      this.hudRootEl.classList.remove('is-autovj-hidden');
      this.hudRootEl.classList.remove('is-revealed');
    }
    this.hudRootEl = null;
    for (const t of this.targets) t.destroy();
    this.targets = [];
    this.cosmo?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Audio glue
  // ───────────────────────────────────────────────────────────────────────────

  private applyTempoRate(rate: number): void {
    this.audioBridge.setMusicRate(rate);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sprint 14C — beat-lock opt-in (drift-loose default)
  // ───────────────────────────────────────────────────────────────────────────

  /** Install the `B` debug-hotkey. Listener is window-level so it works even
   *  when the canvas hasn't focus. Returns an unsubscribe so cleanup can fire
   *  on scene shutdown. */
  private installHotkey(): () => void {
    const handler = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyB') return;
      // Don't steal the key from text inputs (future-proofing).
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
      this.toggleBeatLockMode();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }

  /** Flip beat-lock mode. Persists to LS and (if turning on) lazy-loads the
   *  beatmap. Public so a future settings-UI can call it directly. */
  toggleBeatLockMode(): void {
    this.beatLockMode = !this.beatLockMode;
    this.persistBeatLockMode(this.beatLockMode);
    this.beatLockRing?.setVisible(this.beatLockMode);
    // eslint-disable-next-line no-console
    console.log(`[cosmos] beat-lock: ${this.beatLockMode ? 'on' : 'off'}`);
    if (this.beatLockMode) {
      void this.ensureBeatmapLoaded();
    } else {
      // Reset spawn-cadence so drift-loose doesn't immediately fire a stale
      // bubble (the timer was paused while beat-lock was driving spawns).
      this.scheduleNextSpawn(this.uniforms.time);
    }
  }

  /** Lazy-load the beatmap on first beat-lock activation. Failures fall back
   *  to drift-loose silently — no rhythm-druk if the JSON is missing. */
  private async ensureBeatmapLoaded(): Promise<void> {
    if (this.scheduler || this.beatmapLoadStarted) return;
    this.beatmapLoadStarted = true;
    try {
      const url = assetPath(beatmapUrl(BEAT_LOCK_DEFAULT_TRACK));
      const map = await loadBeatmap(url);
      this.scheduler = new BeatmapScheduler(map, (ev) => this.spawnFromBeatmap(ev));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cosmos] beat-lock load failed, falling back to drift-loose', err);
      this.beatLockMode = false;
      this.beatLockRing?.setVisible(false);
      this.beatmapLoadStarted = false; // allow a retry on next toggle
    }
  }

  /** Spawn a BeatTarget from a beatmap event. Mirrors the placeholder spawn
   *  but uses normalised x/y coords from the JSON-DSL. The hitTime is
   *  converted from the audio-clock domain into uniforms.time-relative so
   *  the existing perfect/good/miss evaluator stays the single source of
   *  truth for combo windows. */
  private spawnFromBeatmap(ev: BeatEvent): void {
    if (this.targets.length >= MAX_ACTIVE_BEATS) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const radius = Math.min(w, h) * 0.06;
    const xPx = ev.x * w;
    const yStartPx = ev.y * h + radius * 2;
    const yEndPx = -radius * 2;
    const audioNow = this.audioBridge.musicCurrentTime();
    const tNow = this.uniforms.time;
    const hitTimeUniforms = tNow + Math.max(0, ev.t - audioNow);
    const cfg: BeatTargetSpawnConfig = {
      x: xPx,
      yStart: yStartPx,
      yEnd: yEndPx,
      hitTime: hitTimeUniforms,
      spawnTime: tNow,
      travelS: ev.telegraph + 1.7,
      radius,
    };
    this.targets.push(new BeatTarget(this, cfg));
  }

  /** Saffron ring around Cosmo, FFT-lows pulsed. Drift-loose hides this. */
  private updateBeatLockRing(): void {
    const ring = this.beatLockRing;
    if (!ring || !this.beatLockMode) return;
    const cosmoH = this.computeCosmoHeight();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // FFT band 0 = lows. Same source the post-FX bloom uses, so the ring
    // pulses on the same beat the screen breathes on.
    const lows = this.uniforms.audioFFT[0] ?? 0;
    const pulse = 1 + lows * 0.18;
    const baseR = cosmoH * BEAT_LOCK_RING_RADIUS_FRACTION;
    const r = baseR * pulse;
    ring.clear();
    ring.lineStyle(2, 0xf4a261, 0.55);
    ring.strokeCircle(cx, cy, r);
    ring.lineStyle(1, 0xf4a261, 0.25);
    ring.strokeCircle(cx, cy, r * 1.08);
  }
}
