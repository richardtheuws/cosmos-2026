/**
 * Star pickup. Tiny floating Dewdrop with fluo-pop accent — magenta + lime halo.
 * Bobs vertically, rotates faintly, pulses with a sine each frame. Collected on
 * overlap; emits a chime via Howler when triggered.
 */
import Phaser from 'phaser';

export class Star {
  sprite: Phaser.GameObjects.Image;
  private baseY: number;
  private wobblePhase: number;
  collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'star') {
    this.sprite = scene.add.image(x, y, textureKey);
    this.sprite.setDisplaySize(28, 28);
    this.sprite.setData('star', this);
    scene.physics.add.existing(this.sprite);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 20).setAllowGravity(false).setImmovable(true);
    this.baseY = y;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  update(time: number): void {
    if (this.collected) return;
    this.sprite.y = this.baseY + Math.sin(time * 0.003 + this.wobblePhase) * 3;
    this.sprite.angle = Math.sin(time * 0.002 + this.wobblePhase) * 6;
  }

  collect(scene: Phaser.Scene): void {
    if (this.collected) return;
    this.collected = true;
    // Burst flash + fade. Scene wires the SFX + scoring on the overlap callback.
    scene.tweens.add({
      targets: this.sprite,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => this.sprite.destroy(),
    });
  }
}
