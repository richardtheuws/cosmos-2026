/**
 * cosmoV2.ts — Wave 20a (2026-05-03)
 *
 * Hybrid Cosmo: Three.js primitive skeleton + painted-decal textures.
 * Replaces the broken Meshy-imported GLB rig (`public/assets/3d/cosmo.glb`)
 * after three failed weight-redistribution attempts (v1.5.0–1.5.2). Honors
 * the original `cosmo-animation-spec.json` line 183 ("procedural-object-
 * transforms") which always said this is what the rig should be.
 *
 * Architecture spec: `.claude/brainstorm/wave20/01-cosmo-v2-architecture.md`
 *
 * The skeleton is built from `THREE.Object3D` transform-only nodes carrying
 * primitive geometries. NO `SkinnedMesh`, NO `Skeleton`, NO inverse-bind
 * matrices — every animation is direct transform manipulation on a node.
 * That's how we get 360° head rotation without a single shear vertex, scale
 * up/down without skinning artifacts, and jump-arc/climb without baking
 * new clips.
 *
 * The 4 face-states (neutral / coo / blink / wave) are 512×512 painted
 * PNGs swapped on the same plane. Lip-sync = `setFaceState()`. Eye-track
 * is a tiny UV offset on the iris band of the same texture (Wave 20b).
 *
 * Brand contract (NORTH-STAR §brand): Hayao×Moebius watercolor, 1992-DNA
 * (pearl-drop head, chameleon-bulging eyes, saffron crescent catchlight,
 * antenna with bulb, suction-cup discs, faded-rose-spotted green skin).
 */
import * as THREE from 'three';
import { assetPath } from '../core/assetPath';

const V2_ASSET_BASE = 'assets/3d/v2';
/** Wave 21 — final decal set lives here. Split eyes/mouth/antenna so the
 *  CosmoAnimDirector can blink each eye independently and so the antenna
 *  flower-bulb gets a painted decal instead of a flat-color sphere. */
const V2_FINAL_DECAL_BASE = 'assets/cosmo/decals/v2-final';

/** All face-state texture URLs the rig knows about. */
const FACE_STATES = ['neutral', 'coo', 'blink', 'wave'] as const;
export type FaceState = (typeof FACE_STATES)[number];

/**
 * Wave 21 — punch-list #5 resolution.
 *
 * The architect's BehaviorContract `ArrivalCtx` references `CosmoState`. The
 * type itself lives in `src/phaser/entities/CosmoAgent.ts` (state-machine
 * union of `idle | walking | jumping | …`). Forest's `behavior.ts` flagged
 * the import-path mismatch as a discrepancy. We re-export here so substrate
 * authors can `import type { CosmoState } from '<...>/cosmoV2'` without
 * reaching into the Phaser tree, AND so the contract's docstring path
 * matches reality. Backwards-compat: the original CosmoAgent export still
 * works for legacy code paths.
 */
export type { CosmoState } from '../phaser/entities/CosmoAgent';

/** Public handle returned by buildCosmoV2(). The CosmoAgent (and only
 *  CosmoAgent) writes to these nodes; everything else routes through it. */
export interface CosmoV2Rig {
  /** World-space driver. Position + scale (jump-arc + trip-scale). */
  readonly root: THREE.Group;
  /** Torso. Capsule. Holds head, discs. Roll/pitch follow body posture. */
  readonly body: THREE.Object3D;
  /** Sphere head (slightly squashed Y for pearl-drop). 360° yaw target. */
  readonly head: THREE.Object3D;
  /** Antenna pivot at head crown. Wiggles on FFT-air. */
  readonly antennaBase: THREE.Object3D;
  /** Bulb at antenna tip. */
  readonly antennaTip: THREE.Object3D;
  /** Painted face plane on +Z front of head. Texture is swappable per state.
   *  Wave 21 — kept as a *legacy* composite plane for the 4 face-states; new
   *  split decals (eyeDecalL/R + mouthDecal) live alongside it for animation. */
  readonly faceDecal: THREE.Mesh;
  /** Wave 21 — left eye decal plane. Independent Y-scale for blink. The
   *  plane is `visible=false` until the v2-final decal asset loads (graceful
   *  fallback to composite face-decal for legacy deploys). */
  readonly eyeDecalL: THREE.Mesh;
  /** Wave 21 — right eye decal plane. */
  readonly eyeDecalR: THREE.Mesh;
  /** Wave 21 — mouth decal plane (currently neutral-only; lip-sync via
   *  composite swap stays available via setFaceState). */
  readonly mouthDecal: THREE.Mesh;
  /** Wave 21 — antenna flower-bulb decal billboard at antenna tip. */
  readonly antennaFlowerDecal: THREE.Mesh;
  /** Free-floating disc-arms. Animate independently for walk / climb. */
  readonly discL: THREE.Object3D;
  readonly discR: THREE.Object3D;

