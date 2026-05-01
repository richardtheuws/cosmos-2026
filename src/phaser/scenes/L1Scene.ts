/**
 * L1Scene — "First Steps", Bloomroot Veld. The first real level. Loads the
 * compact grid from src/data/levelL1.ts, spawns Cosmo + Stars + HintGlobes,
 * wires SFX/voice playback. Camera follows Cosmo, parallax driven via
 * globalUniforms.cameraX in the Three.js layer.
 */
import Phaser from 'phaser';
import { Cosmo } from '../entities/Cosmo';
import { Star } from '../entities/Star';
import { HintGlobe } from '../entities/HintGlobe';
import { Trampoline } from '../entities/Trampoline';
import { Bomb, BOMB } from '../entities/Bomb';
import { BreakableWall } from '../entities/BreakableWall';
import { Enemy } from '../entities/enemies/Enemy';
import type { EnemyProjectile } from '../entities/enemies/EnemyProjectile';
import { ENEMY_DEFS, type BombTarget } from '../entities/enemies/EnemyTypes';
import { assetPath } from '../../core/assetPath';
import type { InputController } from '../../core/inputController';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { L1_GRID, TILE_SIZE, decodeLevel, HINT_LINES } from '../../data/levelL1';
import { sfx } from '../../audio/sfxBus';

const COLOR = {
  ground: 0x7B9E89,
  dirt: 0x4F6E5C,
  wall: 0x3D2E4A,
  mushroom: 0xE8D5B7,
  platform: 0x2D4A3E,
  spike: 0xB85C7E,
  saffron: 0xF4A261,
  popMagenta: 0xFF2D95,
  popLime: 0x7AFF3D,
  starCore: 0xF4A261,
  starHalo: 0xFF2D95,
} as const;

export class L1Scene extends Phaser.Scene {
  private cosmo!: Cosmo;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private starsGroup!: Phaser.Physics.Arcade.Group;
  private inputCtl!: InputController;
  private uniforms!: GlobalUniforms;
  private hudText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private stars: Star[] = [];
  private globes: HintGlobe[] = [];
  private trampolines: Trampoline[] = [];
  /** Sprint 6C — live bombs in the air. Iterated each frame for fuse-tick. */
  private bombs: Bomb[] = [];
  /** Sprint 6C — physics group for bomb sprites (collide with platforms + breakables). */
  private bombsGroup!: Phaser.Physics.Arcade.Group;
  /** Sprint 6C — breakable wall instances kept here so explosions can scan them. */
  private breakables: BreakableWall[] = [];
  /** Sprint 6C — bomb-pickup sprites. */
  private bombPickupsGroup!: Phaser.Physics.Arcade.Group;
  /** Sprint 6C — Sprint 6B enemy classes register themselves here so Bomb can hit them. */
  private bombTargets: BombTarget[] = [];
  /** Sprint 6B — active enemies on the level. Iterated each frame for behavior + cleanup. */
  private enemies: Enemy[] = [];
  /** Sprint 6B — physics group for enemy sprites (collide-with-platforms + overlap-with-cosmo). */
  private enemiesGroup!: Phaser.Physics.Arcade.Group;
  /** Sprint 6B — live projectiles fired by Eye Plants / Spitting Walls. */
  private enemyProjectiles: EnemyProjectile[] = [];
  /** Sprint 6B — projectile sprite group (collide-with-platforms + overlap-with-cosmo). */
  private enemyProjectilesGroup!: Phaser.Physics.Arcade.Group;
  private starsCollected = 0;
  private currentHintTimer = 0;
  private cosmoSpawn = { x: 96, y: 480 };
  private worldW = 0;
  private worldH = 0;

  constructor() { super({ key: 'L1Scene' }); }

  init(data: { input: InputController; uniforms: GlobalUniforms }): void {
    this.inputCtl = data.input;
    this.uniforms = data.uniforms;
  }

