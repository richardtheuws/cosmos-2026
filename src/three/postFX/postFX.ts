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

  /* ── Permanent base stack — tuned hot for constant-trippy feel ──────── */

  const bloom = new BloomEffect({
    intensity: 0.8,
    luminanceThreshold: 0.62,
    luminanceSmoothing: 0.35,
    mipmapBlur: true,
    radius: 0.85,
  });

  const chroma = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.006, 0.007),
    radialModulation: true,
    modulationOffset: 0.05,
  });

  const fluid = new FluidDisplacementEffect({
    amplitude: 0.022,
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
  noise.blendMode.opacity.value = 0.32;

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

      // Constant-trippy breathing — slow sine drives bloom + chroma in lockstep.
      const breath = 0.5 + 0.5 * Math.sin(u.time * 0.45);
      bloom.intensity = 0.7 + breath * 0.45;
      chroma.offset.set(0.005 + breath * 0.004, 0.006 + breath * 0.004);

      // Kaleidoscope strength: ambient ripple lifts to 0.18 (subtle continuous symmetry shimmer)
      // plus on-trigger spike to ~1.0 for star pickup.
      const ambientKaleido = 0.16 + 0.08 * Math.sin(u.time * 0.7);
      const kStrength = ambientKaleido + u.kaleidoTrigger * 0.7;
      kaleido.uniforms.get('strength')!.value = kStrength;
      kaleido.uniforms.get('angle')!.value = u.time * 0.12;

      // Datamosh — only on damage pulse.
      datamosh.uniforms.get('strength')!.value = u.damagePulse;
      datamosh.uniforms.get('time')!.value = u.time;
    },
  };
}
