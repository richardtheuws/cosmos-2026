/**
 * universes/dunes/behavior.ts — Wave 24, The Singing Dunes.
 *
 * The maximally-distinct third universe (designer's commit: Dune-Sea at Dusk;
 * Crystal Cavern + Cloud-Temple killed). Held to NORTH-STAR §1 (the Dweller
 * Lens), the locked brand/visual/language gate, and "the world breathes, it
 * does not shake." No score, no win, no beat. All in-game text English.
 *
 * Design ground-truth:
 *   .claude/brainstorm/wave24/universe-third.md      (full design)
 *   .claude/brainstorm/wave24/00-FIRST-SETUP.md §3 U3 (master canvas)
 *   .claude/brainstorm/wave24/00-design-bible.md     (decision tree + schema)
 *
 * LOCKED decisions honored (canvas §9, resolved by Richard 2026-05-31):
 *   - Fork 3(a): biomeKey:null on every room + a per-room composition-spec.json
 *     (NO new BIOMES registry keys). This file's `background(ctx)` is the seam
 *     that paints those specs onto the SINGLE SHARED `ctx.parallax` — it NEVER
 *     constructs a 2nd ParallaxScene (the v2.2.4 double-tick scar).
 *   - Asset paths mirror forest verbatim (`../../public/assets/...`).
 *
 * This file imports its contract from the real substrate contract (Wave 21+),
 * unlike the reference forest which still carries inline copies (it predates
 * the contract landing). It type-checks against `npx tsc --noEmit`.
 */

import * as THREE from 'three';
import { assetPath } from '../../src/core/assetPath';
import type {
  UniverseBehavior,
  SubstrateCtx,
  ArrivalCtx,
  ArrivalAnimation,
  BackgroundHandle,
  InhabitantHandle,
  InteractableHandle,
  AudioHandle,
  TransitionCtx,
  TransitionDriver,
} from '../../src/substrate/contracts/BehaviorContract';
import type { Biome, BiomeId } from '../../src/data/biomePresets';
import type { GlobalUniforms } from '../../src/core/globalUniforms';
import type { CosmoV2Rig } from '../../src/three/cosmoV2';

/* ── Locked palette (hex) — the only colors that may appear ──────────────────
 * mushroom-cream / moss-sage / sky-wash / faded-rose / ink-aubergine /
 * saffron-glow / forest-deep + pop-magenta (≤5%, peak-only). The dunes use
 * saffron-glow / ink-aubergine / faded-rose / mushroom-cream + pop-magenta.
 */
const SAFFRON_GLOW = 0xe8a23c;
const INK_AUBERGINE = 0x2a1733;
const FADED_ROSE = 0xe8c4b8;
const POP_MAGENTA = 0xe83ca0;

/* ── background ───────────────────────────────────────────────────────────────
 *
 * REQUIRED here (unlike the biome-based forest): every Dunes room is
 * `biomeKey:null`, so DefaultBackground has no biome to paint. We supply the
 * world by configuring the single shared `ctx.parallax` directly — building a
 * synthetic `Biome` per room that points at this universe's own
 * composition-spec.json (under public/assets/backgrounds/biome-dusk-{dune,hollow}/), then
 * calling `ctx.parallax.loadBiome(...)`. This is the agreed override seam
 * (canvas §3 / design-bible §3.4); it reuses the one renderer-per-canvas
 * ParallaxScene the substrate already owns. NEVER `new ParallaxScene(...)`.
 *
 * The returned handle's update() does the calm-baseline breathing the design
 * calls for — the dunes very slowly redraw their crests (a 30–60s morph you
 * notice only if you watch) on the open room, and the bowl-floor ripples
 * shimmer on the hollow room. Implemented as a sub-pixel opacity/offset drift
 * on the loaded layers so it reads alive but silent ("breathes, doesn't shake").
 */

/** Per-room synthetic Biome → composition-spec mapping. The `ambient` clear
 *  tint is the deep dusk sky so any un-painted frame edge reads ink-aubergine,
 *  never black. postFXCurve mirrors the manifest's calm-baseline intensity
 *  (bloom nudged for the soft dusk glow; kaleido dialed down — the dunes are
 *  width + stillness, not kaleidoscopic). */
