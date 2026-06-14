/**
 * Three.js parallax background — Sprint 17F multi-layer rendering.
 *
 * Sprint 14B kept ONE 4K image per biome (cheap depth, baked in). Sprint 17C
 * delivered 5-7 transparent PNG layers per biome with a `composition-spec.json`
 * that describes parallax-multiplier / scale / offset / z-position / blend-mode
 * per layer. This file consumes that spec to build a stack of N planes per
 * biome, plus a small ring of fixed-position weirdo decorations from
 * Sprint 15C so each biome reads as an inhabited place rather than a backdrop.
 *
 * Render flow per frame:
 *   - update(u, motion) reads MotionController pan-X/Y → shifts each layer by
 *     `pan * parallaxMultiplier * PARALLAX_GAIN`. The base position is the
 *     spec's `xOffset/yOffset` so layers stay rooted on their authored anchor.
 *   - Decorations (Sprint 15C objects) have NO parallax — they're scene-static
 *     and move with the camera (cosmoStage handles camera-pan independently).
 *   - mouth-pillar's per-frame sprite-sheet cycler (Sprint 16C) ticks against
 *     the audio clock so all live mouths breathe in lock-step with the music.
 *   - secret-crystal visibility flips based on the live kaleidoTrigger
 *     (Sprint 16E reveal-threshold preserved).
 *
 * Fallback: if the spec fetch / parse fails we paint the legacy 4K plane via
 * `bgUrl` so dev folders without the 17C assets still render something.
 *
 * Post-FX: `postFX.composer.render()` continues to drive the entire scene
 * (layers + decorations) through the bloom / kaleido / fluid / chroma stack.
 */
import * as THREE from 'three';
import type { GlobalUniforms } from '../core/globalUniforms';
import type { Biome, BiomeLayer, BiomeCompositionSpec, DecorationSpot } from '../data/biomePresets';
import { loadBiomeCompositionSpec } from '../data/biomePresets';
import { createPostFX, type PostFX } from './postFX/postFX';
import type { MotionController } from '../core/motionController';
import { assetPath } from '../core/assetPath';

/** World-units the camera-pan multiplies into per-layer offset. The PRD calls
 *  for "subtle drift" — 1.6 lines up with the Sprint 17C composition-mockup
 *  preview where mid-cluster offset reads as ~25% of viewport. */
const PARALLAX_GAIN = 1.6;
/** Vertical parallax is dampened so beta-tilt doesn't expose canvas top/bottom edges. */
const PARALLAX_GAIN_Y = 0.6;

/** Reference frame-height in world-units. Each layer plane is sized so its
 *  pixel-height matches roughly this many world-units before per-layer scale.
 *  Tuned so a 1024×1536 portrait fills the ortho viewport with overscan. */
const FRAME_WORLD_HEIGHT = 2.4;

interface RuntimeLayer {
  mesh: THREE.Mesh;
  spec: BiomeLayer;
  /** Base scene-space position (before parallax pan). Recomputed on load. */
  baseX: number;
  baseY: number;
}

interface RuntimeDecoration {
  spec: DecorationSpot;
  group: THREE.Group;
  /** Sprint 16C — populated for mouth-pillar so we can tick its sprite-sheet. */
  mouthFrameUpdate?: (audioNow: number, bpm?: number) => void;
}

/** Decoration billboard SPECS — same source as Sprint 15C's weirdoObstacleFactory.
 *  Duplicated here on purpose so parallaxScene doesn't reach into the obstacle
 *  pipeline (the brief calls 17F's decoration system "separate from
 *  TrampolineSpots in 17D"). The factory file stays as a reference for the
 *  mouth-pillar sheet metadata which we mirror below. */
interface DecorationAssetSpec {
  url: string;
  width: number;
  height: number;
  yOffset: number;
  sheet?: { frames: number };
}

