/**
 * TrampolineSpots — Sprint 17D
 *
 * Fixed in-biome interaction-spots replacing the old runner-style spawn-pool.
 * Each spot is a billboarded plane with the Sprint 15C
 * `organic-flesh-trampoline.png` asset, parked at a hand-authored (x, y, z)
 * inside the biome's `cameraBounds`. Every spot has a subtle hover-bob driven
 * by a per-spot phase offset so the cluster never reads as in-sync clones.
 *
 * Tap-detection
 * ─────────────
 * Pure-Three.js raycaster from the camera through the tap NDC. The closest
 * intersected spot is the "winner"; its world-position is handed back so
 * CosmoAgent can `walkTo()` it and bounce. No-hit → no-op (tapping empty
 * sky has no penalty per the 17D brief: "Geen hit → niets").
 *
 * Hover-bob formula
 *   y(t) = baseY + sin((t + phase) * BOB_FREQ) * BOB_AMPLITUDE
 *   phase ∈ [0, 2π) seeded per-spot at construction so spots desync.
 *
 * Composition-spec format (extension)
 * ───────────────────────────────────
 * Each biome's `composition-spec.json` may add an `interactionSpots` field:
 *
 *   "interactionSpots": {
 *     "trampolines": [
 *       { "x": -1.2, "y": 0, "z": -3.0 },
 *       { "x":  0.8, "y": 0, "z": -2.0 }
 *     ]
 *   }
 *
 * Positions must lie within the biome's MotionController bounds (±1.6 X,
 * depth -2 to -5). When the field is absent we fall back to a 3-spot
 * default arranged symmetrically around 0.
 *
 * Lifecycle
 * ─────────
 * - Constructed once (at boot or biome-load) with the spot list.
 * - `attach(scene)` adds all spot meshes to the THREE.Scene.
 * - `update(dt)` advances per-spot bob.
 * - `pickAtNDC(ndcX, ndcY)` runs raycaster, returns the closest spot
 *   (worldX, worldY, worldZ) or null.
 * - `dispose()` removes meshes + disposes geometry/material.
 *
 * Authoring notes
 *   - Spots stay STATIC in world-space; the camera moves around them. This
 *     means a tilted gyro reveals different spots in the framing.
 *   - We don't use AdditiveBlending (would wash out against bright biomes).
 *     Standard alpha + double-sided so the camera-pan can swing past behind
 *     them without culling artefacts.
 *   - The trampoline texture has natural subject-shadow inside its alpha,
 *     so we don't apply MeshStandardMaterial — Basic + texture is enough
 *     and cheaper on mobile.
 */
import * as THREE from 'three';
import { assetPath } from '../../core/assetPath';

const BOB_FREQ = 1.4; // rad/s
const BOB_AMPLITUDE = 0.05;
const PLANE_W = 1.0;
const PLANE_H = 0.6;
/** How forgiving the tap-pick is — we round-up the raycaster's `params.Mesh.threshold`
 *  via a slightly larger bounding plane geometry on each spot. */
const TAP_PADDING_FACTOR = 1.15;

/** Per-biome definition — JSON-friendly. */
export interface TrampolineSpotDef {
  x: number;
  y: number;
  z: number;
}

interface SpotInstance {
  def: TrampolineSpotDef;
  group: THREE.Group;
  mesh: THREE.Mesh;
  /** Phase offset in [0, 2π) — desyncs hover-bob. */
  phase: number;
  /** Cached base-Y (def.y) — bob offsets ride on top. */
  baseY: number;
}

/** Default spot layout when a biome's composition-spec omits `interactionSpots`. */
export const DEFAULT_TRAMPOLINE_SPOTS: readonly TrampolineSpotDef[] = [
  { x: -1.2, y: 0, z: -3.0 },
  { x: 0.0, y: 0, z: -2.4 },
  { x: 1.2, y: 0, z: -3.6 },
];

/** Pick result returned from `pickAtNDC()`. */
export interface SpotPick {
  /** World-space position of the picked spot (with current bob applied). */
  world: THREE.Vector3;
  /** Index into the spots-array — useful for callers that want to flash
   *  the picked spot's material on commit. */
  index: number;
}

export class TrampolineSpots {
  private spots: SpotInstance[] = [];
  private scene: THREE.Scene | null = null;
  private texture: THREE.Texture | null = null;
  private sharedMaterial: THREE.MeshBasicMaterial | null = null;
  private sharedGeometry: THREE.PlaneGeometry | null = null;
  private raycaster = new THREE.Raycaster();
  private ndcVec = new THREE.Vector2();
  /** Wall-clock time accumulator for hover-bob. */
  private t = 0;

