/**
 * main.ts — boot the dual-canvas. Three.js draws the parallax background; Phaser
 * draws the gameplay plane on top with a transparent canvas. Both share a single
 * rAF loop driven by CanvasManager.
 *
 * S2 spike: prove sync. S3 onwards: load real assets, levels, post-FX.
 */
import Phaser from 'phaser';
import { createGlobalUniforms } from './core/globalUniforms';
import { CanvasManager } from './core/canvasManager';
import { InputController } from './core/inputController';
import { ParallaxScene } from './three/parallaxScene';
import { L1Scene } from './phaser/scenes/L1Scene';
import { BIOMES } from './data/biomes';
import { TrippyEventDirector } from './three/postFX/trippyEventDirector';
import { AudioFFTBridge } from './audio/audioFFTBridge';

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
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 1300 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [L1Scene],
  });

  phaserGame.scene.start('L1Scene', { input, uniforms });

  const eventDirector = new TrippyEventDirector();
  const audioBridge = new AudioFFTBridge(uniforms);
  audioBridge.init();

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

  manager.register(() => audioBridge.update());
  manager.register((u) => eventDirector.update(u));
  manager.register((u) => parallax.update(u));
  manager.start();

  // Expose for console-debug. Strip in production via tree-shake on `import.meta.env.DEV`.
  if (import.meta.env.DEV) {
    (window as unknown as { cosmos: object }).cosmos = { uniforms, parallax, phaserGame, input, eventDirector, audioBridge };
    // eslint-disable-next-line no-console
    console.log('[cosmos] dual-canvas ready. window.cosmos = { uniforms, parallax, phaserGame, input, eventDirector, audioBridge }');
  }
}

void boot();
