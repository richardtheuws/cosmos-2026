/**
 * globalUniforms — single source of truth shared between Three.js (3D parallax + post-FX)
 * and Phaser 4 (2D gameplay). Updated once per frame in main.ts before either
 * renderer ticks. TSL nodes and Phaser filters both read from the same object.
 */
export interface BiomeIntensity {
  /** 0..1 multiplier on the bloom intensity peak (PRD §5 curve). */
  bloom: number;
  /** 0..1 multiplier on the kaleido strength ceiling. */
  kaleido: number;
  /** 0..1 multiplier on the fluid amplitude. */
  fluid: number;
  /** 0..1 multiplier on the chromatic-aberration offset. */
  chroma: number;
  /** 0..1 alpha of the parallax-stack (used during crossfade). */
  parallaxAlpha: number;
}

export interface GlobalUniforms {
  /** Seconds since boot (monotonic). */
  time: number;
  /** Delta in seconds for the current frame. */
  delta: number;
  /** 8-bin FFT of the audio bus, 0..1. Audio bridge fills this; renderers read. */
  audioFFT: Float32Array;
  /** World-space x of the player's collision center (Phaser pixels). */
  cosmoX: number;
  cosmoY: number;
  /** -1 = facing left, +1 = facing right. */
  cosmoFacing: 1 | -1;
  /** Player state machine flag for shaders that react to gameplay. */
  cosmoState: 'idle' | 'run' | 'jump' | 'fall' | 'cling' | 'damage' | 'death' | 'beat';
  /** Trigger pulses 1.0 then decays to 0 over `kaleidoTriggerDuration`. Power-up etc. */
  kaleidoTrigger: number;
  kaleidoTriggerDuration: number;
  /** Damage flash. Pulses to 1.0, decays over 0.2s. Drives datamosh-tear. */
  damagePulse: number;
  /** Camera position (pixels in Phaser space). Three.js parallax follows with multipliers. */
  cameraX: number;
  cameraY: number;
  /** Viewport (CSS pixels). Updated on resize. */
  viewportW: number;
  viewportH: number;
  /**
   * Per-biome post-FX intensity envelope (PRD §5). BiomeManager (Sprint 13C)
   * crossfades these values between biomes; postFX.ts multiplies its base
   * targets by these to scale the trip per biome. Defaults to 1.0 across the
   * board so games without a BiomeManager attached still render hot.
   */
  biomeIntensity: BiomeIntensity;
}

export function createGlobalUniforms(): GlobalUniforms {
  return {
    time: 0,
    delta: 0,
    audioFFT: new Float32Array(8),
    cosmoX: 0,
    cosmoY: 0,
    cosmoFacing: 1,
    cosmoState: 'idle',
    kaleidoTrigger: 0,
    kaleidoTriggerDuration: 5.0,
    damagePulse: 0,
    cameraX: 0,
    cameraY: 0,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    biomeIntensity: {
      bloom: 1,
      kaleido: 1,
      fluid: 1,
      chroma: 1,
      parallaxAlpha: 1,
    },
  };
}

/** Decay any pulse-style uniforms. Called once per frame from main loop. */
export function decayUniforms(u: GlobalUniforms, dt: number): void {
  if (u.kaleidoTrigger > 0) {
    u.kaleidoTrigger = Math.max(0, u.kaleidoTrigger - dt / u.kaleidoTriggerDuration);
  }
  if (u.damagePulse > 0) {
    u.damagePulse = Math.max(0, u.damagePulse - dt / 0.2);
  }
}
