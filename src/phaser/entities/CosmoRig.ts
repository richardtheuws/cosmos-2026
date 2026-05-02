/**
 * CosmoRig — Sprint 13A.
 *
 * The dead-centre Cosmo for the rhythm-trip rebuild. Reads
 * `globalUniforms.audioFFT[0..7]` per-frame and applies pure value-driven
 * transforms (NO Phaser tweens) so Cosmo feels alive on every tone the music
 * exposes.
 *
 *  Band → effect (PRD §4):
 *    0 sub          → body Y-scale  ×0.04
 *    1 bass         → head-bob Y-translate ×4 px
 *    2 low-mid      → faded-rose spot glow opacity ×0.3
 *    3 mid          → spot glow opacity (combined w/ band-2) ×0.3
 *    4 high-mid     → eye iris-shimmer rotation ±8°
 *    5 air          → antenne-bloem flap rotation ±12°
 *    6 tape-hiss    → outline-jitter pop-cyan tint ×0.15
 *    7 sparkle      → outline-jitter pop-cyan tint ×0.15
 *
 *  Idle micro-acts (PRD §4):
 *    - blink every 4–7 s
 *    - antenne micro-zwiep on sub-band
 *    - yawn auto-VJ (triggered externally via .yawn())
 *    - look-around when no input >12 s (.lookAround())
 *
 * The rig is composed of:
 *
 *    body          — main Cosmo sprite (canonical-v2-cleaned, 4K when 13D lands)
 *    glowSpots     — Graphics overlay (additive, low alpha) painted in a
 *                    single fillCircle pass, scaled per-frame. We don't
 *                    redraw the graphics every frame — we just scale alpha.
 *    antenne       — small Container with a pivot below the body so rotation
 *                    feels like the bloem flicking from its stem.
 *    eyeShimmer    — additive arc on top of the canonical-eyes region. Tiny
 *                    rotation jitter via setAngle on a pivoted Graphics.
 *
 * The blink overlay is a pop-aubergine rectangle drawn briefly across the
 * eye region. Cheap, no extra texture round-trip.
 */
import Phaser from 'phaser';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { assetPath } from '../../core/assetPath';

/** PRD-locked palette. */
const COLOR = {
  fadedRose: 0xb85c7e,
  popCyan: 0x4ee3ff,
  saffron: 0xf4a261,
  inkAubergine: 0x3d2e4a,
} as const;

const BAND_GAIN = {
  bodyPulse: 0.04,
  headBobPx: 4,
  spotGlow: 0.3,
  eyeShimmerDeg: 8,
  antenneFlapDeg: 12,
  outlineJitter: 0.15,
} as const;

const BLINK_MIN_S = 4;
const BLINK_MAX_S = 7;
const BLINK_DURATION_S = 0.12;
const YAWN_DURATION_S = 1.2;

export interface CosmoRigOptions {
  /** Initial display height in CSS pixels. Recomputed on resize. */
  displayHeight: number;
  /** Texture key already loaded into the scene. */
  textureKey: string;
}

export class CosmoRig {
  /** Sub-tree root — translate this to recompose the rig position. */
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  private glowSpots: Phaser.GameObjects.Graphics;
  private antenne: Phaser.GameObjects.Graphics;
  private eyeShimmer: Phaser.GameObjects.Graphics;
  private blink: Phaser.GameObjects.Graphics;

  private displayH: number;
  /** Body's natural texture-aspect, used to derive width from displayH. */
  private aspect = 1;

  private blinkUntil = 0;
  private nextBlinkAt = 0;
  private yawnUntil = 0;
  private lookAroundUntil = 0;
  private lookAroundDir = 0;

  /** Time-accumulator for idle-loop maths (sin curves etc.). */
  private t = 0;

  /** Crouch progress 0..1 — driven by CosmoRig.startCrouch / endCrouch. */
  private crouch = 0;
  /** Crouch decay per second when released. */
  private static CROUCH_DECAY = 4;
  /** Crouch ramp-up per second while held. */
  private static CROUCH_RAMP = 2.2;
  private crouchHeld = false;

  static preload(scene: Phaser.Scene): void {
    // Sprint 13D — premium 4K hero (img2img'd from canonical-v2 + ESRGAN).
    // Cosmo center-stage at 40% portrait viewport demands crisp render on
    // high-DPI mobile (devicePixelRatio 3).
    scene.load.image('cosmo-canonical', assetPath('assets/sprites/cosmo-hero-4k.png'));
  }

