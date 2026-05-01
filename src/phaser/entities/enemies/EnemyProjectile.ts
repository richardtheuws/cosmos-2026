/**
 * EnemyProjectile — single saffron-glow blob spat by Eye Plants and Spitting
 * Walls. Lives for `lifeS` seconds or until it hits a platform / Cosmo. No
 * gravity, no spin, no easing — the projectile fires in a straight line.
 *
 * Visuals are intentionally minimal: a 12-px filled circle with a faint
 * faded-rose halo. Real painted projectile sprites land in Sprint 6E; we draw
 * via `Graphics.generateTexture` so the asset pipeline isn't blocked.
 */
import Phaser from 'phaser';

const TEXTURE_KEY = 'enemy-projectile-spit';

export class EnemyProjectile {
  sprite: Phaser.Physics.Arcade.Sprite;
  private life: number;
  private alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, lifeS: number) {
    EnemyProjectile.ensureTexture(scene);
    this.sprite = scene.physics.add.sprite(x, y, TEXTURE_KEY);
    this.sprite.setDisplaySize(18, 18);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 14).setAllowGravity(false);
    body.setVelocity(vx, vy);
    this.sprite.setData('projectile', this);
    this.life = lifeS;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) this.destroy();
  }

  isAlive(): boolean {
    return this.alive;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }

  private static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(TEXTURE_KEY)) return;
    const g = scene.add.graphics();
    g.fillStyle(0xB85C7E, 0.35).fillCircle(9, 9, 9);
    g.fillStyle(0xF4A261, 0.95).fillCircle(9, 9, 5);
    g.fillStyle(0xFFF6D6, 0.9).fillCircle(7.5, 7.5, 1.6);
    g.generateTexture(TEXTURE_KEY, 18, 18);
    g.destroy();
  }
}