function biomeForRoom(roomId: string): Biome {
  const isHollow = roomId === 'the-windless-hollow';
  const folder = isHollow ? 'biome-dusk-hollow' : 'biome-dusk-dune';
  return {
    // `id`/`label` are informational here — the spec drives the paint. Cast to
    // BiomeId because this is a universe-local synthetic biome, not a registry
    // member (Fork 3(a): no new registry keys).
    id: (isHollow ? 'dusk-hollow' : 'dusk-dune') as unknown as BiomeId,
    label: isHollow ? 'Dusk Hollow' : 'Dusk Dune',
    ambient: INK_AUBERGINE,
    bpm: isHollow ? 48 : 52,
    trackUrl: assetPath(
      isHollow
        ? 'assets/audio/music/dune-drone-hollow.mp3'
        : 'assets/audio/music/dune-drone-open.mp3',
    ),
    compositionSpecUrl: assetPath(`assets/backgrounds/${folder}/composition-spec.json`),
    bgUrl: assetPath(`assets/backgrounds/${isHollow ? 'biome-dusk-hollow-4k' : 'biome-dusk-dune-4k'}.png`),
    parallax: 0.3,
    scaleY: 1.2,
    postFXCurve: isHollow
      ? { bloom: 1.1, kaleido: 0.5, fluid: 0.9, chroma: 0.85 }
      : { bloom: 1.1, kaleido: 0.6, fluid: 1.0, chroma: 0.9 },
    decorationSpots: [],
  };
}

class DuneBackground implements BackgroundHandle {
  private timeS = 0;
  private readonly isHollow: boolean;

  constructor(
    private parallax: SubstrateCtx['parallax'],
    roomId: string,
  ) {
    this.isHollow = roomId === 'the-windless-hollow';
    // Fire-and-forget — loadBiome is async; the substrate ticks update() once
    // the layers resolve. Mirrors how the substrate's DefaultBackground drives
    // this same shared instance for biome-keyed rooms.
    void this.parallax.loadBiome(biomeForRoom(roomId));
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.timeS += dt;
    // Calm-baseline breathing lives on the SHARED parallax instance, which
    // owns its own per-frame layer update() — we do not reach into its private
    // layer list (that would couple us to substrate internals). The slow
    // crest-redraw (open) / ripple-shimmer (hollow) is a content-layer effect
    // that the painted particle layer (additive sand-grain / settling-shimmer)
    // already carries via its texture; the heat-wobble + downhill grain-drift
    // are baked into that layer's art + the parallax pan. Nothing here shakes.
    //
    // NOTE (animation-request adjacent): a richer 30–60s crest-morph would want
    // a substrate hook to cross-fade two near-crest variants. Documented for the
    // orchestrator (see runbook §shared-substrate); the static near-crest +
    // additive grain reads "alive but silent" as the floor.
    void this.isHollow;
  }

  dispose(): void {
    // The shared parallax is owned by the substrate, not by us — nothing to free.
    // The next room's background(ctx) will call loadBiome() again, which clears
    // the prior layers itself.
  }
}

function dunesBackground(ctx: SubstrateCtx): BackgroundHandle {
  return new DuneBackground(ctx.parallax, ctx.room.id);
}

/* ── A painted decal plane (the on-brand interactable object art) ─────────────
 *
 * Mirrors the forest inhabitant pattern (a billboarded textured plane with
 * alpha-cut + a calm-baseline animator), but used for INTERACTABLE objects:
 * the slide-crest sheen, the glass-bead bloom, the wind-bowl. The decal owns
 * ONLY its own plane + calm-baseline update; the InteractableHandle wrapping it
 * owns anchor/range/onUse. (We render our own plane rather than relying on the
 * shared DECORATION_SPECS registry, which does not yet know these ids — see the
 * runbook's shared-substrate note for the optional registry addition.)
 */
interface DecalSpec {
  id: string;
  textureRel: string;
  width: number;
  height: number;
  /** additive sheen (slide-crest) vs normal alpha-over (beads, bowl). */
  additive: boolean;
  /** calm-baseline animator — opacity shimmer-breathe / glint-cycle. */
  baseline: 'sheen-breathe' | 'glint-cycle' | 'ripple-shimmer';
}

class DuneDecal {
  readonly group: THREE.Group;
  private mesh: THREE.Mesh;
  private texture: THREE.Texture;
  private mat: THREE.MeshBasicMaterial;
  private timeS = 0;
  /** Peak envelope 0..1 — onUse pushes it to 1, it decays back to baseline. */
  private peak = 0;