  constructor(scene: Phaser.Scene, x: number, y: number, opts: CosmoRigOptions) {
    this.displayH = opts.displayHeight;

    this.container = scene.add.container(x, y);
    this.container.setDepth(10);

    this.body = scene.add.image(0, 0, opts.textureKey);
    const tex = this.body.texture;
    if (tex && tex.key !== '__MISSING') {
      this.aspect = tex.getSourceImage().width / Math.max(1, tex.getSourceImage().height);
    }
    this.body.setOrigin(0.5, 0.55);
    this.body.setDisplaySize(this.displayH * this.aspect, this.displayH);

    // Glow-spots overlay — painted once at displayH-relative size, alpha-driven.
    this.glowSpots = scene.add.graphics();
    this.glowSpots.setBlendMode(Phaser.BlendModes.ADD);
    this.repaintGlowSpots();

    // Antenne — a small bloem on top, rotated around its stem-pivot.
    this.antenne = scene.add.graphics();
    this.repaintAntenne();

    // Eye-shimmer additive arc just above the eye-line of the canonical pose.
    this.eyeShimmer = scene.add.graphics();
    this.eyeShimmer.setBlendMode(Phaser.BlendModes.ADD);
    this.repaintEyeShimmer();

    // Blink shutter — invisible at rest, alpha pulses to 1 on blink.
    this.blink = scene.add.graphics();
    this.blink.setAlpha(0);
    this.repaintBlink();

    this.container.add([this.body, this.glowSpots, this.antenne, this.eyeShimmer, this.blink]);

    this.scheduleNextBlink();
  }

  /** Scene gives us the FFT and per-frame dt. Pure value-driven, no tweens. */
  update(uniforms: GlobalUniforms, dt: number): void {
    this.t += dt;
    const fft = uniforms.audioFFT;

    // Crouch progression
    if (this.crouchHeld) {
      this.crouch = Math.min(1, this.crouch + dt * CosmoRig.CROUCH_RAMP);
    } else {
      this.crouch = Math.max(0, this.crouch - dt * CosmoRig.CROUCH_DECAY);
    }

    // Body — sub-band pulse + idle breathing + crouch squash
    const subPulse = fft[0] * BAND_GAIN.bodyPulse;
    const breathe = Math.sin(this.t * 1.3) * 0.012;
    const crouchY = 1 - this.crouch * 0.18;
    const crouchX = 1 + this.crouch * 0.10;
    this.body.setScale(
      crouchX,
      (1 + subPulse + breathe) * crouchY,
    );

    // Head-bob via container Y-translation. We bias towards negative (up)
    // because Cosmo nodding into a kick reads better than nodding down.
    const bob = -fft[1] * BAND_GAIN.headBobPx;
    this.body.setPosition(0, bob - this.crouch * this.displayH * 0.05);

    // Glow-spots — combined 2/3 mid bands.
    const spotAlpha = Math.min(1, (fft[2] + fft[3]) * BAND_GAIN.spotGlow);
    this.glowSpots.setAlpha(spotAlpha);

    // Eye shimmer — high-mid rotation ± deg, blended additively.
    const eyeAng = (fft[4] - 0.5) * 2 * BAND_GAIN.eyeShimmerDeg;
    this.eyeShimmer.setAngle(eyeAng);
    this.eyeShimmer.setAlpha(0.4 + fft[4] * 0.5);

    // Antenne flap — sub mod + air mod, both feed the rotation.
    const antenneAng =
      (fft[5] - 0.5) * 2 * BAND_GAIN.antenneFlapDeg +
      Math.sin(this.t * 1.1 + fft[0] * 6) * 2;
    this.antenne.setAngle(antenneAng);

    // Outline-jitter pop-cyan tint via body tint scaling.
    // Phaser tinting interp: lerp white→popCyan by `outlineJitter * (band6+band7)/2`.
    const jitter = ((fft[6] + fft[7]) / 2) * BAND_GAIN.outlineJitter;
    this.body.setTint(this.lerpTint(0xffffff, COLOR.popCyan, jitter));

    // Blink scheduler
    if (this.t > this.nextBlinkAt && this.blinkUntil <= this.t) {
      this.blinkUntil = this.t + BLINK_DURATION_S;
      this.scheduleNextBlink();
    }
    this.blink.setAlpha(this.t < this.blinkUntil ? 1 : 0);

    // Yawn — open mouth via Y-stretch on the body (additive to crouch). The
    // texture itself doesn't have a yawn frame yet (Sprint 13D); for now we
    // exaggerate the body to communicate "open".
    if (this.t < this.yawnUntil) {
      const phase = 1 - (this.yawnUntil - this.t) / YAWN_DURATION_S;
      const yawnAmp = Math.sin(phase * Math.PI) * 0.05;
      this.body.setScale(
        this.body.scaleX * (1 + yawnAmp * 0.5),
        this.body.scaleY * (1 + yawnAmp),
      );
    }

    // Look-around — small head-tilt by rotating the whole body subtly.
    if (this.t < this.lookAroundUntil) {
      const phase = 1 - (this.lookAroundUntil - this.t) / 1.6;
      const tilt = Math.sin(phase * Math.PI) * 6 * this.lookAroundDir;
      this.body.setAngle(tilt);
    } else {
      this.body.setAngle(0);
    }
  }

