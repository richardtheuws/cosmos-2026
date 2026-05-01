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

  create(): void {
    this.makeTextures();
    this.worldW = L1_GRID[0].length * TILE_SIZE;
    this.worldH = L1_GRID.length * TILE_SIZE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.starsGroup = this.physics.add.group();

    this.populateLevel();

    this.cosmo = new Cosmo(this, this.cosmoSpawn.x, this.cosmoSpawn.y, 'cosmo-stand');
    this.physics.add.collider(this.cosmo.sprite, this.platforms);
    this.physics.add.overlap(this.cosmo.sprite, this.starsGroup, (_player, starSprite) => {
      const star = (starSprite as Phaser.Physics.Arcade.Sprite).getData('star') as Star | undefined;
      if (star && !star.collected) {
        star.collect(this);
        sfx.play('starPickup');
        this.starsCollected += 1;
      }
    });
    this.physics.add.overlap(this.cosmo.sprite, this.hazards, () => {
      if (this.cosmo.takeDamage()) sfx.play('hurt');
    });

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.cosmo.sprite, true, 0.12, 0.14);

    this.makeAnimations();
    this.buildHUD();
  }

  override update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.cosmo.update(this.inputCtl, dt, this.uniforms);

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
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-ground', this.platforms);
          break;
        case 'dirt':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-dirt', this.platforms);
          break;
        case 'wall':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-wall', this.platforms);
          break;
        case 'mushroom':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-mushroom', this.platforms);
          break;
        case 'platform':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-platform', this.platforms);
          break;
        case 'spike':
          this.addStaticTile(s.x, s.y, TILE_SIZE, TILE_SIZE, 'tex-spike', this.hazards);
          break;
        case 'star': {
          const star = new Star(this, s.x, s.y);
          this.stars.push(star);
          this.starsGroup.add(star.sprite);
          break;
        }
        case 'hint': {
          const globe = new HintGlobe(this, s.x, s.y, s.hintIdx ?? 0);
          this.globes.push(globe);
          break;
        }
        case 'powerup':
          // Visual placeholder until proper powerup-class lands.
          this.add.image(s.x, s.y, 'tex-mushroom').setScale(0.7).setTint(0xFFFFFF);
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
    const block = this.add.image(x, y, key).setOrigin(0, 0);
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
    // Ground — moss-sage with a darker top-edge highlight.
    def('tex-ground', (g) => {
      g.fillStyle(COLOR.ground).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0x9DBBA9).fillRect(0, 0, TILE_SIZE, 4);
      g.lineStyle(1, COLOR.wall, 0.35).strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    });
    def('tex-dirt', (g) => {
      g.fillStyle(COLOR.dirt).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Speckles
      g.fillStyle(0x3A5145, 0.5);
      for (let i = 0; i < 6; i += 1) g.fillCircle(Math.random() * TILE_SIZE, Math.random() * TILE_SIZE, 1);
      g.lineStyle(1, COLOR.wall, 0.3).strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    });
    def('tex-wall', (g) => {
      g.fillStyle(COLOR.wall).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0x55425F, 0.4).fillRect(0, 0, 4, TILE_SIZE);
      g.fillStyle(0x55425F, 0.4).fillRect(TILE_SIZE - 4, 0, 4, TILE_SIZE);
      g.lineStyle(1, 0x261A30, 0.7).strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    });
    def('tex-mushroom', (g) => {
      g.fillStyle(COLOR.mushroom).fillRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, 8);
      g.fillStyle(0xB85C7E, 0.45).fillCircle(8, 10, 3);
      g.fillStyle(0xB85C7E, 0.45).fillCircle(22, 18, 4);
      g.fillStyle(0xB85C7E, 0.45).fillCircle(15, 24, 2);
      g.lineStyle(1.5, COLOR.wall, 0.6).strokeRoundedRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1, 8);
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

  /** Phaser sprite-anims sit waiting for the FalSprite-derived atlas in S4. For
   *  now they're no-ops so the controller's `playStateAnim()` doesn't error. */
  private makeAnimations(): void {
    // Intentionally empty in S3 — the procedural cosmo-stand texture has 1 frame
    // and `Cosmo.playStateAnim()` already gracefully no-ops when the anim doesn't
    // exist (see Cosmo.ts).
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
