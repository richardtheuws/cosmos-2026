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

/** All face-state texture URLs the rig knows about. */
const FACE_STATES = ['neutral', 'coo', 'blink', 'wave'] as const;
export type FaceState = (typeof FACE_STATES)[number];

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
  /** Painted face plane on +Z front of head. Texture is swappable per state. */
  readonly faceDecal: THREE.Mesh;
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
  const loader = new THREE.TextureLoader();
  const skinTexture = loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-body-skin.png`));
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

  const bodyGeo = new THREE.CapsuleGeometry(0.45, 0.9, 8, 16);
  const bodyMesh = new THREE.Mesh(bodyGeo, skinMaterial);
  bodyMesh.position.y = 0.45;
  body.add(bodyMesh);

  // ── Head ───────────────────────────────────────────────────────────────
  const head = new THREE.Object3D();
  head.name = 'cosmoV2_head';
  head.position.y = 1.15;
  body.add(head);

  const headGeo = new THREE.SphereGeometry(0.5, 24, 18);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.scale.set(1.0, 0.92, 1.0);
  head.add(headMesh);

  // ── Antenna ────────────────────────────────────────────────────────────
  const antennaBase = new THREE.Object3D();
  antennaBase.name = 'cosmoV2_antennaBase';
  antennaBase.position.set(0, 0.46, 0);
  head.add(antennaBase);

  const antennaShaftGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.25, 8);
  const antennaShaftMat = new THREE.MeshBasicMaterial({ color: 0x6f8060 });
  const antennaShaft = new THREE.Mesh(antennaShaftGeo, antennaShaftMat);
  antennaShaft.position.y = 0.125;
  antennaBase.add(antennaShaft);

  const antennaTip = new THREE.Object3D();
  antennaTip.name = 'cosmoV2_antennaTip';
  antennaTip.position.y = 0.27;
  antennaBase.add(antennaTip);

  const bulbGeo = new THREE.SphereGeometry(0.07, 12, 10);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xc25a4a,
    emissive: 0x5c1a14,
    emissiveIntensity: 0.25,
    roughness: 0.6,
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

  const faceGeo = new THREE.PlaneGeometry(0.85, 0.55);
  const faceDecal = new THREE.Mesh(faceGeo, faceMaterial);
  faceDecal.name = 'cosmoV2_faceDecal';
  faceDecal.position.set(0, 0.04, 0.46);
  head.add(faceDecal);

  let currentFaceState: FaceState = 'neutral';

  // ── Discs (free-floating suction-cup arms) ─────────────────────────────
  const discTexture = loader.load(assetPath(`${V2_ASSET_BASE}/cosmo-disc-suction.png`));
  discTexture.colorSpace = THREE.SRGBColorSpace;

  const discMaterial = new THREE.MeshStandardMaterial({
    map: discTexture,
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.0,
  });
  const discGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24);

  const discL = new THREE.Object3D();
  discL.name = 'cosmoV2_discL';
  discL.position.set(-0.7, 0.6, 0.1);
  const discLMesh = new THREE.Mesh(discGeo, discMaterial);
  discLMesh.rotation.x = Math.PI / 2;
  discL.add(discLMesh);
  root.add(discL);

  const discR = new THREE.Object3D();
  discR.name = 'cosmoV2_discR';
  discR.position.set(0.7, 0.6, 0.1);
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
    discGeo.dispose();
    skinMaterial.dispose();
    antennaShaftMat.dispose();
    bulbMat.dispose();
    faceMaterial.dispose();
    discMaterial.dispose();
    skinTexture.dispose();
    discTexture.dispose();
    for (const tex of Object.values(faceTextures)) tex.dispose();
  }

  return {
    root,
    body,
    head,
    antennaBase,
    antennaTip,
    faceDecal,
    discL,
    discR,
    setFaceState,
    dispose,
  };
}
