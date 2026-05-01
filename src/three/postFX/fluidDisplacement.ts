/**
 * FluidDisplacementEffect — gentle wet-edge curl-noise wobble on the entire
 * frame. Constant ON (low amplitude) so the watercolor feels alive even when
 * nothing else is happening. Frequency cranks up on DMT-peaks via globalUniforms.
 */
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float time;
uniform float amplitude;
uniform float frequency;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)), dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)), dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y
  );
}

void mainUv(inout vec2 uv) {
  float t = time * 0.18;
  vec2 p = uv * frequency;
  float dx = noise(p + vec2(t, 0.0));
  float dy = noise(p + vec2(0.0, t * 1.13));
  uv += vec2(dx, dy) * amplitude;
}
`;

interface FluidDisplacementOptions {
  amplitude?: number;
  frequency?: number;
}

export class FluidDisplacementEffect extends Effect {
  constructor(opts: FluidDisplacementOptions = {}) {
    super('FluidDisplacementEffect', FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ['time', new Uniform(0)],
        ['amplitude', new Uniform(opts.amplitude ?? 0.008)],
        ['frequency', new Uniform(opts.frequency ?? 1.5)],
      ]),
    });
  }
}