const DECORATION_SPECS: Record<DecorationSpot['id'], DecorationAssetSpec> = {
  'organic-flesh-trampoline': { url: 'assets/objects/organic-flesh-trampoline.webp', width: 1.0, height: 0.6, yOffset: 0.3 },
  'floating-star': { url: 'assets/objects/floating-star.webp', width: 0.5, height: 0.5, yOffset: 0.6 },
  'eyeball-sentry': { url: 'assets/objects/eyeball-sentry.webp', width: 0.7, height: 0.7, yOffset: 1.1 },
  'upside-down-tree': { url: 'assets/objects/upside-down-tree.webp', width: 1.0, height: 1.6, yOffset: 0.8 },
  'mouth-pillar': {
    url: 'assets/objects/mouth-pillar-sheet.webp',
    width: 0.7,
    height: 1.5,
    yOffset: 0.75,
    sheet: { frames: 4 },
  },
  'breathing-portal': { url: 'assets/objects/breathing-portal.webp', width: 1.0, height: 1.0, yOffset: 0.7 },
  'secret-crystal': { url: 'assets/objects/secret-crystal.webp', width: 0.6, height: 0.6, yOffset: 0.6 },
  'melting-clock-bubble': { url: 'assets/objects/melting-clock-bubble.webp', width: 0.8, height: 0.8, yOffset: 0.9 },
};

/** Sprint 16E threshold — secret-crystal stays invisible until kaleidoTrigger
 *  crosses this. Preserved verbatim from `weirdoObstacleFactory.ts`. */
const KALEIDO_REVEAL_THRESHOLD = 0.8;

/** Mouth-pillar ping-pong frame derivation — mirrored from
 *  `weirdoObstacleFactory.pingPongFrame` so we don't import a Phaser-side
 *  factory into the Three.js scene. Same maths, identical output. */
function pingPongFrame(audioNow: number, bpm: number, frames: number): number {
  if (audioNow <= 0 || bpm <= 0) return 0;
  const beatPeriod = 60 / bpm;
  const step = Math.floor(audioNow / beatPeriod) % (frames * 2 - 2);
  return step < frames ? step : frames * 2 - 2 - step;
}

export interface ParallaxSceneHooks {
  /** Read the live audio-clock for mouth-pillar frame stepping. Returns 0
   *  pre-gesture; in that case the mouth stays on frame 0 (closed). */
  audioNow?: () => number;
  /** Read the live kaleidoTrigger so the secret-crystal can hide/show. If
   *  omitted the crystal stays permanently hidden. */
  getKaleidoTrigger?: () => number;
  /** Active biome BPM, used to drive mouth-pillar frame-cycling at the
   *  current biome's tempo. Defaults to 92 (cathedral). */
  getBpm?: () => number;
}

