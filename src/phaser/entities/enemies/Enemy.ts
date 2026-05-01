/**
 * Enemy — single class drives all 12 enemy kinds defined in `EnemyTypes.ts`.
 * Behavior switches on `def.behavior.kind` per frame; one entity = one body.
 *
 * Wiring contract (see `L1Scene.ts`):
 *  - `physics.collider` Cosmo ↔ enemy.sprite, callback calls `tryStomp`
 *  - `physics.overlap`  Cosmo ↔ enemy.sprite for sensor-only kinds (ghost,
 *    flying-wisp, dragonfly mid-flight) and projectile-emitting bodies
 *  - Scene calls `update(dt, ctx)` every frame on every active enemy. Projectiles
 *    spawn into a scene-owned group passed via `ctx.spawnProjectile`.
 *
 * Stomp rule: Cosmo's velocity.y > +threshold AND Cosmo's body.bottom ≤ enemy
 * top + headRoom → stomp. Else side/bottom touch deals damage (unless
 * `def.damageOnTouch === false`, e.g. friendly Tulip Launcher).
 *
 * Damage to Cosmo runs through `Cosmo.takeDamage()` (1.2s i-frames built-in),
 * stomp-bounce uses `Cosmo.stompBounce()`. Both already exist in `Cosmo.ts`.
 */
import Phaser from 'phaser';
import type { BombTarget, EnemyDef } from './EnemyTypes';
import { sfx } from '../../../audio/sfxBus';
import type { Cosmo } from '../Cosmo';
import { EnemyProjectile } from './EnemyProjectile';

/** Threshold for stomp-detection: how much of the enemy top counts as "head".
 *  Tuned to the standard 32–48px enemy sprites — Cosmo's body must overlap
 *  this top band AND be falling (vy > 60) to score a stomp. */
const STOMP_HEAD_FRACTION = 0.35;
const STOMP_MIN_VY = 60;

export interface EnemyUpdateCtx {
  cosmo: Cosmo;
  worldW: number;
  worldH: number;
  spawnProjectile: (p: EnemyProjectile) => void;
  /** Static platforms group — used by patrol-edge-flip + wallCrawler turn checks. */
  platforms: Phaser.Physics.Arcade.StaticGroup;
}

export class Enemy implements BombTarget {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: EnemyDef;
  alive = true;
  /** Remaining stomps before death. Snapshot of `def.stompsToKill` at spawn. */
  stompsLeft: number;
  /** BombTarget contract — Bomb.explode() reads these flags. */
  vulnerableToBomb: boolean;
  vulnerableToStomp: boolean;
  /** Per-frame behavior state. Each behavior uses its own subset of fields. */
  private dir: 1 | -1 = 1;
  private hopTimer = 0;
  private fireTimer = 0;
  private burrowTimer = 0;
  private burrowed = true;
  private spawnX: number;
  private spawnY: number;
  private phase: number;
  private launchCooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    this.def = def;
    this.spawnX = x;
    this.spawnY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.sprite = scene.physics.add.sprite(x, y, def.spriteKey);
    this.sprite.setDisplaySize(def.displaySize, def.displaySize);
    if (def.tint !== 0) this.sprite.setTint(def.tint);
    this.sprite.setData('enemy', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Body in *texture-space*: scale hitbox proportional to display vs. natural texture size.
    const tw = this.sprite.width;
    const th = this.sprite.height;
    const scaleX = tw / def.displaySize;
    const scaleY = th / def.displaySize;
    const bw = def.bodySize.w * scaleX;
    const bh = def.bodySize.h * scaleY;
    body.setSize(bw, bh).setOffset((tw - bw) / 2, (th - bh) / 2);

    this.stompsLeft = typeof def.stompsToKill === 'number' ? def.stompsToKill : 1;
    this.vulnerableToBomb = def.vulnerableToBomb;
    this.vulnerableToStomp = typeof def.stompsToKill === 'number';
    this.applyBehaviorInit(body);
  }

  /** BombTarget — `dead` mirrors `!alive` for symmetry with the Sprint 6C contract. */
  get dead(): boolean {
    return !this.alive;
  }

  /** BombTarget callback — Sprint 6C bomb explodes radius-checks targets. */
  onBombHit(): boolean {
    return this.hitByBomb();
  }

