/**
 * HudOverlay.ts — Sprint 11B HUD redesign.
 *
 * Architectuur
 * ------------
 *   We renderen de HUD als pure HTML/CSS pills bovenop de Phaser canvas, met
 *   een kleine extra **<canvas>**-laag binnen de game-info pill voor de
 *   watercolor heart/bomb/star primitives. Geen Phaser RenderTexture — die
 *   zou geen `backdrop-filter: blur(20px)` (CSS-pixelpipe) kunnen toepassen
 *   en zou ook niet mooi op devicePixelRatio uitkomen.
 *
 *   Drie pills:
 *     1) Top-left "game-info pill"  → label · hearts-canvas · bomb · star · state
 *     2) Top-right "nav pill"       → bestaande nav (Home / Verhaal / Updates / Steun)
 *                                     + version-block. Wordt grotendeels in HTML
 *                                     verzorgd; deze klasse zorgt alleen dat de
 *                                     class-hooks correct gestyled zijn.
 *     3) Bottom-center "controls-hint" → ← → move · Space jump · X bomb · ↑↓ pan,
 *                                     auto-hide na 8s, re-toon op keypress.
 *
 *   De gebruiker injecteert state via `update({ hp, maxHp, bombs, stars, state,
 *   levelLabel, version })`. Idle redraw skipt: alleen redraw wanneer relevante
 *   waarden zijn veranderd.
 *
 * Visual language
 * ---------------
 *   - Hartjes: filled = saffron-glow (#F4A261) met faded-rose halo (#B85C7E),
 *             outline-stroke ink-aubergine (#3D2E4A) 1.5px, watercolor-blob
 *             gemaakt uit twee bezier-arcs + cleft-notch bovenaan.
 *   - Bomb: zwarte sphere (ink-aubergine) met saffron-glow fuse-spark.
 *   - Star: 5-puntig saffron-glow met faded-rose stroke.
 *   - Pill: rgba(20,16,26,0.55) + backdrop-blur(20px) + 1px stroke
 *           rgba(244,162,97,0.3), border-radius 18px.
 *
 * Responsive
 * ----------
 *   - <600px: pill padding 10/8, fonts -2px, hartjes 14x14, controls-hint hidden
 *             (de touch-overlay heeft eigen guidance, dus dubbele instructies
 *             vermeden).
 */

const SIZES = {
  desktop: { heart: 18, icon: 24, gap: 6 },
  mobile: { heart: 14, icon: 20, gap: 4 },
} as const;

const COLOR = {
  saffron: '#F4A261',
  saffronSoft: 'rgba(244, 162, 97, 0.55)',
  rose: '#B85C7E',
  roseHalo: 'rgba(184, 92, 126, 0.45)',
  ink: '#3D2E4A',
  inkSoft: 'rgba(61, 46, 74, 0.6)',
  cream: '#E8D5B7',
  starHalo: 'rgba(244, 162, 97, 0.35)',
} as const;

export interface HudState {
  hp: number;
  maxHp: number;
  bombs: number;
  stars: number;
  state: string;
  levelLabel: string;
  version: string;
}

interface CachedState {
  hp: number;
  maxHp: number;
  bombs: number;
  stars: number;
  state: string;
  levelLabel: string;
  isMobile: boolean;
}

export class HudOverlay {
  /** Container div for the top-left game-info pill. */
  private gameInfoPill: HTMLDivElement | null = null;
  /** Inner canvas for the heart-row primitives (live-updating). */
  private iconCanvas: HTMLCanvasElement | null = null;
  /** Tiny once-rendered canvases for the bomb + star icons (count-pair). */
  private bombIconCanvas: HTMLCanvasElement | null = null;
  private starIconCanvas: HTMLCanvasElement | null = null;
  /** Live <span>s for label + bombs/stars counts + state text. */
  private labelEl: HTMLSpanElement | null = null;
  private bombsCountEl: HTMLSpanElement | null = null;
  private starsCountEl: HTMLSpanElement | null = null;
  private stateEl: HTMLSpanElement | null = null;
  /** Bottom-center controls hint pill. */
  private controlsHint: HTMLDivElement | null = null;
  /** Re-show timer on keypress. */
  private hintFadeTimer: number | null = null;
  /** Last-seen state for change detection (avoid redraw thrash). */
  private cached: CachedState = {
    hp: -1,
    maxHp: -1,
    bombs: -1,
    stars: -1,
    state: '',
    levelLabel: '',
    isMobile: false,
  };
  private resizeBound = (): void => this.onResize();
  private keyBound = (e: KeyboardEvent): void => this.onKeydown(e);
  private active = false;

