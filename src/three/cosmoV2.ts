/**
 * cosmoV2.ts — Wave 21.2 (2026-05-05) — billboard-cosmo pivot
 *
 * Cosmo is now a single textured plane carrying the canonical
 * `cosmo-hero-lora.png` painting (Sprint 16A LoRA-locked, 4096² RGBA, BiRefNet
 * alpha applied). The plane Y-locked-billboards toward the camera every frame
 * so it always reads as a flat watercolor character no matter where Cosmo is
 * in the scene or how the camera pans.
 *
 * Pivot rationale (NORTH-STAR §6 entry 2026-05-05, second of the day): three
 * decal-on-capsule attempts (Sprint 16A hero-only, Wave 21 PIL-crop, Wave 21.1
 * fal.ai-regen) failed to converge. Diffusion models trained on whole-character
 * data don't isolate organ-decals cleanly even with negatives. Per §4 brave-
 * reconsideration rule: when patches don't converge, retire the system. The
 * decal-on-capsule paradigm is retired. The hero-PNG already exists, is 10/10,
 * and reads as a real Cosmo. Use it directly.
 *
 * What survives from the old rig:
 *   - The same `root` Group that CosmoAgent moves with worldX/Y/Z.
 *   - The `CosmoState` re-export (substrate's BehaviorContract imports it).
 *   - The 4 anims that depend only on root transforms (idle-breath, walk-sway,
 *     jump-arc squash-stretch, climb 90° rotation).
 *
 * What's retired (kept on disk for rollback safety, not loaded):
 *   - `public/assets/cosmo/decals/v2-final/*.png` (6 files)
 *   - `public/assets/3d/v2/cosmo-*.png` (face-states + body-skin + disc)
 *   - capsule body, sphere head, antenna shaft+bulb, 4 disc-arms, all bones.
 *   - `FaceState` enum + `setFaceState()` method.
 */
import * as THREE from 'three';
import { assetPath } from '../core/assetPath';

/**
 * Wave 21 punch-list #5 carry-over.
 *
 * The architect's BehaviorContract `ArrivalCtx` references `CosmoState`. The
 * type itself lives in `src/phaser/entities/CosmoAgent.ts`. We re-export here
 * so substrate authors can `import type { CosmoState } from '<...>/cosmoV2'`
 * without reaching into the Phaser tree.
 */
export type { CosmoState } from '../phaser/entities/CosmoAgent';

/** Plane footprint matches the old capsule's screen-space silhouette: roughly
 *  1.2 wide × 1.8 tall world-units at root.scale=1.1. */
const PLANE_W = 1.2;
const PLANE_H = 1.8;
/** Plane vertical offset so the billboard's center sits at the old eye-line.
 *  Tuned to match the previous capsule's eye/face position (head Y≈1.05 in
 *  body-space, body bottom at root Y=0). 0.9 places Cosmo's painted center
 *  just above the ground plane, feet at root.position.y. */
const PLANE_Y = 0.9;

/** Public handle returned by buildCosmoV2(). Substrate's BehaviorContract.ts
 *  reads this shape; pre-21.2 fields (head/body/antennaBase/discL/discR/etc.)
 *  are gone. */
export interface CosmoV2Rig {
  /** World-space driver. CosmoAgent writes position + scale (jump-arc + trip-
   *  scale) here. Same identity as the pre-21.2 root. */
  readonly root: THREE.Group;
  /** The single textured plane. Mutated by anim director (rotation.z sway,
   *  scale.y squash-stretch is on root not plane). */
  readonly plane: THREE.Mesh;
  /** Per-frame: Y-locked lookAt toward camera. Call AFTER position has been
   *  written for the frame so the billboard faces the camera with the new
   *  world-space anchor. */
  update(camera: THREE.Camera): void;
  /** Dispose geometry + material + texture. */
  dispose(): void;
}

interface BuildOptions {
  /** Rendered scale baseline. Cosmo at ~30-40% portrait height @ FOV 35, dist 6. */
  scale?: number;
}

export function buildCosmoV2(options: BuildOptions = {}): CosmoV2Rig {
  const baseScale = options.scale ?? 1.1;

  const root = new THREE.Group();
  root.name = 'cosmoV2_root';
  root.scale.setScalar(baseScale);

  const loader = new THREE.TextureLoader();
  const heroTex = loader.load(assetPath('assets/sprites/cosmo-hero-lora.png'));
  heroTex.colorSpace = THREE.SRGBColorSpace;
  heroTex.minFilter = THREE.LinearFilter;
  heroTex.magFilter = THREE.LinearFilter;
  heroTex.generateMipmaps = false;
  heroTex.anisotropy = 4;

  const material = new THREE.MeshBasicMaterial({
    map: heroTex,
    transparent: true,
    // alphaTest 0.1 kills the BiRefNet alpha-edge halo without biting into the
    // semi-transparent watercolor wash at antenna-tip / silhouette-edges.
    alphaTest: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H);
  const plane = new THREE.Mesh(geometry, material);
  plane.name = 'cosmoV2_billboard';
  plane.position.set(0, PLANE_Y, 0);
  // Wave 21.2 finish — Cosmo always renders LAST, on top of every other plane
  // in the scene (forest inhabitants default to renderOrder=0). Without this,
  // depthWrite:false on every alpha-cut plane meant draw-order won, and the
  // inhabitants painted over Cosmo on substrate path. (Live UAT 2026-05-05.)
  plane.renderOrder = 100;
  root.add(plane);

  // Scratch — Y-locked lookAt target. The plane faces the camera in XZ, but
  // its up-vector stays world-up so Cosmo never rolls or pitches.
  const scratchTarget = new THREE.Vector3();

  function update(camera: THREE.Camera): void {
    // Build a target on the camera's XZ but at the plane's world Y. That keeps
    // the plane's up-axis aligned with world-up — no roll, no pitch.
    const camPos = camera.position;
    // root.position is in parent-space; the plane's actual world Y is
    // root.position.y + PLANE_Y * root.scale.y. lookAt() works in world-space,
    // so we feed the camera's world XZ + the plane's world Y.
    scratchTarget.set(
      camPos.x,
      root.position.y + PLANE_Y * root.scale.y,
      camPos.z,
    );
    plane.lookAt(scratchTarget);
  }

  function dispose(): void {
    geometry.dispose();
    material.dispose();
    heroTex.dispose();
  }

  return { root, plane, update, dispose };
}
