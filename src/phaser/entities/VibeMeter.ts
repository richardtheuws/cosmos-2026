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

    // Wave-23 pivot (NORTH-STAR §6, 2026-05-31): the vibe ring is the avatar of
    // the retired beat/combo-score mechanic — Richard flagged it as distracting
    // on the live build. Stop drawing it. The level logic stays for now (Deep-
    // TripMode still reads fullEdge) until the score mechanic is fully removed
    // in the pivot cleanup. screenX/screenY kept for signature stability.
    void screenX;
    void screenY;
    this.graphics.clear();
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
