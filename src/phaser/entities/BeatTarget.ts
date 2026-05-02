/**
 * BeatTarget — Sprint 13A.
 *
 * Cosmic-bubble that drifts from the bottom of the screen towards the top
 * past Cosmo. The player has to tap during the perfect window for a combo
 * bump. Sprint 13D will swap the canvas-Graphics body for the real cosmic-
 * bubble sprite-set; for now we paint a soft watercolour disc with a saffron
 * core and a faded-rose halo (palette-locked, no emoji).
 *
 * Timing model:
 *
 *    spawn ──────► hitTime ──────► offscreenTop
 *      ▲              ▲                   ▲
 *      │              │                   │
 *      └ first frame   └ ±150 ms = perfect, ±300 ms = good, else miss
 *
 * `hitTime` is measured against the audio-bridge clock supplied by the scene
 * (`tNow`) so we never drift from the music. Until the beatmap arrives in
 * Sprint 13B, the scene sets `hitTime` to "spawn + travelTime/2", i.e. the
 * mid-screen pass.
 *
 * Burst: when tapped (or auto-tapped by AutoVJ) the body explodes into 8
 * little radial shards drawn in the same Graphics object, then the whole
 * target is destroyed. Until 13D's real sprites land, this stays canvas-
 * primitive.
 */
import Phaser from 'phaser';

export type BeatTimingResult = 'perfect' | 'good' | 'miss';

export const BEAT_TIMING = {
  PERFECT_MS: 150,
  GOOD_MS: 300,
} as const;

export interface BeatTargetSpawnConfig {
  /** Pixel-x where the bubble drifts upward. */
  x: number;
  /** Y at which the bubble enters (usually viewport-bottom + radius). */
  yStart: number;
  /** Y where the bubble exits (usually viewport-top - radius). */
  yEnd: number;
  /** Audio-clock seconds when the bubble should be tapped. */
  hitTime: number;
  /** Audio-clock seconds at spawn. */
  spawnTime: number;
  /** Total flight-time in seconds. Default 3.5s — telegraph per PRD §9. */
  travelS: number;
  /** Radius in CSS pixels. */
  radius: number;
}

const COLOR = {
  rose: 0xb85c7e,
  saffron: 0xf4a261,
  popMagenta: 0xff2d95,
  popCyan: 0x4ee3ff,
  inkAubergine: 0x3d2e4a,
} as const;

export class BeatTarget {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  cfg: BeatTargetSpawnConfig;
  /** True until tapped or off-screen. */
  alive = true;
  /** True if this target was already evaluated (tap or auto-miss). */
  resolved = false;

  /** Burst phase 0..1 once tapped; rendered separately so the bubble can fade
   *  while the shards expand. */
  private burst = -1;
  private hitResult: BeatTimingResult | null = null;

  constructor(scene: Phaser.Scene, cfg: BeatTargetSpawnConfig) {
    this.scene = scene;
    this.cfg = cfg;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
    this.graphics.x = cfg.x;
    this.graphics.y = cfg.yStart;
    this.repaint();
  }

  /** `tNow` is audio-clock seconds. Returns false when the target should be
   *  removed by the scene (after burst finishes or it goes offscreen). */
  update(tNow: number, dt: number): boolean {
    if (!this.alive) return false;

    if (this.burst >= 0) {
      this.burst += dt * 3.0; // ~330 ms total burst
      this.repaint();
      if (this.burst >= 1) {
        this.alive = false;
        return false;
      }
      return true;
    }

    // Drift — linear from yStart to yEnd over travelS, anchored on spawnTime.
    const u = Math.min(1, Math.max(0, (tNow - this.cfg.spawnTime) / this.cfg.travelS));
    this.graphics.y = this.cfg.yStart + (this.cfg.yEnd - this.cfg.yStart) * u;

    // Wobble — slight horizontal drift to give it cosmic-bubble feel.
    const wob = Math.sin((tNow - this.cfg.spawnTime) * 4 + this.cfg.x) * 4;
    this.graphics.x = this.cfg.x + wob;

    if (u >= 1 && !this.resolved) {
      // Off-screen without being tapped → miss.
      this.resolved = true;
      this.hitResult = 'miss';
      this.alive = false;
      return false;
    }
    return true;
  }

  /** Returns the timing-band for a tap firing at `tNow` (audio-clock). */
  evaluateTap(tNow: number): BeatTimingResult {
    const offsetMs = Math.abs(tNow - this.cfg.hitTime) * 1000;
    if (offsetMs <= BEAT_TIMING.PERFECT_MS) return 'perfect';
    if (offsetMs <= BEAT_TIMING.GOOD_MS) return 'good';
    return 'miss';
  }

  /** Pixel-distance from a point to the bubble's current centre. */
  distanceTo(x: number, y: number): number {
    return Math.hypot(this.graphics.x - x, this.graphics.y - y);
  }

  /** Fired by the scene when the player tap landed within hit-radius. */
  applyTap(result: BeatTimingResult): void {
    if (this.resolved) return;
    this.resolved = true;
    this.hitResult = result;
    this.burst = 0;
    this.repaint();
  }

  /** Did this target resolve to a hit? Read after evaluation. */
  getResult(): BeatTimingResult | null {
    return this.hitResult;
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private repaint(): void {
    const g = this.graphics;
    g.clear();

    if (this.burst < 0) {
      // Idle bubble — three concentric circles, rose halo + saffron core +
      // pop-magenta seed.
      const r = this.cfg.radius;
      g.fillStyle(COLOR.rose, 0.32);
      g.fillCircle(0, 0, r);
      g.fillStyle(COLOR.saffron, 0.45);
      g.fillCircle(0, 0, r * 0.65);
      g.fillStyle(COLOR.popMagenta, 0.75);
      g.fillCircle(0, 0, r * 0.32);
      g.lineStyle(1, COLOR.inkAubergine, 0.4);
      g.strokeCircle(0, 0, r);
    } else {
      // Burst — 8 shards expanding outward. Colour reflects timing.
      const t = Math.min(1, this.burst);
      const r = this.cfg.radius * (1 + t * 1.8);
      const alpha = 1 - t;
      const tint =
        this.hitResult === 'perfect'
          ? COLOR.saffron
          : this.hitResult === 'good'
          ? COLOR.popMagenta
          : COLOR.popCyan;

      g.fillStyle(tint, alpha * 0.7);
      g.fillCircle(0, 0, r * 0.4);
      g.lineStyle(2, tint, alpha);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const x1 = Math.cos(ang) * r * 0.5;
        const y1 = Math.sin(ang) * r * 0.5;
        const x2 = Math.cos(ang) * r;
        const y2 = Math.sin(ang) * r;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath();
      }
    }
  }
}
