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
    // Sprint 4.5 Fase B v2 — Cosmo, enemies, painted tiles, painted pickups.
    // Each sprite is a square painted PNG with transparent BG. We display sprites
    // at 64x64 and align the body to a 28x36 inset (texture-space).
    const v2 = '/assets/sprites/v2';
    this.load.image('cosmo-walk-1', `${v2}/cosmo-walk-1-cleaned.png`);
    this.load.image('cosmo-walk-2', `${v2}/cosmo-walk-2-cleaned.png`);
    this.load.image('cosmo-walk-3', `${v2}/cosmo-walk-3-cleaned.png`);
    this.load.image('cosmo-jump-up', `${v2}/cosmo-jump-up-cleaned.png`);
    this.load.image('cosmo-jump-fall', `${v2}/cosmo-jump-fall-cleaned.png`);
    this.load.image('cosmo-cling', `${v2}/cosmo-cling-cleaned.png`);

    this.load.image('enemy-brumberry', `${v2}/enemy-brumberry-cleaned.png`);
    this.load.image('enemy-hopper', `${v2}/enemy-hopper-cabbage-cleaned.png`);
    this.load.image('enemy-eye-plant', `${v2}/enemy-eye-plant-cleaned.png`);

    // Painted tiles — replace procedural Graphics in S5 wiring.
    this.load.image('tile-ground-painted', '/assets/tiles/tile-ground-cleaned.png');
    this.load.image('tile-dirt-painted', '/assets/tiles/tile-dirt.png');
    this.load.image('tile-wall-painted', '/assets/tiles/tile-wall-cleaned.png');
    this.load.image('tile-mushroom-painted', '/assets/tiles/tile-mushroom-cleaned.png');
    this.load.image('tile-spike-painted', '/assets/tiles/tile-spike-cleaned.png');

    // Painted pickups
    this.load.image('pickup-star-painted', '/assets/pickups/pickup-star-cleaned.png');
    this.load.image('pickup-powerup-painted', '/assets/pickups/pickup-powerup-cleaned.png');
    this.load.image('pickup-cheeseburger-painted', '/assets/pickups/pickup-cheeseburger-cleaned.png');
    this.load.image('hint-globe-painted', '/assets/pickups/hint-globe-cleaned.png');
  }

  create(): void {
    this.makeTextures();
    this.worldW = L1_GRID[0].length * TILE_SIZE;
    this.worldH = L1_GRID.length * TILE_SIZE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.starsGroup = this.physics.add.group();

    this.populateLevel();

    this.cosmo = new Cosmo(this, this.cosmoSpawn.x, this.cosmoSpawn.y, 'cosmo-walk-2');
    // Cosmo painted PNGs are ~1024x1024. Display at 80x80, body sized to where the
    // character actually sits in the texture (centered slim figure).
    this.cosmo.sprite.setDisplaySize(80, 80);
    const body = this.cosmo.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(180, 380, false).setOffset(420, 360);
    this.physics.add.collider(this.cosmo.sprite, this.platforms);
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

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.cosmo.sprite, true, 0.12, 0.14);

    this.makeAnimations();
    this.buildHUD();
  }

  override update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.cosmo.update(this.inputCtl, dt, this.uniforms);
    this.swapCosmoTexture(time);

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
        default:
          break;
      }
    }
  }

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
      `${heartsFull}${heartsEmpty}    ${c.bombs ? `bombs ${c.bombs}` : ''}`,
      `★ ${this.starsCollected}    state ${c.state}`,
      ``,
      `← →  move    Space  jump    ↑↓ pan`,
    ].join('\n'));
  }

  /** Swap the sprite texture each frame based on Cosmo's state. Walk-cycle
   *  alternates between walk-1/2/3 every 110ms; other states are static frames. */
  private swapCosmoTexture(time: number): void {
    const sprite = this.cosmo.sprite;
    let key: string;
    switch (this.cosmo.state) {
      case 'run': {
        const phase = Math.floor(time / 110) % 4;
        const order = ['cosmo-walk-2', 'cosmo-walk-1', 'cosmo-walk-2', 'cosmo-walk-3'];
        key = order[phase];
        break;
      }
      case 'jump':
        key = 'cosmo-jump-up';
        break;
      case 'fall':
        key = 'cosmo-jump-fall';
        break;
      case 'cling':
        key = 'cosmo-cling';
        break;
      default:
        key = 'cosmo-walk-2';
    }
    if (sprite.texture.key !== key) sprite.setTexture(key);
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
