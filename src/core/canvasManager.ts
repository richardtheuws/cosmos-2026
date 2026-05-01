/**
 * Dual-canvas orchestration. Three.js (3D parallax + post-FX) renders behind on
 * #scene-canvas. Phaser 4 (2D gameplay) renders in front on #game-canvas with
 * transparent background. Both share viewport size + DPR.
 *
 * Renderers register tick callbacks; the manager drives a single rAF loop.
 */
import type { GlobalUniforms } from './globalUniforms';
import { decayUniforms } from './globalUniforms';

type Tick = (u: GlobalUniforms) => void;

export class CanvasManager {
  private uniforms: GlobalUniforms;
  private ticks: Tick[] = [];
  private last = performance.now();
  private rafId = 0;
  private running = false;

  constructor(uniforms: GlobalUniforms) {
    this.uniforms = uniforms;
    this.bindResize();
  }

  /** Register a per-frame callback. Order matters: register Phaser before Three.js if Phaser drives gameplay state that shaders read. */
  register(tick: Tick): void {
    this.ticks.push(tick);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.uniforms.time += dt;
      this.uniforms.delta = dt;
      decayUniforms(this.uniforms, dt);
      for (const tick of this.ticks) tick(this.uniforms);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private bindResize(): void {
    const onResize = (): void => {
      this.uniforms.viewportW = window.innerWidth;
      this.uniforms.viewportH = window.innerHeight;
    };
    window.addEventListener('resize', onResize, { passive: true });
  }
}
