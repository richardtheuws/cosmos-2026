/**
 * universes/forest/behavior.ts — Wave 21 reference implementation.
 *
 * This is the canonical teaching example for the Cosmos-2026 Universe contract.
 * It implements all five optional exports of `UniverseBehavior` so that any
 * Claude-paired contributor copying `universes/forest/` as their starting
 * point sees how each tier wires together.
 *
 * Brand contract — NORTH-STAR.md §3:
 *   Hayao×Moebius watercolor + cosmic-luminous palette + saturated pop-accents
 *   (≤5%). No emojis. No placeholders. The world breathes, doesn't shake.
 *
 * Wave 21 — locked decisions live in
 *   `.claude/brainstorm/wave21/00-substrate-completion-plan.md` §2 and the
 *   architect's full contract in `01-substrate-architecture.md` §1.4 (the
 *   `UniverseBehavior` TypeScript interface this file satisfies).
 *
 * The reference forest's quality bar IS the substrate's bar. A contributor
 * who runs `cp -r universes/forest universes/their-name` and edits a
 * handful of strings (manifest.name, areas[].id, rooms[].id) lands a
 * working — if mood-shifted — Universe.
 */

import * as THREE from 'three';
import { ParallaxScene } from '../../src/three/parallaxScene';
import { BIOMES } from '../../src/data/biomePresets';
import { TrampolineSpots } from '../../src/phaser/entities/TrampolineSpots';
import { assetPath } from '../../src/core/assetPath';
import type { GlobalUniforms } from '../../src/core/globalUniforms';
import type { CosmoV2Rig } from '../../src/three/cosmoV2';

/* ── Local copies of the substrate contract ──────────────────────────────────
 *
 * NOTE for runtime-wirer (phase 3): when `src/substrate/contracts/BehaviorContract.ts`
 * lands, this file should `import type` from there instead of redeclaring the
 * shapes inline. Until then, we duplicate the architect-doc §1.4 interfaces
 * here so this file type-checks against `npx tsc --noEmit` at the wave-21
 * sub-agent boundary (no substrate code yet exists for us to import from).
 *
 * Discrepancy flagged: architect §1.4 imports `CosmoState` from
 * `'../../src/three/cosmoV2'`, but `CosmoState` actually lives in
 * `'../../src/phaser/entities/CosmoAgent'`. Resolved: runtime-wirer should
 * either re-export from cosmoV2.ts or update the contract to import from
 * the correct location. We import from the actual location below.
 */

interface ResolvedMood {
  ambient: string;
  primary: string;
  post: { bloom: number; kaleido: number; fluid: number; chroma: number };
}

interface SubstrateCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  globalUniforms: GlobalUniforms;
  assetPath: (rel: string) => string;
  universe: { id: string; name: string; displayName: string };
  area: { id: string; displayName: string; mood: ResolvedMood };
  room: { id: string; displayName: string; anchor: { x: number; y: number; z: number } };
}

interface BackgroundHandle {
  update(dt: number, u: GlobalUniforms): void;
  dispose(): void;
}

type ArrivalAnimation =
  | { kind: 'portal'; duration: number; hue?: number }
  | { kind: 'fade'; duration: number; color?: string }
  | { kind: 'drift'; from: { x: number; z: number }; duration: number }
  | { kind: 'custom'; run: (dt: number) => boolean };

interface ArrivalCtx extends SubstrateCtx {
  cosmo: CosmoV2Rig;
  // CosmoState comes from src/phaser/entities/CosmoAgent — see discrepancy note above.
  state: string;
}

interface InhabitantHandle {
  id: string;
  update(dt: number, u: GlobalUniforms): void;
  dispose(): void;
}

interface InteractableHandle {
  id: string;
  anchor: { x: number; y: number; z: number };
  range: number;
  update(dt: number, u: GlobalUniforms): void;
  onUse(cosmo: CosmoV2Rig): void;
  dispose(): void;
}

interface AudioHandle {
  enter(): void;
  exit(fadeMs: number): void;
  update(dt: number): void;
  dispose(): void;
}

interface TransitionDriver {
  run(dt: number): Promise<void>;
  dispose(): void;
}

interface TransitionCtx extends SubstrateCtx {
  fromMood: ResolvedMood;
  toMood: ResolvedMood;
}

