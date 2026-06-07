/**
 * WayMoteOverlay — Wave 24 · S1 (the "Look up." return path).
 *
 * A FREE, substrate-owned affordance mounted in every non-reserved universe so
 * no Universe can ever trap a player without a way home. No universe authors it
 * (the author-cost would defeat the point); it is mounted once per boot by
 * SubstrateLoader for any universe whose id is not `_`-prefixed.
 *
 * Form (brand contract — NORTH-STAR §3):
 *   A faint painted way-mote pinned top-center with the English microcopy
 *   "Look up." in Cormorant Italic. It BREATHES (a slow opacity sine), it does
 *   not pulse or shake. Locked palette only (mushroom-cream over a soft
 *   saffron glow), well under the ≤5% pop budget.
 *
 * Gesture → return:
 *   tap the mote · a single upward swipe anywhere · the `M` key
 *   → navigate to the reserved chart universe. We write ONLY `universe=<id>`
 *     and DELETE area/room so SubstrateLoader's left-to-right resolver fills the
 *     chart's own defaultArea/entryRoom — this driver stays decoupled from the
 *     chart's internal room ids. The resolver's reserved-allowlist (ResolveURL
 *     ResolveCtx.reservedUniverses) makes `_chart` resolve instead of bouncing
 *     to the forest.
 *
 * The portal-in-reverse ceremony (the room receding UP into its bloom) and the
 * pre-return Cosmo `look` clip are S2/S3 — owned by the substrate, not yet
 * wired. Until then the return is an honest reload into the chart triple; the
 * chart plays its own calm arrival portal. An optional `onActivate` hook is
 * provided so S3 can later play `look` before the navigation fires.
 */

import { requestNavigate } from './TravelVeil';

export interface WayMoteOptions {
  /** Reserved universe id to return to (e.g. `_chart`). */
  reservedUniverseId: string;
  /** Optional pre-return hook (S3: play Cosmo `look`, then call `proceed`).
   *  If provided, it is responsible for eventually calling `proceed`. If
   *  absent, the return fires immediately. */
  onActivate?: (proceed: () => void) => void;
}

export class WayMoteOverlay {
  private el: HTMLDivElement | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;
  private onTouchEnd: ((e: TouchEvent) => void) | null = null;
  private touchStartY = 0;
  private touchStartX = 0;
  private touchStartT = 0;
  private activating = false;

  constructor(private opts: WayMoteOptions) {
    if (typeof document === 'undefined') return;
    this.mount();
  }

  private mount(): void {
    const el = document.createElement('div');
    el.id = 'way-mote';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Look up — return to the chart');
    el.tabIndex = 0;
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.35rem',
      paddingTop: '0.7rem',
      cursor: 'pointer',
      zIndex: '32',
      userSelect: 'none',
      // Soft saffron glow behind a mushroom-cream mote — well under the pop budget.
      background:
        'radial-gradient(ellipse 120px 60px at 50% 0%, rgba(242,177,52,0.16) 0%, rgba(242,177,52,0) 70%)',
    } as Partial<CSSStyleDeclaration>);

    // The mote itself — a small painted dot of light.
    const mote = document.createElement('div');
    Object.assign(mote.style, {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: '#F5EDD8',
      boxShadow: '0 0 10px 3px rgba(245,237,216,0.55)',
    } as Partial<CSSStyleDeclaration>);

    // "Look up." microcopy — Cormorant Italic, faded-rose, faint.
    const label = document.createElement('div');
    label.textContent = 'Look up.';
    Object.assign(label.style, {
      fontFamily: "'Cormorant', Georgia, serif",
      fontStyle: 'italic',
      fontSize: '0.95rem',
      color: 'rgba(232,196,184,0.78)',
      textShadow: '0 1px 6px rgba(0,0,0,0.5)',
      letterSpacing: '0.02em',
    } as Partial<CSSStyleDeclaration>);

    el.appendChild(mote);
    el.appendChild(label);

    // Breathe (the world breathes, it does not shake): a slow opacity sine via
    // CSS keyframes injected once.
    if (!document.getElementById('way-mote-style')) {
      const style = document.createElement('style');
      style.id = 'way-mote-style';
      style.textContent =
        '@keyframes wayMoteBreathe{0%,100%{opacity:0.45}50%{opacity:0.85}}' +
        '#way-mote{animation:wayMoteBreathe 7s ease-in-out infinite}' +
        '#way-mote:hover,#way-mote:focus-visible{opacity:1!important;outline:none}';
      document.head.appendChild(style);
    }

    el.addEventListener('click', () => this.activate());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.activate();
      }
    });

    // Global `M` key.
    this.onKey = (e: KeyboardEvent): void => {
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        this.activate();
      }
    };
    window.addEventListener('keydown', this.onKey);

    // A DELIBERATE upward flick (Wave 25.5 — raised hard from dy>90). A dweller
    // wandering kept getting yanked out of rooms: the old threshold fired on any
    // casual upward drag. Now it needs a long, fast, near-vertical flick — about
    // 40% of the screen height, in under ~450ms, barely sideways. Tapping the
    // "Look up." mote (always available) remains the easy, intentional way home.
    this.onTouchStart = (e: TouchEvent): void => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      this.touchStartY = t.clientY;
      this.touchStartX = t.clientX;
      this.touchStartT = performance.now();
    };
    this.onTouchEnd = (e: TouchEvent): void => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dy = this.touchStartY - t.clientY; // positive = swiped up
      const dx = Math.abs(t.clientX - this.touchStartX);
      const dt = performance.now() - this.touchStartT;
      const minDy = Math.min(window.innerHeight * 0.4, 320);
      if (dy > minDy && dx < dy * 0.4 && dt < 450) this.activate();
    };
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });

    document.body.appendChild(el);
    this.el = el;
  }

  private activate(): void {
    if (this.activating) return;
    this.activating = true;
    const proceed = (): void => this.returnToChart();
    if (this.opts.onActivate) this.opts.onActivate(proceed);
    else proceed();
  }

  private returnToChart(): void {
    if (typeof window === 'undefined') return;
    // Wave 25 — in-app return (no reload): dispatch the navigation request and
    // let main.ts run the travel ceremony around SubstrateLoader.switchTo. Cosmo
    // survives the swap. area/room omitted so the resolver fills the chart's
    // own defaultArea/entryRoom (this driver stays decoupled from chart ids).
    requestNavigate({ universe: this.opts.reservedUniverseId });
    // Allow re-activation if the ceremony is interrupted; the overlay is
    // disposed by switchTo when the chart loads, so this rarely matters.
    this.activating = false;
  }

  dispose(): void {
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    if (this.onTouchStart) window.removeEventListener('touchstart', this.onTouchStart);
    if (this.onTouchEnd) window.removeEventListener('touchend', this.onTouchEnd);
    this.onKey = null;
    this.onTouchStart = null;
    this.onTouchEnd = null;
    this.el?.remove();
    this.el = null;
  }
}