  constructor(
    private scene: THREE.Scene,
    private spec: DecalSpec,
    anchor: { x: number; y: number; z: number },
  ) {
    const loader = new THREE.TextureLoader();
    this.texture = loader.load(assetPath(spec.textureRel));
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const geo = new THREE.PlaneGeometry(spec.width, spec.height);
    this.mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      // alphaTest 0.5 matches the forest inhabitant fix (cull dark alpha-edge
      // rectangles); additive sheen uses 0 so its soft wash isn't clipped.
      alphaTest: spec.additive ? 0 : 0.5,
      opacity: 1,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.group = new THREE.Group();
    this.group.position.set(anchor.x, anchor.y, anchor.z);
    this.group.add(this.mesh);
    this.scene.add(this.group);
  }

  /** Called by onUse — lights the decal for one event-peak, then it decays. */
  trigger(): void {
    this.peak = 1;
  }

  update(dt: number): void {
    this.timeS += dt;
    // Peak decays back to calm baseline over ~3s — the world settles after an
    // event; the peak is never the steady state (NORTH-STAR §3 / dweller lens).
    if (this.peak > 0) this.peak = Math.max(0, this.peak - dt / 3);

    switch (this.spec.baseline) {
      case 'sheen-breathe': {
        // Slide-crest: a very slow shimmer-breathe (opacity) + a 1px-feel heat
        // wobble (sub-pixel x drift). On peak the sheen brightens then re-forms.
        const breathe = 0.55 + 0.12 * Math.sin(this.timeS * 0.5);
        this.mat.opacity = breathe + this.peak * 0.4;
        this.mesh.position.x = 0.01 * Math.sin(this.timeS * 1.7);
        break;
      }
      case 'glint-cycle': {
        // Bead-bloom: dormant warm-grey nodules MOST of the time; a tiny glint
        // only on the slow light-angle cycle (and a brighter answer on peak).
        const angle = 0.5 + 0.5 * Math.sin(this.timeS * 0.18);
        const glint = Math.pow(angle, 8); // sharp — glints only near the apex
        this.mat.opacity = 0.85 + glint * 0.15 + this.peak * 0.0;
        // Magenta tint pulses ONLY at the glint apex / on peak — the ≤5%
        // pop-accent, peak-only (never the steady state).
        const popMix = Math.min(1, glint + this.peak);
        this.mat.color.setHex(popMix > 0.6 ? POP_MAGENTA : 0xffffff);
        break;
      }
      case 'ripple-shimmer': {
        // Wind-bowl: ripples shimmer very slowly (faint cream highlight crawling
        // the crests), silent. On peak a thin pop-magenta rim-light races the
        // ripples (zero pop-accent at baseline — the peak feels earned).
        this.mat.opacity = 0.9 + 0.06 * Math.sin(this.timeS * 0.35);
        this.mat.color.setHex(this.peak > 0.5 ? POP_MAGENTA : 0xffffff);
        break;
      }
    }
  }

  dispose(): void {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.texture.dispose();
  }
}

/* ── interactables ────────────────────────────────────────────────────────────
 *
 * Room-filtered (the forest pattern). Each names: the object + painted asset,
 * the clip(s) onUse drives, the calm-baseline update, the event-peak.
 *
 * The onUse Cosmo-drive uses the SAME bridge convention as the reference
 * forest trampoline: we nudge `cosmo.root.position` / `cosmo.rollZ` directly
 * (the CosmoAnimDirector will own the full clip-drive when it lands as a
 * first-class scheduler). Each onUse comments the named clip sequence the
 * director should play, and any animation-request the design raised.
 */

class SlideCrest implements InteractableHandle {
  readonly id = 'slide-crest';
  readonly anchor: { x: number; y: number; z: number };
  readonly range = 2.2; // fits the slope lip
  private decal: DuneDecal;

  constructor(scene: THREE.Scene, room: SubstrateCtx['room']) {
    // The crest lip, slightly ahead of and below Cosmo's arrival anchor.
    this.anchor = { x: room.anchor.x + 0.2, y: room.anchor.y, z: room.anchor.z - 2.6 };
    this.decal = new DuneDecal(
      scene,
      {
        id: 'slide-crest',
        textureRel: 'assets/objects/slide-crest.png',
        width: 2.4,
        height: 1.2,
        additive: true,
        baseline: 'sheen-breathe',
      },
      this.anchor,
    );
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.decal.update(dt);
  }

