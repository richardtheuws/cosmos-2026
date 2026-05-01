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
import { BOMB } from './Bomb';

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
  /** Walk-cycle phase accumulator — alternates walk-1/walk-2 every WALK_FRAME_DT seconds. */
  private walkPhase = 0;
  private walkFrameToggle: 0 | 1 = 0;
  /** ~133ms per frame at 60fps = 8 frames per swap, classic 1992-platformer cadence. */
  private static readonly WALK_FRAME_DT = 0.133;

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
      // Sprint 8D — pull cooldown from the BOMB const so Cosmo + Bomb stay in sync.
      this.bombCooldown = BOMB.COOLDOWN_S;
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

    this.updateAnim(dt);

    uniforms.cosmoX = this.sprite.x;
    uniforms.cosmoY = this.sprite.y;
    uniforms.cosmoFacing = this.facing;
    uniforms.cosmoState = this.state;
  }

  takeDamage(): boolean {
    if (this.iframe > 0 || this.state === 'death') return false;
    this.hp = Math.max(0, this.hp - 1);
    this.iframe = 1.2;
    if (this.hp <= 0) {
      this.state = 'death';
      this.sprite.setVelocity(0, COSMO.JUMP_VELOCITY * 0.7);
      // Sprint 8D — death rotation tween (Sprint 7A open issue). 90° forward
      // tilt over 600ms easeIn — reads as Cosmo collapsing while the
      // ragdoll-arc plays out. Z-rotation is angle in Phaser (degrees).
      this.sprite.scene.tweens.add({
        targets: this.sprite,
        angle: 90 * (this.facing > 0 ? 1 : -1),
        duration: 600,
        ease: 'Cubic.easeIn',
      });
      return true;
    }
    this.state = 'damage';
    this.sprite.setVelocity(-this.facing * 180, COSMO.JUMP_VELOCITY * 0.55);
    // Use scene-aware timer so the callback respects scene pause/shutdown.
    this.sprite.scene.time.delayedCall(220, () => {
      if (this.state === 'damage') this.state = 'fall';
    });
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

  /**
   * Sprint 7A — texture-swap-based animation. Each Cosmo state maps to a distinct
   * pose-texture generated via Flux Control LoRA Canny + skeleton-control. We do
   * NOT use Phaser's anim-system here because each pose is its OWN 1024² texture
   * (not a spritesheet). Walk-cycle alternates walk-1 / walk-2 every ~133ms.
   *
   * facing < 0 mirrors via setFlipX. cling-right is generated facing-right with
   * suction-cups extending right; for left-wall cling we flip horizontally.
   */
  private updateAnim(dt: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let key: string;

    switch (this.state) {
      case 'cling':
        key = 'cosmo-cling-right';
        // Cling-side determines facing — render hands toward the wall.
        // clingSide = -1 → left wall → flipX so suction-cups face left.
        // clingSide = +1 → right wall → no flip.
        this.sprite.setFlipX(this.clingSide < 0);
        this.sprite.setTexture(key);
        return;

      case 'jump':
        key = body.velocity.y < 0 ? 'cosmo-jump-up' : 'cosmo-jump-fall';
        break;

      case 'fall':
        key = 'cosmo-jump-fall';
        break;

      case 'damage':
      case 'death':
        key = 'cosmo-hurt';
        break;

      case 'run': {
        // Alternate walk-1 / walk-2 based on phase accumulator.
        // TODO(Sprint 8E+): walk-1/walk-2 eye-drift — chameleon eyes shift
        // ~3px between frames (Flux seed-variance). Fix via per-frame
        // seed-lock pass through fal.ai (~$0.18/run). Deferred from 8D.
        this.walkPhase += dt;
        if (this.walkPhase >= Cosmo.WALK_FRAME_DT) {
          this.walkPhase -= Cosmo.WALK_FRAME_DT;
          this.walkFrameToggle = this.walkFrameToggle === 0 ? 1 : 0;
        }
        key = this.walkFrameToggle === 0 ? 'cosmo-walk-1' : 'cosmo-walk-2';
        break;
      }

      case 'idle':
      default:
        // Idle: use walk-1 (most "neutral" stride). Reset walk-cycle so the next
        // run-transition starts on frame 1 — prevents flicker on quick taps.
        this.walkPhase = 0;
        this.walkFrameToggle = 0;
        key = 'cosmo-walk-1';
        break;
    }

    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setTexture(key);
  }
}
