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
  private comboFlashUntil = 0;
  private versionPillEl: HTMLDivElement | null = null;
  private comboTextEl: HTMLDivElement | null = null;
  private comboHasShown = false;

  /** Spawn-loop accumulator. */
  private spawnT = 0;
  private nextSpawnAt = 0;

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

    // React to viewport changes — keep Cosmo centered + sized correctly.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);

    // Audio-clock seconds — uniforms.time follows the rAF-loop, close enough
    // to the AudioContext clock for a placeholder beatmap. Sprint 13B will
    // promote this to AudioContext.currentTime.
    const tNow = this.uniforms.time;

    this.cosmo.update(this.uniforms, dt);
    this.autoVJ.update(dt);
    this.progression.tick();

    // Spawn placeholder bubbles until 13B beatmap takes over.
    this.spawnT += dt;
    if (this.spawnT >= this.nextSpawnAt && this.targets.length < MAX_ACTIVE_BEATS) {
      this.spawnPlaceholderTarget(tNow);
      this.scheduleNextSpawn(tNow);
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
    this.comboFlashUntil = this.uniforms.time + 0.4;
    this.comboHasShown = true;

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
      this.comboFlashUntil = this.uniforms.time + 0.2;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HUD (DOM overlay; Phaser stays uncluttered)
  // ───────────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const root = document.body;

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
      backdropFilter: 'blur(4px)',
    } satisfies Partial<CSSStyleDeclaration>);
    root.appendChild(versionPill);
    this.versionPillEl = versionPill;

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
      transition: 'opacity 240ms ease-out, transform 240ms ease-out',
      backdropFilter: 'blur(4px)',
    } satisfies Partial<CSSStyleDeclaration>);
    root.appendChild(combo);
    this.comboTextEl = combo;
  }

  private updateHUD(): void {
    if (this.comboTextEl) {
      this.comboTextEl.textContent = String(this.combo);
      const visible = this.comboHasShown;
      const flashing = this.uniforms.time < this.comboFlashUntil;
      this.comboTextEl.style.opacity = visible ? (flashing ? '1' : '0.85') : '0';
      this.comboTextEl.style.transform = flashing ? 'scale(1.12)' : 'scale(1)';
    }
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
    this.versionPillEl?.remove();
    this.comboTextEl?.remove();
    this.versionPillEl = null;
    this.comboTextEl = null;
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
}
