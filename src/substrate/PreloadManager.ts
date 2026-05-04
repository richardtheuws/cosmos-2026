/**
 * PreloadManager — eager preload of `manifest.assets[]` per architect §7.1
 * (Wave 21 scope: Universe-load eager). Lazy-per-Room scoping is reserved
 * for Wave 22+.
 *
 * Path safety + the legacy-forest allowlist (punch-list #3):
 *
 *   The architect contract says "paths are universe-folder-relative; the
 *   substrate strips `../` for safety". The reference forest manifest pre-dates
 *   the fully-isolated `universes/<name>/assets/` layout — its asset paths
 *   start with `../../public/assets/...` because the public/ directory IS the
 *   asset root for the legacy forest. Stripping `../` blindly would break the
 *   reference universe.
 *
 *   Resolution: an explicit allowlist. A path that begins with `../../public/`
 *   resolves to the project's public root (via Vite BASE_URL). Any other
 *   `../` segment is stripped. This is the ONLY supported escape; long-term
 *   migration to per-universe `assets/` folders is Wave 22.
 *
 * The PreloadManager only enforces the allowlist for STRING URL resolution —
 * actual fetches are best-effort (image/audio assets need browser APIs to
 * load, not just `fetch`). For Wave 21 we issue HEAD requests; failures
 * print a warning but never block boot. Visual fidelity bugs surface in UAT.
 */
import { assetPath } from '../core/assetPath';
import type { AssetEntry } from './contracts/BehaviorContract';

const LEGACY_ALLOWLIST_PREFIX = '../../public/';

export interface PreloadResult {
  resolved: number;
  failed: number;
  warnings: string[];
}

export class PreloadManager {
  /**
   * Resolve a manifest-asset path to a URL the browser can fetch.
   *
   * Allowlist rules:
   *   - paths starting with `../../public/<rest>` resolve via the project's
   *     `assetPath('<rest stripped of "../../public/">')` (legacy forest path)
   *   - paths starting with `assets/...` (universe-relative) resolve via
   *     `<base>/<universe>/<path>` — wave-22 universe-isolated layout
   *   - any other `../` is stripped before joining
   *
   * The `universeRel` argument is the `universes/<name>/` URL prefix; e.g.
   * '/universes/forest'. Universe-relative paths join under that.
   */
  static resolveAssetUrl(rawPath: string, universeRel: string): string {
    if (rawPath.startsWith(LEGACY_ALLOWLIST_PREFIX)) {
      // Legacy reference-forest path. Strip the prefix; resolve under the
      // public root via assetPath() (handles vite base correctly).
      const tail = rawPath.slice(LEGACY_ALLOWLIST_PREFIX.length);
      return assetPath(tail);
    }

    // Strip any remaining `../` for safety.
    const safe = rawPath.replace(/\.\.\//g, '').replace(/^\/+/, '');
    // Universe-relative — join under universeRel.
    return `${universeRel.replace(/\/$/, '')}/${safe}`;
  }

  /** Eager-fetch every asset with `preload: true`. Failures warn but never throw. */
  static async preloadEager(assets: readonly AssetEntry[], universeRel: string): Promise<PreloadResult> {
    const eager = assets.filter((a) => a.preload);
    let resolved = 0;
    let failed = 0;
    const warnings: string[] = [];

    await Promise.all(
      eager.map(async (a) => {
        const url = PreloadManager.resolveAssetUrl(a.path, universeRel);
        try {
          // HEAD request just probes. Browser-native loaders (TextureLoader/
          // <audio>) will fetch the file again from the cache when behaviors
          // mount — that's fine, the second load is a 304/cache-hit.
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) {
            resolved++;
          } else {
            failed++;
            warnings.push(`[substrate/preload] ${a.path} -> ${url} responded ${res.status}`);
          }
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`[substrate/preload] ${a.path} -> ${url} failed: ${msg}`);
        }
      }),
    );

    return { resolved, failed, warnings };
  }
}
