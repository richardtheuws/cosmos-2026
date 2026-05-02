/**
 * Post-FX pipeline. Stacked on top of the Three.js parallax renderer using
 * pmndrs/postprocessing's EffectComposer. Constant-trippy by design — the base
 * permanent stack already feels hallucinatory, then peak triggers (star-pickup,
 * power-up, damage, boss-intro, bonus-warp) add another layer on top.
 *
 * The Phaser canvas overlays this composer's output — Phaser draws gameplay
 * sprites on a transparent canvas in front, so the post-FX hits the parallax
 * but not the gameplay sprites. That's intentional: the world hallucinates,
 * Cosmo stays legible.
 *
 * If we later want to post-FX the gameplay too, we render Phaser to a texture
 * and pipe it through the same composer.
 */
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from 'postprocessing';
import * as THREE from 'three';
import type { GlobalUniforms } from '../../core/globalUniforms';
import { KaleidoscopeEffect } from './kaleidoscope';
import { FluidDisplacementEffect } from './fluidDisplacement';
import { DatamoshEffect } from './datamosh';

export interface PostFX {
  composer: EffectComposer;
  resize(w: number, h: number): void;
  update(u: GlobalUniforms): void;
}

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  /* ── Permanent base stack — calm baseline, peaks via events ──────────── */
  // Sprint 18 calm-pass: 80% soft/breathing, 20% spikes. Weirdness is now
  // event-driven, not always-on. Old "constant-trippy" numbers preserved as
  // comments for reference.

  const bloom = new BloomEffect({
    intensity: 0.45, // was 0.8 — softer baseline, peaks lift via lows
    luminanceThreshold: 0.7, // was 0.62 — fewer pixels bloom
    luminanceSmoothing: 0.35,
    mipmapBlur: true,
    radius: 0.7, // was 0.85
  });

  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0028, 0.0032), // was 0.006/0.007
    radialModulation: true,
    modulationOffset: 0.05,
  });

  const fluid = new FluidDisplacementEffect({
    amplitude: 0.01, // was 0.022 — half-amp wobble floor
    frequency: 2.6,
  });

  const kaleido = new KaleidoscopeEffect({
    sides: 8.0,
    angle: 0.0,
    strength: 0.0,
  });

  const datamosh = new DatamoshEffect({ strength: 0.0 });

  const vignette = new VignetteEffect({
    darkness: 0.55,
    offset: 0.28,
    blendFunction: BlendFunction.NORMAL,
  });

  const noise = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  });
  noise.blendMode.opacity.value = 0.18; // was 0.32 — less grain crawl

  // Three passes — kept apart so convolution (bloom, chroma) and UV-warp (fluid, kaleido) don't collide.
  composer.addPass(new EffectPass(camera, fluid, kaleido));
  composer.addPass(new EffectPass(camera, datamosh));
  composer.addPass(new EffectPass(camera, chroma, bloom, vignette, noise));

  return {
    composer,

    resize(w, h): void {
      composer.setSize(w, h);
    },

    update(u): void {
      fluid.uniforms.get('time')!.value = u.time;

      // Audio-FFT drive — split 8 bands into lows/mids/highs averages.
      // bands 0..1 = sub/bass, 2..4 = mid (low-mid + mid + high-mid), 5..7 = air/sparkle.
      const f = u.audioFFT;
      const lows = (f[0] + f[1]) * 0.5;
      const mids = (f[2] + f[3] + f[4]) / 3;
      const highs = (f[5] + f[6] + f[7]) / 3;

      // Per-biome scalars (PRD §5). 1.0 = full base stack, lower = damped.
      // Defaults to 1 in createGlobalUniforms() so unattached scenes stay hot.
      const bi = u.biomeIntensity;

      // Sprint 18 calm-pass — DECOUPLED breathing.
      // bloom uses a slow sine (calm pulse).
      // chroma uses a SEPARATE faster, smaller sine so they don't lockstep into
      // a permanent "everything pulses together" hum.
      // Lows lift bloom (0..+0.35) but only when the bass actually plays.
      const bloomBreath = 0.5 + 0.5 * Math.sin(u.time * 0.45);
      bloom.intensity = (0.4 + bloomBreath * 0.18 + lows * 0.35) * bi.bloom; // was 0.7+0.45+0.6
      const chromaBreath = 0.5 + 0.5 * Math.sin(u.time * 0.31 + 1.7); // decoupled phase + slower rate
      const chromaScale = bi.chroma;
      chroma.offset.set(
        (0.0024 + chromaBreath * 0.0014) * chromaScale, // was 0.005+0.004
        (0.003 + chromaBreath * 0.0016) * chromaScale, // was 0.006+0.004
      );

      // Kaleidoscope: ambient floor is now ZERO. Prism only kicks in when an
      // event sets kaleidoTrigger (Director, power-up, boss-intro). Mids
      // contribute a tiny lift (0..0.06) that rides the music but stays
      // imperceptible at silence.
      // TODO(gameplay-agent): src/phaser/CosmoAI.ts (~line 273) does
      // `u.kaleidoTrigger = Math.max(u.kaleidoTrigger, 0.18)` per-frame on
      // certain Cosmo states. That floor causes permanent baseline kaleido even
      // with our ambient set to 0. Please drop those nudges or convert them to
      // one-shot pulses on state transitions only (not every frame).
      const ambientKaleido = 0; // was 0.16 + 0.08 * sin(t*0.7)
      const kStrength = (ambientKaleido + u.kaleidoTrigger * 0.55 + mids * 0.06) * bi.kaleido; // peak coeff was 0.7, mids was 0.25
      kaleido.uniforms.get('strength')!.value = kStrength;
      kaleido.uniforms.get('angle')!.value = u.time * 0.12 + mids * 0.6;

      // Fluid amplitude — soft floor + highs lift on shimmer peaks. The floor
      // is now a third of the old value (0.008 vs 0.022); highs only push
      // when air-band audio is loud, so silence = nearly still.
      fluid.uniforms.get('amplitude')!.value = (0.008 + highs * 0.016) * bi.fluid; // was 0.022+0.025

      // Datamosh — short bursts only. Hard-clamp via decay (damagePulse decays
      // over 0.2s in decayUniforms) so duration stays well under 400ms even on
      // a full 1.0 hit. NEVER baseline-on.
      datamosh.uniforms.get('strength')!.value = u.damagePulse;
      datamosh.uniforms.get('time')!.value = u.time;
    },
  };
}