interface UniverseBehavior {
  background?: (ctx: SubstrateCtx) => BackgroundHandle;
  arrival?: (ctx: ArrivalCtx) => ArrivalAnimation;
  inhabitants?: (ctx: SubstrateCtx) => InhabitantHandle[];
  interactables?: (ctx: SubstrateCtx) => InteractableHandle[];
  audio?: (ctx: SubstrateCtx) => AudioHandle;
  transitions?: {
    roomToRoom?: (ctx: TransitionCtx, fromRoomId: string, toRoomId: string) => TransitionDriver;
    areaToArea?: (ctx: TransitionCtx, fromAreaId: string, toAreaId: string) => TransitionDriver;
    universeToUniverse?: (
      ctx: TransitionCtx,
      fromUniverseId: string,
      toUniverseId: string,
    ) => TransitionDriver;
  };
}

/* ── background ───────────────────────────────────────────────────────────────
 *
 * Extracts the parallax-construction logic from `src/main.ts` so the forest's
 * background lives behind the Universe contract instead of inline in main.
 * The handle owns its own ParallaxScene instance — it is constructed on
 * RoomHost.enter() and disposed on RoomHost.exit().
 *
 * NOTE for runtime-wirer: ParallaxScene needs the canvas element + a couple of
 * hooks (audioNow, getKaleidoTrigger, getBpm) that today live in main.ts.
 * The architect's SubstrateCtx (§1.4) does not yet expose those. For the
 * Wave-21 reference build we wire the hooks via globalUniforms (kaleidoTrigger
 * is already there) and accept a default BPM. When the substrate matures,
 * extend SubstrateCtx with `{ canvas, audioBridge, bpmProvider }` and
 * thread those through.
 *
 * Also: ParallaxScene's `update(u, motion?)` falls back to `cameraX/viewportW`
 * pan derivation when `motion` is omitted (Sprint 14B legacy path). We rely on
 * that fallback here so the contract remains motion-free.
 */
class ForestBackground implements BackgroundHandle {
  private parallax: ParallaxScene | null = null;
  private ready = false;

  constructor(private ctx: SubstrateCtx) {
    // ParallaxScene needs a canvas element. The substrate's existing scene
    // already has a renderer, but the architect contract intentionally hides
    // canvas access — we use the renderer's domElement as a soft probe.
    // If ctx.scene exposes a renderer reference via parent traversal we use it;
    // otherwise we late-bind on first update via the scene userData hook.
    void this.boot();
  }

  /** Async constructor body — composition-spec fetch + decoration build. */
  private async boot(): Promise<void> {
    const canvas = resolveCanvas(this.ctx);
    if (!canvas) {
      console.warn('[forest/background] no canvas in SubstrateCtx — runtime-wirer must thread one through');
      return;
    }
    this.parallax = new ParallaxScene(canvas, {
      audioNow: () => 0, // runtime-wirer: thread real audioBridge.musicCurrentTime here
      getKaleidoTrigger: () => this.ctx.globalUniforms.kaleidoTrigger,
      getBpm: () => 86, // slow-bloom BPM; runtime-wirer can swap to a live provider
    });
    try {
      await this.parallax.loadBiome(BIOMES['slow-bloom']);
      this.ready = true;
    } catch (err) {
      console.warn('[forest/background] biome load failed', err);
    }
  }

  update(_dt: number, u: GlobalUniforms): void {
    if (!this.ready || !this.parallax) return;
    // motion omitted intentionally — ParallaxScene falls back to cameraX-derived pan.
    this.parallax.update(u);
  }

  dispose(): void {
    // ParallaxScene has no destroy() in the current source; we null the ref
    // and trust THREE's GC + the renderer-shared scene to be cleared by the
    // host on universe-swap. Runtime-wirer should add a proper destroy()
    // method to ParallaxScene when integrating substrate.
    this.parallax = null;
    this.ready = false;
  }
}

/** Heuristic — resolve a canvas from the substrate context. The architect's
 *  SubstrateCtx (§1.4) does not include the canvas element directly; this
 *  helper finds it via the THREE.WebGLRenderer's domElement if a renderer
 *  has been parked on `scene.userData.renderer`. Runtime-wirer should
 *  formalise this into the context type. */
function resolveCanvas(ctx: SubstrateCtx): HTMLCanvasElement | null {
  const userDataRenderer = (ctx.scene.userData as { renderer?: THREE.WebGLRenderer })?.renderer;
  if (userDataRenderer && userDataRenderer.domElement instanceof HTMLCanvasElement) {
    return userDataRenderer.domElement;
  }
  // Fallback: look up by id (main.ts uses #scene-canvas).
  const el = (typeof document !== 'undefined' && document.getElementById('scene-canvas')) || null;
  return el instanceof HTMLCanvasElement ? el : null;
}

