// gradientCut.frag — architect §4.2.
// Diagonal smoothstep sweep from `fromColor` to `toColor`. Alpha eases in and
// out so the cut composites over post-FX without dipping to black.
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
