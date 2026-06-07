/**
 * AmbientField — Wave 25.5 "rooms breathe" (Richard's kader).
 *
 * A reusable drifting-mote field: a single THREE.Points cloud of soft particles
 * that drift slowly through a bounded volume around Cosmo's view, wrapping at the
 * edges so the room is never empty. Tuned per world it becomes forest spores,
 * dune sand-glints, ink-ocean plankton, or chart star-drift.
 *
 * Calm baseline (NORTH-STAR §3 — the world breathes, it does not shake): slow
 * drift + a gentle per-particle sway + a slow global opacity breath. No event
 * peaks, no interaction — wandering through it IS the reward (the dweller lens;
 * direct thing-interaction is a later layer).
 *
 * Implements InhabitantHandle so a universe's `inhabitants(ctx)` just pushes one.
 * Renders into the perspective cosmoStage scene (ctx.scene) behind Cosmo.
 */
import * as THREE from 'three';
import type { GlobalUniforms } from '../../core/globalUniforms';
import type { InhabitantHandle } from '../contracts/BehaviorContract';

export interface AmbientFieldOpts {
  id: string;
  count: number;
  color: number;
  /** Point size in world units (sizeAttenuation on). */
  size: number;
  opacity: number;
  /** Half-extents of the drift box, centred on `center`. */
  area: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  /** Base drift velocity (world units / second). Per-particle jittered ±40%. */
  drift: { x: number; y: number; z: number };
  /** Lateral sine-sway amplitude (units/s) layered on the x-drift. */
  sway: number;
  /** Additive blend for glow-motes (plankton, star-drift); false = soft alpha. */
  additive?: boolean;
}

export class AmbientField implements InhabitantHandle {
  readonly id: string;
  private readonly opts: AmbientFieldOpts;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.PointsMaterial;
  private readonly points: THREE.Points;
  private readonly vel: Float32Array;
  private readonly phase: Float32Array;
  private t = 0;

  constructor(scene: THREE.Scene, opts: AmbientFieldOpts) {
    this.opts = opts;
    this.id = opts.id;

    const n = opts.count;
    const pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    const { center: c, area: a, drift: d } = opts;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      pos[ix] = c.x + (Math.random() * 2 - 1) * a.x;
      pos[ix + 1] = c.y + (Math.random() * 2 - 1) * a.y;
      pos[ix + 2] = c.z + (Math.random() * 2 - 1) * a.z;
      const j = (): number => 0.6 + Math.random() * 0.8; // ±40% jitter
      this.vel[ix] = d.x * j();
      this.vel[ix + 1] = d.y * j();
      this.vel[ix + 2] = d.z * j();
      this.phase[i] = Math.random() * Math.PI * 2;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      color: opts.color,
      size: opts.size,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.renderOrder = -2; // behind Cosmo + decals
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.t += dt;
    const { center: c, area: a } = this.opts;
    const attr = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const n = this.opts.count;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      p[ix] += (this.vel[ix] + Math.sin(this.t * 0.3 + this.phase[i]) * this.opts.sway) * dt;
      p[ix + 1] += this.vel[ix + 1] * dt;
      p[ix + 2] += this.vel[ix + 2] * dt;
      // Wrap within the box so the field never drains.
      if (p[ix] > c.x + a.x) p[ix] = c.x - a.x;
      else if (p[ix] < c.x - a.x) p[ix] = c.x + a.x;
      if (p[ix + 1] > c.y + a.y) p[ix + 1] = c.y - a.y;
      else if (p[ix + 1] < c.y - a.y) p[ix + 1] = c.y + a.y;
      if (p[ix + 2] > c.z + a.z) p[ix + 2] = c.z - a.z;
      else if (p[ix + 2] < c.z - a.z) p[ix + 2] = c.z + a.z;
    }
    attr.needsUpdate = true;
    // Slow global opacity breath (never a flicker).
    this.mat.opacity = this.opts.opacity * (0.82 + 0.18 * Math.sin(this.t * 0.4));
  }

  dispose(): void {
    if (this.points.parent) this.points.parent.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}