  private applyBehaviorInit(body: Phaser.Physics.Arcade.Body): void {
    const b = this.def.behavior;
    switch (b.kind) {
      case 'patrol':
        body.setAllowGravity(true).setVelocityX(b.speed);
        this.dir = 1;
        break;
      case 'hop':
        body.setAllowGravity(true);
        this.hopTimer = b.intervalMs * 0.5;
        break;
      case 'drifter':
        body.setAllowGravity(false).setVelocityY(b.floatSpeed);
        break;
      case 'static':
      case 'wallTurret':
        body.setAllowGravity(false).setImmovable(true);
        break;
      case 'burrow':
        body.setAllowGravity(false);
        this.burrowed = true;
        this.sprite.setAlpha(0);
        this.burrowTimer = b.burrowTimeS;
        break;
      case 'proximityGhost':
        body.setAllowGravity(false);
        this.sprite.setAlpha(0.55);
        break;
      case 'homing':
        body.setAllowGravity(false);
        break;
      case 'sinusoid':
        body.setAllowGravity(false).setVelocityX(b.horizontalSpeed);
        this.dir = 1;
        break;
      case 'wallCrawler':
        body.setAllowGravity(true).setVelocityX(b.speed);
        this.dir = 1;
        break;
      case 'tulipLauncher':
        body.setAllowGravity(false).setImmovable(true);
        break;
      case 'rail':
        body.setAllowGravity(false).setImmovable(false).setVelocityX(b.speed);
        this.dir = 1;
        break;
    }
  }

  update(dt: number, ctx: EnemyUpdateCtx): void {
    if (!this.alive) return;
    this.launchCooldown = Math.max(0, this.launchCooldown - dt);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const b = this.def.behavior;
    switch (b.kind) {
      case 'patrol':
        this.updatePatrol(body, b, ctx);
        break;
      case 'hop':
        this.updateHop(body, b, dt);
        break;
      case 'drifter':
        this.updateDrifter(body, b);
        break;
      case 'static':
        break;
      case 'wallTurret':
        this.updateWallTurret(body, b, dt, ctx);
        break;
      case 'burrow':
        this.updateBurrow(b, dt, ctx);
        break;
      case 'proximityGhost':
        this.updateProximityGhost(body, b, ctx);
        break;
      case 'homing':
        this.updateHoming(body, b, ctx);
        break;
      case 'sinusoid':
        this.updateSinusoid(body, b, ctx);
        break;
      case 'wallCrawler':
        this.updateWallCrawler(body, b);
        break;
      case 'tulipLauncher':
        // Static, the touch-callback in scene handles the launch via tryLaunch().
        break;
      case 'rail':
        this.updateRail(body, b);
        break;
    }
  }

  // ── Behavior updates ────────────────────────────────────────────────────

