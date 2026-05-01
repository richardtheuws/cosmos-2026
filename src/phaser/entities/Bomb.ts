/**
 * Bomb — thrown projectile with a 1.5s fuse and ~64px AoE explosion.
 *
 * Mechanics (Sprint 6C):
 *   - Cosmo presses bomb (X / Alt) → spawn Bomb at his hands, throw-arc:
 *     X velocity ±320 (depending on Cosmo.facing), Y velocity -450.
 *   - Arcade gravity pulls it down; it interacts with platforms (collide).
 *   - 1.5s fuse → explode(): radius-check kills enemies flagged
 *     `vulnerableToBomb`, breaks tiles flagged `breakable`, fires post-FX
 *     trippy-spike (kaleidoTrigger + damagePulse boost) and a canvas-drawn
 *     expanding flash-circle (no emoji/sprite-fallback).
 *
 * Sprite: TODO (Asset Generator) — currently uses a procedural canvas
 * "bomb-procedural" texture (ink-aubergine sphere with saffron fuse-spark).
 */
import Phaser from 'phaser';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { sfx } from '../../audio/sfxBus';

export const BOMB = {
  THROW_VX: 320,
  THROW_VY: -450,
  GRAVITY: 1300,
  MAX_FALL: 720,
  FUSE_S: 1.5,
  EXPLOSION_RADIUS: 64,
  /** Display size in screen pixels. Body matches displayed size. */
  DISPLAY: 22,
  COOLDOWN_S: 0.35,
} as const;

export class Bomb {
  sprite: Phaser.Physics.Arcade.Sprite;
  exploded = false;
  private fuse = BOMB.FUSE_S;
  private blinkTimer = 0;
  private uniforms: GlobalUniforms;
  /** Called once on explode() so the scene can resolve enemy/wall hits. */
  private onExplode: (b: Bomb) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    facing: 1 | -1,
    uniforms: GlobalUniforms,
    onExplode: (b: Bomb) => void,
  ) {
    this.uniforms = uniforms;
    this.onExplode = onExplode;
    this.sprite = scene.physics.add.sprite(x, y, 'bomb-procedural');
    this.sprite.setDisplaySize(BOMB.DISPLAY, BOMB.DISPLAY);
    this.sprite.setData('bomb', this);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(BOMB.DISPLAY, BOMB.DISPLAY, false);
    body.setMaxVelocity(800, BOMB.MAX_FALL);
    body.setGravityY(BOMB.GRAVITY);
    body.setBounce(0.35, 0.25);
    body.setDragX(180);
    this.sprite.setVelocity(facing * BOMB.THROW_VX, BOMB.THROW_VY);
    this.sprite.setAngularVelocity(facing * 380);
    sfx.play('bomb-throw');
  }

  /** Per-frame tick. Returns true once exploded so the scene can drop it. */
  update(dt: number): boolean {
    if (this.exploded) return true;
    this.fuse -= dt;
    this.blinkTimer += dt;
    // Visual fuse-tick: rapid red→cream tint blink in the last 0.6s.
    if (this.fuse < 0.6) {
      const fast = Math.floor(this.blinkTimer * 14) % 2 === 0;
      this.sprite.setTint(fast ? 0xff5a5a : 0xfaeacb);
    }
    if (this.fuse <= 0) {
      this.explode();
      return true;
    }
    return false;
  }

  /** Returns world-space position where the explosion is centered. */
  getCenter(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /** Detonate. Triggers post-FX spike + canvas flash-circle, then destroys. */
  explode(): void {
    if (this.exploded) return;
    this.exploded = true;
    const scene = this.sprite.scene;
    const cx = this.sprite.x;
    const cy = this.sprite.y;

    // Post-FX trippy-spike — kaleidoTrigger drives bloom+chroma rise via the
    // breathing layer in postFX.ts; damagePulse drives the datamosh tear.
    // Tunings: kaleido-spike +0.9 (caps at 1.0), datamosh-spike +0.6, both
    // sustained for ~0.4s by the existing decay rates (see decayUniforms).
    this.uniforms.kaleidoTrigger = Math.min(1.0, this.uniforms.kaleidoTrigger + 0.9);
    this.uniforms.damagePulse = Math.min(1.0, this.uniforms.damagePulse + 0.6);

    sfx.play('bomb-boom');

    // Canvas-drawn expanding flash-ring — NO emoji/sprite fallback.
    // Two concentric arcs (saffron core, magenta halo) drawn via Graphics,
    // expanded + faded over 0.4s, then destroyed.
    const flash = scene.add.graphics();
    flash.setDepth(900);
    const startR = 8;
    const endR = BOMB.EXPLOSION_RADIUS * 1.15;
    const ring = { r: startR, alpha: 1 };
    const drawRing = (): void => {
      flash.clear();
      flash.fillStyle(0xff2d95, 0.32 * ring.alpha).fillCircle(cx, cy, ring.r * 1.05);
      flash.fillStyle(0xf4a261, 0.55 * ring.alpha).fillCircle(cx, cy, ring.r * 0.78);
      flash.fillStyle(0xfff6d6, 0.85 * ring.alpha).fillCircle(cx, cy, ring.r * 0.45);
      flash.lineStyle(2, 0x3d2e4a, 0.5 * ring.alpha).strokeCircle(cx, cy, ring.r);
    };
    drawRing();
    scene.tweens.add({
      targets: ring,
      r: endR,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: drawRing,
      onComplete: () => flash.destroy(),
    });

    this.onExplode(this);
    this.sprite.destroy();
  }

  /** Generate a procedural bomb sprite once per scene. Adds ink-aubergine
   *  sphere with a saffron-glow fuse-spark on top. */
  static ensureProceduralTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('bomb-procedural')) return;
    const g = scene.add.graphics();
    const size = 32;
    // Body — ink-aubergine sphere with rim-light.
    g.fillStyle(0x3d2e4a, 1).fillCircle(size / 2, size / 2 + 2, 11);
    g.fillStyle(0x55425f, 1).fillCircle(size / 2 - 3, size / 2 - 1, 4); // hi-light
    g.fillStyle(0x261a30, 0.6).fillCircle(size / 2 + 4, size / 2 + 5, 5); // shadow
    // Fuse stub
    g.lineStyle(2, 0x7B5A3B, 1).beginPath().moveTo(size / 2, size / 2 - 8).lineTo(size / 2 + 3, size / 2 - 14).strokePath();
    // Spark
    g.fillStyle(0xF4A261, 1).fillCircle(size / 2 + 3, size / 2 - 14, 2);
    g.fillStyle(0xFFF6D6, 1).fillCircle(size / 2 + 3, size / 2 - 14, 0.9);
    g.generateTexture('bomb-procedural', size, size);
    g.destroy();
  }
}