  attach(): void {
    if (this.active) return;
    this.buildGameInfoPill();
    this.buildControlsHint();
    window.addEventListener('resize', this.resizeBound);
    window.addEventListener('keydown', this.keyBound);
    this.active = true;
    // Initial fade-in for controls-hint, then auto-hide after 8s.
    this.scheduleHintHide(8000);
  }

  detach(): void {
    if (!this.active) return;
    window.removeEventListener('resize', this.resizeBound);
    window.removeEventListener('keydown', this.keyBound);
    if (this.hintFadeTimer !== null) {
      window.clearTimeout(this.hintFadeTimer);
      this.hintFadeTimer = null;
    }
    this.gameInfoPill?.remove();
    this.controlsHint?.remove();
    this.gameInfoPill = null;
    this.controlsHint = null;
    this.iconCanvas = null;
    this.bombIconCanvas = null;
    this.starIconCanvas = null;
    this.labelEl = null;
    this.bombsCountEl = null;
    this.starsCountEl = null;
    this.stateEl = null;
    this.active = false;
  }

  /** Push live state from the scene. Cheap: only redraws when something changed. */
  update(s: HudState): void {
    if (!this.active) return;
    const isMobile = window.innerWidth < 600;
    const labelChanged =
      s.levelLabel !== this.cached.levelLabel || isMobile !== this.cached.isMobile;
    if (labelChanged && this.labelEl) {
      this.labelEl.textContent = s.levelLabel;
    }
    if (s.bombs !== this.cached.bombs && this.bombsCountEl) {
      this.bombsCountEl.textContent = String(s.bombs);
    }
    if (s.stars !== this.cached.stars && this.starsCountEl) {
      this.starsCountEl.textContent = String(s.stars);
    }
    if (s.state !== this.cached.state && this.stateEl) {
      this.stateEl.textContent = s.state;
    }
    const heartsChanged =
      s.hp !== this.cached.hp ||
      s.maxHp !== this.cached.maxHp ||
      isMobile !== this.cached.isMobile;
    if (heartsChanged) {
      this.drawIcons(s.hp, s.maxHp, isMobile);
    }
    this.cached = {
      hp: s.hp,
      maxHp: s.maxHp,
      bombs: s.bombs,
      stars: s.stars,
      state: s.state,
      levelLabel: s.levelLabel,
      isMobile,
    };
  }

  // ---------- DOM construction ----------

  private buildGameInfoPill(): void {
    // The pill itself is HTML/CSS — purely so we can use real backdrop-filter
    // blur. Inside it we mount one <canvas> for hearts (live-updates) plus
    // <span>s for static-ish text.
    const pill = document.createElement('div');
    pill.className = 'hud-pill hud-pill--gameinfo';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-label', 'Game info');

    const label = document.createElement('span');
    label.className = 'hud-pill__label';
    label.textContent = '';
    this.labelEl = label;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.className = 'hud-pill__hearts';
    iconCanvas.setAttribute('aria-hidden', 'true');
    this.iconCanvas = iconCanvas;

    // Tiny icon canvases for bomb + star (decorative, count is sibling span).
    const bombIcon = document.createElement('canvas');
    bombIcon.className = 'hud-pill__icon hud-pill__icon--bomb';
    bombIcon.setAttribute('aria-hidden', 'true');
    this.bombIconCanvas = bombIcon;

    const bombsCount = document.createElement('span');
    bombsCount.className = 'hud-pill__count hud-pill__count--bombs';
    bombsCount.textContent = '0';
    this.bombsCountEl = bombsCount;

    const starIcon = document.createElement('canvas');
    starIcon.className = 'hud-pill__icon hud-pill__icon--star';
    starIcon.setAttribute('aria-hidden', 'true');
    this.starIconCanvas = starIcon;

    const starsCount = document.createElement('span');
    starsCount.className = 'hud-pill__count hud-pill__count--stars';
    starsCount.textContent = '0';
    this.starsCountEl = starsCount;

    const state = document.createElement('span');
    state.className = 'hud-pill__state';
    state.textContent = '';
    this.stateEl = state;

    pill.appendChild(label);
    pill.appendChild(iconCanvas);
    pill.appendChild(bombIcon);
    pill.appendChild(bombsCount);
    pill.appendChild(starIcon);
    pill.appendChild(starsCount);
    pill.appendChild(state);

    // Insert into existing .hud-left wrapper if present (so HTML keeps full
    // control over the layout flow), otherwise stack under body as a fallback.
    const hudLeft = document.querySelector('.hud-left');
    if (hudLeft) {
      // Wipe out the old <a> nav links — Sprint 11B moves nav to the right side
      // entirely. We keep the wrapper for grid alignment but inject our pill.
      // Actually: nav stays on the right (per spec). Left is JUST the pill.
      hudLeft.appendChild(pill);
    } else {
      document.body.appendChild(pill);
    }
    this.gameInfoPill = pill;

    this.layoutIconCanvas();
    this.drawDecorativeIcons();
  }

