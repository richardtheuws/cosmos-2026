/**
 * touchOverlay.ts — Sprint 7B mobile/touch controls.
 *
 * Architecture
 * ------------
 *   Single root <div> with `position:fixed` covering the viewport. Inside it,
 *   four discrete pointer-target buttons painted on per-button <canvas> elements
 *   so we can use canvas-drawn primitives (cosmic-watercolor strokes, soft fills,
 *   saffron glow on press) — NO emoji, NO unicode icons.
 *
 *   Hit detection uses Pointer Events (multi-touch capable: pointerId tracking).
 *   Each pointer that goes down on a button locks to that button until pointerup
 *   or pointercancel — so dragging from d-pad to jump doesn't double-fire.
 *
 *   The overlay forwards state into InputController.setVirtualInput() — keyboard
 *   stays untouched and is OR'd in by the controller's merge logic.
 *
 * Layout (portrait + landscape)
 * -----------------------------
 *   - Left thumb-zone (24px from left, 24px from bottom):
 *       LEFT button  80x80
 *       RIGHT button 80x80   gap 12
 *   - Right thumb-zone (24px from right, 24px from bottom):
 *       BOMB button  80x80   gap 12 (sits to the LEFT of jump)
 *       JUMP button 100x100  primary action, larger
 *
 *   Buttons re-layout on window resize. We don't change CSS — we redraw each
 *   button canvas to the new logical size based on devicePixelRatio.
 *
 * Visual language
 * ---------------
 *   - Idle:    mushroom-cream fill (alpha 0.35), faded-rose stroke (alpha 0.65)
 *   - Pressed: saffron-glow fill (alpha 0.55), saffron-glow stroke + outer halo
 *   - Symbols: triangle / chevron / circle drawn with arc/lineTo only.
 */

import type { InputController } from '../core/inputController';
import { isTouchDevice } from '../core/deviceDetect';

type Action = 'left' | 'right' | 'jump' | 'bomb';

interface ButtonSpec {
  action: Action;
  size: number;
  /** Drawn glyph type. */
  glyph: 'arrow-left' | 'arrow-right' | 'arrow-up' | 'circle';
}

const BUTTONS: ButtonSpec[] = [
  { action: 'left', size: 80, glyph: 'arrow-left' },
  { action: 'right', size: 80, glyph: 'arrow-right' },
  { action: 'bomb', size: 80, glyph: 'circle' },
  { action: 'jump', size: 100, glyph: 'arrow-up' },
];

const COLOR = {
  paper: 'rgba(232, 213, 183, 0.35)', // mushroom-cream @ 35%
  paperPressed: 'rgba(244, 162, 97, 0.55)', // saffron-glow @ 55%
  stroke: 'rgba(184, 92, 126, 0.65)', // faded-rose @ 65%
  strokePressed: 'rgba(244, 162, 97, 0.95)', // saffron-glow
  glyph: 'rgba(61, 46, 74, 0.85)', // ink-aubergine
  glyphPressed: 'rgba(61, 46, 74, 1.0)',
  haloPressed: 'rgba(244, 162, 97, 0.45)',
} as const;

interface ActiveButton {
  spec: ButtonSpec;
  el: HTMLCanvasElement;
  pressed: boolean;
  /** pointerId currently holding this button down, or null. */
  pointerId: number | null;
}

export class TouchOverlay {
  private input: InputController;
  private root: HTMLDivElement | null = null;
  private buttons = new Map<Action, ActiveButton>();
  private resizeBound = (): void => this.layout();
  private active = false;

  constructor(input: InputController) {
    this.input = input;
  }

  /** Attach overlay only if the device should see it. Idempotent. */
  attachIfTouchDevice(): boolean {
    if (this.active) return true;
    if (!isTouchDevice()) return false;
    this.attach();
    return true;
  }