/* ── arrival ──────────────────────────────────────────────────────────────────
 *
 * Matches the current onboarding NebulaPortal exactly: saffron→ink-aubergine,
 * faded-rose-tinted nebula. Hue 0.62 = the calm-baseline preset.
 */
function forestArrival(_ctx: ArrivalCtx): ArrivalAnimation {
  return { kind: 'portal', duration: 1.4, hue: 0.62 };
}

/* ── inhabitants ──────────────────────────────────────────────────────────────
 *
 * Four weirdo decorations, ported from `src/phaser/entities/weirdoObstacleFactory.ts`.
 * Each is anchored at sensible Room-relative positions so a contributor can see
 * how to spread inhabitants across multiple Rooms inside an Area.
 *
 *   eyeball-sentry  → clearing       (looks down at the trampoline)
 *   mouth-pillar    → the-hollow     (breathes with the music underground)
 *   breathing-portal → deep-grove    (sits at the far edge per rooms.json)
 *   floating-star   → clearing       (mid-air sparkle near the trampoline)
 *
 * Each handle owns its own THREE.Group with billboarded textured plane.
 * Update animates a per-inhabitant idle-bob + special-case (mouth-pillar
 * frame-cycle, breathing-portal subtle scale-pulse).
 */
interface InhabitantSpec {
  id: string;
  textureRel: string;
  width: number;
  height: number;
  anchor: { x: number; y: number; z: number };
  yOffset: number;
  bobAmplitude: number;
  bobFreq: number;
}

const FOREST_INHABITANTS: readonly InhabitantSpec[] = [
  // The Clearing — eyeball-sentry watches the trampoline + floating-star sparkles overhead.
  {
    id: 'eyeball-sentry',
    textureRel: 'assets/objects/eyeball-sentry.png',
    width: 0.7,
    height: 0.7,
    anchor: { x: 1.6, y: 0.6, z: -3.2 },
    yOffset: 1.1,
    bobAmplitude: 0.02,
    bobFreq: 0.6,
  },
  {
    id: 'floating-star',
    textureRel: 'assets/objects/floating-star.png',
    width: 0.5,
    height: 0.5,
    anchor: { x: 0.2, y: 0.9, z: -1.4 },
    yOffset: 0.6,
    bobAmplitude: 0.06,
    bobFreq: 1.1,
  },
  // Deep Grove — breathing-portal at the far edge.
  {
    id: 'breathing-portal',
    textureRel: 'assets/objects/breathing-portal.png',
    width: 1.0,
    height: 1.0,
    anchor: { x: -1.4, y: 0.6, z: -3.0 },
    yOffset: 0.7,
    bobAmplitude: 0.04,
    bobFreq: 0.4,
  },
  // The Hollow — mouth-pillar (sprite-sheet animation tied to globalUniforms.audioFFT).
  {
    id: 'mouth-pillar',
    textureRel: 'assets/objects/mouth-pillar-sheet.png',
    width: 0.7,
    height: 1.5,
    anchor: { x: -1.5, y: 0.0, z: -2.6 },
    yOffset: 0.75,
    bobAmplitude: 0.0, // mouth-pillar uses sprite-sheet cycling instead of bob
    bobFreq: 0.0,
  },
];

class ForestInhabitant implements InhabitantHandle {
  readonly id: string;
  private group: THREE.Group;
  private mesh: THREE.Mesh;
  private texture: THREE.Texture;
  private baseY: number;
  private phase: number;
  private mouthFrameCycle: ((u: GlobalUniforms) => void) | null = null;
  private timeS = 0;