  private updatePatrol(body: Phaser.Physics.Arcade.Body, b: { speed: number; flipOnEdge: boolean }, ctx: EnemyUpdateCtx): void {
    if (body.blocked.left || body.touching.left) this.dir = 1;
    else if (body.blocked.right || body.touching.right) this.dir = -1;
    // Edge-flip: if grounded and the front-bottom corner has no floor, turn.
    // We probe the platforms static group: any body whose AABB contains the
    // forward-foot point counts as "floor". Cheap O(n) over the platforms.
    if (b.flipOnEdge && (body.blocked.down || body.touching.down)) {
      const probeX = this.sprite.x + this.dir * (this.def.displaySize * 0.55);
      const probeY = this.sprite.y + this.def.displaySize * 0.55 + 4;
      let foundFloor = false;
      const children = ctx.platforms.getChildren();
      for (const child of children) {
        const obj = child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody };
        const sb = obj.body;
        if (!sb) continue;
        if (probeX >= sb.left && probeX <= sb.right && probeY >= sb.top && probeY <= sb.bottom + 4) {
          foundFloor = true;
          break;
        }
      }
      if (!foundFloor) this.dir = (this.dir * -1) as -1 | 1;
    }
    body.setVelocityX(this.dir * b.speed);
    this.sprite.setFlipX(this.dir < 0);
  }

  private updateHop(body: Phaser.Physics.Arcade.Body, b: { intervalMs: number; jumpVelocity: number; horizontalDrift: number }, dt: number): void {
    this.hopTimer -= dt * 1000;
    const onFloor = body.blocked.down || body.touching.down;
    if (onFloor && this.hopTimer <= 0) {
      body.setVelocityY(b.jumpVelocity);
      const drift = (Math.random() * 2 - 1) * b.horizontalDrift;
      body.setVelocityX(drift);
      this.hopTimer = b.intervalMs;
    } else if (!onFloor) {
      // Air-drift damping
      body.setVelocityX(body.velocity.x * 0.98);
    }
  }

  private updateDrifter(body: Phaser.Physics.Arcade.Body, b: { floatSpeed: number; postStompFallMul: number }): void {
    const target = this.stompsLeft < (typeof this.def.stompsToKill === 'number' ? this.def.stompsToKill : 2)
      ? b.floatSpeed * b.postStompFallMul
      : b.floatSpeed;
    body.setVelocityY(target);
    // Slow horizontal drift
    body.setVelocityX(Math.sin(this.sprite.scene.game.loop.time / 600 + this.phase) * 18);
  }

  private updateWallTurret(_body: Phaser.Physics.Arcade.Body, b: { fireIntervalMs: number; projectileSpeed: number; projectileLifeS: number; aimAtCosmo: boolean }, dt: number, ctx: EnemyUpdateCtx): void {
    this.fireTimer -= dt * 1000;
    if (this.fireTimer > 0) return;
    this.fireTimer = b.fireIntervalMs;
    let vx = -b.projectileSpeed;
    let vy = 0;
    if (b.aimAtCosmo) {
      const dx = ctx.cosmo.sprite.x - this.sprite.x;
      const dy = ctx.cosmo.sprite.y - this.sprite.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      vx = (dx / len) * b.projectileSpeed;
      vy = (dy / len) * b.projectileSpeed;
    }
    const projectile = new EnemyProjectile(this.sprite.scene, this.sprite.x, this.sprite.y, vx, vy, b.projectileLifeS);
    ctx.spawnProjectile(projectile);
  }

  private updateBurrow(b: { surfaceRadiusPx: number; surfaceTimeS: number; burrowTimeS: number }, dt: number, ctx: EnemyUpdateCtx): void {
    this.burrowTimer -= dt;
    if (this.burrowed) {
      // Stay invisible at spawn; surface only when Cosmo within radius AND timer expired.
      const dx = ctx.cosmo.sprite.x - this.spawnX;
      const dy = ctx.cosmo.sprite.y - this.spawnY;
      const inRange = (dx * dx + dy * dy) < (b.surfaceRadiusPx * b.surfaceRadiusPx);
      if (this.burrowTimer <= 0 && inRange) {
        this.burrowed = false;
        this.burrowTimer = b.surfaceTimeS;
        // Surface 8px above spawn so Cosmo can stomp.
        this.sprite.setPosition(this.spawnX, this.spawnY - 8);
        this.sprite.setAlpha(1);
      }
    } else if (this.burrowTimer <= 0) {
      this.burrowed = true;
      this.burrowTimer = b.burrowTimeS;
      this.sprite.setAlpha(0);
      // Move out of play while burrowed so the body can't be stomped.
      this.sprite.setPosition(this.spawnX, this.spawnY + 4096);
    }
  }

  private updateProximityGhost(body: Phaser.Physics.Arcade.Body, b: { activateRadiusPx: number; chaseSpeed: number }, ctx: EnemyUpdateCtx): void {
    const dx = ctx.cosmo.sprite.x - this.sprite.x;
    const dy = ctx.cosmo.sprite.y - this.sprite.y;
    const distSq = dx * dx + dy * dy;
    const inRadius = distSq < b.activateRadiusPx * b.activateRadiusPx;
    // Only chase when Cosmo is facing AWAY from this ghost.
    const ghostIsToTheRight = dx < 0; // ghost.x > cosmo.x
    const facingAway = ghostIsToTheRight ? ctx.cosmo.facing < 0 : ctx.cosmo.facing > 0;
    if (inRadius && facingAway) {
      const len = Math.max(1, Math.hypot(dx, dy));
      body.setVelocity((dx / len) * b.chaseSpeed, (dy / len) * b.chaseSpeed);
    } else {
      body.setVelocity(0, 0);
    }
  }

  private updateHoming(body: Phaser.Physics.Arcade.Body, b: { lerp: number; maxSpeed: number; activateRadiusPx: number }, ctx: EnemyUpdateCtx): void {
    const dx = ctx.cosmo.sprite.x - this.sprite.x;
    const dy = ctx.cosmo.sprite.y - this.sprite.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > b.activateRadiusPx * b.activateRadiusPx) {
      body.setVelocity(body.velocity.x * 0.95, body.velocity.y * 0.95);
      return;
    }
    const len = Math.max(1, Math.hypot(dx, dy));
    const targetVX = (dx / len) * b.maxSpeed;
    const targetVY = (dy / len) * b.maxSpeed;
    body.setVelocity(
      Phaser.Math.Linear(body.velocity.x, targetVX, b.lerp),
      Phaser.Math.Linear(body.velocity.y, targetVY, b.lerp),
    );
  }

  private updateSinusoid(body: Phaser.Physics.Arcade.Body, b: { amplitudePx: number; frequencyHz: number; horizontalSpeed: number; diveOnAlignedRadiusPx: number }, ctx: EnemyUpdateCtx): void {
    // Reverse direction at world bounds.
    if (this.sprite.x < 32) this.dir = 1;
    else if (this.sprite.x > ctx.worldW - 32) this.dir = -1;
    body.setVelocityX(this.dir * b.horizontalSpeed);
    const t = this.sprite.scene.game.loop.time / 1000;
    const targetY = this.spawnY + Math.sin(t * b.frequencyHz * Math.PI * 2 + this.phase) * b.amplitudePx;
    // Position-based vertical (no gravity).
    this.sprite.y = targetY;
    // Dive-attack: if Cosmo within horizontal alignment radius, snap downward.
    const dx = ctx.cosmo.sprite.x - this.sprite.x;
    if (Math.abs(dx) < b.diveOnAlignedRadiusPx && ctx.cosmo.sprite.y > this.sprite.y + 32) {
      this.sprite.y = Math.min(this.sprite.y + 4, ctx.cosmo.sprite.y - 16);
    }
    this.sprite.setFlipX(this.dir < 0);
  }

  private updateWallCrawler(body: Phaser.Physics.Arcade.Body, b: { speed: number }): void {
    // Simple ground-crawler placeholder. Full ceiling/wall crawl needs a custom
    // physics path (raycast against tile grid) — Sprint 6E spike.
    if (body.blocked.left || body.touching.left) this.dir = 1;
    else if (body.blocked.right || body.touching.right) this.dir = -1;
    body.setVelocityX(this.dir * b.speed);
    this.sprite.setFlipX(this.dir < 0);
  }

  private updateRail(body: Phaser.Physics.Arcade.Body, b: { speed: number; railLengthPx: number }): void {
    const offset = this.sprite.x - this.spawnX;
    if (offset > b.railLengthPx) this.dir = -1;
    else if (offset < 0) this.dir = 1;
    body.setVelocityX(this.dir * b.speed);
  }

  // ── Collision API (called from L1Scene) ─────────────────────────────────

  /**
   * Resolve a touch with Cosmo. Returns the outcome so the scene can apply
   * audio + post-FX pulses. Honors def-flags: `bombOnly` enemies always
   * damage (no stomp); friendly tulipLauncher launches Cosmo upward.
   */
  resolveTouch(cosmo: Cosmo): 'stomp' | 'damage' | 'launch' | 'nothing' {
    if (!this.alive) return 'nothing';
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const cosmoBody = cosmo.sprite.body as Phaser.Physics.Arcade.Body;

    // Tulip Launcher friendly behavior: bounce Cosmo up regardless of approach angle.
    if (this.def.behavior.kind === 'tulipLauncher' && !this.def.behavior.hostileOnTouch) {
      if (this.launchCooldown <= 0) {
        cosmoBody.setVelocityY(this.def.behavior.launchVelocity);
        this.launchCooldown = this.def.behavior.cooldownS;
        sfx.play('jump');
        return 'launch';
      }
      return 'nothing';
    }

    const enemyTop = body.top;
    const enemyHeight = body.height;
    const cosmoBottom = cosmoBody.bottom;
    const headBand = enemyTop + enemyHeight * STOMP_HEAD_FRACTION;
    const isStomp = cosmoBody.velocity.y > STOMP_MIN_VY && cosmoBottom <= headBand + 8;

    if (isStomp && this.def.stompsToKill !== 'invincible' && this.def.stompsToKill !== 'bombOnly') {
      this.stompsLeft -= 1;
      cosmo.stompBounce();
      sfx.play('stomp');
      if (this.stompsLeft <= 0) {
        this.kill();
        return 'stomp';
      }
      return 'stomp';
    }

    // Side / bottom touch → damage
    if (this.def.damageOnTouch) {
      if (cosmo.takeDamage()) return 'damage';
    }
    return 'nothing';
  }

  /** Bomb-explosion API. Sprint 6C wires the bomb entity. */
  hitByBomb(): boolean {
    if (!this.alive || !this.def.vulnerableToBomb) return false;
    this.kill();
    return true;
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    const sprite = this.sprite;
    sprite.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: sprite.scale * 1.4,
      angle: sprite.angle + 90,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => sprite.destroy(),
    });
  }
}
