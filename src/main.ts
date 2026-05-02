/**
 * main.ts — Sprint 15B rebuild. Boots the dual-canvas (Three.js parallax + post-FX
 * underneath, Phaser 4 CosmoScene HUD on top) and wires the FFT bridge, gesture-bus,
 * progression, BiomeManager, and the new weirdo auto-runner gameplay stack:
 *   ParallaxScene (background, post-FX) → CosmoStage (3D Cosmo + obstacles, no
 *   post-FX, on top) → Phaser HUD (vibe ring + altitude).
 *
 * Compared to v1.0.x (rhythm-tap):
 *   - BeatScene → CosmoScene (Phaser is HUD-only now)
 *   - CosmoRig (2D sprite) → CosmoAgent (3D GLB w/ 2D fallback) on CosmoStage
 *   - BeatTarget pool → ObstacleManager pool (in 3D scene)
 *   - AutoVJ (idle-detector) → CosmoAgent.tickRandomAgency (per-frame RNG events)
 *   - Combo counter → VibeMeter (ring around projected Cosmo) + DeepTripMode
 *
 * Audio bridge / parallax / post-FX / globalUniforms / BiomeManager are
 * untouched per sprint-15B brief.
 */
import Phaser from 'phaser';
import * as THREE from 'three';
import { createGlobalUniforms } from './core/globalUniforms';
import { CanvasManager } from './core/canvasManager';
import { InputController } from './core/inputController';
import { ParallaxScene } from './three/parallaxScene';
import { CosmoStage } from './three/cosmoStage';
import { BIOMES } from './data/biomePresets';
import { TrippyEventDirector } from './three/postFX/trippyEventDirector';
import { AudioFFTBridge, HALLUCINATION_PEAKS } from './audio/audioFFTBridge';
import { CosmoScene } from './phaser/scenes/CosmoScene';
import { CosmoAgent } from './phaser/entities/CosmoAgent';
import { ObstacleManager } from './phaser/entities/ObstacleManager';
import { createWeirdoObstacleFactory } from './phaser/entities/weirdoObstacleFactory';
import { Progression } from './core/progression';
import { isTouchDevice } from './core/deviceDetect';
import { TouchOverlay } from './ui/touchOverlay';
import { BiomeManager } from './three/biomeManager';
import { announceVisit } from './share/dailyStreak';

const VERSION = '1.1.0';