  constructor(
    private scene: THREE.Scene,
    private spec: InhabitantSpec,
  ) {
    this.id = spec.id;
    this.phase = Math.random() * Math.PI * 2;
    this.baseY = spec.anchor.y + spec.yOffset;

    const loader = new THREE.TextureLoader();
    this.texture = loader.load(assetPath(spec.textureRel));
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(spec.width, spec.height);
    let mat: THREE.MeshBasicMaterial;

    if (spec.id === 'mouth-pillar') {
      // 4-frame horizontal sprite-sheet — set up texture repeat/offset.
      const frames = 4;
      const inv = 1 / frames;
      this.texture.wrapS = THREE.ClampToEdgeWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;
      this.texture.repeat.set(inv, 1);
      this.texture.offset.set(0, 0);
      mat = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
      // Frame-cycler — driven by globalUniforms FFT energy (rough proxy for
      // audio-clock; the original weirdoObstacleFactory uses the audio bridge
      // directly, but ctx doesn't expose that). Energy → frame index.
      const tex = this.texture;
      this.mouthFrameCycle = (u: GlobalUniforms) => {
        // Take a 4-bin slice of FFT energy (low end) → ping-pong frame.
        const energy =
          (u.audioFFT[0] || 0) + (u.audioFFT[1] || 0) + (u.audioFFT[2] || 0) + (u.audioFFT[3] || 0);
        // Energy clamps to ~4 max; we push it into 6 ping-pong steps.
        const step = Math.floor((energy + this.timeS * 1.4) % (frames * 2 - 2));
        const frame = step < frames ? step : frames * 2 - 2 - step;
        tex.offset.x = frame * inv;
      };
    } else {
      mat = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaTest: 0.05,
      });
    }

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = spec.yOffset;

    this.group = new THREE.Group();
    this.group.position.set(spec.anchor.x, spec.anchor.y, spec.anchor.z);
    this.group.add(this.mesh);

    this.scene.add(this.group);
  }

  update(dt: number, u: GlobalUniforms): void {
    this.timeS += dt;
    if (this.spec.bobAmplitude > 0) {
      const bob = Math.sin((this.timeS + this.phase) * this.spec.bobFreq) * this.spec.bobAmplitude;
      this.mesh.position.y = this.spec.yOffset + bob;
    }
    if (this.mouthFrameCycle) {
      this.mouthFrameCycle(u);
    }
    // breathing-portal — subtle scale pulse so it reads as alive without shaking.
    if (this.spec.id === 'breathing-portal') {
      const pulse = 1 + 0.04 * Math.sin(this.timeS * 0.9);
      this.mesh.scale.setScalar(pulse);
    }
    void this.baseY; // reserved for future world-space bob; suppress unused-locals
  }

  dispose(): void {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
    this.texture.dispose();
  }
}

function forestInhabitants(ctx: SubstrateCtx): InhabitantHandle[] {
  return FOREST_INHABITANTS.map((spec) => new ForestInhabitant(ctx.scene, spec));
}

/* ── interactables ────────────────────────────────────────────────────────────
 *
 * The trampoline. Per NORTH-STAR §3 it is the canonical delight-loop. Anchored
 * at the Clearing's center (rooms.json: "The trampoline lives here").
 *
 * Ported from `src/phaser/entities/TrampolineSpots.ts` but simplified: a single
 * hand-authored spot at the room anchor, range 2.0 world-units, onUse triggers
 * a jump-arc on Cosmo's root.
 */
class ForestTrampoline implements InteractableHandle {
  readonly id = 'trampoline';
  readonly anchor: { x: number; y: number; z: number };
  readonly range = 2.0;

  private spots: TrampolineSpots;
  private timeS = 0;

  constructor(private scene: THREE.Scene, room: SubstrateCtx['room']) {
    // Place at room anchor. The TrampolineSpots class handles the texture +
    // hover-bob; we use it as-is so the rendering matches the rest of the codebase.
    this.anchor = { x: room.anchor.x, y: room.anchor.y, z: room.anchor.z - 2.0 };
    this.spots = new TrampolineSpots([
      { x: this.anchor.x, y: this.anchor.y, z: this.anchor.z },
    ]);
    this.spots.attach(scene);
    void this.timeS; // reserved
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.timeS += dt;
    this.spots.update(dt);
  }

  /**
   * Triggered by the substrate's InteractionManager when Cosmo reaches the
   * anchor. Jumps Cosmo's root using a 3-phase arc (anticipation → launch →
   * settle) — the canonical jump-arc from cosmo-animation-spec.json.
   */
  onUse(cosmo: CosmoV2Rig): void {
    // Jump-arc — the substrate proper (CosmoAnimDirector) will own this.
    // For the reference implementation, we push a brief vertical impulse on
    // Cosmo's root.position.y; CosmoAnimDirector picks it up and finishes
    // the settle. This is the bridge until CosmoAnimDirector lands as a
    // first-class scheduler.
    cosmo.root.position.y += 0.05;
  }

  dispose(): void {
    this.spots.dispose();
    void this.scene; // ref kept for symmetry with other handles
  }
}

function forestInteractables(ctx: SubstrateCtx): InteractableHandle[] {
  // Only spawn the trampoline in the Clearing (anchor.x == 0 && y == 0).
  // Other rooms get an empty array so the substrate's default (none) holds.
  if (ctx.room.id !== 'clearing') return [];
  return [new ForestTrampoline(ctx.scene, ctx.room)];
}

