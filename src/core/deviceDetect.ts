/**
 * deviceDetect.ts — single source of truth for "is this a touch device that
 * needs the on-screen overlay?".
 *
 * THRESHOLD: viewport-width < 1024px AND has-touch.
 *
 * Why 1024px?
 *   - Modern iPad Air landscape is 1180px → keeps keyboard-friendly desktop UX.
 *   - iPad Mini portrait is 768px → triggers overlay (correct, no keyboard).
 *   - Most laptops with hybrid touch (Surface, etc.) are >=1280px → desktop UX.
 *   - Below 1024px there is essentially never an attached keyboard in practice.
 *
 * We deliberately do NOT use UA-string sniffing — the touch + viewport heuristic
 * is more durable across 2026 device classes (foldables, ARM tablets, etc.).
 *
 * Re-evaluated on demand. Caller (touchOverlay) hooks `resize` to react to
 * orientation flips.
 */

const VIEWPORT_MAX = 1024;

export function hasTouch(): boolean {
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}

export function isNarrowViewport(): boolean {
  return window.innerWidth < VIEWPORT_MAX;
}

/**
 * Primary check: should the on-screen touch overlay be shown?
 * True iff the device reports touch capability AND the viewport is < 1024px.
 */
export function isTouchDevice(): boolean {
  return hasTouch() && isNarrowViewport();
}

export const DEVICE_DETECT_THRESHOLD_PX = VIEWPORT_MAX;
