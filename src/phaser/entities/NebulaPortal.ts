/**
 * NebulaPortal — Sprint 15D.
 *
 * Canvas-drawn animated portal at screen-centre. Concentric rings expand
 * outward with a saffron→ink-aubergine→faded-rose gradient sweep. Pure
 * Phaser Graphics — no shader, no Three.js plane — so it renders correctly
 * regardless of 15A's GLB load-state. Cheap, dispose-clean, mobile-friendly.
 *
 * Visual recipe (matches the locked palette in PRD §5):
 *   - 6 concentric rings, radius eased outward over `durationMs`.
 *   - Inner rings: saffron-glow (#F4A261) high alpha, hot core.
 *   - Mid rings:   faded-rose (#D8A4B5) mid alpha.
 *   - Outer rings: ink-aubergine (#3D2E4A) low alpha, dissolves into bg.
 *   - Subtle rotation + per-ring breath so it doesn't read as a
 *     mechanical bullseye. Cosmic, organic, just a touch unsettling.
 *
 * Lifecycle:
 *   const portal = new NebulaPortal(scene);
 *   portal.open(1500);   // expand over 1.5s
 *   …after Cosmo arrives…
 *   portal.close(800);   // fade-out 0.8s, then auto-dispose.
 *
 * The portal owns its own Graphics + per-frame draw loop; the host scene
 * just calls update(dt). It registers nothing on the scene event-bus, so a
 * scene shutdown that forgets to dispose() leaks at most one Graphics —
 * but we pre-empt that by listening to SHUTDOWN ourselves.
 */
import Phaser from 'phaser';

const RING_COUNT = 6;
/** Saffron / faded-rose / ink-aubergine palette (PRD §5). */
const COLOR_INNER = 0xf4a261;
const COLOR_MID = 0xd8a4b5;
const COLOR_OUTER = 0x3d2e4a;

export class NebulaPortal {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private centreX = 0;
  private centreY = 0;
  /** 0 = closed, 1 = fully open. Drives ring radii + alphas. */
  private openProgress = 0;
  /** 1 = fully drawn, 0 = invisible. Independent of openProgress so close()
   *  can fade without rewinding the open animation. */
  private alpha = 0;
  private openDurationS = 1.5;
  private closing = false;
  private closeDurationS = 0.8;
  private closeT = 0;
  private offShutdown: (() => void) | null = null;
  private disposed = false;
  /** Wall-time accumulator used for breath + rotation. */
  private timeS = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(50); // above gameplay (BeatTarget=8) but below boot-overlay
    this.gfx.setVisible(false);
    this.recentre();

    const onResize = (): void => this.recentre();
    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    const onShutdown = (): void => this.dispose();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);
    this.offShutdown = (): void => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    };
  }

  /** Begin open-animation; ring radii expand from 0 to maxRadius over ms. */
  open(durationMs: number): void {
    if (this.disposed) return;
    this.openDurationS = Math.max(0.1, durationMs / 1000);
    this.openProgress = 0;
    this.alpha = 1;
    this.closing = false;
    this.closeT = 0;
    this.gfx.setVisible(true);
  }

  /** Begin close-animation; gfx fades over ms, then auto-disposes. */
  close(durationMs: number): void {
    if (this.disposed || this.closing) return;
    this.closing = true;
    this.closeDurationS = Math.max(0.1, durationMs / 1000);
    this.closeT = 0;
  }

  /** Per-frame update — drives the easing + breath + redraw. */
  update(dt: number): void {
    if (this.disposed) return;
    this.timeS += dt;

    if (!this.closing) {
      this.openProgress = Math.min(1, this.openProgress + dt / this.openDurationS);
    } else {
      this.closeT += dt;
      const t = Math.min(1, this.closeT / this.closeDurationS);
      this.alpha = 1 - t;
      if (t >= 1) {
        this.dispose();
        return;
      }
    }
    this.draw();
  }

  /** True until close() has run its full fade-out. */
  isActive(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gfx.destroy();
    this.offShutdown?.();
    this.offShutdown = null;
  }

  // ───────────────────────────────────────────────────────────────────────

  private recentre(): void {
    this.centreX = this.scene.scale.width / 2;
    this.centreY = this.scene.scale.height / 2;
  }

  private draw(): void {
    if (this.disposed) return;
    const g = this.gfx;
    g.clear();

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const maxR = Math.min(w, h) * 0.55;
    // Ease-out-cubic on openProgress so the burst peaks early then settles.
    const eased = 1 - Math.pow(1 - this.openProgress, 3);
    const rotation = this.timeS * 0.25; // slow drift, not strobe-y

    for (let i = 0; i < RING_COUNT; i++) {
      const ringFraction = (i + 1) / RING_COUNT; // 0.16..1.0
      // Per-ring breath at slightly different phases — cosmic, not robotic.
      const breath = 0.06 * Math.sin(this.timeS * 1.3 + i * 0.7);
      const radius = maxR * ringFraction * (eased + breath);
      if (radius < 1) continue;

      // Pick palette by depth. Inner = saffron, outer = ink-aubergine.
      let color: number;
      let baseAlpha: number;
      if (i < 2) {
        color = COLOR_INNER;
        baseAlpha = 0.85;
      } else if (i < 4) {
        color = COLOR_MID;
        baseAlpha = 0.55;
      } else {
        color = COLOR_OUTER;
        baseAlpha = 0.35;
      }
      const alpha = baseAlpha * this.alpha * eased;
      // Stroke lineWidth tapers outward so rings don't all read at the
      // same weight — gives the bloom a depth feel without a real shader.
      const lineWidth = 4 - i * 0.5;
      g.lineStyle(Math.max(1, lineWidth), color, alpha);

      // Slight per-ring offset (rotation eccentricity) — gives an organic
      // wobble rather than a perfect bullseye. Subtle: ±2% radius.
      const dx = Math.cos(rotation + i * 1.1) * radius * 0.02;
      const dy = Math.sin(rotation + i * 1.1) * radius * 0.02;
      g.strokeCircle(this.centreX + dx, this.centreY + dy, radius);
    }

    // Hot core — saffron-filled disk for the first 25% of the open and
    // shrinks as the rings expand. Sells the "portal opens" sensation.
    if (eased < 0.6) {
      const coreR = maxR * 0.18 * (1 - eased) * (1 - eased);
      const coreAlpha = 0.7 * this.alpha * (1 - eased);
      g.fillStyle(COLOR_INNER, coreAlpha);
      g.fillCircle(this.centreX, this.centreY, Math.max(0.5, coreR));
    }
  }
}
