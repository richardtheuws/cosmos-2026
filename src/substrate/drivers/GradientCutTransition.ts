/**
 * Area↔Area transition — architect §4.2.
 *
 * Adds a fullscreen quad to the scene (z = 5, in front of the parallax stack
 * but BEHIND Cosmo per the cosmoStage compositing trace). The quad's
 * shader sweeps `fromColor` → `toColor` diagonally over `durationS`.
 *
 * Cosmo continues rendering on top via cosmoStage (architect §4.2: "Cosmo
 * continues rendering on top — the gradient-cut sits between parallax and
 * Cosmo").
 */
import * as THREE from 'three';
import type { ResolvedMood, TransitionDriver } from '../contracts/BehaviorContract';

const VERT_SRC = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG_SRC = /* glsl */ `
  uniform vec3 fromColor;
  uniform vec3 toColor;
  uniform float t;
  varying vec2 vUv;
  void main() {
    float sweep = smoothstep(t - 0.15, t + 0.15, vUv.x * 0.5 + vUv.y * 0.5);
    vec3 col = mix(fromColor, toColor, sweep);
    float alpha = t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0;
    gl_FragColor = vec4(col, alpha);
  }
`;

export class GradientCutTransition implements TransitionDriver {
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private elapsed = 0;
  private rafHandle = 0;

  constructor(
    private scene: THREE.Scene,
    private fromMood: ResolvedMood,
    private toMood: ResolvedMood,
    private durationS = 0.9,
  ) {}

  async run(_dt: number): Promise<void> {
    void _dt;
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT_SRC,
      fragmentShader: FRAG_SRC,
      uniforms: {
        fromColor: { value: hexToVec3(this.fromMood.primary) },
        toColor: { value: hexToVec3(this.toMood.primary) },
        t: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Render last in the scene (post the parallax stack), but Cosmo still draws
    // after via cosmoStage — that's the architect-spec compositing.
    this.mesh.renderOrder = 999;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (now: number): void => {
        if (!this.material) return;
        this.elapsed = (now - start) / 1000;
        const t = Math.min(1, this.elapsed / this.durationS);
        this.material.uniforms.t.value = t;
        if (t >= 1) {
          resolve();
          return;
        }
        this.rafHandle = requestAnimationFrame(tick);
      };
      this.rafHandle = requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geometry?.dispose();
    this.material?.dispose();
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }
}

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}
