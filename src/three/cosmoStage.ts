/**
 * cosmoStage.ts — Sprint 17B (render-pipeline trace updated Sprint 18)
 *
 * Dedicated Three.js sub-renderer for the 3D Cosmo character. Renders ON TOP of
 * the existing ParallaxScene (renderer.autoClear=false + clearDepth) so the
 * background still goes through the post-FX composer while Cosmo himself
 * stays crisp + legible.
 *
 * Sprint 17B refactor — companion-mode camera
 * ─────────────────────────────────────────────
 *   The old `followCamera(cosmoX, cosmoY, dt)` runner-mechanic is GONE. Cosmo
 *   no longer scrolls the world from right to left; he stays anchored at the
 *   centre of the biome and only the camera pans on user-motion (gyro/mouse)
 *   or companion auto-drift. This unlocks the "always-alive" feeling where
 *   tilting the phone or moving the mouse subtly shifts the view, and after
 *   8s of no-input the camera breathes on its own.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  COMPOSITING / RENDER-PIPELINE TRACE — DO NOT REORDER WITHOUT REASON     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Per-frame order (driven from main.ts CanvasManager):                    ║
 * ║                                                                          ║
 * ║   1. audioBridge.update()             — fresh FFT into uniforms          ║
 * ║   2. eventDirector.update(u)          — writes ONLY to uniforms          ║
 * ║                                          (kaleidoTrigger / damagePulse   ║
 * ║                                          / etc). NEVER touches Cosmo     ║
 * ║                                          materials directly.             ║
 * ║   3. motion.tick(dt)                  — smoothed pan vector              ║
 * ║   4. parallax.update(u, motion)                                          ║
 * ║       ├─ shifts each parallax-layer plane                                ║
 * ║       ├─ ticks decoration sprite-sheets                                  ║
 * ║       ├─ postFX.update(u)                                                ║
 * ║       └─ postFX.composer.render()  ← writes parallax.scene to CANVAS,    ║
 * ║                                       through fluid → kaleido →          ║
 * ║                                       datamosh → chroma → bloom →        ║
 * ║                                       vignette → noise. The final        ║
 * ║                                       pass blits to the default          ║
 * ║                                       framebuffer (canvas).              ║
 * ║   5. cosmoAI.tick(dt) + cosmoAgent.update(...)                           ║
 * ║   6. cosmoStage.render()           ← THIS FILE.                          ║
 * ║       ├─ renderer.autoClear = false  (preserve canvas color = post-FX'd  ║
 * ║       │                                parallax already on screen)       ║
 * ║       ├─ renderer.clearDepth()       (so Cosmo isn't z-occluded by the   ║
 * ║       │                                parallax planes that wrote depth) ║
 * ║       └─ renderer.render(scene, cam) (DIRECT renderer call — Cosmo       ║
 * ║                                        BYPASSES the composer entirely)   ║
 * ║   7. Phaser HUD DOM canvas paints over (vibe ring, altitude).            ║
 * ║                                                                          ║
 * ║  ⇒ INVARIANT: post-FX (fluid/kaleido/chroma/bloom/datamosh) NEVER        ║
 * ║    touches Cosmo. The world warps trippy, Cosmo stays DNA-correct        ║
 * ║    (Sprint 16A LoRA-locked silhouette). If a future change pipes         ║
 * ║    Cosmo through composer.render() — STOP. That breaks the brand.        ║
 * ║                                                                          ║
 * ║  Possible perceived warping is CHROMA FRINGE + BLOOM HALO from bright    ║
 * ║  parallax pixels behind/around Cosmo's silhouette — that's post-fx       ║
 * ║  agent's domain (postFX.ts), not this file's.                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * The stage owns
 *   - PerspectiveCamera that pans on motion within biome.cameraBounds
 *   - The Cosmo Object3D group (populated by CosmoAgent)
 *   - A simple soft-light setup tuned for the Hayao×Moebius palette
 *
 * It deliberately does NOT load the GLB itself — CosmoAgent does that.
 */
import * as THREE from 'three';
import type { MotionController } from '../core/motionController';

const CAMERA_FOV = 35;
const CAMERA_DISTANCE = 6.0;
const CAMERA_HEIGHT = 1.4;
/** Default world-units the camera can pan from centre when no biome
 *  cameraBounds are supplied. Half-extent on each axis. */
const DEFAULT_PAN_RANGE_X = 1.6;
const DEFAULT_PAN_RANGE_Y = 0.6;
/** Lerp factor per frame at 60fps (frame-rate corrected) — smooth camera. */
const CAMERA_PAN_LERP = 6.0;

/** Biome-bounds the camera is clamped within during pan. Half-extents from
 *  scene-centre on each axis. Optional — biomes that don't supply bounds
 *  fall back to DEFAULT_PAN_RANGE_*. */
export interface CameraBounds {
  panRangeX: number;
  panRangeY: number;
}