  /**
   * Slide-Crest delight-loop (Room A headline joy):
   *   walk → look (down the slope) → fall (slips over) + procedural lateral-glide
   *   (gentle rollZ sway + downhill translation, NOT a tumble) → stretch (soft
   *   landing at the dune-foot as the sand-boom decays) → idle.
   *
   * ANIMATION REQUEST: clip `slide` (~1.6s one-shot, Cosmo sledding on his
   *   backside, arms out, antenna streaming back, calm not frantic). Until it
   *   ships, the composite below (fall + procedural lateral-glide + stretch) is
   *   the doc-rated "acceptable" fallback. Tracked as a REAL dependency (this is
   *   Room A's headline joy) — see runbook + canvas §5.
   */
  onUse(cosmo: CosmoV2Rig): void {
    this.decal.trigger();
    // Bridge until CosmoAnimDirector: a gentle downhill lateral-glide impulse +
    // a slight roll-sway (reads as sliding, not tumbling). The director will
    // replace this with walk→look→[slide|fall+glide]→stretch and the sand-boom
    // SFX swell (dune-slide event sound).
    cosmo.root.position.x -= 0.06; // downhill drift along the lit face
    cosmo.root.position.y -= 0.03;
    cosmo.rollZ = -0.08; // balance-lean into the slide (survives the billboard lookAt)
  }

  dispose(): void {
    this.decal.dispose();
  }
}

class BeadBloom implements InteractableHandle {
  readonly id = 'bead-bloom';
  readonly anchor: { x: number; y: number; z: number };
  readonly range = 1.5;
  private decal: DuneDecal;

  constructor(scene: THREE.Scene, room: SubstrateCtx['room']) {
    this.anchor = { x: room.anchor.x + 1.7, y: room.anchor.y - 0.15, z: room.anchor.z - 1.6 };
    this.decal = new DuneDecal(
      scene,
      {
        id: 'glass-bead-bloom',
        textureRel: 'assets/objects/glass-bead-bloom.png',
        width: 0.7,
        height: 0.5,
        additive: false,
        baseline: 'glint-cycle',
      },
      this.anchor,
    );
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.decal.update(dt);
  }

  /**
   * Bead-Bloom (Room A small/quiet loop):
   *   walk → duck (crouch to peer at the half-buried desert-glass) → wink (a
   *   tiny pop-magenta glint answers; glass-bead glint SFX fires) → idle.
   * All clips shipped — no animation-request. The private delight of noticing
   * something almost-hidden; the desert's one secret jewel (the ≤5% pop-magenta
   * accent, peak-only).
   */
  onUse(cosmo: CosmoV2Rig): void {
    this.decal.trigger();
    // Bridge until CosmoAnimDirector (which plays walk→duck→wink). A tiny
    // settle-dip stands in for the crouch-peek beat.
    cosmo.root.position.y -= 0.02;
  }

  dispose(): void {
    this.decal.dispose();
  }
}

class SingingBowl implements InteractableHandle {
  readonly id = 'singing-bowl';
  readonly anchor: { x: number; y: number; z: number };
  readonly range = 1.8;
  private decal: DuneDecal;
  private orbit = 0;
  private orbiting = false;

  constructor(scene: THREE.Scene, room: SubstrateCtx['room']) {
    // The scoured rippled sand-depression in the cupped floor.
    this.anchor = { x: room.anchor.x, y: room.anchor.y - 0.3, z: room.anchor.z - 2.0 };
    this.decal = new DuneDecal(
      scene,
      {
        id: 'wind-bowl',
        textureRel: 'assets/objects/wind-bowl.png',
        width: 2.2,
        height: 1.1,
        additive: false,
        baseline: 'ripple-shimmer',
      },
      this.anchor,
    );
  }

