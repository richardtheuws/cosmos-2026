/**
 * DatamoshEffect — horizontal stripe-shift + RGB-channel-split for damage moments.
 * Strength 0 = pass-through. Spike to 1.0 on damage; decays over 200ms.
 *
 * The stripe-shift uses pseudo-random hash per stripe-band so it looks chaotic
 * but stable for the duration of the spike (no per-frame jitter).
 */
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float strength;
uniform float time;

float hash11(float n) { return fract(sin(n) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (strength <= 0.001) {
    outputColor = inputColor;
    return;
  }
  float band = floor(uv.y * 18.0);
  float seed = hash11(band + floor(time * 60.0));
  float shift = (seed - 0.5) * 0.18 * strength;
  vec2 r_uv = uv + vec2(shift * 1.3, 0.0);
  vec2 g_uv = uv + vec2(shift * 0.4, 0.0);
  vec2 b_uv = uv + vec2(-shift * 1.1, 0.0);
  float r = texture2D(inputBuffer, clamp(r_uv, 0.0, 1.0)).r;
  float g = texture2D(inputBuffer, clamp(g_uv, 0.0, 1.0)).g;
  float b = texture2D(inputBuffer, clamp(b_uv, 0.0, 1.0)).b;
  vec3 torn = vec3(r, g, b);
  outputColor = vec4(mix(inputColor.rgb, torn, clamp(strength, 0.0, 1.0)), inputColor.a);
}
`;

interface DatamoshOptions {
  strength?: number;
}

export class DatamoshEffect extends Effect {
  constructor(opts: DatamoshOptions = {}) {
    super('DatamoshEffect', FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ['strength', new Uniform(opts.strength ?? 0)],
        ['time', new Uniform(0)],
      ]),
    });
  }
}