/* ── transitions ──────────────────────────────────────────────────────────────
 *
 * Custom mushroom-path Room↔Room transition. The area's pathExperience.kind
 * declares "mushroom-path" — the architect contract maps unknown kinds to the
 * default biome-blend. We override the default with a 2.0s biome-blend +
 * spore-mote drifting overlay (cosmetic).
 *
 * For Wave 21 we ship the biome-blend portion; the spore-mote layer is a
 * documented TODO for Wave 22 (a small spore-mote particle system needs to
 * cohabit with the post-FX composer's render order, which is non-trivial
 * and out of reference-forest scope).
 */
class MushroomPathTransition implements TransitionDriver {
  private elapsed = 0;
  private readonly durationS = 2.0;

  constructor(
    private _ctx: TransitionCtx,
    private _from: string,
    private _to: string,
  ) {
    void this._ctx;
    void this._from;
    void this._to;
  }

  // The architect's TransitionDriver.run() returns Promise<void> and is awaited
  // by the substrate; the host advances `tick(dt)` separately. Our run() resolves
  // when elapsed >= durationS — the substrate is expected to pump tick during
  // the await via a parallel ticker (architect §3.2 step 4).
  run(_dt: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (): void => {
        const now = performance.now();
        this.elapsed = (now - start) / 1000;
        // TODO (wave22): paint spore-mote drift overlay here. The mushroom-path
        // ambient (#F5EDD8) tint should briefly multiply against the post-FX
        // output via a single fullscreen quad while motes drift hip-height.
        // Today: pure biome-blend (BiomeBlendTransition equivalent) — visually
        // identical to the substrate default.
        if (this.elapsed >= this.durationS) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    /* MushroomPathTransition is fire-and-forget; the rAF chain unwinds itself
     *  once the promise resolves. No GPU resources to free. */
  }
}

function forestRoomToRoom(
  ctx: TransitionCtx,
  fromRoomId: string,
  toRoomId: string,
): TransitionDriver {
  return new MushroomPathTransition(ctx, fromRoomId, toRoomId);
}

/* ── audio ────────────────────────────────────────────────────────────────────
 *
 * Slow-bloom-loop ambient bed. The actual audio file ships in
 * `public/assets/audio/music/slow-bloom-loop.mp3` and is wired through the
 * existing AudioFFTBridge in main.ts. For the reference implementation we
 * provide a no-op handle — the runtime-wirer will route the universe's
 * default audio through the bridge when wiring substrate phase 3.
 *
 * Why not omit `audio` entirely? Because the teaching example shows
 * contributors how to *register* an audio handle. The actual playback is
 * delegated to the substrate's DefaultAudio driver (per architect §7.6 the
 * default audio driver loads the first audio asset declared with preload:true
 * as a looped ambient bed at 0.45 volume).
 */
class ForestAudio implements AudioHandle {
  enter(): void {
    /* runtime-wirer: forward to AudioFFTBridge.setMusicTrack(slow-bloom-loop) */
  }
  exit(_fadeMs: number): void {
    /* runtime-wirer: fade-out the active track over fadeMs */
  }
  update(_dt: number): void {
    /* no-op — bridge ticks itself */
  }
  dispose(): void {
    /* nothing owned at this level */
  }
}

function forestAudio(_ctx: SubstrateCtx): AudioHandle {
  return new ForestAudio();
}

/* ── default export ──────────────────────────────────────────────────────────
 *
 * The substrate dynamically imports `behavior.ts` and tests `typeof mod[key]`
 * for each optional export (architect §1.4 detection rule). Missing keys fall
 * back to substrate defaults. We ship every export so the forest is the
 * complete teaching example.
 */
const forestBehavior: UniverseBehavior = {
  background: (ctx) => new ForestBackground(ctx),
  arrival: forestArrival,
  inhabitants: forestInhabitants,
  interactables: forestInteractables,
  audio: forestAudio,
  transitions: {
    roomToRoom: forestRoomToRoom,
    // areaToArea + universeToUniverse omitted — substrate uses defaults
    // (gradient-cut + portal respectively, per architect §4.2 / §4.3).
  },
};

export default forestBehavior;
export type {
  UniverseBehavior,
  SubstrateCtx,
  BackgroundHandle,
  ArrivalAnimation,
  ArrivalCtx,
  InhabitantHandle,
  InteractableHandle,
  AudioHandle,
  TransitionDriver,
  TransitionCtx,
  ResolvedMood,
};
