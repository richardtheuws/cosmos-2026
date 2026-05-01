/**
 * BreakableWall — wall-tile that blocks like a normal solid until a Bomb
 * explosion overlaps its bounds, after which it tweens out (scale 0 + alpha 0)
 * and removes its body so Cosmo can pass.
 *
 * Sprite (Sprint 7D): uses dedicated `tile-wall-cracked-painted` Flux Dev
 * texture — branching ink-aubergine cracks with saffron-glow tip-spark baked
 * into the image. The legacy procedural Graphics overlay was removed since
 * the asset itself communicates the breakable nature.
 *
 * Legend char: `B` (see src/data/levelL1.ts).
 */
import Phaser from 'phaser';

export class BreakableWall {
  sprite: Phaser.GameObjects.Image;
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
  }

  /** Returns true when actually destroyed (idempotent). */
  destroyByExplosion(scene: Phaser.Scene): boolean {
    if (this.destroyed) return false;
    this.destroyed = true;
    // Drop the body immediately so Cosmo can pass through during the tween.
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 0,
      duration: 280,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sprite.destroy();
      },
    });
    return true;
  }
}