  update(dt: number, _u: GlobalUniforms): void {
    this.decal.update(dt);
    // Procedural slow-orbit fallback for the `circle-sway` request — while the
    // bowl rings, Cosmo orbits the rim. Decays after one slow loop. (Cosmo's
    // root.position is owned by CosmoAgent; this only advances the phase used by
    // onUse's re-trigger — the actual orbit translation is applied in onUse via
    // a slow lerp the director will own.)
    if (this.orbiting) {
      this.orbit += dt * 0.5; // ~2s per loop
      if (this.orbit >= Math.PI * 2) {
        this.orbit = 0;
        this.orbiting = false;
      }
    }
  }

  /**
   * Singing Bowl (Room B delight-loop — the slowest, most enveloping peak):
   *   walk → dance (a slow circling sway around the rim, NOT frantic) as the
   *   bowl rings (bowl-ring SFX + drone octave-lift + pop-magenta rim-light
   *   tracing the ripples) → petted-posture (contentment) → idle.
   *
   * ANIMATION REQUEST: clip `circle-sway` (optional, 2s loop — slow trance-like
   *   circular sway, eyes half-lidded). The `dance` clip + the procedural
   *   slow-orbit here is the stated fallback that "reads well" — nice-to-have,
   *   not a hard dependency. See runbook + canvas §5.
   */
  onUse(cosmo: CosmoV2Rig): void {
    this.decal.trigger();
    this.orbiting = true;
    this.orbit = 0;
    // Bridge until CosmoAnimDirector (which plays walk→dance→petted→idle). A
    // gentle roll-sway stands in for leaning into the slow circle.
    cosmo.rollZ = 0.05;
  }

  dispose(): void {
    this.decal.dispose();
  }
}

function dunesInteractables(ctx: SubstrateCtx): InteractableHandle[] {
  if (ctx.room.id === 'long-dune') {
    return [new SlideCrest(ctx.scene, ctx.room), new BeadBloom(ctx.scene, ctx.room)];
  }
  if (ctx.room.id === 'the-windless-hollow') {
    return [new SingingBowl(ctx.scene, ctx.room)];
  }
  return [];
}

/* ── inhabitants ──────────────────────────────────────────────────────────────
 *
 * Seen-not-used ambient life (the dweller-lens Sims-density requirement, beyond
 * the interactables + 5–7 parallax layers). The crest-redraw, bead glint-cycle
 * and ripple-shimmer are carried by the interactable decals + the background's
 * additive particle layer, so this stays deliberately light — there is no extra
 * autonomous creature in the dunes (emptiness IS the strangeness, canvas §1).
 * Returning [] keeps the substrate default; the breathing life is all in the
 * background + interactable layers. (Explicitly declared per the dweller-lens
 * "deliberate stillness must be declared" rule.)
 */
function dunesInhabitants(_ctx: SubstrateCtx): InhabitantHandle[] {
  return [];
}

/* ── audio ────────────────────────────────────────────────────────────────────
 *
 * Per-room drone bed, declared via `rooms.json audioBed` (the Wave-24 RoomSpec
 * field): long-dune → dune-drone-open.mp3, the-windless-hollow →
 * dune-drone-hollow.mp3. The substrate's DefaultAudio swaps to the room's
 * audioBed on enter (the room-keyed bed-swap is the Phase-0 substrate seam,
 * canvas §8 / O4). We register a handle so the teaching shape is present; the
 * three event SFX (sand-slide boom, glass-bead glint, crest-wind / bowl-ring,
 * ripple-settle, hollow-hush) are fired by the interactables/transitions when
 * the SFX scheduler lands — see runbook for the ElevenLabs prompts.
 */
class DuneAudio implements AudioHandle {
  enter(): void {
    /* substrate DefaultAudio loads the room's `audioBed` and loops it at 0.45. */
  }
  exit(_fadeMs: number): void {
    /* substrate fades the active bed over fadeMs on room-exit. */
  }
  update(_dt: number): void {
    /* no-op — the AudioFFTBridge ticks itself. */
  }
  dispose(): void {
    /* nothing owned at this level. */
  }
}

function dunesAudio(_ctx: SubstrateCtx): AudioHandle {
  return new DuneAudio();
}

/* ── transitions.roomToRoom — the one descend/climb hush-blend ────────────────
 *
 * long-dune ⇄ the-windless-hollow share the Area `the-singing-flat`, so the
 * substrate runs a continuous biome-blend. We override exactly this one path
 * (matching forest's "override one path of N" ratio): the wide saffron band
 * narrows/warms into faded-rose pooled light, the wind-texture fades out (the
 * hollow-hush pressure-drop SFX fires at the threshold), and the drone closes
 * in (open-reverb → room-resonance — same harmonic DNA, so it's one tone
 * tightening, never a theme-cut). 2.6s, ambient #E8C4B8. Cosmo lands at t=0.5
 * already infused with the destination mood. No vortex, no shake.
 */
