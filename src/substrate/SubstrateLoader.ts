/**
 * SubstrateLoader — Wave 21 entry point.
 *
 *   1. Parses the URL request via ResolveURL.
 *   2. Loads the universe manifests + optional behavior module.
 *   3. Constructs UniverseHost; calls applyUniverseDefaults + enterAreaRoom.
 *   4. Runs the arrival animation.
 *   5. Exposes a per-frame `tick(dt, u)` that fans into UniverseHost.
 *
 * The SubstrateLoader does NOT own Cosmo. CosmoStage + CosmoAgent + CosmoAI
 * are constructed in main.ts and INJECTED into the loader via SubstrateBootCtx.
 * This keeps Cosmo's identity stable across both the legacy and substrate
 * paths during phase A coexistence.
 */
import type * as THREE from 'three';
import type { GlobalUniforms } from '../core/globalUniforms';
import type { MotionController } from '../core/motionController';
import type { AudioFFTBridge } from '../audio/audioFFTBridge';
import type { CosmoAgent } from '../phaser/entities/CosmoAgent';
import type { CosmoStage } from '../three/cosmoStage';
import type { BiomeManager } from '../three/biomeManager';
import type { ParallaxScene } from '../three/parallaxScene';

import {
  validateAreasManifest,
} from './contracts/AreasSchema';
import {
  validateManifest,
} from './contracts/ManifestSchema';
import { validateRoomsManifest } from './contracts/RoomsSchema';
import type {
  AreasManifest,
  Manifest,
  RoomsManifest,
  SubstrateCtx,
  UniverseBehavior,
} from './contracts/BehaviorContract';
import { DEFAULT_UNIVERSE, parseURLRequest, resolveURLRequest, syncURL } from './ResolveURL';
import { UniverseHost } from './UniverseHost';
import { appendTraversal, loadState, saveState, type CosmosPersistedState } from './StatePersistence';
import { PreloadManager } from './PreloadManager';

export interface SubstrateBootCtx {
  /** Element the parallax + cosmo renderers paint to. */
  canvas: HTMLCanvasElement;
  /** Three.js renderer (shared across parallax + cosmoStage). */
  renderer: THREE.WebGLRenderer;
  /** Cosmo stage scene + camera; substrate writes into stage.scene's userData
   *  for compatibility with forest/behavior.ts's resolveCanvas heuristic. */
  cosmoStage: CosmoStage;
  /** Long-lived agent (constructed once in main.ts). */
  cosmoAgent: CosmoAgent;
  /** Audio bridge — drives mouth-pillar audio-clock + universe-bed playback. */
  audioBridge: AudioFFTBridge;
  /** Motion controller — drives parallax pan + cosmo head-track. */
  motion: MotionController;
  /** Shared global uniforms. */
  globalUniforms: GlobalUniforms;
  /** Biome manager — reused for BiomeBlendTransition crossfades. */
  biomeMgr: BiomeManager;
  /** Shared parallax instance. The substrate uses it via DefaultBackground;
   *  legacy code-paths that still write to it remain compatible. */
  parallax: ParallaxScene;
}

export class SubstrateLoader {
  private host: UniverseHost | null = null;
  private state: CosmosPersistedState;
  private universeRel = '';
  private booted = false;

  constructor(private bootCtx: SubstrateBootCtx) {
    this.state = loadState();
  }

