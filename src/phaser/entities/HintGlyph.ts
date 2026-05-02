/**
 * HintGlyph — Sprint 15D.
 *
 * Canvas-drawn floating-arrow + text hint that anchors to a target screen
 * position. Used by the OnboardingDirector to teach the first swipe-up
 * gesture without resorting to a text-tutorial. Pure Phaser primitives —
 * no DOM, no images — so it composites correctly with the post-FX stack.
 *
 * The glyph follows a target {x, y} provider (a function so the host can
 * point it at an obstacle that hasn't spawned yet without circular refs).
 * If the target returns null the glyph parks at screen-centre.
 *
 * Visual:
 *   - Up-pointing chevron-arrow drawn with three line segments + a fill
 *     wedge. Saffron-glow stroke, mushroom-cream fill (low alpha).
 *   - Small italic label "veeg omhoog" in Cormorant-Garamond below the
 *     arrow. Same palette as the boot-overlay sub-text for visual rhyme.
 *   - Idle: gentle bob (sin) + breath-pulse (alpha 0.7..1.0 @ 1.5Hz).
 *   - intensify(): scales 1.0→1.2→1.0 + alpha cycles harder (0.7..1.0 @ 3Hz).
 *
 * Lifecycle:
 *   const hint = new HintGlyph(scene, () => obstacle.getScreenPos());
 *   hint.show();      // fade-in 400ms
 *   …player swipes…
 *   hint.hide(400);   // fade-out, then auto-disposes.
 */
import Phaser from 'phaser';

const COLOR_STROKE = 0xf4a261; // saffron-glow
const COLOR_FILL = 0xf5edd8; // mushroom-cream
const TEXT_COLOR = '#F5EDD8';
const TEXT_FONT = '500 italic 16px "Cormorant Garamond", serif';

export interface TargetProvider {
  (): { x: number; y: number } | null;
}

export class HintGlyph {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private getTarget: TargetProvider;
  private alpha = 0;
  /** Target alpha — driven by show/hide; live alpha lerps toward it. */
  private targetAlpha = 0;
  private timeS = 0;
  private intense = false;
  private fadeDurationS = 0.4;
  private hiding = false;
  private hideT = 0;
  private disposed = false;
  private text: string;

  constructor(scene: Phaser.Scene, target: TargetProvider, text = 'veeg omhoog') {
    this.scene = scene;
    this.getTarget = target;
    this.text = text;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(40); // above gameplay, below boot-overlay
    this.label = scene.add.text(0, 0, text, {
      fontFamily: '"Cormorant Garamond", serif',
      fontSize: '16px',
      fontStyle: 'italic',
      color: TEXT_COLOR,
    });
    this.label.setOrigin(0.5, 0);
    this.label.setDepth(41);
    this.label.setAlpha(0);
    this.gfx.setVisible(false);
    this.label.setVisible(false);
    // Stash the font for the canvas (text uses Phaser's text-renderer; the
    // arrow uses Graphics so no font needed there).
    void TEXT_FONT;
  }

  /** Fade-in 400ms. Idempotent. */
  show(): void {
    if (this.disposed) return;
    this.gfx.setVisible(true);
    this.label.setVisible(true);
    this.targetAlpha = 1;
    this.hiding = false;
    this.hideT = 0;
  }

  /** Fade-out over `durationMs` then auto-dispose. */
  hide(durationMs = 400): void {
    if (this.disposed || this.hiding) return;
    this.hiding = true;
    this.fadeDurationS = Math.max(0.1, durationMs / 1000);
    this.hideT = 0;
    this.targetAlpha = 0;
  }

  /** Pulse harder — used when no-input timeout hits. */
  intensify(): void {
    this.intense = true;
  }

  /** Per-frame redraw. Cheap — single Graphics + text-position update. */
  update(dt: number): void {
    if (this.disposed) return;
    this.timeS += dt;

    if (this.hiding) {
      this.hideT += dt;
      const t = Math.min(1, this.hideT / this.fadeDurationS);
      this.alpha = (1 - t);
      if (t >= 1) {
        this.dispose();
        return;
      }
    } else {
      // Lerp toward targetAlpha (fade-in 400ms).
      const fadeIn = 1 / Math.max(0.05, this.fadeDurationS);
      this.alpha = Math.min(this.targetAlpha, this.alpha + dt * fadeIn);
    }
    this.draw();
  }

  isActive(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gfx.destroy();
    this.label.destroy();
  }

  // ───────────────────────────────────────────────────────────────────────

  private draw(): void {
    const target = this.getTarget();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    let cx = target?.x ?? w / 2;
    let cy = target?.y ?? h * 0.55;

    // Park position: float ABOVE the target so the arrow points up at it.
    const bobOffset = Math.sin(this.timeS * 1.6) * 6;
    const arrowAnchorY = cy - 70 + bobOffset;

    // Pulse — alpha + scale.
    const pulseHz = this.intense ? 3 : 1.5;
    const breath = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin(this.timeS * pulseHz * Math.PI * 2));
    const scaleBase = 1.0;
    const scaleAmp = this.intense ? 0.2 : 0.06;
    const scale = scaleBase + scaleAmp * (0.5 + 0.5 * Math.sin(this.timeS * pulseHz * Math.PI * 2));

    const finalAlpha = this.alpha * breath;
    if (finalAlpha <= 0.01) {
      this.gfx.clear();
      this.label.setAlpha(0);
      return;
    }

    // Draw chevron-arrow: ▲ shape, point-up. Approximate with a triangle
    // outline + faint inner fill.
    const g = this.gfx;
    g.clear();

    const armW = 22 * scale;
    const armH = 28 * scale;
    const tipX = cx;
    const tipY = arrowAnchorY - armH * 0.5;
    const lX = cx - armW;
    const lY = arrowAnchorY + armH * 0.4;
    const rX = cx + armW;
    const rY = arrowAnchorY + armH * 0.4;

    // Inner fill wedge — soft mushroom-cream, very low alpha.
    g.fillStyle(COLOR_FILL, finalAlpha * 0.18);
    g.beginPath();
    g.moveTo(tipX, tipY);
    g.lineTo(lX, lY);
    g.lineTo(rX, rY);
    g.closePath();
    g.fillPath();

    // Outer stroke — saffron-glow chevron.
    g.lineStyle(3, COLOR_STROKE, finalAlpha);
    g.beginPath();
    g.moveTo(lX, lY);
    g.lineTo(tipX, tipY);
    g.lineTo(rX, rY);
    g.strokePath();

    // Optional: short tail-line under the chevron — reads as "swipe-from-here".
    g.lineStyle(2, COLOR_STROKE, finalAlpha * 0.55);
    g.beginPath();
    g.moveTo(cx, arrowAnchorY + armH * 0.6);
    g.lineTo(cx, arrowAnchorY + armH * 1.0);
    g.strokePath();

    // Label — anchored under the chevron.
    this.label.setText(this.text);
    this.label.setPosition(cx, arrowAnchorY + armH * 1.1);
    this.label.setAlpha(finalAlpha);
    this.label.setScale(scale);
  }
}