export class CosmoStage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Empty group; CosmoAgent adds the GLB or fallback plane to this. */
  readonly group: THREE.Group;
  private renderer: THREE.WebGLRenderer;
  /** Target camera position the per-frame lerp moves toward. */
  private camTargetX = 0;
  private camTargetY = CAMERA_HEIGHT;
  /** Active biome bounds. Updated via setCameraBounds(). */
  private bounds: CameraBounds = {
    panRangeX: DEFAULT_PAN_RANGE_X,
    panRangeY: DEFAULT_PAN_RANGE_Y,
  };
  /** Parallax shift applied to objects in `group` whose `userData.depth` is
   *  set. depth=0 → moves with camera (no parallax); depth=1 → stays fixed in
   *  scene-space (max parallax). */
  private parallaxOffsetX = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();

    const aspect = renderer.domElement.width / Math.max(1, renderer.domElement.height);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100);
    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    this.camera.lookAt(0, CAMERA_HEIGHT, 0);

    // Soft Hayao×Moebius lighting — warm sun-fill + cool rim from behind so
    // the antenne-bloem catches highlight even in the deep-trip darkening.
    const ambient = new THREE.AmbientLight(0xffe4c2, 0.55);
    const fill = new THREE.DirectionalLight(0xfff1d8, 0.85);
    fill.position.set(2.5, 4, 3);
    const rim = new THREE.DirectionalLight(0x9fc6ff, 0.55);
    rim.position.set(-3, 2, -2);
    this.scene.add(ambient, fill, rim);

    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  /** Set the per-biome camera bounds. Pass partial — missing fields keep
   *  their previous value. Called by main.ts when a biome loads. */
  setCameraBounds(bounds: Partial<CameraBounds>): void {
    if (bounds.panRangeX !== undefined) this.bounds.panRangeX = bounds.panRangeX;
    if (bounds.panRangeY !== undefined) this.bounds.panRangeY = bounds.panRangeY;
  }

  /**
   * Sprint 17B — replaces `followCamera`. Reads the MotionController's
   * normalised pan vector in [-1..1] and maps it into world-units within
   * the biome's cameraBounds. The world stays still; the camera moves.
   *
   * `dt` in seconds — used for frame-rate-independent lerp.
   */
  panCamera(motion: MotionController, dt: number): void {
    const px = motion.getPanX();
    const py = motion.getPanY();

    this.camTargetX = px * this.bounds.panRangeX;
    // PanY is inverted because pointer-Y grows downward but we want "look up"
    // when the cursor goes up. Pixel-Y up = panY negative, so we negate.
    this.camTargetY = CAMERA_HEIGHT + -py * this.bounds.panRangeY;

    const k = 1 - Math.exp(-CAMERA_PAN_LERP * dt);
    this.camera.position.x += (this.camTargetX - this.camera.position.x) * k;
    this.camera.position.y += (this.camTargetY - this.camera.position.y) * k;
    // Look slightly ahead-of-camera in the pan direction so the framing
    // feels like Cosmo is reacting, not a locked-on portrait.
    this.camera.lookAt(this.camera.position.x * 0.6, CAMERA_HEIGHT, 0);

    // Subtle parallax — depth-tagged children of `group` shift counter to
    // the camera so they appear closer/further. Iterate once; cheap.
    this.parallaxOffsetX = this.camera.position.x;
    for (const child of this.group.children) {
      const depth = (child.userData?.depth as number | undefined) ?? 0;
      if (depth !== 0) {
        child.position.x = -this.parallaxOffsetX * depth;
      }
    }
  }

  /** Render Cosmo on top of the parallax pass. Caller has already rendered
   *  the parallax composer this frame.
   *
   *  CRITICAL: This is a DIRECT `renderer.render()` call — Cosmo intentionally
   *  bypasses the post-FX composer so fluid/kaleido/chroma/bloom never warp
   *  his DNA-locked silhouette (Sprint 16A LoRA brand-rule). DO NOT pipe this
   *  through `composer.render()` or any RenderPass — Cosmo is the one thing
   *  in the scene that must NEVER trip. See top-of-file pipeline trace.
   */
  render(): void {
    const prevAutoClear = this.renderer.autoClear;
    // Defensive: composer leaves the renderer's render-target unbound (=canvas
    // default framebuffer) but in case a future post-fx change forgets, force
    // null so we always paint Cosmo onto the visible canvas, never into a
    // composer ping-pong target where post-FX could re-process him next frame.
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = prevAutoClear;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Project a world-space point to screen-space CSS pixels. Used by the
   *  Phaser HUD layer to paint the vibe-ring around the rendered Cosmo. */
  projectToScreen(world: THREE.Vector3, viewportW: number, viewportH: number): { x: number; y: number } {
    const ndc = world.clone().project(this.camera);
    return {
      x: (ndc.x * 0.5 + 0.5) * viewportW,
      y: (-ndc.y * 0.5 + 0.5) * viewportH,
    };
  }
}