export class ParallaxScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  private layers: RuntimeLayer[] = [];
  private decorations: RuntimeDecoration[] = [];
  private ambientPlane: THREE.Mesh;
  private postFX: PostFX;
  private hooks: ParallaxSceneHooks;
  private textureLoader = new THREE.TextureLoader();
  /** Cached per-asset texture so re-loading the same biome twice doesn't
   *  re-fetch the PNGs. Cleared only on destroy(). */
  private texCache = new Map<string, THREE.Texture>();
  /** Wave 21 — kept so destroy() can detach the resize handler. */
  private resizeListener: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, hooks: ParallaxSceneHooks = {}) {
    this.scene = new THREE.Scene();
    this.hooks = hooks;
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

    // Ambient plane — biome-tinted backstop behind the layer-stack so any
    // gaps between transparent layers fall back to the biome ambient rather
    // than the renderer clear-color (which is shared across biomes).
    const ambientGeo = new THREE.PlaneGeometry(40, 40);
    const ambientMat = new THREE.MeshBasicMaterial({ color: 0xf5edd8, depthWrite: false });
    this.ambientPlane = new THREE.Mesh(ambientGeo, ambientMat);
    this.ambientPlane.position.z = -20;
    this.scene.add(this.ambientPlane);

    this.postFX = createPostFX(this.renderer, this.scene, this.camera);

    this.bindResize();
  }

  /**
   * Replace the active biome stack with a freshly-loaded composition. Tries
   * the multi-layer spec first (Sprint 17C asset pipeline); if that fails
   * (network, missing folder, parse error) falls back to the single 4K
   * `bgUrl` plane from Sprint 14B.
   */
  async loadBiome(biome: Biome): Promise<void> {
    this.clearLayers();
    this.clearDecorations();
    (this.ambientPlane.material as THREE.MeshBasicMaterial).color.setHex(biome.ambient);
    this.renderer.setClearColor(biome.ambient, 1);

    let specLoaded = false;
    try {
      const spec = await loadBiomeCompositionSpec(biome.compositionSpecUrl);
      await this.loadFromSpec(spec, spec.folder);
      // Merge code-side decorations with spec-defined decorations. Spec wins
      // on duplicates so an authored JSON can override a biome's defaults.
      const decorations = mergeDecorationSpots(biome.decorationSpots, spec.decorationSpots);
      await this.loadDecorations(decorations);
      specLoaded = true;
    } catch (err) {
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(`[parallaxScene] composition-spec load failed for ${biome.id}; falling back to bgUrl`, err);
      }
    }

    if (!specLoaded) {
      try {
        await this.addLegacyFallback(biome.bgUrl, biome.parallax, biome.scaleY);
        // Fallback path: still try to place decorations so the biome doesn't
        // feel completely empty even when the layer-stack is missing.
        await this.loadDecorations(biome.decorationSpots);
      } catch {
        // Legacy fallback also missing — clear-color carries the biome.
      }
    }
  }

  private async loadFromSpec(spec: BiomeCompositionSpec, folder: string): Promise<void> {
    // Layers are added back-to-front (lower zPosition first) so DOM order
    // doesn't matter; Three.js uses the explicit position.z for depth-sort.
    const sorted = [...spec.layers].sort((a, b) => a.zPosition - b.zPosition);
    for (const layer of sorted) {
      const url = `${folder}/${layer.file}`;
      try {
        await this.addLayerFromSpec(url, layer, spec.frameSize);
      } catch (err) {
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn(`[parallaxScene] layer load failed: ${url}`, err);
        }
      }
    }
  }

  private async addLayerFromSpec(
    url: string,
    spec: BiomeLayer,
    frameSize: { width: number; height: number },
  ): Promise<void> {
    const tex = await this.loadTextureCached(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    // The composition spec's frame-size is in PNG pixels (1024×1536). We map
    // that to world-units so the painted scene fills roughly FRAME_WORLD_HEIGHT
    // tall before per-layer scale. Aspect-ratio of the PNG is preserved.
    const aspect = frameSize.width / Math.max(1, frameSize.height);
    const planeH = FRAME_WORLD_HEIGHT * spec.scale;
    const planeW = planeH * aspect;
    const geo = new THREE.PlaneGeometry(planeW, planeH);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: blendingFor(spec.blendMode),
      opacity: spec.opacity,
      alphaTest: spec.blendMode === 'additive' ? 0 : 0.01,
    });

    const mesh = new THREE.Mesh(geo, mat);
    // Map normalized x_offset/y_offset (in [-1..1] of frame) to world-units.
    const baseX = spec.xOffset * (FRAME_WORLD_HEIGHT * aspect) * 0.5;
    const baseY = spec.yOffset * FRAME_WORLD_HEIGHT * 0.5;
    mesh.position.set(baseX, baseY, spec.zPosition * 0.05);
    // Normalize zPosition into the ortho near/far range. Spec uses -190..0
    // values for an arbitrary unit; we scale to the small camera frustum.
    this.scene.add(mesh);
    this.layers.push({ mesh, spec, baseX, baseY });
  }

  /** Sprint 14B legacy fallback — single 4K plane, used when spec loading
   *  fails. Kept identical behaviour to the pre-17F code path. */
  private async addLegacyFallback(url: string, parallax: number, scaleY: number): Promise<void> {
    const tex = await this.loadTextureCached(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = tex.image.width / tex.image.height;
    const overscan = 1.15;
    const geo = new THREE.PlaneGeometry(scaleY * aspect * 2 * overscan, scaleY * 2 * overscan);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, -10);
    this.scene.add(mesh);
    // Re-purpose the spec shape so update() can drive the fallback the same way.
    const fakeSpec: BiomeLayer = {
      file: url,
      parallaxMultiplier: parallax,
      scale: scaleY,
      xOffset: 0,
      yOffset: 0,
      zPosition: -10,
      blendMode: 'normal',
      opacity: 1,
      role: 'mid-a',
    };
    this.layers.push({ mesh, spec: fakeSpec, baseX: 0, baseY: 0 });
  }

  private async loadDecorations(spots: readonly DecorationSpot[] | undefined): Promise<void> {
    if (!spots || spots.length === 0) return;
    for (const spot of spots) {
      const assetSpec = DECORATION_SPECS[spot.id];
      if (!assetSpec) continue;
      try {
        const decoration = await this.buildDecoration(spot, assetSpec);
        this.scene.add(decoration.group);
        this.decorations.push(decoration);
      } catch (err) {
        if (typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn(`[parallaxScene] decoration load failed: ${spot.id}`, err);
        }
      }
    }
  }

  private async buildDecoration(spot: DecorationSpot, asset: DecorationAssetSpec): Promise<RuntimeDecoration> {
    const url = assetPath(asset.url);
    const baseTex = await this.loadTextureCached(url);
    const group = new THREE.Group();
    const uniformScale = spot.scale ?? 1.0;
    const planeW = asset.width * uniformScale;
    const planeH = asset.height * uniformScale;
    const geo = new THREE.PlaneGeometry(planeW, planeH);

    let mouthFrameUpdate: ((audioNow: number, bpm?: number) => void) | undefined;
    let mat: THREE.MeshBasicMaterial;

    if (asset.sheet) {
      // Mouth-pillar — clone the texture so this decoration's repeat/offset
      // doesn't leak into other live decorations sharing the same source.
      const tex = baseTex.clone();
      tex.needsUpdate = true;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const inv = 1 / asset.sheet.frames;
      tex.repeat.set(inv, 1);
      tex.offset.set(0, 0);
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
      const sheet = asset.sheet;
      mouthFrameUpdate = (audioNow: number, bpm = 92): void => {
        const frame = pingPongFrame(audioNow, bpm, sheet.frames);
        tex.offset.x = frame * inv;
      };
    } else {
      mat = new THREE.MeshBasicMaterial({
        map: baseTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    // yOffset from the asset-spec puts the decoration's pivot at its visual
    // base (so y=0 places it on the ground); spot.y stacks on top of that.
    mesh.position.y = asset.yOffset;
    group.add(mesh);

    group.position.set(spot.x, spot.y, spot.z);

    // secret-crystal starts hidden — visibility flips per-frame in update().
    if (spot.id === 'secret-crystal') {
      group.visible = false;
    }

    return { spec: spot, group, mouthFrameUpdate };
  }

  /** Cached texture-load. Subsequent loads hit the in-process map and
   *  resolve synchronously via THREE's already-decoded image. */
  private loadTextureCached(url: string): Promise<THREE.Texture> {
    const cached = this.texCache.get(url);
    if (cached) return Promise.resolve(cached);
    return this.textureLoader.loadAsync(url).then((tex) => {
      this.texCache.set(url, tex);
      return tex;
    });
  }

  /** Wave 24 — drop the current biome's layers + decorations WITHOUT loading a
   *  replacement. The substrate calls this on boot so the legacy `slow-bloom`
   *  preload (main.ts line ~113) does not bleed through universes whose
   *  `behavior.background()` paints custom content instead of calling
   *  `loadBiome()` (e.g. the chart's ink-void, ink-ocean's water layers). The
   *  ambient base plane is preserved so the room's mood clear-colour still
   *  shows. Idempotent. */
  unloadBiome(): void {
    this.clearLayers();
    this.clearDecorations();
  }

  private clearLayers(): void {
    for (const layer of this.layers) {
      const m = layer.mesh.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
      layer.mesh.geometry.dispose();
      this.scene.remove(layer.mesh);
    }
    this.layers = [];
  }

  private clearDecorations(): void {
    for (const dec of this.decorations) {
      // Dispose meshes inside the group.
      dec.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
          child.geometry.dispose();
        }
      });
      this.scene.remove(dec.group);
    }
    this.decorations = [];
  }

  /**
   * Per-frame tick. Reads the MotionController's pan vector and shifts each
   * layer mesh by `pan * parallaxMultiplier * PARALLAX_GAIN`. Decorations
   * are scene-static (no parallax) but still get their per-frame mouth-cycle
   * + secret-crystal visibility check.
   *
   * Backwards compat: the old call signature `update(u)` is preserved when
   * `motion` is omitted — falls back to the cameraX-derived shift from the
   * Sprint 14B implementation, so any caller that hasn't been updated yet
   * still gets some parallax.
   */
  update(u: GlobalUniforms, motion?: MotionController): void {
    let panX: number;
    let panY: number;
    if (motion) {
      panX = motion.getPanX();
      panY = motion.getPanY();
    } else {
      // Legacy fallback — normalise cameraX into [-1..1].
      panX = u.cameraX / Math.max(1, u.viewportW);
      panY = 0;
    }

    for (const layer of this.layers) {
      const mult = layer.spec.parallaxMultiplier;
      layer.mesh.position.x = layer.baseX + panX * mult * PARALLAX_GAIN;
      // PanY in pointer-space grows downward; we negate so "look up" reads as up.
      layer.mesh.position.y = layer.baseY + (-panY) * mult * PARALLAX_GAIN_Y;
    }

    // Decorations — scene-static. The mouth-pillar steps its sprite-sheet
    // frame from the audio clock, the secret-crystal toggles visibility from
    // the live kaleidoTrigger.
    const audioNow = this.hooks.audioNow ? this.hooks.audioNow() : 0;
    const bpm = this.hooks.getBpm ? this.hooks.getBpm() : 92;
    const kaleido = this.hooks.getKaleidoTrigger ? this.hooks.getKaleidoTrigger() : 0;
    for (const dec of this.decorations) {
      if (dec.mouthFrameUpdate) {
        dec.mouthFrameUpdate(audioNow, bpm);
      }
      if (dec.spec.id === 'secret-crystal') {
        dec.group.visible = kaleido > KALEIDO_REVEAL_THRESHOLD;
      }
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
    this.resizeListener = onResize;
    window.addEventListener('resize', onResize, { passive: true });
  }

  /** Wave 21 — dispose every owned THREE resource and detach the resize
   *  listener. Called by `DefaultBackground.dispose()` when the substrate
   *  swaps room background. The renderer + canvas are NOT owned by the scene
   *  (they're shared with cosmoStage in the live boot path) so we leave them
   *  intact. */
  destroy(): void {
    this.clearLayers();
    this.clearDecorations();
    if (this.ambientPlane) {
      const m = this.ambientPlane.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
      this.ambientPlane.geometry.dispose();
      this.scene.remove(this.ambientPlane);
    }
    for (const tex of this.texCache.values()) tex.dispose();
    this.texCache.clear();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }
}

/** Resolve a `BlendMode` to the Three.js blending constant. */
function blendingFor(mode: 'normal' | 'additive' | 'multiply'): THREE.Blending {
  if (mode === 'additive') return THREE.AdditiveBlending;
  if (mode === 'multiply') return THREE.MultiplyBlending;
  return THREE.NormalBlending;
}

/** Merge code-side defaults with spec-defined decorations. Spec wins on
 *  duplicate ids (same id + same x/y/z within 0.001 tolerance is treated as
 *  the same spot). Order: spec first, then code-side defaults that aren't
 *  already covered. */
function mergeDecorationSpots(
  defaults: readonly DecorationSpot[],
  spec: readonly DecorationSpot[] | undefined,
): readonly DecorationSpot[] {
  if (!spec || spec.length === 0) return defaults;
  const out: DecorationSpot[] = [...spec];
  for (const d of defaults) {
    const dup = out.find((s) =>
      s.id === d.id &&
      Math.abs(s.x - d.x) < 0.001 &&
      Math.abs(s.y - d.y) < 0.001 &&
      Math.abs(s.z - d.z) < 0.001,
    );
    if (!dup) out.push(d);
  }
  return out;
}
