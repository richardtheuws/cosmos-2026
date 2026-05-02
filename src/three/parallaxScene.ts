/**
 * Three.js parallax background. Sprint 14B — single 4K plane per biome.
 *
 * Earlier we composed 3-4 layered images for cheap depth; the new 4K biome
 * images already bake in depth so we only need ONE plane that drifts gently
 * with the camera. This kills the white-fringe blend-ghost that appeared when
 * a transparent near-layer slid over an opaque clear-color (visible underneath
 * the camera frame on tall screens).
 *
 * If the texture fails to load (e.g. asset not yet generated), the scene just
 * keeps the ambient clear-color visible — the show still goes on.
 */
import * as THREE from 'three';
import type { GlobalUniforms } from '../core/globalUniforms';
import type { Biome } from '../data/biomePresets';
import { createPostFX, type PostFX } from './postFX/postFX';

interface RuntimeLayer {
  mesh: THREE.Mesh;
  parallax: number;
}

export class ParallaxScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  /** Active biome plane(s). Always 1 in the new pipeline; array kept so a
   *  future crossfade can hold an outgoing plane while the new one fades in. */
  private layers: RuntimeLayer[] = [];
  private ambientPlane: THREE.Mesh;
  private postFX: PostFX;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf5edd8, 1);

    const aspect = window.innerWidth / window.innerHeight;
    const halfH = 1;
    this.camera = new THREE.OrthographicCamera(-aspect * halfH, aspect * halfH, halfH, -halfH, 0.01, 100);
    this.camera.position.z = 5;

    // Ambient plane is now redundant with opaque clear-color, but kept as belt-and-braces
    // for biome ambient tinting that matches but isn't identical to clear (e.g. cave biome).
    const ambientGeo = new THREE.PlaneGeometry(40, 40);
    const ambientMat = new THREE.MeshBasicMaterial({ color: 0xf5edd8, depthWrite: false });
    this.ambientPlane = new THREE.Mesh(ambientGeo, ambientMat);
    this.ambientPlane.position.z = -20;
    this.scene.add(this.ambientPlane);

    this.postFX = createPostFX(this.renderer, this.scene, this.camera);

    this.bindResize();
  }

  /** Replace the active biome plane with a freshly loaded 4K background. */
  async loadBiome(biome: Biome): Promise<void> {
    this.clearLayers();
    (this.ambientPlane.material as THREE.MeshBasicMaterial).color.setHex(biome.ambient);
    this.renderer.setClearColor(biome.ambient, 1);
    try {
      await this.addLayer(biome.bgUrl, biome.parallax, biome.scaleY);
    } catch {
      // Asset missing — clear-color still gives us the biome ambient.
    }
  }

  private async addLayer(url: string, parallax: number, scaleY: number): Promise<void> {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = tex.image.width / tex.image.height;
    // Plane is sized to cover the ortho viewport with a small parallax over-scan
    // so the gentle drift never exposes the clear-color edge.
    const overscan = 1.15;
    const geo = new THREE.PlaneGeometry(scaleY * aspect * 2 * overscan, scaleY * 2 * overscan);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -10;
    this.scene.add(mesh);
    this.layers.push({ mesh, parallax });
  }

  private clearLayers(): void {
    for (const layer of this.layers) {
      layer.mesh.geometry.dispose();
      const m = layer.mesh.material;
      if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
      else m.dispose();
      this.scene.remove(layer.mesh);
    }
    this.layers = [];
  }

  /** Per-frame tick. Reads global cameraX (Phaser-pixel space) and shifts layers,
   *  then runs the EffectComposer instead of a raw render — every frame goes
   *  through the post-FX stack. */
  update(u: GlobalUniforms): void {
    const norm = u.cameraX / Math.max(1, u.viewportW);
    for (const layer of this.layers) {
      layer.mesh.position.x = -norm * layer.parallax;
    }
    this.postFX.update(u);
    this.postFX.composer.render();
  }

  private bindResize(): void {
    const onResize = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.postFX?.resize(w, h);
      const aspect = w / h;
      this.camera.left = -aspect;
      this.camera.right = aspect;
      this.camera.top = 1;
      this.camera.bottom = -1;
      this.camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
  }
}
