/**
 * Three.js parallax background. Per level we load ONE biome — three layers
 * (far/mid/near) of the SAME scene at different parallax multipliers. No more
 * cross-biome stacking.
 *
 * If a layer fails to load (e.g. asset not yet generated), the scene quietly
 * skips that layer rather than aborting — the show still goes on with whatever
 * has rendered.
 */
import * as THREE from 'three';
import type { GlobalUniforms } from '../core/globalUniforms';
import type { Biome, BiomeLayer } from '../data/biomes';
import { createPostFX, type PostFX } from './postFX/postFX';

interface RuntimeLayer {
  mesh: THREE.Mesh;
  parallax: number;
}

export class ParallaxScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
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

  /** Replace all layers with the chosen biome's sky/far/mid/near images. */
  async loadBiome(biome: Biome): Promise<void> {
    this.clearLayers();
    (this.ambientPlane.material as THREE.MeshBasicMaterial).color.setHex(biome.ambient);
    this.renderer.setClearColor(biome.ambient, 1);
    const order: BiomeLayer[] = [];
    if (biome.sky) order.push(biome.sky);
    order.push(biome.far, biome.mid, biome.near);
    for (const layer of order) {
      try {
        await this.addLayer(layer);
      } catch {
        // Asset not generated yet — skip silently, the rest of the biome still composes.
      }
    }
  }

  private async addLayer(layer: BiomeLayer): Promise<void> {
    const tex = await new THREE.TextureLoader().loadAsync(layer.url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = tex.image.width / tex.image.height;
    const geo = new THREE.PlaneGeometry(layer.scaleY * aspect * 2, layer.scaleY * 2);
    const blending =
      layer.blend === 'multiply'
        ? THREE.MultiplyBlending
        : layer.blend === 'additive'
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending,
      premultipliedAlpha: layer.blend === 'multiply',
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = layer.depth;
    this.scene.add(mesh);
    this.layers.push({ mesh, parallax: layer.parallax });
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
