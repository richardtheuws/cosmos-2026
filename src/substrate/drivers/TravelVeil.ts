/**
 * TravelVeil — Wave 25 · fluid-travel ceremony ("the between").
 *
 * A full-screen DOM veil that fades IN to hide a universe/room swap, then fades
 * OUT to reveal the destination — the calm "between" beat of the 3-beat travel
 * (depart → between → arrive). It is the breath, not a shake: a slow ease, a
 * soft saffron-glow core over a deep ink-aubergine wash (the void between
 * worlds), well within the locked palette.
 *
 * Why DOM (not a Phaser/Three overlay): it composites above BOTH renderers
 * reliably on mobile with zero depth/renderer coupling, survives the host
 * teardown (the swap rebuilds the Three scene underneath it), and blocks input
 * for the duration so a traveller can't double-fire a navigation mid-flight.
 *
 * The orchestrator (main.ts) drives it:
 *   await veil.fadeIn();           // depart — cover the outgoing world
 *   await loader.switchTo(...);    // swap, hidden behind the veil
 *   await veil.hold();             // a held breath
 *   await veil.fadeOut();          // arrive — reveal the destination
 */

/** Locked palette (PRD §5 / NORTH-STAR brand contract). */
const INK_AUBERGINE = '#3D2E4A';
const SAFFRON_GLOW = 'rgba(242, 177, 52, 0.18)';

export class TravelVeil {
  private el: HTMLDivElement | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    this.mount();
  }

  private mount(): void {
    const el = document.createElement('div');
    el.id = 'travel-veil';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      // Saffron-glow core dissolving into a deep ink-aubergine void — the
      // "between worlds" wash. Near-opaque at peak so the swap is unseen.
      background:
        `radial-gradient(ellipse 60% 50% at 50% 48%, ${SAFFRON_GLOW} 0%, rgba(61,46,74,0) 55%), ${INK_AUBERGINE}`,
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '40',
      transition: 'opacity 500ms ease-in-out',
      willChange: 'opacity',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    this.el = el;
  }

  /** Fade the veil in (depart). Blocks input while raised. */
  fadeIn(ms = 520): Promise<void> {
    return this.ramp(0.985, ms, 'auto');
  }

  /** Fade the veil out (arrive). Releases input once gone. */
  fadeOut(ms = 680): Promise<void> {
    return this.ramp(0, ms, 'none');
  }

  /** A held breath at full cover — the calm centre of the journey. */
  hold(ms = 260): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private ramp(target: number, ms: number, pointer: 'auto' | 'none'): Promise<void> {
    const el = this.el;
    if (!el) return Promise.resolve();
    el.style.transition = `opacity ${ms}ms ease-in-out`;
    el.style.pointerEvents = pointer;
    // Force a reflow so the transition applies from the current value.
    void el.offsetWidth;
    el.style.opacity = String(target);
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}

/** Detail payload for the `cosmos-navigate` CustomEvent — the single in-app
 *  navigation channel (way-mote return + chart-bloom taps both dispatch it;
 *  main.ts listens and runs the ceremony around SubstrateLoader.switchTo). */
export interface CosmosNavigateDetail {
  universe: string;
  area?: string;
  room?: string;
}

/** Dispatch an in-app navigation request. area/room omitted → resolver fills
 *  the destination universe's defaults. */
export function requestNavigate(detail: CosmosNavigateDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CosmosNavigateDetail>('cosmos-navigate', { detail }));
}
