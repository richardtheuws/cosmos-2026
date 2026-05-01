/**
 * SandboxScene — Sprint 2 test arena. Procedurally generates a small platforming
 * playground with enough verticals to exercise the wallcling, stomp, and pan
 * mechanics. No tilemap import yet; that lands in Sprint 3 with the real L1.
 */
import Phaser from 'phaser';
import { Cosmo } from '../entities/Cosmo';
import type { InputController } from '../../core/inputController';
import type { GlobalUniforms } from '../../core/globalUniforms';

const TILE = 32;

export class SandboxScene extends Phaser.Scene {
  private cosmo!: Cosmo;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private inputCtl!: InputController;
  private uniforms!: GlobalUniforms;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  init(data: { input: InputController; uniforms: GlobalUniforms }): void {
    this.inputCtl = data.input;
    this.uniforms = data.uniforms;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.physics.world.setBounds(0, 0, W * 2, H);

    this.makeTileTextures();
    this.makeCosmoTexture();

    this.platforms = this.physics.add.staticGroup();
    this.buildPlayground(W, H);

    this.cosmo = new Cosmo(this, 120, H - 240, 'cosmo-stand');
    this.physics.add.collider(this.cosmo.sprite, this.platforms);

    this.cameras.main.startFollow(this.cosmo.sprite, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, W * 2, H);

    this.debugText = this.add.text(12, 12, '', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      color: '#3D2E4A',
      backgroundColor: 'rgba(245, 237, 216, 0.85)',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(1000);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.cosmo.update(this.inputCtl, dt, this.uniforms);
    this.uniforms.cameraX = this.cameras.main.scrollX;
    this.uniforms.cameraY = this.cameras.main.scrollY;
    this.inputCtl.postFrame();

    const c = this.cosmo;
    const b = c.sprite.body as Phaser.Physics.Arcade.Body;
    this.debugText.setText([
      `Cosmo · v0.2.0 sandbox`,
      ``,
      `state    ${c.state}`,
      `facing   ${c.facing > 0 ? 'right →' : '← left'}`,
      `hp       ${c.hp}/${c.maxHp}    iframe ${c.iframe.toFixed(2)}s`,
      `pos      (${c.sprite.x.toFixed(0)}, ${c.sprite.y.toFixed(0)})`,
      `vel      (${b.velocity.x.toFixed(0)}, ${b.velocity.y.toFixed(0)})`,
      `floor=${b.blocked.down ? 'Y' : '·'}  L=${b.blocked.left ? 'Y' : '·'}  R=${b.blocked.right ? 'Y' : '·'}`,
      ``,
      `← →   move      Space  jump`,
      `Hold direction against a wall to cling.`,
      `Jump while clinging to wall-climb.`,
    ].join('\n'));
  }

  private buildPlayground(W: number, H: number): void {
    const groundY = H - TILE;

    // Ground
    this.addBlock(0, groundY, W * 3, TILE, 'tile-ground');

    // Two pillar walls for cling testing
    this.addBlock(420, groundY - TILE * 8, TILE, TILE * 8, 'tile-wall');
    this.addBlock(720, groundY - TILE * 12, TILE, TILE * 12, 'tile-wall');

    // Stair-step platforms
    for (let i = 0; i < 5; i += 1) {
      this.addBlock(900 + i * (TILE * 3), groundY - TILE * (1 + i), TILE * 3, TILE, 'tile-rose');
    }

    // High platform for camera-pan tutorial reveal
    this.addBlock(1300, groundY - TILE * 12, TILE * 6, TILE, 'tile-saffron');

    // Narrow chasm + a small platform across (wallclimb-required gap)
    this.addBlock(1700, groundY - TILE * 8, TILE, TILE * 8, 'tile-wall');
    this.addBlock(1900, groundY - TILE * 8, TILE, TILE * 8, 'tile-wall');
  }

  private addBlock(x: number, y: number, w: number, h: number, key: string): void {
    const block = this.add.tileSprite(x, y, w, h, key).setOrigin(0, 0);
    this.physics.add.existing(block, true);
    const body = block.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(w, h, false).setOffset(0, 0);
    body.position.set(x, y);
    body.updateCenter();
    this.platforms.add(block);
  }

  /** Sprint-2 procedural Cosmo placeholder. Texture matches body bounds 1:1 so physics is honest.
   *  S3 swaps this for the FalSprite-generated walk/jump frames. */
  private makeCosmoTexture(): void {
    if (this.textures.exists('cosmo-stand')) return;
    const w = 28;
    const h = 36;
    const g = this.add.graphics();
    // Body
    g.fillStyle(0x7B9E89, 1).fillRoundedRect(2, 8, w - 4, h - 12, 4);
    // Head highlight
    g.fillStyle(0x9DBBA9, 1).fillRoundedRect(4, 4, w - 8, 12, 4);
    // Eyes
    g.fillStyle(0x3D2E4A, 1).fillCircle(10, 14, 2).fillCircle(18, 14, 2);
    g.fillStyle(0xF4A261, 1).fillCircle(10, 14, 0.8).fillCircle(18, 14, 0.8);
    // Antenna
    g.lineStyle(1, 0x3D2E4A, 1).beginPath().moveTo(14, 4).lineTo(14, 0).strokePath();
    g.fillStyle(0xB85C7E, 1).fillCircle(14, 0, 1.5);
    // Outline
    g.lineStyle(1, 0x3D2E4A, 0.7).strokeRoundedRect(2, 4, w - 4, h - 8, 4);
    g.generateTexture('cosmo-stand', w, h);
    g.destroy();
  }

  /** Procedural color-tile textures so we can use TileSprite (which has reliable static bodies). */
  private makeTileTextures(): void {
    const def = (key: string, color: number): void => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1).fillRect(0, 0, TILE, TILE);
      g.lineStyle(1, 0x3D2E4A, 0.4).strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
      g.generateTexture(key, TILE, TILE);
      g.destroy();
    };
    def('tile-ground', 0x7B9E89);
    def('tile-wall', 0x3D2E4A);
    def('tile-rose', 0xB85C7E);
    def('tile-saffron', 0xF4A261);
  }
}