  /** Resize callback — recompute body size and repaint overlays at new scale. */
  setDisplayHeight(h: number): void {
    this.displayH = h;
    this.body.setDisplaySize(h * this.aspect, h);
    this.repaintGlowSpots();
    this.repaintAntenne();
    this.repaintEyeShimmer();
    this.repaintBlink();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /** Press-and-hold begins — Cosmo squats over 0.5s and post-FX dim. */
  startCrouch(): void {
    this.crouchHeld = true;
  }

  /** Release — caller plays a shockwave + the rig springs back via decay. */
  endCrouch(): void {
    this.crouchHeld = false;
  }

  /** Manual blink trigger (e.g. on miss to add a wince). */
  triggerBlink(): void {
    this.blinkUntil = this.t + BLINK_DURATION_S;
  }

  /** Auto-VJ engages → Cosmo yawns. */
  yawn(): void {
    this.yawnUntil = this.t + YAWN_DURATION_S;
  }

  /** No-input >12s → Cosmo looks left or right. */
  lookAround(): void {
    if (this.t < this.lookAroundUntil) return;
    this.lookAroundDir = Math.random() > 0.5 ? 1 : -1;
    this.lookAroundUntil = this.t + 1.6;
  }

  destroy(): void {
    this.container.destroy(true);
  }

  // ---- Private repaint helpers (called on resize, not per-frame) ----

  private scheduleNextBlink(): void {
    this.nextBlinkAt =
      this.t + BLINK_MIN_S + Math.random() * (BLINK_MAX_S - BLINK_MIN_S);
  }

  private repaintGlowSpots(): void {
    this.glowSpots.clear();
    const r = this.displayH * 0.07;
    // Three faded-rose dots to echo the chameleon spots in canonical-v2.
    this.glowSpots.fillStyle(COLOR.fadedRose, 0.55);
    this.glowSpots.fillCircle(-this.displayH * 0.18, this.displayH * 0.05, r);
    this.glowSpots.fillCircle(this.displayH * 0.16, this.displayH * 0.02, r * 0.85);
    this.glowSpots.fillCircle(0, this.displayH * 0.18, r * 0.7);
  }

  private repaintAntenne(): void {
    this.antenne.clear();
    // Stem
    const stemH = this.displayH * 0.18;
    this.antenne.lineStyle(2, COLOR.inkAubergine, 0.8);
    this.antenne.beginPath();
    this.antenne.moveTo(0, -this.displayH * 0.36);
    this.antenne.lineTo(0, -this.displayH * 0.36 - stemH);
    this.antenne.strokePath();
    // Bloem
    this.antenne.fillStyle(COLOR.fadedRose, 0.85);
    this.antenne.fillCircle(0, -this.displayH * 0.36 - stemH, this.displayH * 0.05);
    this.antenne.fillStyle(COLOR.saffron, 1);
    this.antenne.fillCircle(0, -this.displayH * 0.36 - stemH, this.displayH * 0.018);
  }

  private repaintEyeShimmer(): void {
    this.eyeShimmer.clear();
    const r = this.displayH * 0.04;
    this.eyeShimmer.fillStyle(COLOR.popCyan, 0.5);
    this.eyeShimmer.fillCircle(-this.displayH * 0.085, -this.displayH * 0.08, r);
    this.eyeShimmer.fillCircle(this.displayH * 0.085, -this.displayH * 0.08, r);
  }

  private repaintBlink(): void {
    this.blink.clear();
    // Two thin rectangles across each eye region — the canonical pose has eyes
    // in a horizontal band ~0.08 above container origin.
    const w = this.displayH * 0.10;
    const h = this.displayH * 0.025;
    this.blink.fillStyle(COLOR.inkAubergine, 1);
    this.blink.fillRect(-this.displayH * 0.085 - w / 2, -this.displayH * 0.08 - h / 2, w, h);
    this.blink.fillRect(this.displayH * 0.085 - w / 2, -this.displayH * 0.08 - h / 2, w, h);
  }

  private lerpTint(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
}
