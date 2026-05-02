/**
 * main.ts — Sprint 13A rebuild. Boots the dual-canvas (Three.js parallax + post-FX
 * underneath, Phaser 4 BeatScene on top) and wires the FFT bridge, gesture-bus,
 * progression and (Sprint 13C-ready) BiomeManager hooks.
 *
 * Compared to v0.8.0 (platformer):
 *   - L1Scene → BeatScene (single-screen, no physics, dead-centre Cosmo)
 *   - 8-band FFT bridge stays exactly the same (architectural keep)
 *   - InputController is now gesture-driven; legacy left/right keys still
 *     work as a desktop tap-emulator (Space taps centre)
 *   - TouchOverlay is *not* attached — Sprint 13A vereenvoudigt naar pure
 *     gesture-input. The d-pad / jump / bomb buttons are platformer relics.
 *
 * The BiomeManager is constructed but `start()` is gated on the BiomeManager
 * having beat-track audio sources; for now we keep the static slow-bloom
 * parallax loaded directly. Sprint 13C wires the manager to the audio bridge
 * and Phaser scene.
 */
import Phaser from 'phaser';
import { createGlobalUniforms } from './core/globalUniforms';
import { CanvasManager } from './core/canvasManager';
import { InputController } from './core/inputController';
import { ParallaxScene } from './three/parallaxScene';
import { BIOMES } from './data/biomePresets';
import { TrippyEventDirector } from './three/postFX/trippyEventDirector';
import { AudioFFTBridge, HALLUCINATION_PEAKS } from './audio/audioFFTBridge';
import { BeatScene } from './phaser/scenes/BeatScene';
import { Progression } from './core/progression';
import { isTouchDevice } from './core/deviceDetect';
import { TouchOverlay } from './ui/touchOverlay';
import { BiomeManager } from './three/biomeManager';
import { announceVisit } from './share/dailyStreak';

const VERSION = '1.0.0';

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
  await parallax.loadBiome(BIOMES['slow-bloom']);

  const phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameMount,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    // No arcade physics — BeatScene is a single-screen presentation, all
    // entities are pure GameObjects + Graphics. Removing the physics step
    // removes a per-frame pass that the platformer needed.
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BeatScene],
  });

  const eventDirector = new TrippyEventDirector();
  const audioBridge = new AudioFFTBridge(uniforms);
  audioBridge.init();

  const progression = new Progression();
  progression.load();

  phaserGame.scene.start('BeatScene', {
    input,
    uniforms,
    audioBridge,
    progression,
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

  // Sprint 13E — BiomeManager wires audio + post-FX intensity. main.ts owns
  // the URL→audio swap; the manager only emits onTrackSwap with URLs.
  const biomeMgr = new BiomeManager(uniforms, {
    onTrackSwap: (nextUrl) => audioBridge.setMusicTrack(nextUrl),
  });
  biomeMgr.start();

  manager.register(() => audioBridge.update());
  manager.register((u) => eventDirector.update(u));
  manager.register((u) => parallax.update(u));
  manager.register((_u) => biomeMgr.update(1 / 60));
  manager.start();

  // Sprint 10C — wire trippy event director into audio bridge so kaleidoscope
  // peaks occasionally drag a hallucination-track over the base music.
  eventDirector.setOnSpikeFire(() => audioBridge.startHallucination(HALLUCINATION_PEAKS));

  // Sprint 13E — daily-streak pill on visit (auto-show 4s, dismissible).
  announceVisit();

  // Sprint 13A — disclaimer-only touch overlay (no d-pad). All gestures flow
  // through InputController's pointer listener, so the overlay only mounts a
  // tiny "Tik Cosmo aan op het beat" hint on touch devices.
  const touchOverlay = new TouchOverlay(input);
  touchOverlay.attachIfTouchDevice();

  // Expose for console-debug.
  if (import.meta.env.DEV) {
    (window as unknown as { cosmos: object }).cosmos = {
      uniforms,
      parallax,
      phaserGame,
      input,
      eventDirector,
      audioBridge,
      progression,
      isTouchDevice: isTouchDevice(),
      version: VERSION,
    };
    // eslint-disable-next-line no-console
    console.log('[cosmos] BeatScene ready. version', VERSION);
  }
}

void boot();