  /** Swap the face-decal texture. No-op if state already active. */
  setFaceState(state: FaceState): void;
  /** Dispose every geometry/material/texture this rig owns. */
  dispose(): void;
}

interface BuildOptions {
  /** Rendered scale baseline. Cosmo at ~30-40% portrait height @ FOV 35, dist 6. */
  scale?: number;
}

export function buildCosmoV2(options: BuildOptions = {}): CosmoV2Rig {
  const baseScale = options.scale ?? 1.1;

  // Shared skin material: body + head wear the same painted-tile so the
  // silhouette reads as one being instead of two stacked primitives.
  // Wave 21 — try the v2-final body-skin first, fall back to wave20a tile.
  const loader = new THREE.TextureLoader();
  const skinTexture = loader.load(
    assetPath(`${V2_FINAL_DECAL_BASE}/body-skin.png`),
    undefined,
    undefined,
    () => {
      // v2-final not deployed yet → fall back to wave20a tile.
      const fallback = loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-body-skin.png`));
      fallback.colorSpace = THREE.SRGBColorSpace;
      fallback.wrapS = THREE.RepeatWrapping;
      fallback.wrapT = THREE.RepeatWrapping;
      skinMaterial.map = fallback;
      skinMaterial.needsUpdate = true;
    },
  );
  skinTexture.colorSpace = THREE.SRGBColorSpace;
  skinTexture.wrapS = THREE.RepeatWrapping;
  skinTexture.wrapT = THREE.RepeatWrapping;

  const skinMaterial = new THREE.MeshStandardMaterial({
    map: skinTexture,
    color: 0xc4d6a8,
    roughness: 0.85,
    metalness: 0.0,
  });

  // ── Root + body ────────────────────────────────────────────────────────
  const root = new THREE.Group();
  root.name = 'cosmoV2_root';
  root.scale.setScalar(baseScale);

  const body = new THREE.Object3D();
  body.name = 'cosmoV2_body';
  root.add(body);

  // Wave 20a fix (proportions): kid-alien proportions instead of green-pill.
  // Body shorter + thinner so head reads dominant. Head bigger + more
  // pearl-drop Y-squash. Head sits with overlap on body-top to hide collar
  // seam. All values tuned by visual reference (cosmo-preview.png + LoRA hero).
  const bodyGeo = new THREE.CapsuleGeometry(0.30, 0.45, 8, 16);
  const bodyMesh = new THREE.Mesh(bodyGeo, skinMaterial);
  bodyMesh.position.y = 0.40;
  body.add(bodyMesh);

  // ── Head ───────────────────────────────────────────────────────────────
  const head = new THREE.Object3D();
  head.name = 'cosmoV2_head';
  head.position.y = 1.05; // ~0.2 overlap into body top so no visible collar seam
  body.add(head);

  const headGeo = new THREE.SphereGeometry(0.55, 24, 18);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.scale.set(1.0, 0.85, 1.0); // pearl-drop: more vertical squash
  head.add(headMesh);

  // ── Antenna ────────────────────────────────────────────────────────────
  const antennaBase = new THREE.Object3D();
  antennaBase.name = 'cosmoV2_antennaBase';
  antennaBase.position.set(0, 0.47, 0); // top of squashed head (0.55 * 0.85 ≈ 0.47)
  head.add(antennaBase);

  const antennaShaftGeo = new THREE.CylinderGeometry(0.020, 0.025, 0.28, 8);
  const antennaShaftMat = new THREE.MeshBasicMaterial({ color: 0x6f8060 });
  const antennaShaft = new THREE.Mesh(antennaShaftGeo, antennaShaftMat);
  antennaShaft.position.y = 0.14;
  antennaBase.add(antennaShaft);

  const antennaTip = new THREE.Object3D();
  antennaTip.name = 'cosmoV2_antennaTip';
  antennaTip.position.y = 0.30;
  antennaBase.add(antennaTip);

  const bulbGeo = new THREE.SphereGeometry(0.10, 16, 12); // bigger + smoother
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xc25a4a,
    emissive: 0x5c1a14,
    emissiveIntensity: 0.30,
    roughness: 0.55,
  });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  antennaTip.add(bulb);

  // ── Face decal ─────────────────────────────────────────────────────────
  // Single painted plane carrying eyes + mouth as one watercolor stroke.
  // Texture is swappable per face-state. Pre-load all 4 so swap is instant.
  const faceTextures: Record<FaceState, THREE.Texture> = {
    neutral: loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-face-neutral.png`)),
    coo: loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-face-coo.png`)),
    blink: loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-face-blink.png`)),
    wave: loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-face-wave.png`)),
  };
  for (const tex of Object.values(faceTextures)) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const faceMaterial = new THREE.MeshBasicMaterial({
    map: faceTextures.neutral,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  });

  // Face plane scaled to fit the bigger head; positioned slightly forward
  // (just past the +Z hemisphere of the head sphere) so it reads as ON the
  // face. Wave 20b will replace this with curved billboard geometry for
  // better silhouette read at side-angles.
  const faceGeo = new THREE.PlaneGeometry(0.95, 0.65);
  const faceDecal = new THREE.Mesh(faceGeo, faceMaterial);
  faceDecal.name = 'cosmoV2_faceDecal';
  faceDecal.position.set(0, 0.0, 0.50);
  head.add(faceDecal);

  let currentFaceState: FaceState = 'neutral';

  // ── Wave 21 — Split decals (eyeL / eyeR / mouth / antenna-flower) ──────
  // Each decal is a thin plane parented at the appropriate bone. They sit
  // slightly in front of the composite face plane (faceDecal) on Z so they
  // overdraw it. If the v2-final asset is missing, the plane is hidden in
  // the load-error callback; the composite face-decal remains visible as
  // the legacy fallback path.
  const eyePlaneGeo = new THREE.PlaneGeometry(0.27, 0.27);
  const mouthPlaneGeo = new THREE.PlaneGeometry(0.32, 0.18);
  const antennaPlaneGeo = new THREE.PlaneGeometry(0.20, 0.20);

  function loadDecalPlane(
    file: string, geo: THREE.PlaneGeometry, position: THREE.Vector3,
    parent: THREE.Object3D, name: string,
  ): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, alphaTest: 0.05, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.position.copy(position);
    // Hide until the texture loads — prevents a one-frame untextured flash.
    mesh.visible = false;
    parent.add(mesh);
    loader.load(
      assetPath(`${V2_FINAL_DECAL_BASE}/${file}`),
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.needsUpdate = true;
        mesh.visible = true;
      },
      undefined,
      () => {
        // v2-final asset missing → keep hidden; composite face-decal stays
        // visible as legacy fallback. No console.warn (graceful fallback).
        mesh.visible = false;
      },
    );
    return mesh;
  }

  // Eyes (head-relative). z=0.51 is a hair in front of the face plane (z=0.50).
  const eyeDecalL = loadDecalPlane(
    'eyes-l.png', eyePlaneGeo,
    new THREE.Vector3(-0.18, 0.06, 0.51), head, 'cosmoV2_eyeDecalL',
  );
  const eyeDecalR = loadDecalPlane(
    'eyes-r.png', eyePlaneGeo,
    new THREE.Vector3(0.18, 0.06, 0.51), head, 'cosmoV2_eyeDecalR',
  );
  // Mouth — under eyes.
  const mouthDecal = loadDecalPlane(
    'mouth-neutral.png', mouthPlaneGeo,
    new THREE.Vector3(0, -0.16, 0.51), head, 'cosmoV2_mouthDecal',
  );
  // Antenna flower-bulb — billboard plane at antenna tip.
  const antennaFlowerDecal = loadDecalPlane(
    'antenna-flower.png', antennaPlaneGeo,
    new THREE.Vector3(0, 0, 0), antennaTip, 'cosmoV2_antennaFlowerDecal',
  );

  // ── Discs (free-floating suction-cup arms) ─────────────────────────────
  // Wave 21 — try v2-final disc first, fall back to wave20a.
  const discTexture = loader.load(
    assetPath(`${V2_FINAL_DECAL_BASE}/disc-suction.png`),
    undefined, undefined,
    () => {
      const fallback = loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-disc-suction.png`));
      fallback.colorSpace = THREE.SRGBColorSpace;
      discMaterial.map = fallback;
      discMaterial.needsUpdate = true;
    },
  );
  discTexture.colorSpace = THREE.SRGBColorSpace;

  const discMaterial = new THREE.MeshStandardMaterial({
    map: discTexture,
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.0,
  });
  // Free-floating suction-cup discs — bigger now, repositioned further out
  // and forward of the body silhouette so they read as hand-tip discs, not
  // little buttons hiding behind the back. The disc-face points at the
  // camera (+Z) by rotating the cylinder so its flat top is the visible
  // pad surface.
  const discGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24);

  const discL = new THREE.Object3D();
  discL.name = 'cosmoV2_discL';
  discL.position.set(-0.55, 0.55, 0.35); // out + forward
  const discLMesh = new THREE.Mesh(discGeo, discMaterial);
  discLMesh.rotation.x = Math.PI / 2;
  discL.add(discLMesh);
  root.add(discL);

  const discR = new THREE.Object3D();
  discR.name = 'cosmoV2_discR';
  discR.position.set(0.55, 0.55, 0.35); // mirror
  const discRMesh = new THREE.Mesh(discGeo, discMaterial);
  discRMesh.rotation.x = Math.PI / 2;
  discR.add(discRMesh);
  root.add(discR);

  // ── Public methods ─────────────────────────────────────────────────────
  function setFaceState(state: FaceState): void {
    if (state === currentFaceState) return;
    const tex = faceTextures[state];
    if (!tex) return;
    faceMaterial.map = tex;
    faceMaterial.needsUpdate = true;
    currentFaceState = state;
  }

  function dispose(): void {
    bodyGeo.dispose();
    headGeo.dispose();
    antennaShaftGeo.dispose();
    bulbGeo.dispose();
    faceGeo.dispose();
    eyePlaneGeo.dispose();
    mouthPlaneGeo.dispose();
    antennaPlaneGeo.dispose();
    discGeo.dispose();
    skinMaterial.dispose();
    antennaShaftMat.dispose();
    bulbMat.dispose();
    faceMaterial.dispose();
    discMaterial.dispose();
    skinTexture.dispose();
    discTexture.dispose();
    for (const tex of Object.values(faceTextures)) tex.dispose();
    // Split-decal materials are owned by their meshes — dispose by walking.
    for (const mesh of [eyeDecalL, eyeDecalR, mouthDecal, antennaFlowerDecal]) {
      if (!mesh) continue;
      const m = mesh.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else (m as THREE.Material).dispose();
    }
  }

  return {
    root,
    body,
    head,
    antennaBase,
    antennaTip,
    faceDecal,
    eyeDecalL,
    eyeDecalR,
    mouthDecal,
    antennaFlowerDecal,
    discL,
    discR,
    setFaceState,
    dispose,
  };
}