  preload(): void {
    // Sprint 4.5 Fase B v2 — enemies, painted tiles, painted pickups.
    // Sprint 4.5 Fase C v3 — Cosmo CANONICAL (Hayao-Moebius hybrid, chameleon eyes).
    // Sprint 6A — Flux Fill inpainting added extended-arm geometry with black
    //   suction-cup pads at hand-tips; tail removed via deterministic alpha-erase
    //   post-BiRefNet. See public/assets/case-study/cosmo-inpaint-process/
    //   _manifest.json for full pipeline.
    // Sprint 7A — multi-frame poses via Flux Control LoRA Canny + skeleton-control.
    // Each pose is a distinct 1024² texture; Cosmo.updateAnim() texture-swaps
    // per state. See public/assets/case-study/cosmo-multi-frame/ for skeletons +
    // raw Flux outputs. Walk-cycle alternates walk-1/walk-2 every ~133ms.
    const v3 = assetPath('assets/sprites/v3');
    const v2 = assetPath('assets/sprites/v2');
    this.load.image('cosmo-walk-1', `${v3}/cosmo-walk-1.png`);
    this.load.image('cosmo-walk-2', `${v3}/cosmo-walk-2.png`);
    this.load.image('cosmo-jump-up', `${v3}/cosmo-jump-up.png`);
    this.load.image('cosmo-jump-fall', `${v3}/cosmo-jump-fall.png`);
    this.load.image('cosmo-cling-right', `${v3}/cosmo-cling-right.png`);
    this.load.image('cosmo-hurt', `${v3}/cosmo-hurt.png`);

    this.load.image('enemy-brumberry', `${v2}/enemy-brumberry-cleaned.png`);
    this.load.image('enemy-hopper', `${v2}/enemy-hopper-cabbage-cleaned.png`);
    this.load.image('enemy-eye-plant', `${v2}/enemy-eye-plant-cleaned.png`);

    // Sprint 7D — dedicated sprites for the remaining 9 enemy classes.
    // Flux Dev + BiRefNet, locked palette, Hayao×Moebius style coherent with Cosmo.
    const v4 = assetPath('assets/sprites/v4');
    this.load.image('enemy-parachute', `${v4}/enemy-parachute-cleaned.png`);
    this.load.image('enemy-pinkworm', `${v4}/enemy-pinkworm-cleaned.png`);
    this.load.image('enemy-ghost', `${v4}/enemy-ghost-cleaned.png`);
    this.load.image('enemy-spittingwall', `${v4}/enemy-spittingwall-cleaned.png`);
    this.load.image('enemy-dragonfly', `${v4}/enemy-dragonfly-cleaned.png`);
    this.load.image('enemy-flyingwisp', `${v4}/enemy-flyingwisp-cleaned.png`);
    this.load.image('enemy-suctioncrawler', `${v4}/enemy-suctioncrawler-cleaned.png`);
    this.load.image('enemy-tuliplauncher', `${v4}/enemy-tuliplauncher-cleaned.png`);
    this.load.image('enemy-spark', `${v4}/enemy-spark-cleaned.png`);

    // Sprint 7D — bomb assets (replaces procedural canvas textures).
    this.load.image('bomb', assetPath('assets/bombs/bomb-cleaned.png'));
    this.load.image('bomb-pickup', assetPath('assets/bombs/bomb-pickup-cleaned.png'));

    // Painted tiles — replace procedural Graphics in S5 wiring.
    this.load.image('tile-ground-painted', assetPath('assets/tiles/tile-ground-cleaned.png'));
    this.load.image('tile-dirt-painted', assetPath('assets/tiles/tile-dirt.png'));
    this.load.image('tile-wall-painted', assetPath('assets/tiles/tile-wall-v2.png'));
    // Sprint 7D — dedicated cracked-wall texture for breakable walls.
    this.load.image('tile-wall-cracked-painted', assetPath('assets/tiles/tile-wall-cracked-painted.png'));
    this.load.image('tile-mushroom-painted', assetPath('assets/tiles/tile-mushroom-v2.png'));
    this.load.image('tile-spike-painted', assetPath('assets/tiles/tile-spike-cleaned.png'));
    this.load.image('tile-trampoline-painted', assetPath('assets/tiles/tile-trampoline.png'));

    // Painted pickups
    this.load.image('pickup-star-painted', assetPath('assets/pickups/pickup-star-cleaned.png'));
    this.load.image('pickup-powerup-painted', assetPath('assets/pickups/pickup-powerup-cleaned.png'));
    this.load.image('pickup-cheeseburger-painted', assetPath('assets/pickups/pickup-cheeseburger-cleaned.png'));
    this.load.image('hint-globe-painted', assetPath('assets/pickups/hint-globe-cleaned.png'));
  }

