/**
 * trampoline3D.ts — Wave 22 (2026-05-30) — the real trampoline.
 *
 * Richard's brief (2026-05-30): "een trampoline-trampoline, zo'n stalen framepje
 * met blauwe rand en wit flexibel doek om op te springen, waar Cosmo helemaal
 * los op kan gaan, ook met truukjes." So this is NOT the old organic-flesh
 * billboard — it's a built-from-primitives 3D trampoline:
 *
 *   - a steel ring frame with a blue rim (TorusGeometry, metallic)
 *   - four splayed steel legs to the ground
 *   - a WHITE FLEXIBLE MAT: a subdivided disc whose centre dips on impact and
 *     springs back with damped overshoot (a 1-DOF spring), so the doek visibly
 *     flexes when Cosmo lands and launches.
 *
 * Brand note (NORTH-STAR §3): the trampoline is a deliberate pop-object — the
 * one piece of "real" gear in the watercolor world. It is shaded soft (low
 * gloss, the stage's warm-fill + cool-rim lights) so it sits in the painting
 * rather than screaming chrome. The ≤5% pop-accent budget covers it.
 *
 * No post-FX touches this (it lives in CosmoStage.scene, rendered direct — see
 * cosmoStage.ts pipeline trace), so it stays crisp like Cosmo.
 *
 * Physics: a single damped-spring scalar `comp` (0 = flat, 1 = max dip). The mat
 * verts are displaced each frame by `comp * bowlShape(r)`. `impact(strength)`
 * injects downward velocity; the spring rings down to rest. Pure transforms,
 * no per-frame allocation.
 */
import * as THREE from 'three';

const RADIUS = 0.5; // mat + rim radius (world units, pre-group-scale)
const RIM_TUBE = 0.05;
const STAND_HEIGHT = 0.34; // how high the mat sits off the ground
const MAT_RINGS = 6; // concentric rings — more = smoother bowl
const MAT_SEGMENTS = 32;
const MAX_DIP = 0.42; // world-units the centre can sink at comp=1

// Damped-spring tunables — tuned for a lively-but-calm doek (rings down in ~0.6s).
const SPRING_K = 140; // stiffness
const SPRING_DAMP = 9; // damping
const COMP_MAX = 1.0;

// Palette — the CLASSIC trampoline combo (Richard, 2026-05-30): vivid blue
// safety-pad rim + bright white mat. A deliberate pop-object; the steel legs
// keep it grounded in the watercolor world.
const STEEL_COLOR = 0xb4c0cf; // brushed steel legs (a touch brighter)
const RIM_COLOR = 0x1a6ae5; // vivid cobalt blue pad (the classic blue)
const MAT_COLOR = 0xffffff; // bright white doek

export class Trampoline3D {
  /** Add this to a THREE.Scene; position/scale it via this group. */
  readonly group: THREE.Group;
  /** The mat mesh — exposed so callers can raycast it for tap-picking. */
  readonly matMesh: THREE.Mesh;

  private matGeo: THREE.BufferGeometry;
  /** Rest positions of the mat verts (y=0 plane); deform rides on top. */
  private restY: Float32Array;
  private radialDist: Float32Array;

  // Spring state.
  private comp = 0;
  private compVel = 0;

  private disposables: Array<{ dispose(): void }> = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'trampoline3d';

    // ── White flexible mat (subdivided disc in the XZ plane, normal +Y) ──
    const { geometry, restY, radial } = buildDisc(RADIUS * 0.92, MAT_RINGS, MAT_SEGMENTS);
    this.matGeo = geometry;
    this.restY = restY;
    this.radialDist = radial;
    const matMaterial = new THREE.MeshStandardMaterial({
      color: MAT_COLOR,
      roughness: 0.7,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveIntensity: 0.12, // lift the white so it reads bright, not grey-lit
      side: THREE.DoubleSide,
    });
    // Mat + rim sit at the group ORIGIN (y=0) so the group can be placed at
    // Cosmo's ground level and he bounces ON the doek. Legs hang DOWN to
    // y = -STAND_HEIGHT (the stand reaches below the bounce surface).
    this.matMesh = new THREE.Mesh(this.matGeo, matMaterial);
    this.matMesh.name = 'trampoline_mat';
    this.matMesh.position.y = 0;
    this.group.add(this.matMesh);
    this.disposables.push(this.matGeo, matMaterial);