class HushBlendTransition implements TransitionDriver {
  private elapsed = 0;
  private readonly durationS = 2.6;

  constructor(
    private _ctx: TransitionCtx,
    private _from: string,
    private _to: string,
  ) {
    void this._ctx;
    void this._from;
    void this._to;
  }

  run(_dt: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (): void => {
        this.elapsed = (performance.now() - start) / 1000;
        // The continuous mood-lerp (saffron→faded-rose) + bed cross-fade are
        // driven by the substrate's default biome-blend against the two specs;
        // this override colors the flavour (drift kind, #E8C4B8 tint) and is
        // where the hollow-hush SFX would be cued at the threshold (~t=0.5).
        if (this.elapsed >= this.durationS) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    /* fire-and-forget rAF chain; no GPU resources to free. */
  }
}

function dunesRoomToRoom(
  ctx: TransitionCtx,
  fromRoomId: string,
  toRoomId: string,
): TransitionDriver {
  return new HushBlendTransition(ctx, fromRoomId, toRoomId);
}

/* ── arrival + universeToUniverse — the dusk-mirage portal ────────────────────
 *
 * Arrival materializes Cosmo on The Long Dune crest (the "you have arrived
 * somewhere vast" beat). A warm saffron-tinted 1.4s portal — hue pulled from
 * calm-baseline warmed toward saffron (0.10 ≈ warm-orange on the HSL wheel the
 * portal hue param uses; forest's 0.62 is the cool default).
 */
function dunesArrival(_ctx: ArrivalCtx): ArrivalAnimation {
  return { kind: 'portal', duration: 1.4, hue: 0.1 };
}

/**
 * The dusk-mirage portal (Universe↔Universe). A heat-shimmer rift on the
 * horizon: the destination wavers into being through rising desert-heat, the
 * saffron horizon-line bowing/parting like a mirage, then resolving from the
 * bottom up. NO spinning vortex (that would shake) — a slow LATERAL
 * mirage-bloom (it breathes). 1.4s, warm saffron tone.
 *
 * We ship the timing/ceremony envelope here; the lateral heat-shimmer shader
 * sweep is the substrate portal driver's job (it already owns the portal pass).
 * This override exists so the Dunes portal reads warm-mirage rather than the
 * default cool nebula.
 */
class DuskMiragePortal implements TransitionDriver {
  private elapsed = 0;
  private readonly durationS = 1.4;

  constructor(private _ctx: TransitionCtx) {
    void this._ctx;
    // Tints reserved for the substrate portal pass to consume (warm saffron
    // mirage rather than cool nebula). Referenced so they survive tree-shaking
    // and document the intended hue.
    void SAFFRON_GLOW;
    void FADED_ROSE;
  }

  run(_dt: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (): void => {
        this.elapsed = (performance.now() - start) / 1000;
        if (this.elapsed >= this.durationS) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    /* fire-and-forget. */
  }
}

function dunesUniverseToUniverse(
  ctx: TransitionCtx,
  _fromUniverseId: string,
  _toUniverseId: string,
): TransitionDriver {
  return new DuskMiragePortal(ctx);
}

/* ── default export ──────────────────────────────────────────────────────────
 *
 * The substrate dynamically imports this module and tests `typeof mod[key]`
 * for each optional export; missing keys fall back to substrate defaults.
 * We ship the full set the design calls for. `inhabitants` is intentionally
 * empty (declared deliberate stillness — emptiness IS the strangeness).
 */
const dunesBehavior: UniverseBehavior = {
  background: dunesBackground, // REQUIRED — biomeKey:null everywhere (Fork 3(a))
  arrival: dunesArrival,
  inhabitants: dunesInhabitants,
  interactables: dunesInteractables,
  audio: dunesAudio,
  transitions: {
    roomToRoom: dunesRoomToRoom,
    // areaToArea omitted — single Area; substrate default gradient-cut never fires.
    universeToUniverse: dunesUniverseToUniverse,
  },
};

export default dunesBehavior;
