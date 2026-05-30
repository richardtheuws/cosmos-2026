/**
 * TrampolineSpots — Sprint 17D, rebuilt Wave 22 (2026-05-30).
 *
 * Wave 22: the old `organic-flesh-trampoline.png` billboard is retired. Each
 * spot now renders a real built-from-primitives `Trampoline3D` (steel frame,
 * blue rim, white flexible mat) — Richard's brief: "een trampoline-trampoline …
 * waar Cosmo helemaal los op kan gaan." The mat flexes on impact via a spring.
 *
 * The public API is UNCHANGED so the existing wiring keeps working:
 *   - main.ts constructs it + attaches to CosmoStage.scene + ticks update(dt)
 *   - CosmoAI reads positions() for its 'curious' walk-to target
 *   - InteractionManager (CosmoScene) raycasts via pickAtNDC() → walkTo + bounce
 *
 * New: `impactNearest(x, z)` — the host pulses the mat under Cosmo when he
 * bounces (wired from CosmoAgent.onBounce in main.ts).
 *
 * Spots stay STATIC in world-space; the camera moves around them (Sprint 17B).
 * Group origin = the bounce surface (mat at y=0), so a spot at def.y=0 lets
 * Cosmo bounce ON the doek from his ground level. Legs hang below.
 */
import * as THREE from 'three';
import { Trampoline3D } from '../../three/trampoline3D';

/** Per-biome definition — JSON-friendly. */
export interface TrampolineSpotDef {
  x: number;
  y: number;
  z: number;
}

interface SpotInstance {
  def: TrampolineSpotDef;
  trampoline: Trampoline3D;
}

/** Default layout when a biome's composition-spec omits `interactionSpots`.
 *  Wave 22: ONE hero trampoline (NORTH-STAR §3 — one fully-alive delight loop
 *  beats three half-alive ones). Centred, mid-depth, on the ground (y=0). */
export const DEFAULT_TRAMPOLINE_SPOTS: readonly TrampolineSpotDef[] = [
  { x: 0.0, y: 0, z: -2.6 },
];

/** Pick result returned from `pickAtNDC()`. */
export interface SpotPick {
  /** World-space position of the picked trampoline. */
  world: THREE.Vector3;
  index: number;
}

export class TrampolineSpots {
  private spots: SpotInstance[] = [];
  private scene: THREE.Scene | null = null;
  private raycaster = new THREE.Raycaster();
  private ndcVec = new THREE.Vector2();

  constructor(defs: readonly TrampolineSpotDef[] = DEFAULT_TRAMPOLINE_SPOTS) {
    this.buildSpots(defs);
  }

  /** Replace the active spot-list (e.g. on biome-change). */
  setSpots(defs: readonly TrampolineSpotDef[]): void {
    const prevScene = this.scene;
    for (const s of this.spots) s.trampoline.dispose();
    this.spots = [];
    this.buildSpots(defs);
    if (prevScene) {
      for (const s of this.spots) prevScene.add(s.trampoline.group);
    }
  }

  /** Add all trampolines to the THREE.Scene. */
  attach(scene: THREE.Scene): void {
    this.scene = scene;
    for (const s of this.spots) scene.add(s.trampoline.group);
  }

  /** Remove + dispose all trampolines. */
  dispose(): void {
    for (const s of this.spots) s.trampoline.dispose();
    this.spots = [];
    this.scene = null;
  }

  /** Per-frame tick — advances each mat's flex spring. `dt` in seconds. */
  update(dt: number): void {
    for (const s of this.spots) s.trampoline.update(dt);
  }

  /** Read-only view of the trampoline world-positions (CosmoAI walk target). */
  positions(): readonly THREE.Vector3[] {
    return this.spots.map((s) => s.trampoline.group.position.clone());
  }

  count(): number {
    return this.spots.length;
  }

  /**
   * Cast a ray through (ndcX, ndcY) using `camera`; return the closest
   * trampoline hit (mat mesh) in world-space, or null. NDC convention:
   * `ndcX = (clientX / viewportW) * 2 - 1`, `ndcY = -(clientY / viewportH) * 2 + 1`.
   */
  pickAtNDC(camera: THREE.Camera, ndcX: number, ndcY: number): SpotPick | null {
    if (!this.spots.length) return null;
    this.ndcVec.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndcVec, camera);
    const meshes = this.spots.map((s) => s.trampoline.matMesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const hitMesh = hits[0].object as THREE.Mesh;
    const idx = this.spots.findIndex((s) => s.trampoline.matMesh === hitMesh);
    if (idx < 0) return null;
    return { world: this.spots[idx].trampoline.group.position.clone(), index: idx };
  }

  /** World-position of the trampoline at `index`, or null. */
  positionOf(index: number): THREE.Vector3 | null {
    const s = this.spots[index];
    return s ? s.trampoline.group.position.clone() : null;
  }

  /** Flex the mat of the trampoline nearest (x, z) in world-space — the host
   *  calls this when Cosmo bounces so the doek visibly gives. */
  impactNearest(x: number, z: number, strength = 1): void {
    let best: SpotInstance | null = null;
    let bestD = Infinity;
    for (const s of this.spots) {
      const p = s.trampoline.group.position;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    best?.trampoline.impact(strength);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private buildSpots(defs: readonly TrampolineSpotDef[]): void {
    for (const def of defs) {
      const trampoline = new Trampoline3D();
      trampoline.group.position.set(def.x, def.y, def.z);
      this.spots.push({ def, trampoline });
    }
  }
}