  /** Boot — resolves URL, loads manifests, runs arrival. Must be awaited. */
  async boot(): Promise<void> {
    if (this.booted) return;

    const knownUniverses = await this.discoverUniverses();
    const req = parseURLRequest(window.location.search);
    const resolved = await resolveURLRequest(req, {
      knownUniverses,
      loadUniverseManifests: (id) => this.loadManifestsFor(id),
    });

    if (resolved.changed) syncURL(resolved);

    const manifests = await this.loadManifestsFor(resolved.universe);
    if (!manifests) {
      throw new Error(`[substrate] manifests for '${resolved.universe}' could not be loaded`);
    }

    this.universeRel = baseRelative(`universes/${resolved.universe}`);
    const behavior = manifests.manifest.behaviorModule
      ? await this.loadBehaviorFor(resolved.universe)
      : null;

    // Eager preload (architect §7.1 / 8.4 option A).
    const preload = await PreloadManager.preloadEager(manifests.manifest.assets, this.universeRel);
    if (preload.warnings.length && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[substrate/preload]', preload);
    }

    // Build the SubstrateCtx — punch-list #6 fields included.
    const ctx: SubstrateCtx = {
      scene: this.bootCtx.cosmoStage.scene,
      camera: this.bootCtx.cosmoStage.camera,
      globalUniforms: this.bootCtx.globalUniforms,
      assetPath: (rel) => PreloadManager.resolveAssetUrl(rel, this.universeRel),
      universe: {
        id: resolved.universe,
        name: manifests.manifest.name,
        displayName: manifests.manifest.displayName,
      },
      // Filled by UniverseHost.enterAreaRoom — placeholders here so the type
      // is satisfied before the first room is entered. Driver code should
      // never call into ctx.area/.room before enter completes.
      area: { id: resolved.area, displayName: '', mood: { ambient: '', primary: '', post: { bloom: 1, kaleido: 1, fluid: 1, chroma: 1 } } },
      room: { id: resolved.room, displayName: '', anchor: { x: 0, y: 0, z: 0 } },
      canvas: this.bootCtx.canvas,
      audioBridge: this.bootCtx.audioBridge,
      motion: this.bootCtx.motion,
      renderer: this.bootCtx.renderer,
      // Wave 22 (D4) — expose the single shared ParallaxScene so a Universe's
      // background driver configures it rather than constructing a second one.
      parallax: this.bootCtx.parallax,
    };

    // Wire renderer onto scene.userData so the forest-builder's resolveCanvas
    // heuristic finds the canvas without explicit ctx threading. Belt + braces.
    (this.bootCtx.cosmoStage.scene.userData as { renderer?: THREE.WebGLRenderer }).renderer =
      this.bootCtx.renderer;

    this.host = new UniverseHost(ctx, {
      manifest: manifests.manifest,
      areas: manifests.areas,
      rooms: manifests.rooms,
      behavior,
      universeRel: this.universeRel,
      parallax: this.bootCtx.parallax,
    });
    this.host.applyUniverseDefaults();
    this.host.enterAreaRoom(resolved.area, resolved.room);

    // Apply room camera bounds.
    const room = this.host.getCurrentRoom();
    if (room?.cameraBounds) {
      this.bootCtx.cosmoStage.setCameraBounds(room.cameraBounds);
    }
    // Place Cosmo at the room anchor.
    if (room) {
      this.bootCtx.cosmoAgent.root.position.set(room.anchor.x, room.anchor.y, room.anchor.z);
    }

    // Persist + append traversal.
    appendTraversal(this.state, resolved.universe, resolved.area, resolved.room);
    saveState(this.state);
    window.addEventListener('pagehide', () => saveState(this.state), { once: false });

    this.booted = true;
  }

  /** Per-frame tick — fans into UniverseHost. Called from main.ts CanvasManager.register. */
  tick(dt: number, u: GlobalUniforms): void {
    this.host?.tick(dt, u);
  }

  dispose(): void {
    this.host?.dispose();
    this.host = null;
    this.booted = false;
  }

  /** Persisted state — exposed for the loader's own debugging. */
  getState(): CosmosPersistedState {
    return this.state;
  }

  /* ── private ─────────────────────────────────────────────────────────── */

  private async discoverUniverses(): Promise<ReadonlySet<string>> {
    // Wave 21: hard-coded list of known universes. Wave 22+ will use
    // import.meta.glob for hot-reload + dynamic discovery; for now the
    // forest is the only universe and the substrate's defaults handle missing.
    return new Set([DEFAULT_UNIVERSE]);
  }

  private async loadManifestsFor(universeId: string): Promise<{
    manifest: Manifest;
    areas: AreasManifest;
    rooms: RoomsManifest;
  } | null> {
    const lenient = import.meta.env.DEV;
    const baseRel = baseRelative(`universes/${universeId}`);

    try {
      const [mRaw, aRaw, rRaw] = await Promise.all([
        fetchJSON(`${baseRel}/manifest.json`),
        fetchJSON(`${baseRel}/areas.json`),
        fetchJSON(`${baseRel}/rooms.json`),
      ]);
      if (!mRaw || !aRaw || !rRaw) return null;

      const manifest = validateManifest(mRaw, { lenient, source: `${universeId}/manifest.json` });
      const areas = validateAreasManifest(aRaw, { lenient, source: `${universeId}/areas.json` });
      const rooms = validateRoomsManifest(rRaw, {
        lenient,
        source: `${universeId}/rooms.json`,
        defaultArea: manifest.defaultArea,
      });
      return { manifest, areas, rooms };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[substrate] manifest load failed for '${universeId}'`, err);
      return null;
    }
  }

  private async loadBehaviorFor(universeId: string): Promise<UniverseBehavior | null> {
    try {
      // Vite handles the dynamic import; the universes/<id>/behavior.ts file
      // is bundled per-universe. The path is intentionally a string literal
      // template that Vite resolves statically (`/universes/${id}/behavior.ts`
      // would not — we use a glob fallback instead).
      const mods = import.meta.glob('/universes/*/behavior.ts');
      const key = Object.keys(mods).find((k) => k.includes(`/universes/${universeId}/`));
      if (!key) return null;
      const mod = (await mods[key]()) as { default?: UniverseBehavior };
      return mod.default ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[substrate] behavior load failed for '${universeId}'`, err);
      return null;
    }
  }
}

async function fetchJSON(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Resolve a project-root-relative path under Vite's BASE_URL. In dev `base`
 *  is `/`, in prod it's `/games/cosmos-2026/`. */
function baseRelative(rel: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + '/' + rel.replace(/^\/+/, '');
}
