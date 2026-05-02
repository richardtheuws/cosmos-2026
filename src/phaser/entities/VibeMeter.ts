/**
 * VibeMeter — Sprint 15B
 *
 * Replaces the old combo counter. 0..1 ring drawn around the projected screen-
 * position of Cosmo. Saffron-glow at full, soft rose at low.
 *
 * Decay 5%/sec while idle, gain on success-actions, peak triggers DeepTripMode.
 *
 * The render is canvas-drawn (Phaser.Graphics) — texture-based later in 15D.
 * For now Graphics is fine: one stroked arc per frame is sub-millisecond.
 */
import Phaser from 'phaser';

const DECAY_PER_SECOND = 0.05;
const RING_RADIUS_PX = 96;
const RING_INNER_PX = 88;

export class VibeMeter {
  /** Public read-only vibe level 0..1. */
  level = 0;
  /** True iff the meter just hit 1.0 this frame (one-shot). */
  fullEdge = false;
  private graphics: Phaser.GameObjects.Graphics;
  private prevLevel = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(20);
  }

  /** Add to the meter. Saturates at 1.0. */
  gain(amount: number): void {
    this.level = Math.min(1, this.level + amount);
  }

  /** Subtract from the meter. Saturates at 0. */
  decay(amount: number): void {
    this.level = Math.max(0, this.level - amount);
  }

  /** Per-frame tick. `screenX/Y` is the projected Cosmo position. */
  update(screenX: number, screenY: number, dt: number): void {
    // Idle decay.
    if (this.level > 0) {
      this.level = Math.max(0, this.level - DECAY_PER_SECOND * dt);
    }

    // Detect rising-edge to full.
    this.fullEdge = this.prevLevel < 1 && this.level >= 1;
    this.prevLevel = this.level;

    // Repaint.
    const g = this.graphics;
    g.clear();
    if (this.level <= 0.01) return;

    // Outer subtle base ring.
    g.lineStyle(2, 0x3d2e4a, 0.18);
    g.strokeCircle(screenX, screenY, RING_RADIUS_PX);

    // Filled arc — rotates with the level.
    const TAU = Math.PI * 2;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + TAU * this.level;

    // Saffron when high, rose when low — interpolate.
    const lowColor = 0xb85c7e;
    const highColor = 0xf4a261;
    const color = this.lerpColor(lowColor, highColor, this.level);

    g.lineStyle(8, color, 0.85);
    g.beginPath();
    g.arc(screenX, screenY, RING_INNER_PX, startAngle, endAngle, false);
    g.strokePath();

    // Inner soft glow (offset duplicate).
    g.lineStyle(3, color, 0.45);
    g.beginPath();
    g.arc(screenX, screenY, RING_INNER_PX + 6, startAngle, endAngle, false);
    g.strokePath();
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private lerpColor(a: number, b: number, t: number): number {
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