    // ── Blue rim (torus laid flat around Y) ──
    const rimGeo = new THREE.TorusGeometry(RADIUS, RIM_TUBE, 10, MAT_SEGMENTS);
    const rimMat = new THREE.MeshStandardMaterial({
      color: RIM_COLOR,
      roughness: 0.45,
      metalness: 0.15, // low metal so the cobalt reads VIVID, not dark-chrome
      emissive: RIM_COLOR,
      emissiveIntensity: 0.18, // keep the blue saturated even in shade
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2; // lay flat
    rim.position.y = 0;
    this.group.add(rim);
    this.disposables.push(rimGeo, rimMat);

    // ── Four splayed steel legs (from the rim down to the ground) ──
    const legMat = new THREE.MeshStandardMaterial({
      color: STEEL_COLOR,
      roughness: 0.4,
      metalness: 0.6,
    });
    this.disposables.push(legMat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const top = new THREE.Vector3(Math.cos(a) * RADIUS * 0.92, 0, Math.sin(a) * RADIUS * 0.92);
      const foot = new THREE.Vector3(Math.cos(a) * RADIUS * 1.18, -STAND_HEIGHT, Math.sin(a) * RADIUS * 1.18);
      const leg = makeStrut(top, foot, 0.035, legMat);
      this.group.add(leg.mesh);
      this.disposables.push(leg.geo);
    }
  }

  /** Inject a downward impulse — Cosmo just hit the mat. `strength` ~ [0..1+]. */
  impact(strength = 1): void {
    this.compVel += Math.max(0, strength) * 9;
  }

  /** Per-frame: advance the spring and re-displace the mat. `dt` in seconds. */
  update(dt: number): void {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    // Damped spring toward rest (comp=0). Sub-step for stability at low fps.
    const steps = dt > 1 / 45 ? 2 : 1;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      const accel = -SPRING_K * this.comp - SPRING_DAMP * this.compVel;
      this.compVel += accel * h;
      this.comp += this.compVel * h;
      if (this.comp < 0) this.comp = 0; // mat can't bulge above the rim
      if (this.comp > COMP_MAX) {
        this.comp = COMP_MAX;
        this.compVel = 0;
      }
    }
    this.applyDeform();
  }

  private applyDeform(): void {
    const pos = this.matGeo.getAttribute('position') as THREE.BufferAttribute;
    const dip = this.comp * MAX_DIP;
    for (let i = 0; i < pos.count; i++) {
      // bowl: deepest at centre, zero at rim. cos ramp = smooth doek.
      const rN = this.radialDist[i]; // 0..1
      const shape = Math.cos(rN * (Math.PI / 2)); // 1 centre → 0 rim
      pos.setY(i, this.restY[i] - dip * shape);
    }
    pos.needsUpdate = true;
    this.matGeo.computeVertexNormals();
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Build a flat disc (XZ plane, normal +Y) as concentric rings so the centre
 *  can be displaced into a smooth bowl. Returns geometry + rest-Y + normalised
 *  radial distance per vertex (0 centre … 1 rim). */
function buildDisc(
  radius: number,
  rings: number,
  segments: number,
): { geometry: THREE.BufferGeometry; restY: Float32Array; radial: Float32Array } {
  const verts: number[] = [];
  const radial: number[] = [];
  // ring 0 = centre point repeated `segments` times (keeps indexing uniform).
  for (let i = 0; i <= rings; i++) {
    const r = radius * (i / rings);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      verts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      radial.push(i / rings);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < segments; s++) {
      const sNext = (s + 1) % segments;
      const a = i * segments + s;
      const b = i * segments + sNext;
      const c = (i + 1) * segments + s;
      const d = (i + 1) * segments + sNext;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const restY = new Float32Array(verts.length / 3); // all zero (flat rest)
  return { geometry, restY, radial: new Float32Array(radial) };
}

/** A cylinder strut spanning A→B with the given radius. */
function makeStrut(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): { mesh: THREE.Mesh; geo: THREE.CylinderGeometry } {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius * 1.1, len, 6);
  const mesh = new THREE.Mesh(geo, material);
  // Cylinder default axis is +Y; orient it along dir, centre at midpoint.
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return { mesh, geo };
}
