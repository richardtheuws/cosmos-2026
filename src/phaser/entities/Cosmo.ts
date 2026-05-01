/**
 * Cosmo — the player. Strict 8x8-grid arcade-feel platformer with a signature
 * suction-cup wallcling: against a vertical wall, `cling` latches; tapping jump
 * mid-cling launches off into a pseudo-wallclimb. No double-jump.
 *
 * The state machine is intentionally tight — adding states later (swim, scooter,
 * invincible) routes through the same handful of transitions.
 */
import Phaser from 'phaser';
import type { InputController } from '../../core/inputController';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { sfx } from '../../audio/sfxBus';

export const COSMO = {
  RUN_SPEED: 200,
  JUMP_VELOCITY: -460,
  WALL_CLIMB_VELOCITY: -320,
  WALL_PUSHOFF_X: 230,
  GRAVITY: 1300,
  CLING_GRAVITY: 220,
  MAX_FALL: 720,
  STOMP_BOUNCE: -360,
  WIDTH: 28,
  HEIGHT: 36,
} as const;

type State = 'idle' | 'run' | 'jump' | 'fall' | 'cling' | 'damage' | 'death';

/** Sprint 6C bomb hooks — scene supplies these so Cosmo can throw without
 *  importing Bomb directly (avoids the entity ↔ scene coupling cycle). */
export interface CosmoBombHooks {
  /** Spawn a bomb thrown from Cosmo's hand-position with a given facing. */
  throwBomb: (x: number, y: number, facing: 1 | -1) => void;
}

