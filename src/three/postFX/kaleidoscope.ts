/**
 * KaleidoscopeEffect — radial mirror around viewport center. Strength 0 = pass-through;
 * higher values mirror N-fold. Used both as ambient ripple (small constant) and as
 * on-trigger peak (5s power-up burst).
 */
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float sides;
uniform float angle;
uniform float strength;

void mainUv(inout vec2 uv) {
  if (strength <= 0.001) return;
  vec2 centered = uv - 0.5;
  float r = length(centered);
  float a = atan(centered.y, centered.x) + angle;
  float seg = 6.2831853 / sides;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 mirrored = vec2(cos(a), sin(a)) * r + 0.5;
  uv = mix(uv, mirrored, clamp(strength, 0.0, 1.0));
}
`;

interface KaleidoscopeOptions {
  sides?: number;
  angle?: number;
  strength?: number;
}

export class KaleidoscopeEffect extends Effect {
  constructor(opts: KaleidoscopeOptions = {}) {
    super('KaleidoscopeEffect', FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ['sides', new Uniform(opts.sides ?? 6)],
        ['angle', new Uniform(opts.angle ?? 0)],
        ['strength', new Uniform(opts.strength ?? 0)],
      ]),
    });
  }
}
