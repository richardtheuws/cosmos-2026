/**
 * cosmoStage.ts — Sprint 15B
 *
 * Dedicated Three.js sub-renderer for the 3D Cosmo character. Lives ON TOP of
 * the existing ParallaxScene (renderer.autoClear=false + clearDepth) so the
 * background still goes through the post-FX composer while Cosmo himself
 * stays crisp + legible. This matches the existing "world hallucinates,
 * Cosmo stays legible" rule in src/three/postFX/postFX.ts.
 *
 * Render order per frame:
 *
 *    parallax composer renders into the canvas (with post-FX)
 *    cosmoStage clears depth, renders Cosmo group on top  ← here
 *    Phaser HUD canvas paints over (vibe ring + altitude)
 *
 * The stage owns:
 *   - PerspectiveCamera that follows Cosmo's X with a deadzone
 *   - The Cosmo Object3D group (populated by CosmoAgent)
 *   - A simple soft-light setup (ambient + 2 directional) tuned for the
 *     Hayao×Moebius palette (warm fill, cool rim)
 *
 * It deliberately does NOT load the GLB itself — CosmoAgent does that and
 * adds the resulting model + AnimationMixer to `this.group`. Keeping the
 * stage agnostic of the model lets the 2D fallback (a textured plane) plug
 * into the same group without special-casing.
 */
import * as THREE from 'three';

const CAMERA_FOV = 35;
const CAMERA_DISTANCE = 6.0;
const CAMERA_HEIGHT = 1.4;
/** Horizontal deadzone (world units) — camera doesn't move while Cosmo
 *  walks inside this band. Keeps small idle wobbles from jiggling the view. */
const CAMERA_DEADZONE_X = 0.6;
/** Lerp factor for camera follow-X per frame at 60fps (frame-rate corrected). */
const CAMERA_FOLLOW_LERP = 6.0;

export class CosmoStage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Empty group; CosmoAgent adds the GLB or fallback plane to this. */
  readonly group: THREE.Group;
  private renderer: THREE.WebGLRenderer;
  /** World-X the camera lerps toward. */
  private camTargetX = 0;

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

  /** Per-frame camera follow with deadzone. `cosmoX` is world units. */
  followCamera(cosmoX: number, cosmoY: number, dt: number): void {
    const dx = cosmoX - this.camTargetX;
    if (Math.abs(dx) > CAMERA_DEADZONE_X) {
      // Pull the deadzone edge toward Cosmo (don't snap to centre).
      this.camTargetX += dx - Math.sign(dx) * CAMERA_DEADZONE_X;
    }
    const k = 1 - Math.exp(-CAMERA_FOLLOW_LERP * dt);
    this.camera.position.x += (this.camTargetX - this.camera.position.x) * k;
    // Camera height matches Cosmo's height with a small upward offset so we
    // see his face, not his feet.
    const targetY = cosmoY + CAMERA_HEIGHT;
    this.camera.position.y += (targetY - this.camera.position.y) * k;
    this.camera.lookAt(this.camera.position.x, cosmoY + 0.6, 0);
  }

  /** Render Cosmo on top of the parallax pass. Caller has already rendered
   *  the parallax composer this frame. */
  render(): void {
    const prevAutoClear = this.renderer.autoClear;
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