  create(): void {
    this.makeTextures();
    this.worldW = L1_GRID[0].length * TILE_SIZE;
    this.worldH = L1_GRID.length * TILE_SIZE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.starsGroup = this.physics.add.group();
    this.bombsGroup = this.physics.add.group();
    this.bombPickupsGroup = this.physics.add.group();
    this.enemiesGroup = this.physics.add.group();
    this.enemyProjectilesGroup = this.physics.add.group();

    // Sprint 7D — real `bomb` and `bomb-pickup` textures preloaded above;
    // procedural canvas-Graphics fallbacks are no longer needed for these.

    this.populateLevel();

    this.cosmo = new Cosmo(this, this.cosmoSpawn.x, this.cosmoSpawn.y, 'cosmo-walk-1');
    // Cosmo MOET prominenter zijn — TE GEK eis. Display 120x120 desktop, 80x80 mobile.
    // Sprint 7B: shrink on small viewports so HUD + touch overlay stay legible.
    // Body proportions (texture-space 180x380 with 420/360 offset) stay fixed —
    // only the display-scale changes; physics geometry is invariant.
    const cosmoDisplay = this.scale.width < 1024 ? 80 : 120;
    this.cosmo.sprite.setDisplaySize(cosmoDisplay, cosmoDisplay);
    const body = this.cosmo.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(180, 380, false).setOffset(420, 360);
    this.physics.add.collider(this.cosmo.sprite, this.platforms);
    // Trampolines: collider with custom callback for bounce.
    for (const tramp of this.trampolines) {
      this.physics.add.collider(this.cosmo.sprite, tramp.sprite, () => {
        const cosmoBody = this.cosmo.sprite.body as Phaser.Physics.Arcade.Body;
        if (cosmoBody.touching.down || cosmoBody.blocked.down) {
          tramp.tryBounce(cosmoBody, this.uniforms, this.game.loop.delta / 1000);
        }
      });
    }
    this.physics.add.overlap(this.cosmo.sprite, this.starsGroup, (_player, starSprite) => {
      const star = (starSprite as Phaser.Physics.Arcade.Sprite).getData('star') as Star | undefined;
      if (star && !star.collected) {
        star.collect(this);
        sfx.play('starPickup');
        this.starsCollected += 1;
        // Trippy pulse — short kaleidoscope flicker + brief chromatic peak.
        this.uniforms.kaleidoTrigger = Math.min(1, this.uniforms.kaleidoTrigger + 0.35);
        if (this.starsCollected % 5 === 0) {
          this.uniforms.kaleidoTrigger = 1.0;  // every 5th star is a louder peak
        }
      }
    });
    this.physics.add.overlap(this.cosmo.sprite, this.hazards, () => {
      if (this.cosmo.takeDamage()) {
        sfx.play('hurt');
        this.uniforms.damagePulse = 1.0;
      }
    });

    // Sprint 6B — enemy ↔ platforms + cosmo overlaps. Most enemies need ground
    // collision (patrol, hop, wallCrawler, parachute-after-stomp). Flying types
    // disabled gravity so they're unaffected, but still solid against tiles for
    // wall-bounces in patrol-edge logic.
    this.physics.add.collider(this.enemiesGroup, this.platforms);
    this.physics.add.overlap(this.cosmo.sprite, this.enemiesGroup, (_p, enemySprite) => {
      const enemy = (enemySprite as Phaser.Physics.Arcade.Sprite).getData('enemy') as Enemy | undefined;
      if (!enemy || !enemy.alive) return;
      const result = enemy.resolveTouch(this.cosmo);
      if (result === 'damage') {
        sfx.play('hurt');
        this.uniforms.damagePulse = 1.0;
      } else if (result === 'stomp') {
        // Trippy peak feedback for clean stomps — short kaleidoscope flicker.
        this.uniforms.kaleidoTrigger = Math.min(1, this.uniforms.kaleidoTrigger + 0.4);
      }
    });

    // Sprint 6B — projectiles collide with platforms (destroyed on hit) +
    // overlap with Cosmo (damage + i-frames).
    this.physics.add.collider(this.enemyProjectilesGroup, this.platforms, (projSprite) => {
      const proj = (projSprite as Phaser.Physics.Arcade.Sprite).getData('projectile') as EnemyProjectile | undefined;
      proj?.destroy();
    });
    this.physics.add.overlap(this.cosmo.sprite, this.enemyProjectilesGroup, (_p, projSprite) => {
      const proj = (projSprite as Phaser.Physics.Arcade.Sprite).getData('projectile') as EnemyProjectile | undefined;
      if (!proj || !proj.isAlive()) return;
      if (this.cosmo.takeDamage()) {
        sfx.play('hurt');
        this.uniforms.damagePulse = 1.0;
      }
      proj.destroy();
    });

    // Sprint 6C — bomb-throw wiring + collider with platforms + bomb-pickup overlap.
    this.cosmo.attachBombHooks({
      throwBomb: (x, y, facing) => this.spawnBomb(x, y, facing),
    });
    this.physics.add.collider(this.bombsGroup, this.platforms);
    this.physics.add.overlap(this.cosmo.sprite, this.bombPickupsGroup, (_player, pickupSprite) => {
      const sprite = pickupSprite as Phaser.Physics.Arcade.Sprite;
      if (sprite.getData('collected')) return;
      sprite.setData('collected', true);
      this.cosmo.pickupBomb(1);
      sfx.play('bonus');
      this.uniforms.kaleidoTrigger = Math.min(1, this.uniforms.kaleidoTrigger + 0.25);
      this.tweens.add({
        targets: sprite,
        scale: 1.6,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.easeOut',
        onComplete: () => sprite.destroy(),
      });
    });

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.cosmo.sprite, true, 0.12, 0.14);

