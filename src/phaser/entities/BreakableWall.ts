/**
 * BreakableWall — wall-tile that blocks like a normal solid until a Bomb
 * explosion overlaps its bounds, after which it tweens out (scale 0 + alpha 0)
 * and removes its body so Cosmo can pass.
 *
 * Sprite: TODO (Asset Generator) — currently uses the existing
 * `tile-wall-painted` texture with a saffron-glow ink-crack overlay drawn via
 * Graphics. Replace with `tile-wall-cracked-painted` once generated.
 *
 * Legend char: `B` (see src/data/levelL1.ts).
 */
import Phaser from 'phaser';

export class BreakableWall {
  sprite: Phaser.GameObjects.Image;
  private cracks: Phaser.GameObjects.Graphics;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key: string) {
    this.sprite = scene.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h);
    this.sprite.setData('breakable', true);
    this.sprite.setData('breakableWall', this);
    scene.physics.add.existing(this.sprite, true);
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(w, h, false).setOffset(0, 0);
    body.position.set(x, y);
    body.updateCenter();

    // Ink-crack overlay — cosmetic hint that this wall is breakable. Cheap
    // procedural lines drawn over the painted tile, no emoji or icons.
    this.cracks = scene.add.graphics();
    this.cracks.lineStyle(1.5, 0x3d2e4a, 0.85);
    const cx = x + w / 2;
    const cy = y + h / 2;
    this.cracks
      .beginPath().moveTo(cx - w * 0.3, cy - h * 0.3).lineTo(cx + w * 0.05, cy - h * 0.05).lineTo(cx + w * 0.3, cy + h * 0.25).strokePath()
      .beginPath().moveTo(cx + w * 0.05, cy - h * 0.05).lineTo(cx - w * 0.2, cy + h * 0.3).strokePath()
      .beginPath().moveTo(cx + w * 0.05, cy - h * 0.05).lineTo(cx + w * 0.25, cy - h * 0.35).strokePath();
    // Saffron-glow halo dots at crack-tips for trippy coherence
    this.cracks.fillStyle(0xF4A261, 0.55);
    this.cracks.fillCircle(cx + w * 0.05, cy - h * 0.05, 1.6);
  }

  /** Returns true when actually destroyed (idempotent). */
  destroyByExplosion(scene: Phaser.Scene): boolean {
    if (this.destroyed) return false;
    this.destroyed = true;
    // Drop the body immediately so Cosmo can pass through during the tween.
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    scene.tweens.add({
      targets: [this.sprite, this.cracks],
      alpha: 0,
      scale: 0,
      duration: 280,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sprite.destroy();
        this.cracks.destroy();
      },
    });
    return true;
  }
}