  constructor(defs: readonly TrampolineSpotDef[] = DEFAULT_TRAMPOLINE_SPOTS) {
    this.buildSpots(defs);
  }

  /** Replace the active spot-list (e.g. on biome-change). Disposes previous
   *  meshes if the scene was attached. */
  setSpots(defs: readonly TrampolineSpotDef[]): void {
    const prevScene = this.scene;
    if (prevScene) {
      for (const s of this.spots) {
        if (s.group.parent) s.group.parent.remove(s.group);
      }
    }
    this.spots = [];
    this.buildSpots(defs);
    if (prevScene) {
      for (const s of this.spots) prevScene.add(s.group);
    }
  }

  /** Add all spots to the THREE.Scene. */
  attach(scene: THREE.Scene): void {
    this.scene = scene;
    for (const s of this.spots) scene.add(s.group);
  }

  /** Remove all spots from the scene + dispose GPU resources. */
  dispose(): void {
    for (const s of this.spots) {
      if (s.group.parent) s.group.parent.remove(s.group);
    }
    this.spots = [];
    this.sharedGeometry?.dispose();
    this.sharedGeometry = null;
    this.sharedMaterial?.dispose();
    this.sharedMaterial = null;
    this.texture?.dispose();
    this.texture = null;
    this.scene = null;
  }

  /** Per-frame tick — advances hover-bob. `dt` in seconds. */
  update(dt: number): void {
    this.t += dt;
    for (const s of this.spots) {
      const offset = Math.sin((this.t + s.phase) * BOB_FREQ) * BOB_AMPLITUDE;
      s.group.position.y = s.baseY + offset;
    }
  }

  /** Read-only view of the spot world-positions. Used by tests + debug HUDs. */
  positions(): readonly THREE.Vector3[] {
    return this.spots.map((s) => s.group.position.clone());
  }

  /** Number of currently-active spots. */
  count(): number {
    return this.spots.length;
  }

  /**
   * Cast a ray through (ndcX, ndcY) using `camera`. NDC is the standard
   * Three.js convention: -1..+1 with +Y up. The closest hit (Vector3 in
   * world-space) is returned, or null if no spot was hit.
   *
   * `ndcX = (clientX / viewportW) * 2 - 1`
   * `ndcY = -(clientY / viewportH) * 2 + 1`  (note Y flip vs CSS pixels)
   */
  pickAtNDC(camera: THREE.Camera, ndcX: number, ndcY: number): SpotPick | null {
    if (!this.spots.length) return null;
    this.ndcVec.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndcVec, camera);
    const meshes = this.spots.map((s) => s.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    // Closest hit is hits[0] (raycaster sorts by distance ascending).
    const hitMesh = hits[0].object as THREE.Mesh;
    const idx = this.spots.findIndex((s) => s.mesh === hitMesh);
    if (idx < 0) return null;
    return {
      world: this.spots[idx].group.position.clone(),
      index: idx,
    };
  }

  /** Get the world-position of the spot at `index`, or null if out of range. */
  positionOf(index: number): THREE.Vector3 | null {
    const s = this.spots[index];
    if (!s) return null;
    return s.group.position.clone();
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private buildSpots(defs: readonly TrampolineSpotDef[]): void {
    if (!this.texture) {
      this.texture = new THREE.TextureLoader().load(
        assetPath('assets/objects/organic-flesh-trampoline.png'),
      );
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }
    if (!this.sharedGeometry) {
      // Slight padding on the geometry so raycaster-tap is forgiving.
      this.sharedGeometry = new THREE.PlaneGeometry(
        PLANE_W * TAP_PADDING_FACTOR,
        PLANE_H * TAP_PADDING_FACTOR,
      );
    }
    if (!this.sharedMaterial) {
      this.sharedMaterial = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        alphaTest: 0.05,
      });
    }
    for (const def of defs) {
      const group = new THREE.Group();
      group.position.set(def.x, def.y, def.z);
      const mesh = new THREE.Mesh(this.sharedGeometry, this.sharedMaterial);
      // Lift the plane so its anchor is the bottom of the trampoline.
      mesh.position.y = PLANE_H / 2;
      group.add(mesh);
      const phase = Math.random() * Math.PI * 2;
      this.spots.push({
        def,
        group,
        mesh,
        phase,
        baseY: def.y,
      });
    }
  }
}