  private attach(): void {
    const root = document.createElement('div');
    root.id = 'touch-overlay';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Touch controls');
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '50',
      // iOS safe-area inset support (viewport-fit=cover)
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      userSelect: 'none',
      webkitUserSelect: 'none',
      // @ts-expect-error — vendor-prefixed iOS-only prop, not in lib.dom typings.
      WebkitTouchCallout: 'none',
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    for (const spec of BUTTONS) {
      const el = document.createElement('canvas');
      el.dataset.action = spec.action;
      el.setAttribute('aria-label', spec.action);
      el.setAttribute('role', 'button');
      Object.assign(el.style, {
        position: 'absolute',
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>);
      // Block default browser gestures on these buttons.
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointermove', this.onPointerMove);
      el.addEventListener('pointerup', this.onPointerUp);
      el.addEventListener('pointercancel', this.onPointerUp);
      el.addEventListener('pointerleave', this.onPointerLeave);
      root.appendChild(el);
      this.buttons.set(spec.action, { spec, el, pressed: false, pointerId: null });
    }

    document.body.appendChild(root);
    this.root = root;
    this.active = true;
    window.addEventListener('resize', this.resizeBound);
    window.addEventListener('orientationchange', this.resizeBound);
    this.layout();
  }

  detach(): void {
    if (!this.active) return;
    window.removeEventListener('resize', this.resizeBound);
    window.removeEventListener('orientationchange', this.resizeBound);
    this.root?.remove();
    this.root = null;
    this.buttons.clear();
    this.active = false;
  }

  /** Re-position + redraw each button. Called on resize/orientation. */
  private layout(): void {
    if (!this.root) return;
    const margin = 24;
    const gap = 12;
    const left = this.buttons.get('left');
    const right = this.buttons.get('right');
    const bomb = this.buttons.get('bomb');
    const jump = this.buttons.get('jump');
    if (!left || !right || !bomb || !jump) return;

    // Left thumb-zone: [LEFT][gap][RIGHT] anchored bottom-left.
    this.placeButton(left, margin, this.bottomY(left.spec.size, margin));
    this.placeButton(
      right,
      margin + left.spec.size + gap,
      this.bottomY(right.spec.size, margin),
    );

    // Right thumb-zone: [BOMB][gap][JUMP] anchored bottom-right.
    const jumpX = window.innerWidth - margin - jump.spec.size;
    this.placeButton(jump, jumpX, this.bottomY(jump.spec.size, margin));
    const bombX = jumpX - gap - bomb.spec.size;
    // Bomb sits a hair higher so it doesn't fight jump's larger hit-box.
    this.placeButton(
      bomb,
      bombX,
      this.bottomY(bomb.spec.size, margin) - 8,
    );

    for (const btn of this.buttons.values()) this.draw(btn);
  }

  private bottomY(size: number, margin: number): number {
    return window.innerHeight - margin - size;
  }

  private placeButton(btn: ActiveButton, x: number, y: number): void {
    const el = btn.el;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${btn.spec.size}px`;
    el.style.height = `${btn.spec.size}px`;
    el.width = btn.spec.size * dpr;
    el.height = btn.spec.size * dpr;
  }

  private draw(btn: ActiveButton): void {
    const ctx = btn.el.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = btn.spec.size;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, s, s);

    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2 - 6;

    // Outer halo when pressed
    if (btn.pressed) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.haloPressed;
      ctx.fill();
    }

    // Body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = btn.pressed ? COLOR.paperPressed : COLOR.paper;
    ctx.fill();

    // Stroke (cosmic-watercolor style — slightly soft)
    ctx.lineWidth = btn.pressed ? 3 : 2;
    ctx.strokeStyle = btn.pressed ? COLOR.strokePressed : COLOR.stroke;
    ctx.stroke();

    // Glyph
    ctx.fillStyle = btn.pressed ? COLOR.glyphPressed : COLOR.glyph;
    ctx.strokeStyle = btn.pressed ? COLOR.glyphPressed : COLOR.glyph;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawGlyph(ctx, btn.spec.glyph, cx, cy, s);

    ctx.restore();
  }

  private drawGlyph(
    ctx: CanvasRenderingContext2D,
    glyph: ButtonSpec['glyph'],
    cx: number,
    cy: number,
    s: number,
  ): void {
    const a = s * 0.18; // arrow half-width
    switch (glyph) {
      case 'arrow-left': {
        ctx.beginPath();
        ctx.moveTo(cx + a * 0.8, cy - a);
        ctx.lineTo(cx - a * 0.8, cy);
        ctx.lineTo(cx + a * 0.8, cy + a);
        ctx.stroke();
        break;
      }
      case 'arrow-right': {
        ctx.beginPath();
        ctx.moveTo(cx - a * 0.8, cy - a);
        ctx.lineTo(cx + a * 0.8, cy);
        ctx.lineTo(cx - a * 0.8, cy + a);
        ctx.stroke();
        break;
      }
      case 'arrow-up': {
        ctx.beginPath();
        ctx.moveTo(cx - a, cy + a * 0.6);
        ctx.lineTo(cx, cy - a * 0.9);
        ctx.lineTo(cx + a, cy + a * 0.6);
        ctx.stroke();
        break;
      }
      case 'circle': {
        // Bomb glyph: filled inner disk + thin offset highlight ring (saffron).
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + s * 0.05, cy - s * 0.06, s * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 162, 97, 0.85)';
        ctx.fill();
        break;
      }
    }
  }

  // ---- Pointer handling ----

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    const target = e.currentTarget as HTMLCanvasElement;
    const action = target.dataset.action as Action | undefined;
    if (!action) return;
    const btn = this.buttons.get(action);
    if (!btn) return;
    btn.pointerId = e.pointerId;
    btn.pressed = true;
    target.setPointerCapture?.(e.pointerId);
    this.draw(btn);
    this.pushVirtualState();
  };

  private onPointerMove = (e: PointerEvent): void => {
    // We only care to keep the visual in sync if the pointer is captured.
    // No state change here — pointercapture guarantees up/cancel fires on the same el.
    e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    const target = e.currentTarget as HTMLCanvasElement;
    const action = target.dataset.action as Action | undefined;
    if (!action) return;
    const btn = this.buttons.get(action);
    if (!btn) return;
    if (btn.pointerId === e.pointerId || btn.pointerId === null) {
      btn.pointerId = null;
      btn.pressed = false;
      this.draw(btn);
      this.pushVirtualState();
    }
  };

  /** If the pointer slides off the button without a proper up, treat as release.
   *  This is gentler than waiting for pointercancel. */
  private onPointerLeave = (e: PointerEvent): void => {
    const target = e.currentTarget as HTMLCanvasElement;
    const action = target.dataset.action as Action | undefined;
    if (!action) return;
    const btn = this.buttons.get(action);
    if (!btn) return;
    if (btn.pointerId === e.pointerId) {
      btn.pointerId = null;
      btn.pressed = false;
      this.draw(btn);
      this.pushVirtualState();
    }
  };

  private pushVirtualState(): void {
    this.input.setVirtualInput({
      left: this.buttons.get('left')?.pressed ?? false,
      right: this.buttons.get('right')?.pressed ?? false,
      jump: this.buttons.get('jump')?.pressed ?? false,
      bomb: this.buttons.get('bomb')?.pressed ?? false,
    });
  }
}
