/**
 * Trampoline — beat-jump platform that catapults Cosmo high. Mushroom-cap on
 * a spring-band. On bounce: squash-tween, particle burst, kaleidoscope spike,
 * audio bounce-pop. Cooldown 0.3s prevents double-bounce.
 *
 * Personal-context: this element was a 1992 psychedelic-trip-anchor for the
 * user. Visual feedback is intentionally maximal.
 */
import Phaser from 'phaser';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { sfx } from '../../audio/sfxBus';

const BOUNCE_VELOCITY = -820;     // ~1.8x normal jump
const COOLDOWN_S = 0.3;

export class Trampoline {
  sprite: Phaser.GameObjects.Image;
  private cooldown = 0;
  private squashTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Trampoline tile is full-scene (Flux scene-bias workaround) — we crop the
    // bottom-strip in-engine. Source 1024×512; crop bottom 128px (~ground+grass
    // strip with mushroom-cap silhouette) and stretch to 64×32 displayed.
    this.sprite = scene.add.image(x, y, 'tile-trampoline-painted').setOrigin(0, 0);
    this.sprite.setCrop(0, 384, 1024, 128);
    this.sprite.setDisplaySize(64, 32);
    this.sprite.setTint(0xfaeacb); // warm tint for mushroom-cream coherence
    scene.physics.add.existing(this.sprite, true);
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(64, 32, false).setOffset(0, 0);
    body.position.set(x, y);
    body.updateCenter();
  }

  /** Apply bounce when Cosmo lands on top. Returns true if bounce fired. */
  tryBounce(cosmoBody: Phaser.Physics.Arcade.Body, uniforms: GlobalUniforms, dt: number): boolean {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return false;
    }
    if (cosmoBody.velocity.y < 0) return false;
    cosmoBody.setVelocityY(BOUNCE_VELOCITY);
    this.cooldown = COOLDOWN_S;
    this.squash();
    sfx.play('jump');
    uniforms.kaleidoTrigger = 1.0;
    return true;
  }

  private squash(): void {
    const sprite = this.sprite;
    this.squashTween?.stop();
    sprite.displayHeight = 32;
    this.squashTween = sprite.scene.tweens.add({
      targets: sprite,
      displayHeight: 14,
      duration: 70,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onComplete: () => {
        sprite.displayHeight = 32;
      },
    });
  }
}
