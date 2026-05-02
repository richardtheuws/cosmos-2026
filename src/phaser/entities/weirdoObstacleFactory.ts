/**
 * weirdoObstacleFactory — Sprint 15E.
 *
 * Replaces ObstacleManager's canvas-primitive defaults with the 8 fal.ai-
 * generated weirdo objects from Sprint 15C. Each obstacle kind picks a random
 * member of its pool so the playthrough never feels repetitive.
 *
 * Per kind:
 *   low   → organic-flesh-trampoline (springable) | floating-star (collectible)
 *   tall  → eyeball-sentry | upside-down-tree | mouth-pillar (sheet, frame-0)
 *   gap   → breathing-portal | secret-crystal | melting-clock-bubble
 *
 * Textures are loaded once at boot via THREE.TextureLoader and cached. Each
 * obstacle is a billboarded plane with the texture mapped on it — keeps the
 * 3D scene mobile-fast while letting the watercolor weirdness read clearly.
 */
import * as THREE from 'three';
import { assetPath } from '../../core/assetPath';
import type { ObstacleKind, ObstacleFactory } from './ObstacleManager';

interface ObstacleSpec {
  url: string;
  width: number;
  height: number;
  yOffset: number;
}

/** Spec per asset (file → 3D plane size in world-units, anchored to ground). */
const SPECS: Record<string, ObstacleSpec> = {
  // low (crouchable / collectible) — short ground-anchored items
  'organic-flesh-trampoline': { url: 'assets/objects/organic-flesh-trampoline.png', width: 1.0, height: 0.6, yOffset: 0.3 },
  'floating-star': { url: 'assets/objects/floating-star.png', width: 0.5, height: 0.5, yOffset: 0.6 },
  // tall (jumpable) — pillar/tree/sentry
  'eyeball-sentry': { url: 'assets/objects/eyeball-sentry.png', width: 0.7, height: 0.7, yOffset: 1.1 },
  'upside-down-tree': { url: 'assets/objects/upside-down-tree.png', width: 1.0, height: 1.6, yOffset: 0.8 },
  'mouth-pillar': { url: 'assets/objects/mouth-pillar-sheet.png', width: 0.7, height: 1.5, yOffset: 0.75 },
  // gap (visual cue mid-air) — portals and crystals
  'breathing-portal': { url: 'assets/objects/breathing-portal.png', width: 1.0, height: 1.0, yOffset: 0.7 },
  'secret-crystal': { url: 'assets/objects/secret-crystal.png', width: 0.6, height: 0.6, yOffset: 0.6 },
  'melting-clock-bubble': { url: 'assets/objects/melting-clock-bubble.png', width: 0.8, height: 0.8, yOffset: 0.9 },
};

const POOL: Record<ObstacleKind, string[]> = {
  low: ['organic-flesh-trampoline', 'floating-star'],
  tall: ['eyeball-sentry', 'upside-down-tree', 'mouth-pillar'],
  gap: ['breathing-portal', 'secret-crystal', 'melting-clock-bubble'],
};

const cache = new Map<string, THREE.Texture>();

function loadTextureCached(loader: THREE.TextureLoader, url: string): THREE.Texture {
  const cached = cache.get(url);
  if (cached) return cached;
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(url, tex);
  return tex;
}

/**
 * Returns an ObstacleFactory that produces THREE.Group billboards using
 * the Sprint 15C generated PNGs. The factory pre-loads all textures on first
 * call so per-spawn cost is just a Group + Mesh allocation.
 */
export function createWeirdoObstacleFactory(): ObstacleFactory {
  const loader = new THREE.TextureLoader();
  // Pre-warm so the very first spawn doesn't pop.
  for (const spec of Object.values(SPECS)) {
    loadTextureCached(loader, assetPath(spec.url));
  }

  return (kind: ObstacleKind): THREE.Group => {
    const pool = POOL[kind];
    const id = pool[Math.floor(Math.random() * pool.length)];
    const spec = SPECS[id];
    const tex = loadTextureCached(loader, assetPath(spec.url));

    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(spec.width, spec.height);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = spec.yOffset;
    // Slight random Z-rotation so identical sprites don't read as cloned.
    mesh.rotation.z = (Math.random() - 0.5) * 0.08;
    group.add(mesh);
    return group;
  };
}