    this.makeAnimations();
    this.buildHUD();
  }

  override update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.cosmo.update(this.inputCtl, dt, this.uniforms);
    // Sprint 7A — texture-swap is now handled inside Cosmo.updateAnim() because
    // each pose is a distinct texture (not a spritesheet). The old
    // `swapCosmoTexture` referenced stale keys (cosmo-walk-3, cosmo-cling).

    // Hint Globes — proximity-trigger
    for (const globe of this.globes) {
      globe.update(time, this.cosmo.sprite.x, this.cosmo.sprite.y, (idx) => this.triggerHint(idx));
    }
    if (this.currentHintTimer > 0) {
      this.currentHintTimer -= dt;
      if (this.currentHintTimer <= 0) this.hintText.setText('');
    }

    // Stars bob
    for (const s of this.stars) s.update(time);

    // Sprint 6B — enemies. Update active, prune dead. Projectiles spawned via
    // ctx callback into the projectile group + array.
    const enemyCtx = {
      cosmo: this.cosmo,
      worldW: this.worldW,
      worldH: this.worldH,
      platforms: this.platforms,
      spawnProjectile: (p: EnemyProjectile) => {
        this.enemyProjectiles.push(p);
        this.enemyProjectilesGroup.add(p.sprite);
      },
    };
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.update(dt, enemyCtx);
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.sprite.active);
    // Projectiles: tick lifetime, prune.
    for (const proj of this.enemyProjectiles) proj.update(dt);
    this.enemyProjectiles = this.enemyProjectiles.filter((p) => p.isAlive());

    // Sprint 6C — fuse-tick bombs; remove exploded ones.
    if (this.bombs.length > 0) {
      const stillAlive: Bomb[] = [];
      for (const b of this.bombs) {
        if (!b.update(dt)) stillAlive.push(b);
      }
      this.bombs = stillAlive;
    }

    // Camera pan input — vertical-only, +/- 64 px
    const pan = (this.inputCtl.state.panUp ? -1 : 0) + (this.inputCtl.state.panDown ? 1 : 0);
    this.cameras.main.setFollowOffset(0, pan * 80);

    this.uniforms.cameraX = this.cameras.main.scrollX;
    this.uniforms.cameraY = this.cameras.main.scrollY;
    this.inputCtl.postFrame();

    this.updateHUD();
  }

  private populateLevel(): void {
    const spawns = decodeLevel(L1_GRID);
    for (const s of spawns) {
      switch (s.type) {
        case 'cosmo':
          this.cosmoSpawn = { x: s.x, y: s.y - 8 };
          break;
        case 'ground':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-ground-painted', this.platforms);
          break;
        case 'dirt':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-dirt-painted', this.platforms);
          break;
        case 'wall':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-wall-painted', this.platforms);
          break;
        case 'mushroom':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-mushroom-painted', this.platforms);
          break;
        case 'platform':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-mushroom-painted', this.platforms);
          break;
        case 'spike':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-spike-painted', this.hazards);
          break;
        case 'star': {
          const star = new Star(this, s.x, s.y, 'pickup-star-painted');
          this.stars.push(star);
          this.starsGroup.add(star.sprite);
          break;
        }
        case 'hint': {
          const globe = new HintGlobe(this, s.x, s.y, s.hintIdx ?? 0, 'hint-globe-painted');
          this.globes.push(globe);
          break;
        }
        case 'powerup':
          this.add.image(s.x, s.y, 'pickup-powerup-painted').setDisplaySize(40, 40);
          break;
        case 'trampoline':
          this.trampolines.push(new Trampoline(this, s.x, s.y));
          break;
        case 'breakableWall': {
          // Sprint 7D — uses dedicated `tile-wall-cracked-painted` Flux Dev
          // texture. BreakableWall still draws a thin Graphics overlay for
          // saffron-glow tip-spark consistency with the bomb-impact moment.
          const wall = new BreakableWall(this, s.x, s.y, TILE_SIZE, TILE_SIZE, 'tile-wall-cracked-painted');
          this.breakables.push(wall);
          this.platforms.add(wall.sprite);
          break;
        }
        case 'bombPickup': {
          // Sprint 7D — real bomb-pickup texture replaces procedural canvas.
          const pickup = this.physics.add.sprite(s.x, s.y, 'bomb-pickup');
          pickup.setDisplaySize(32, 32);
          const body = pickup.body as Phaser.Physics.Arcade.Body;
          body.setAllowGravity(false).setImmovable(true);
          this.bombPickupsGroup.add(pickup);
          break;
        }
        case 'enemy': {
          if (!s.enemyKind) break;
          const def = ENEMY_DEFS[s.enemyKind];
          const enemy = new Enemy(this, s.x, s.y, def);
          this.enemies.push(enemy);
          this.enemiesGroup.add(enemy.sprite);
          this.bombTargets.push(enemy);
          break;
        }
        default:
          break;
      }
    }
  }

  /** Sprint 6C — Cosmo invokes this via the bomb-hook injected at create(). */
  private spawnBomb(x: number, y: number, facing: 1 | -1): void {
    const bomb = new Bomb(this, x, y, facing, this.uniforms, (b) => this.resolveExplosion(b));
    this.bombsGroup.add(bomb.sprite);
    this.bombs.push(bomb);
  }

  /** Sprint 6C — radius-check enemies + breakable walls on bomb detonation. */
  private resolveExplosion(bomb: Bomb): void {
    const { x: cx, y: cy } = bomb.getCenter();
    const r = BOMB.EXPLOSION_RADIUS;
    const r2 = r * r;
    // Enemies (Sprint 6B registers them via this.bombTargets — empty for now).
    for (const target of this.bombTargets) {
      if (target.dead || !target.vulnerableToBomb) continue;
      const dx = target.sprite.x - cx;
      const dy = target.sprite.y - cy;
      if (dx * dx + dy * dy <= r2) target.onBombHit();
    }
    // Breakable walls — bounding-box overlap (more forgiving than radius).
    for (const wall of this.breakables) {
      const sprite = wall.sprite;
      if (!sprite.active) continue;
      const left = sprite.x;
      const right = sprite.x + sprite.displayWidth;
      const top = sprite.y;
      const bottom = sprite.y + sprite.displayHeight;
      const closestX = Math.max(left, Math.min(cx, right));
      const closestY = Math.max(top, Math.min(cy, bottom));
      const ddx = closestX - cx;
      const ddy = closestY - cy;
      if (ddx * ddx + ddy * ddy <= r2) wall.destroyByExplosion(this);
    }
  }

  /** Sprint 6C — register an enemy as bomb-targetable. Sprint 6B calls this. */
  registerBombTarget(target: BombTarget): void {
    this.bombTargets.push(target);
  }

  // Sprint 7D — `ensureBombPickupTexture` removed; replaced by real
  // `bomb-pickup` Flux Dev asset loaded in preload().

  private addStaticTile(
    x: number,
    y: number,
    w: number,
    h: number,
    key: string,
    group: Phaser.Physics.Arcade.StaticGroup,
  ): void {
    // Painted tiles ship as ~1024-wide PNGs; we want them displayed at 32x32.
    const block = this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h);
    this.physics.add.existing(block, true);
    const body = block.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(w, h, false).setOffset(0, 0);
    body.position.set(x, y);
    body.updateCenter();
    group.add(block);
  }

  private makeTextures(): void {
    const def = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, TILE_SIZE, TILE_SIZE);
      g.destroy();
    };
    // Ground — moss-sage with a brighter grass-band on top, no per-tile box-grid.
    def('tex-ground', (g) => {
      g.fillStyle(COLOR.ground).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0x9DBBA9).fillRect(0, 0, TILE_SIZE, 5);
      g.fillStyle(0xB5D0BD, 0.7).fillRect(0, 0, TILE_SIZE, 2);
      // Tiny variation on grass-edge so tiled rows don't look like a flat ribbon.
      const seed = ((TILE_SIZE * 13) % 11) / 11;
      for (let i = 0; i < 3; i += 1) {
        g.fillStyle(0xB5D0BD, 0.6).fillRect(i * 11 + Math.floor(seed * 4), 4, 2, 2);
      }
      // Soft sub-ground hint near bottom
      g.fillStyle(0x4F6E5C, 0.35).fillRect(0, TILE_SIZE - 3, TILE_SIZE, 3);
    });
    def('tex-dirt', (g) => {
      g.fillStyle(COLOR.dirt).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Subtle horizontal striations — looks like packed earth, not grid cells.
      g.fillStyle(0x3A5145, 0.35).fillRect(0, 6, TILE_SIZE, 1);
      g.fillStyle(0x3A5145, 0.3).fillRect(0, 14, TILE_SIZE, 1);
      g.fillStyle(0x3A5145, 0.4).fillRect(0, 22, TILE_SIZE, 1);
      // Sparse pebbles
      g.fillStyle(0x2A3A30, 0.6).fillCircle(8, 11, 1.5).fillCircle(22, 19, 1).fillCircle(14, 26, 1);
    });
    def('tex-wall', (g) => {
      g.fillStyle(COLOR.wall).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Vertical highlight band at left edge — gives stacked tiles a wood-grain feel.
      g.fillStyle(0x55425F, 0.5).fillRect(2, 0, 2, TILE_SIZE);
      g.fillStyle(0x55425F, 0.3).fillRect(TILE_SIZE - 4, 0, 2, TILE_SIZE);
      // Subtle horizontal accent every ~16px to break monotony when stacked vertically.
      g.fillStyle(0x261A30, 0.45).fillRect(0, 0, TILE_SIZE, 1);
    });
    // Mushroom platform — soft organic top-edge band + faded-rose underglow + ink ragged
    // outline, no dice-pip dots. Designed to read as a single organic strip when tiled
    // horizontally; sides are flush so multi-tile platforms blend into one cap.
    def('tex-mushroom', (g) => {
      // Top band: brighter mushroom-cream, slight saffron warmth
      g.fillStyle(0xF0DCBE).fillRect(0, 0, TILE_SIZE, 8);
      // Body: mushroom-cream
      g.fillStyle(COLOR.mushroom).fillRect(0, 8, TILE_SIZE, TILE_SIZE - 8);
      // Underglow: faded-rose hint at bottom
      g.fillStyle(0xB85C7E, 0.18).fillRect(0, TILE_SIZE - 6, TILE_SIZE, 6);
      // Top-edge highlight (1px)
      g.fillStyle(0xFAEBD0).fillRect(0, 0, TILE_SIZE, 2);
      // Ragged ink outline only top + bottom (sides are flush so tiles merge)
      g.lineStyle(1.2, COLOR.wall, 0.55);
      g.beginPath().moveTo(0, 0.6).lineTo(TILE_SIZE, 0.6).strokePath();
      g.beginPath().moveTo(0, TILE_SIZE - 0.6).lineTo(TILE_SIZE, TILE_SIZE - 0.6).strokePath();
    });
    def('tex-platform', (g) => {
      g.fillStyle(COLOR.platform).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0x4A7058, 0.6).fillRect(0, 0, TILE_SIZE, 5);
      g.lineStyle(1, COLOR.wall, 0.5).strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    });
    def('tex-spike', (g) => {
      g.fillStyle(COLOR.spike).beginPath();
      g.moveTo(0, TILE_SIZE);
      for (let i = 0; i < 4; i += 1) {
        const x1 = (i + 0.5) * (TILE_SIZE / 4);
        g.lineTo(x1, TILE_SIZE * 0.3);
        g.lineTo((i + 1) * (TILE_SIZE / 4), TILE_SIZE);
      }
      g.closePath();
      g.fillPath();
    });
    // Star — saffron core + magenta + lime halo. The "fluo-pop" accent.
    def('star', (g) => {
      g.fillStyle(COLOR.popMagenta, 0.32).fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 14);
      g.fillStyle(COLOR.popLime, 0.32).fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 10);
      g.fillStyle(COLOR.starCore, 1).fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 6);
      g.fillStyle(0xFFF6D6, 1).fillCircle(TILE_SIZE / 2 - 1.5, TILE_SIZE / 2 - 1.5, 2);
    });
    def('hint-globe', (g) => {
      g.fillStyle(COLOR.saffron, 0.35).fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 14);
      g.fillStyle(0x4A6FA5, 0.7).fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 9);
      g.fillStyle(0xCFE2F8, 0.85).fillCircle(TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 2, 3);
    });
    // Cosmo procedural placeholder (same as sandbox).
    def('cosmo-stand', (g) => {
      const w = TILE_SIZE - 4;
      const h = TILE_SIZE + 4;
      g.fillStyle(0x7B9E89, 1).fillRoundedRect(2, 8, w, h - 12, 4);
      g.fillStyle(0x9DBBA9, 1).fillRoundedRect(4, 4, w - 4, 12, 4);
      g.fillStyle(0x3D2E4A, 1).fillCircle(10, 14, 2).fillCircle(18, 14, 2);
      g.fillStyle(0xF4A261, 1).fillCircle(10, 14, 0.8).fillCircle(18, 14, 0.8);
      g.lineStyle(1, 0x3D2E4A, 1).beginPath().moveTo(14, 4).lineTo(14, 0).strokePath();
      g.fillStyle(0xB85C7E, 1).fillCircle(14, 0, 1.5);
      g.lineStyle(1, 0x3D2E4A, 0.7).strokeRoundedRect(2, 4, w, h - 8, 4);
    });
  }

  /** Phaser texture-swap-driven "anim" — switches the sprite texture each frame
   *  by listening to Cosmo's state-machine. Real anim-frames will arrive when
   *  S4 packs the FalSprite output into a sprite-atlas. */
  private makeAnimations(): void {
    // No-op — texture swap is handled in update() per state.
  }

  private buildHUD(): void {
    this.hudText = this.add.text(12, 12, '', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '13px',
      color: '#3D2E4A',
      backgroundColor: 'rgba(245, 237, 216, 0.88)',
      padding: { x: 10, y: 6 },
    }).setScrollFactor(0).setDepth(1000);

    this.hintText = this.add.text(this.scale.width / 2, this.scale.height - 70, '', {
      fontFamily: 'Cormorant Garamond, Georgia, serif',
      fontSize: '22px',
      fontStyle: 'italic',
      color: '#3D2E4A',
      backgroundColor: 'rgba(245, 237, 216, 0.92)',
      padding: { x: 22, y: 12 },
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0);
  }

  private updateHUD(): void {
    const c = this.cosmo;
    const heartsFull = '♥'.repeat(c.hp);
    const heartsEmpty = '♡'.repeat(c.maxHp - c.hp);
    this.hudText.setText([
      `Cosmos · L1 — First Steps · v0.3.0`,
      `${heartsFull}${heartsEmpty}    bombs ${c.bombs}`,
      `★ ${this.starsCollected}    state ${c.state}`,
      ``,
      `← →  move    Space  jump    X  bomb    ↑↓ pan`,
    ].join('\n'));
  }

  private triggerHint(idx: number): void {
    const line = HINT_LINES[idx % HINT_LINES.length];
    sfx.play('globe');
    sfx.voice(line.id);
    this.hintText.setText(line.text);
    this.tweens.add({ targets: this.hintText, alpha: 1, duration: 280, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.hintText, alpha: 0, duration: 600, delay: 4000, ease: 'Cubic.easeIn' });
    this.currentHintTimer = 4.8;
  }
}
