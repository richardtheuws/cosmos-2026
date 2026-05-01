/**
 * Build a runtime asset URL that respects Vite's `base` config.
 *
 * In dev (`base: '/'`) returns `/assets/foo.png`.
 * In production (`base: '/games/cosmos-2026/'`) returns `/games/cosmos-2026/assets/foo.png`.
 *
 * Vite only rewrites paths that appear in HTML or as ES-module imports —
 * runtime strings passed to Phaser's `this.load.image` or Three's TextureLoader
 * are NOT rewritten. Use this helper for any such path.
 */
export function assetPath(rel: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + '/' + rel.replace(/^\/+/, '');
}