async function boot(): Promise<void> {
  const sceneCanvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  const gameMount = document.getElementById('game-canvas') as HTMLDivElement | null;
  if (!sceneCanvas || !gameMount) {
    throw new Error('main: missing #scene-canvas or #game-canvas');
  }

  const uniforms = createGlobalUniforms();
  const manager = new CanvasManager(uniforms);
  const input = new InputController();
  input.attach();

  const parallax = new ParallaxScene(sceneCanvas);
  // Sprint 14B — single 4K plane per biome. Awaited so the first frame paints.
  await parallax.loadBiome(BIOMES['slow-bloom']);

  // Sprint 15B — Three.js sub-renderer for 3D Cosmo + obstacles. Renders ON
  // TOP of the parallax composer (autoClear=false + clearDepth) so post-FX
  // hits the world but not Cosmo.
  const cosmoStage = new CosmoStage(parallax.renderer);

  const phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameMount,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    // No arcade physics — CosmoScene is a HUD overlay, all motion is in
    // CosmoStage's THREE.Scene.
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [CosmoScene],
  });

  const eventDirector = new TrippyEventDirector();
  const audioBridge = new AudioFFTBridge(uniforms);
  audioBridge.init();

  const progression = new Progression();
  progression.load();

  // Sprint 15B — gameplay stack lives outside the Phaser scene so its
  // lifetime tracks main.ts (Phaser scene swaps don't tear down the agent).
  // VibeMeter / InteractionManager / DeepTripMode need a Phaser.Scene
  // (VibeMeter draws Graphics) — they're constructed inside CosmoScene's
  // create() using the agent/obstacles/audio passed in here.
  const cosmoAgent = new CosmoAgent(cosmoStage.group);
  const obstacles = new ObstacleManager(cosmoStage.scene, {
    audioNow: () => audioBridge.musicCurrentTime(),
  });
  // Sprint 15E — swap default canvas-primitives for the 8 fal.ai weirdo objects
  // (Sprint 15C deliverable). Each ObstacleKind picks a random pool member per
  // spawn so the playthrough never feels repetitive.
  obstacles.setObstacleFactory(createWeirdoObstacleFactory());

  phaserGame.scene.start('CosmoScene', {
    input,
    uniforms,
    audioBridge,
    progression,
    cosmoAgent,
    cosmoStage,
    obstacles,
    version: VERSION,
  });

  // Browser autoplay policy — first user gesture unlocks the AudioContext.
  const unlockAudio = (): void => {
    audioBridge.ensureRunning();
  };
  window.addEventListener('click', unlockAudio, { once: false, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: false, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: false, passive: true });

  // Debug + control hotkeys: M = toggle music mute, F = log FFT snapshot.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'KeyM') {
      const muted = audioBridge.toggleMute();
      // eslint-disable-next-line no-console
      console.log(`[cosmos] music ${muted ? 'muted' : 'unmuted'}`);
    } else if (e.code === 'KeyF') {
      // eslint-disable-next-line no-console
      console.log('[cosmos] FFT snapshot', audioBridge.snapshot());
    }
  });

  const biomeMgr = new BiomeManager(uniforms, {
    onTrackSwap: (nextUrl) => audioBridge.setMusicTrack(nextUrl),
  });
  biomeMgr.onChange((biome) => {
    void parallax.loadBiome(biome);
  });
  biomeMgr.start();

  // Per-frame ticks. Order matters: audio first (so FFT is fresh for the
  // event-director and Cosmo's mixer), then post-FX-driving systems, then
  // gameplay (CosmoAgent), then renderers.
  manager.register(() => audioBridge.update());
  manager.register((u) => eventDirector.update(u));
  manager.register((u) => parallax.update(u));
  manager.register((u) => {
    const dt = u.delta;
    cosmoAgent.update(u, dt);
    obstacles.update(dt, u.time, cosmoAgent.worldX);
    cosmoStage.followCamera(cosmoAgent.worldX, cosmoAgent.worldY, dt);
    cosmoStage.render();
  });
  manager.register((_u) => biomeMgr.update(1 / 60));
  manager.start();

  // Track viewport for the CosmoStage camera.
  window.addEventListener(
    'resize',
    () => cosmoStage.resize(window.innerWidth, window.innerHeight),
    { passive: true },
  );
  cosmoStage.resize(window.innerWidth, window.innerHeight);

  // Sprint 10C — wire trippy event director into audio bridge so kaleidoscope
  // peaks occasionally drag a hallucination-track over the base music.
  eventDirector.setOnSpikeFire(() => audioBridge.startHallucination(HALLUCINATION_PEAKS));

  // Sprint 13E — daily-streak pill on visit (auto-show 4s, dismissible).
  announceVisit();

  // Sprint 13A — disclaimer-only touch overlay (no d-pad).
  const touchOverlay = new TouchOverlay(input);
  touchOverlay.attachIfTouchDevice();

  // Expose for console-debug.
  if (import.meta.env.DEV) {
    (window as unknown as { cosmos: object }).cosmos = {
      uniforms,
      parallax,
      cosmoStage,
      cosmoAgent,
      obstacles,
      phaserGame,
      input,
      eventDirector,
      audioBridge,
      progression,
      isTouchDevice: isTouchDevice(),
      version: VERSION,
      THREE,
    };
    // eslint-disable-next-line no-console
    console.log('[cosmos] CosmoScene ready. version', VERSION);
  }
}

void boot();
