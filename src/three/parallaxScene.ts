/**
 * Three.js parallax background. Three textured planes at different depths and
 * parallax multipliers, all driven from the same globalUniforms.cameraX so the
 * 3D layer scrolls in lockstep with the Phaser game-camera.
 *
 * S2 deliverable is the spike: prove sync, prove it doesn't fight Phaser. Real
 * Meshy props + post-FX stack come in S3 and S6.
 */
import * as THREE from 'three';
import type { GlobalUniforms } from '../core/globalUniforms';

const PARALLAX = {
  far: 0.18,
  mid: 0.42,
  near: 0.78,
} as const;

interface Layer {
  mesh: THREE.Mesh;
  parallax: number;
  baseY: number;
}

export class ParallaxScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  private layers: Layer[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf5edd8, 0);

    const aspect = window.innerWidth / window.innerHeight;
    const halfH = 1;
    this.camera = new THREE.OrthographicCamera(-aspect * halfH, aspect * halfH, halfH, -halfH, 0.01, 100);
    this.camera.position.z = 5;

    this.bindResize();
  }

  /** Add a textured plane at a depth z; loader resolves async, layer joins on success. */
  async addLayer(textureUrl: string, parallax: number, depth: number, scaleY = 1): Promise<void> {
    const tex = await new THREE.TextureLoader().loadAsync(textureUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = tex.image.width / tex.image.height;
    const geo = new THREE.PlaneGeometry(scaleY * aspect * 2, scaleY * 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = depth;
    mesh.position.y = (1 - scaleY) * 0.2;
    this.scene.add(mesh);
    this.layers.push({ mesh, parallax, baseY: mesh.position.y });
  }

  /** Boilerplate setup: load three layers (sky, mid, near) for the cathedral biome. */
  async loadDefaultBiome(): Promise<void> {
    await Promise.all([
      this.addLayer('/showcase-assets/bg-cloud-cathedral-sky.png', PARALLAX.far, -10, 1.5),
      this.addLayer('/showcase-assets/bg-slow-bloom-jungle.png', PARALLAX.mid, -5, 1.2),
      this.addLayer('/showcase-assets/bg-inkpool-cave.png', PARALLAX.near, -2, 1.0),
    ]).catch(() => {
      /* swallow per-layer 404s — backgrounds may not be loaded yet */
    });
  }

  /** Per-frame tick. Reads global cameraX (Phaser-pixel space) and shifts layers. */
  update(u: GlobalUniforms): void {
    const norm = u.cameraX / Math.max(1, u.viewportW);
    for (const layer of this.layers) {
      layer.mesh.position.x = -norm * layer.parallax;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private bindResize(): void {
    const onResize = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
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