  /** Render the bomb and star icon canvases once (or after resize). */
  private drawDecorativeIcons(): void {
    const isMobile = window.innerWidth < 600;
    const dim = isMobile ? SIZES.mobile : SIZES.desktop;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizes: Array<[HTMLCanvasElement | null, (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void]> = [
      [this.bombIconCanvas, drawBomb],
      [this.starIconCanvas, drawStar],
    ];
    for (const [canvas, drawFn] of sizes) {
      if (!canvas) continue;
      canvas.style.width = `${dim.icon}px`;
      canvas.style.height = `${dim.icon}px`;
      canvas.width = Math.ceil(dim.icon * dpr);
      canvas.height = Math.ceil(dim.icon * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, dim.icon, dim.icon);
      drawFn(ctx, dim.icon / 2, dim.icon / 2, dim.icon);
      ctx.restore();
    }
  }

  private buildControlsHint(): void {
    const pill = document.createElement('div');
    pill.className = 'hud-pill hud-pill--controls';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-label', 'Controls');
    pill.innerHTML = `
      <span class="hud-key"><span class="hud-key__sym">&larr; &rarr;</span><span class="hud-key__lbl">move</span></span>
      <span class="hud-key"><span class="hud-key__sym">Space</span><span class="hud-key__lbl">jump</span></span>
      <span class="hud-key"><span class="hud-key__sym">X</span><span class="hud-key__lbl">bomb</span></span>
      <span class="hud-key"><span class="hud-key__sym">&uarr; &darr;</span><span class="hud-key__lbl">pan</span></span>
    `;
    document.body.appendChild(pill);
    this.controlsHint = pill;
    // Trigger initial fade-in by toggling class next tick (matches CSS keyframes).
    requestAnimationFrame(() => pill.classList.add('hud-pill--visible'));
  }

  private layoutIconCanvas(): void {
    if (!this.iconCanvas) return;
    const isMobile = window.innerWidth < 600;
    const dim = isMobile ? SIZES.mobile : SIZES.desktop;
    const heartSlot = dim.heart + dim.gap; // visual width per heart in row
    // 5 hearts max — leave room for all even at hp=0.
    const widthCss = heartSlot * 5;
    const heightCss = dim.heart + 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.iconCanvas.style.width = `${widthCss}px`;
    this.iconCanvas.style.height = `${heightCss}px`;
    this.iconCanvas.width = Math.ceil(widthCss * dpr);
    this.iconCanvas.height = Math.ceil(heightCss * dpr);
  }

  // ---------- Canvas drawing ----------

  /** Watercolor-blob heart, bomb-disk, star — drawn into the inner canvas. */
  private drawIcons(hp: number, maxHp: number, isMobile: boolean): void {
    const canvas = this.iconCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Resize if breakpoint flipped.
    if (isMobile !== this.cached.isMobile) {
      this.layoutIconCanvas();
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dim = isMobile ? SIZES.mobile : SIZES.desktop;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(
      0,
      0,
      Math.floor(canvas.width / dpr),
      Math.floor(canvas.height / dpr),
    );

    const heartSlot = dim.heart + dim.gap;
    const heartY = (dim.heart + 4) / 2;
    for (let i = 0; i < 5; i += 1) {
      const cx = i * heartSlot + dim.heart / 2 + 1;
      const filled = i < hp;
      const visible = i < maxHp;
      if (!visible) continue;
      drawHeart(ctx, cx, heartY, dim.heart, filled);
    }
    ctx.restore();
  }

  // ---------- Events ----------

  private onResize(): void {
    this.layoutIconCanvas();
    this.drawDecorativeIcons();
    // Force redraw on next update tick — invalidate cache.
    this.cached.hp = -1;
  }

  private onKeydown(e: KeyboardEvent): void {
    // Only the first three control-keys re-trigger the hint (per spec).
    const triggers = ['ArrowLeft', 'ArrowRight', 'Space', 'KeyX'];
    if (!triggers.includes(e.code)) return;
    if (!this.controlsHint) return;
    // Re-show for 4s extra.
    this.controlsHint.classList.add('hud-pill--visible');
    this.scheduleHintHide(4000);
  }

  private scheduleHintHide(ms: number): void {
    if (this.hintFadeTimer !== null) {
      window.clearTimeout(this.hintFadeTimer);
    }
    this.hintFadeTimer = window.setTimeout(() => {
      this.controlsHint?.classList.remove('hud-pill--visible');
      this.hintFadeTimer = null;
    }, ms);
  }
}

// ============================================================================
// Canvas-primitive recipes — exported for reuse in case other UI needs them.
// ============================================================================

/**
 * Watercolor-blob heart, anchored at (cx, cy) with overall size `s`.
 * Filled = saffron-glow + faded-rose halo + ink outline.
 * Empty  = ink outline only, mushroom-cream fill at low alpha.
 *
 * Geometry: classic two-lobe heart from a single bezier curve that loops
 * left-up-right-down. Halo is rendered as a soft radial below the fill.
 */
export function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  filled: boolean,
): void {
  const w = s;
  const h = s;
  // Halo (only when filled — gives a "lit" feeling)
  if (filled) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.85);
    grad.addColorStop(0, COLOR.roseHalo);
    grad.addColorStop(1, 'rgba(184, 92, 126, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heart shape — two arcs + bottom cusp.
  const top = cy - h * 0.32;
  const bot = cy + h * 0.45;
  const half = w * 0.46;
  ctx.beginPath();
  ctx.moveTo(cx, top + h * 0.12);
  // Left lobe
  ctx.bezierCurveTo(
    cx - half * 0.6, top - h * 0.18,
    cx - half, top + h * 0.05,
    cx - half, top + h * 0.32,
  );
  // Down to bottom cusp (left side)
  ctx.bezierCurveTo(
    cx - half, top + h * 0.55,
    cx - half * 0.4, top + h * 0.78,
    cx, bot,
  );
  // Up the right side
  ctx.bezierCurveTo(
    cx + half * 0.4, top + h * 0.78,
    cx + half, top + h * 0.55,
    cx + half, top + h * 0.32,
  );
  // Right lobe
  ctx.bezierCurveTo(
    cx + half, top + h * 0.05,
    cx + half * 0.6, top - h * 0.18,
    cx, top + h * 0.12,
  );
  ctx.closePath();

  if (filled) {
    // Saffron-glow fill with a small light-spot inside (watercolor wash feel).
    const fillGrad = ctx.createRadialGradient(
      cx - w * 0.12, cy - h * 0.12, w * 0.04,
      cx, cy, w * 0.55,
    );
    fillGrad.addColorStop(0, '#FFCB8A');
    fillGrad.addColorStop(1, COLOR.saffron);
    ctx.fillStyle = fillGrad;
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(232, 213, 183, 0.18)';
    ctx.fill();
  }

  // Ink-aubergine outline
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = filled ? COLOR.ink : COLOR.inkSoft;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Bomb disk — small zwarte sphere met saffron fuse-spark.
 * Used in the game-info pill icon-row as a decorative motif (the count
 * lives in a sibling <span>). 24x24 desktop / 20x20 mobile.
 */
export function drawBomb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
): void {
  const r = s * 0.36;
  // Shadow halo
  ctx.beginPath();
  ctx.fillStyle = 'rgba(61, 46, 74, 0.25)';
  ctx.arc(cx, cy + s * 0.12, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.beginPath();
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
  grad.addColorStop(0, '#5A4360');
  grad.addColorStop(1, COLOR.ink);
  ctx.fillStyle = grad;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COLOR.ink;
  ctx.stroke();
  // Fuse stub
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLOR.ink;
  ctx.moveTo(cx + r * 0.5, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.95, cy - r * 1.2);
  ctx.stroke();
  // Saffron spark
  ctx.beginPath();
  ctx.fillStyle = COLOR.saffron;
  ctx.arc(cx + r * 0.95, cy - r * 1.2, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Bright core on spark
  ctx.beginPath();
  ctx.fillStyle = '#FFE7B0';
  ctx.arc(cx + r * 0.95, cy - r * 1.2, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 5-puntige ster — saffron-glow met faded-rose stroke en zachte halo.
 * Used in the game-info pill icon-row as a decorative motif.
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
): void {
  const outer = s * 0.45;
  const inner = s * 0.2;
  // Halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer * 1.3);
  halo.addColorStop(0, COLOR.starHalo);
  halo.addColorStop(1, 'rgba(244, 162, 97, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, outer * 1.3, 0, Math.PI * 2);
  ctx.fill();
  // Star path
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = COLOR.saffron;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COLOR.rose;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Pearl highlight
  ctx.beginPath();
  ctx.fillStyle = '#FFEFC0';
  ctx.arc(cx - outer * 0.18, cy - outer * 0.22, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}