export class Cosmo {
  sprite: Phaser.Physics.Arcade.Sprite;
  state: State = 'idle';
  facing: 1 | -1 = 1;
  hp = 3;
  maxHp = 3;
  bombs = 0;
  /** True for ~1.2s after taking damage. Cosmo is intangible. */
  iframe = 0;
  /** Sprint 6C — short cooldown between throws so holding X doesn't dump bombs. */
  bombCooldown = 0;
  /** Optional scene-supplied hooks. Set via `Cosmo.attachBombHooks()`. */
  private bombHooks: CosmoBombHooks | null = null;
  /** Squash-tween handle for throw-anim — stop before re-running. */
  private throwTween?: Phaser.Tweens.Tween;
  /** Direction of wall when clinging (-1 = wall on left, +1 = wall on right). */
  private clingSide: -1 | 1 = 1;
  /** Latch buffer — tap-jump-out-of-cling has 80ms to register after key release. */
  private clingJumpBuffer = 0;
  /** Coyote-jump after walking off a ledge — 100ms. Forgiveness is gameplay quality. */
  private coyoteTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'cosmo-stand') {
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    // Body matches the *displayed* sprite. We expect texture dimensions to equal
    // COSMO.WIDTH x COSMO.HEIGHT for the procedural placeholder. The real sprite
    // sheet in S3 will set its own size + offset.
    if (this.sprite.width !== COSMO.WIDTH || this.sprite.height !== COSMO.HEIGHT) {
      this.sprite.setSize(COSMO.WIDTH, COSMO.HEIGHT);
      this.sprite.setOffset((this.sprite.width - COSMO.WIDTH) / 2, (this.sprite.height - COSMO.HEIGHT) / 2);
    }
    this.sprite.setMaxVelocity(COSMO.RUN_SPEED * 1.6, COSMO.MAX_FALL);
    this.sprite.setDragX(1500);
    this.sprite.setCollideWorldBounds(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setGravityY(COSMO.GRAVITY);
  }

  update(input: InputController, dt: number, uniforms: GlobalUniforms): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onFloor = body.blocked.down || body.touching.down;
    const onWallLeft = body.blocked.left || body.touching.left;
    const onWallRight = body.blocked.right || body.touching.right;

    if (this.iframe > 0) this.iframe -= dt;
    if (this.coyoteTime > 0) this.coyoteTime -= dt;
    if (this.clingJumpBuffer > 0) this.clingJumpBuffer -= dt;
    if (this.bombCooldown > 0) this.bombCooldown -= dt;

    // Bomb throw — uses an injected scene-hook so Cosmo doesn't import Bomb.
    if (input.state.bombJustPressed && this.bombs > 0 && this.bombCooldown <= 0 && this.state !== 'damage' && this.state !== 'death' && this.bombHooks) {
      const handX = this.sprite.x + this.facing * (COSMO.WIDTH * 0.4);
      const handY = this.sprite.y - COSMO.HEIGHT * 0.1;
      this.bombHooks.throwBomb(handX, handY, this.facing);
      this.bombs -= 1;
      this.bombCooldown = 0.4;
      this.playThrowAnim();
      // bomb-throw SFX is fired by Bomb's constructor — no double-play here.
    }

    const inputX = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
    if (inputX !== 0) this.facing = inputX > 0 ? 1 : -1;

    const canCling = !onFloor && ((onWallLeft && inputX < 0) || (onWallRight && inputX > 0)) && body.velocity.y > -50;
    const wasNotCling = this.state !== 'cling';
    if (canCling && this.state !== 'damage') {
      if (wasNotCling) sfx.play('cling');
      this.state = 'cling';
      this.clingSide = onWallLeft ? -1 : 1;
      body.setGravityY(COSMO.CLING_GRAVITY);
    } else if (this.state === 'cling') {
      this.state = body.velocity.y < 0 ? 'jump' : 'fall';
      body.setGravityY(COSMO.GRAVITY);
    }

    if (this.state !== 'cling' && this.state !== 'damage') {
      this.sprite.setVelocityX(inputX * COSMO.RUN_SPEED);
    }

    if (input.state.jumpJustPressed) {
      if (this.state === 'cling') {
        this.sprite.setVelocityY(COSMO.WALL_CLIMB_VELOCITY);
        this.sprite.setVelocityX(-this.clingSide * COSMO.WALL_PUSHOFF_X);
        this.state = 'jump';
        body.setGravityY(COSMO.GRAVITY);
        this.clingJumpBuffer = 0.08;
        sfx.play('jump');
      } else if (onFloor || this.coyoteTime > 0) {
        this.sprite.setVelocityY(COSMO.JUMP_VELOCITY);
        this.state = 'jump';
        this.coyoteTime = 0;
        sfx.play('jump');
      }
    }

    if (this.state !== 'cling' && this.state !== 'damage' && this.state !== 'jump') {
      if (onFloor) {
        if (Math.abs(body.velocity.x) > 5) this.state = 'run';
        else this.state = 'idle';
        this.coyoteTime = 0.1;
      } else {
        this.state = body.velocity.y < 0 ? 'jump' : 'fall';
      }
    } else if (this.state === 'jump' && body.velocity.y >= 0) {
      this.state = 'fall';
    }

    this.sprite.setFlipX(this.facing < 0);
    this.playStateAnim();

    uniforms.cosmoX = this.sprite.x;
    uniforms.cosmoY = this.sprite.y;
    uniforms.cosmoFacing = this.facing;
    uniforms.cosmoState = this.state;
  }

  takeDamage(): boolean {
    if (this.iframe > 0 || this.state === 'death') return false;
    this.hp -= 1;
    this.iframe = 1.2;
    if (this.hp <= 0) {
      this.state = 'death';
      this.sprite.setVelocity(0, COSMO.JUMP_VELOCITY * 0.7);
      return true;
    }
    this.state = 'damage';
    this.sprite.setVelocity(-this.facing * 180, COSMO.JUMP_VELOCITY * 0.55);
    setTimeout(() => {
      if (this.state === 'damage') this.state = 'fall';
    }, 220);
    return true;
  }

  /** Mario-style head-bounce after stomping an enemy. */
  stompBounce(): void {
    this.sprite.setVelocityY(COSMO.STOMP_BOUNCE);
    this.state = 'jump';
  }

  /** Sprint 6C — scene wires a throw-callback so Cosmo can spawn bombs. */
  attachBombHooks(hooks: CosmoBombHooks): void {
    this.bombHooks = hooks;
  }

  /** Sprint 6C — pickup a bomb from a level-spawned Bomb-pickup. */
  pickupBomb(amount = 1): void {
    this.bombs = Math.min(this.bombs + amount, 9);
  }

  /** Quick squash-tween on bomb-throw — hands forward, body compresses. */
  private playThrowAnim(): void {
    const sprite = this.sprite;
    this.throwTween?.stop();
    const baseSx = sprite.scaleX;
    const baseSy = sprite.scaleY;
    sprite.setScale(baseSx, baseSy);
    this.throwTween = sprite.scene.tweens.add({
      targets: sprite,
      scaleX: baseSx * 1.12,
      scaleY: baseSy * 0.86,
      duration: 80,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onComplete: () => {
        sprite.setScale(baseSx, baseSy);
      },
    });
  }

  private playStateAnim(): void {
    const key = `cosmo-${this.state}`;
    const anim = this.sprite.anims;
    if (!anim || !anim.exists(key)) {
      this.sprite.setFrame(0);
      return;
    }
    if (anim.currentAnim?.key !== key) anim.play(key, true);
  }
}
