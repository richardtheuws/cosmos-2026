# 01-substrate-architecture.md — Wave 21 Substrate Architecture

**Status**: design, locked decisions implemented
**Authored**: 2026-05-04
**Authority**: NORTH-STAR.md §3 + §3b + §6 (2026-05-04 pivot); `00-substrate-completion-plan.md` §2 (locked)
**Implements**: Universe→Area→Room runtime + hybrid-contract loader + per-tier transitions
**Read first**: NORTH-STAR.md, then `00-substrate-completion-plan.md` §2 (do not re-litigate Area-layer, hybrid-contract, transition tiers, or feature-flag rollout)

This document is the implementation contract for phase 2 (authoring-doc-writer + reference-forest-builder) and phase 3 (runtime-wirer). It is implementable, not aspirational. Code lives in phases 2/3.

---

## 1 · JSON contracts

### 1.1 `manifest.json` (extended)

```json
{
  "$schema": "https://cosmos-2026.dev/schemas/manifest-1.1.json",
  "version": "1.1",
  "name": "forest",
  "displayName": "The Mushroom Forest",
  "displayNameEn": "The Mushroom Forest — Cosmo's entry Universe",
  "summaryEn": "A watercolor cosmic-mushroom forest in the Hayao×Moebius idiom. The entry Universe.",
  "author": "Richard Theuws",
  "license": "MIT",
  "behaviorModule": true,
  "defaultArea": "the-mushroom-stand",
  "brandDeviation": null,
  "assets": [
    { "type": "image", "path": "assets/sky.png", "preload": true },
    { "type": "image", "path": "assets/mushroom-near.png", "preload": true },
    { "type": "audio", "path": "assets/ambient.mp3", "preload": false },
    { "type": "shader", "path": "shaders/fluid.frag", "preload": true }
  ],
  "post": {
    "preset": "calm-baseline",
    "intensityCurve": { "bloom": 1.0, "kaleido": 0.85, "fluid": 0.9, "chroma": 1.0 }
  }
}
```

**Field semantics**:
- `version` — schema version. Substrate refuses unknown majors with a clear error; minors are forward-compatible.
- `name` — slug. Must equal the folder name. Used in URLs.
- `displayName` — any language. `displayNameEn` — ≤100 chars English summary so non-native readers can navigate.
- `behaviorModule` — `true` if `behavior.ts` exists. Substrate uses this hint to skip a 404-probe in production builds; `npm run dev` ignores it (Vite glob-import discovers the module).
- `defaultArea` — area id used when URL omits `&area=`. Must match an entry in `areas.json`. If invalid: substrate uses first-listed area and logs a warning.
- `brandDeviation` — `null` (default) or short string explaining intentional deviation. PR-reviewer field, no runtime effect.
- `assets[]` — declarative preload list. Paths are universe-folder-relative (no `../../`). The substrate strips `../` for safety (security, not pedantry).
- `post.preset` — one of `"calm-baseline" | "deep-trip" | "neutral"`. Drives globalUniforms biome-curve presets. Optional; default `"calm-baseline"`.
- `post.intensityCurve` — multipliers applied to the post-FX stack while inside this Universe. Optional.

### 1.2 `areas.json` (NEW)

```json
{
  "$schema": "https://cosmos-2026.dev/schemas/areas-1.0.json",
  "version": "1.0",
  "entryArea": "the-mushroom-stand",
  "areas": [
    {
      "id": "the-mushroom-stand",
      "displayName": "De paddenstoelenstand",
      "displayNameEn": "The Mushroom Stand",
      "description": "The slow-bloom heart of the forest. Mushroom-cream sky, moss-sage ground, three rooms threaded by drifting nectar-spore trails.",
      "moodOverrides": null,
      "pathExperience": {
        "kind": "mushroom-path",
        "duration": 2.4,
        "ambient": "#F5EDD8",
        "description": "Walking under a canopy that breathes; spore-motes drift at hip height; the next room fades in through the leaves."
      },
      "rooms": ["clearing", "deep-grove", "the-hollow"]
    }
  ]
}
```

**Field semantics**:
- `entryArea` — area id used when URL omits `&area=`. Should equal `manifest.defaultArea`; if they disagree the manifest wins (it's the parent contract).
- `areas[]` — ordered. Order matters only for the "first-listed" fallback when URL specifies a missing area.
- `moodOverrides` — `null` (inherit Universe defaults) or a partial palette/post override:
  ```json
  "moodOverrides": {
    "ambient": "#1B0F2A",
    "primary": "#3D2E4A",
    "post": { "bloom": 0.6, "kaleido": 0.3 }
  }
  ```
  Keys are partial — any field absent inherits from the Universe `manifest.post`.
- `pathExperience` — describes the Area-internal path-experience (the Room-to-Room walk, not Area-to-Area which uses gradient-cut). `kind` is a string the substrate maps to a default driver (`"mushroom-path" | "burrow-down" | "drift" | "fade"`); unknown kinds fall back to default biome-blend. `duration` in seconds. `ambient` is the path's clear-color tint while traversing.
- `rooms[]` — string ids referencing entries in `rooms.json`. Order does not matter for traversal (rooms.json `exits` describe the graph); it's a set-membership declaration.

### 1.3 `rooms.json` (extended — backwards-compatible)

```json
{
  "$schema": "https://cosmos-2026.dev/schemas/rooms-1.1.json",
  "version": "1.1",
  "entryRoom": "clearing",
  "rooms": [
    {
      "id": "clearing",
      "area": "the-mushroom-stand",
      "displayName": "The Clearing",
      "displayNameEn": "The Clearing",
      "description": "A soft mushroom-cream open space where Cosmo arrives. The trampoline lives here.",
      "anchor": { "x": 0, "y": 0, "z": 0 },
      "cameraBounds": { "panRangeX": 1.6, "panRangeY": 0.6 },
      "biomeKey": "slow-bloom",
      "exits": [
        { "to": "deep-grove", "via": "left-mushroom-path", "distance": 12 },
        { "to": "the-hollow", "via": "down-burrow", "distance": 8 }
      ]
    }
  ]
}
```

**Backwards-compat note**: Wave 20a `rooms.json` has no `area` field. The substrate treats missing `area` as belonging to `manifest.defaultArea`. This means the existing `universes/forest/rooms.json` keeps loading without edits while the reference-forest-builder backfills `area: "the-mushroom-stand"` in phase 2.

**New fields**:
- `area` — area id this room belongs to. Must reference `areas.json`. Required from v1.1 onwards (with backwards-compat default).
- `displayNameEn` — optional English variant.
- `cameraBounds` — passed to `CosmoStage.setCameraBounds()` on enter. Optional; falls back to default pan ranges.
- `biomeKey` — optional reference to a key in the existing `BIOMES` registry; if present, the default background driver routes through `BiomeManager` for a known curve. Omit for fully custom rooms.

### 1.4 `behavior.ts` (TypeScript interface)

```ts
import type * as THREE from 'three';
import type { GlobalUniforms } from '../../src/core/globalUniforms';
import type { CosmoV2Rig, CosmoState } from '../../src/three/cosmoV2';

/* ── Shared context ─────────────────────────────────────────────────────── */

export interface SubstrateCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  globalUniforms: GlobalUniforms;
  /** Resolves a path relative to this universe's folder. Sandboxed —
   *  attempts to escape (../) are normalised away. */
  assetPath: (rel: string) => string;
  /** Universe metadata, parsed from manifest.json. */
  universe: { id: string; name: string; displayName: string };
  /** Active Area metadata (post mood-override merge). */
  area: { id: string; displayName: string; mood: ResolvedMood };
  /** Active Room metadata. */
  room: { id: string; displayName: string; anchor: { x: number; y: number; z: number } };
}

export interface ResolvedMood {
  ambient: string;       // hex
  primary: string;       // hex
  post: { bloom: number; kaleido: number; fluid: number; chroma: number };
}

/* ── Driver interfaces ──────────────────────────────────────────────────── */

export interface BackgroundHandle {
  update(dt: number, u: GlobalUniforms): void;
  dispose(): void;
}

export type ArrivalAnimation =
  | { kind: 'portal'; duration: number; hue?: number }
  | { kind: 'fade'; duration: number; color?: string }
  | { kind: 'drift'; from: { x: number; z: number }; duration: number }
  | { kind: 'custom'; run: (dt: number) => boolean }; // returns true when complete

export interface ArrivalCtx extends SubstrateCtx {
  cosmo: CosmoV2Rig;
  state: CosmoState;
}

export interface InhabitantHandle {
  id: string;
  update(dt: number, u: GlobalUniforms): void;
  dispose(): void;
}

export interface InteractableHandle {
  id: string;
  /** World-space position Cosmo can walk to. */
  anchor: { x: number; y: number; z: number };
  /** Range in world-units within which Cosmo's AI may target this. */
  range: number;
  update(dt: number, u: GlobalUniforms): void;
  /** Called by InteractionManager when Cosmo reaches the anchor. */
  onUse(cosmo: CosmoV2Rig): void;
  dispose(): void;
}

export interface AudioHandle {
  /** Resume + drive any music/SFX during room residence. */
  enter(): void;
  exit(fadeMs: number): void;
  update(dt: number): void;
  dispose(): void;
}

export interface TransitionDriver {
  /** Plays the transition. Returns a promise that resolves when complete. */
  run(dt: number): Promise<void>;
  dispose(): void;
}

export interface TransitionCtx extends SubstrateCtx {
  fromMood: ResolvedMood;
  toMood: ResolvedMood;
}

/* ── Optional exports (each independently optional) ─────────────────────── */

export interface UniverseBehavior {
  background?: (ctx: SubstrateCtx) => BackgroundHandle;
  arrival?: (ctx: ArrivalCtx) => ArrivalAnimation;
  inhabitants?: (ctx: SubstrateCtx) => InhabitantHandle[];
  interactables?: (ctx: SubstrateCtx) => InteractableHandle[];
  audio?: (ctx: SubstrateCtx) => AudioHandle;
  transitions?: {
    roomToRoom?: (ctx: TransitionCtx, fromRoomId: string, toRoomId: string) => TransitionDriver;
    areaToArea?: (ctx: TransitionCtx, fromAreaId: string, toAreaId: string) => TransitionDriver;
    universeToUniverse?: (ctx: TransitionCtx, fromUniverseId: string, toUniverseId: string) => TransitionDriver;
  };
}
```

**Detection rule**: the substrate dynamically imports `behavior.ts` (one fetch). For each key (`background`, `arrival`, …), it tests `typeof mod[key] === 'function'`. Missing keys fall back to defaults (§7).

**Why each export is independently optional**: an author who wants a new background but the default arrival, default inhabitants, and default transitions writes a 30-line `behavior.ts` exporting only `background`. That's the floor of the hybrid contract.

---

## 2 · URL grammar

### 2.1 Forms

| URL | Resolves to |
|---|---|
| `/play/` | Legacy path (current `ParallaxScene` direct). Until cutover. |
| `/play/?substrate=v2` | Substrate path. Universe = `forest` (entry default). Area = `manifest.defaultArea`. Room = `rooms.json::entryRoom`. |
| `/play/?substrate=v2&universe=<u>` | Universe `<u>`. Area = its `defaultArea`. Room = its `entryRoom`. |
| `/play/?substrate=v2&universe=<u>&area=<a>` | Area `<a>`. Room = `rooms.json::entryRoom` if it belongs to `<a>`, else first room listed in `<a>.rooms`. |
| `/play/?substrate=v2&universe=<u>&area=<a>&room=<r>` | Full triple. Validated as: `<u>` exists, `<a>` is in `<u>.areas`, `<r>` is in `<a>.rooms`. |

After cutover (uat-deploy-keeper, phase 4), `?substrate=v2` flag is dropped — substrate becomes the default.

### 2.2 Invalid-id fallback policy

Resolution is **left-to-right with logged warnings, never silent errors**:

1. **Invalid universe** → fallback to `forest`. Console: `[substrate] universe '<u>' not found, falling back to forest`.
2. **Invalid area** (universe valid) → fallback to `<universe>.defaultArea`, else first-listed area. Console: `[substrate] area '<a>' not found in universe '<u>', falling back to '<defaultArea>'`.
3. **Invalid room** (universe + area valid) → fallback to `entryRoom` if it belongs to the resolved area, else first-listed room of that area. Console: `[substrate] room '<r>' not found in area '<a>', falling back to '<entryRoom>'`.

Fallbacks update `history.replaceState` so the URL shown to the user reflects what actually loaded. This makes share-links self-healing: a stale link to a removed room lands on the area's entry room, with the URL corrected in-place.

### 2.3 Cosmo-state survival across URL changes

Cosmo state lives in `localStorage["cosmos.state.v1"]`:
```ts
{ version: 1, mood, energy, memory, traversalHistory, inventory, lastUniverse, lastArea, lastRoom }
```

**Save points**:
- Every Room exit (just before `roomHost.exit()`).
- Every Universe exit.
- On `pagehide` event (mobile background-tab eviction).

**Load**:
- On boot, `SubstrateLoader` reads the state. If URL specifies different room/area/universe, URL wins (explicit user intent), but `mood / energy / memory / inventory` carry over.
- `traversalHistory` always APPENDS the new `<universe>:<area>:<room>` triple. Cosmo remembers everywhere he's been; URL navigation does not reset memory.

**Anti-corruption**: schema version mismatch → reset state with one-line console warning, not a crash. We never block boot on bad localStorage.

---

## 3 · Runtime architecture

### 3.1 Module diagram

```
src/substrate/
├── SubstrateLoader.ts        # entry — parses URL, fetches manifests, hands off
├── UniverseHost.ts           # owns universe-scope: shared assets, post preset
│   ├── AreaHost.ts           # owns area-scope: mood overrides, path-experience
│   │   ├── RoomHost.ts       # owns room-scope: scene contents (delegates to drivers)
│   │   │   ├── BackgroundDriver (default | author's behavior.background)
│   │   │   ├── InhabitantsDriver (default empty | author's)
│   │   │   ├── InteractablesDriver (default empty | author's)
│   │   │   └── AudioDriver (default silence | author's)
│   │   └── TransitionDriver.RoomToRoom (default biome-blend | author's)
│   └── TransitionDriver.AreaToArea (default gradient-cut | author's)
└── TransitionDriver.UniverseToUniverse (default portal | author's)

src/substrate/drivers/
├── DefaultBackground.ts        # composition-spec parallax (wraps ParallaxScene)
├── DefaultArrival.ts           # 1.4s portal, hue from manifest.post.preset
├── DefaultInhabitants.ts       # noop ([] handle)
├── DefaultInteractables.ts     # noop
├── DefaultAudio.ts             # silence (with universe-bed fallback)
├── BiomeBlendTransition.ts     # reuses BiomeManager crossfade machinery
├── GradientCutTransition.ts    # single-pass shader on globalUniforms
└── PortalTransition.ts         # reuses NebulaPortal (lifted to three/)

src/substrate/contracts/
├── ManifestSchema.ts           # zod-style validators (zero runtime dep, hand-rolled)
├── AreasSchema.ts
├── RoomsSchema.ts
└── BehaviorContract.ts         # the TS interface from §1.4
```

**Reuse map** (NORTH-STAR §3 brand-lock + locked-decisions §2.4):

| Existing system | Substrate role |
|---|---|
| `ParallaxScene` (parallaxScene.ts) | Default `BackgroundDriver` for any room declaring composition-spec assets. Not deleted. |
| `BiomeManager` (biomeManager.ts) | Engine for `BiomeBlendTransition` (Room↔Room). API extension below. |
| `NebulaPortal` (phaser/entities/) | Lifted into `src/three/NebulaPortal3D.ts` shim or kept in Phaser for HUD; `PortalTransition` calls into it. |
| `globalUniforms` | Shared substrate-driven mood-state writes. `biomeIntensity` semantics preserved. |
| `CosmoStage` + `CosmoAgent` + `CosmoAI` | Owned at `UniverseHost` level (shared across rooms). RoomHost calls `cosmoAgent.setPosition(room.anchor)` on enter. |

### 3.2 Lifecycle

Each level (Universe / Area / Room) implements:

```ts
interface Host {
  load(manifest: unknown): Promise<void>;   // fetch + validate JSON, preload assets
  enter(ctx: SubstrateCtx): Promise<void>;  // build drivers, run arrival animation
  tick(dt: number): void;                   // per-frame, drives all child drivers
  exit(ctx: SubstrateCtx): Promise<void>;   // run exit-transition, persist state
  dispose(): void;                          // free THREE objects, listeners
}
```

**Per-frame call order** (driven from CanvasManager registration in main.ts):

1. `audioBridge.update()` — FFT into uniforms (unchanged)
2. `eventDirector.update(u)` (unchanged)
3. `motion.tick(dt)` (unchanged)
4. `substrateLoader.tick(dt)` — fans out to active host: universe → area → room → drivers (background, inhabitants, interactables, audio)
5. `cosmoAI.tick(dt)` + `cosmoAgent.update(...)` (unchanged)
6. `cosmoStage.panCamera(motion, dt)` + `cosmoStage.render()` (unchanged)
7. `biomeMgr.update(1/60)` — only when no substrate room owns biome (legacy fallback path)

**Ownership split**:

- **UniverseHost owns**: shared post-FX preset (writes once on `enter`), shared asset cache, the audio music-bed (if Universe specifies one), the Cosmo rig + CosmoAI lifecycle (Cosmo persists across rooms; only `room.anchor` repositions him).
- **AreaHost owns**: resolved mood (Universe defaults + areas.json overrides), the Area-to-Area path-experience driver, the active room-graph subgraph.
- **RoomHost owns**: the four per-room drivers (background, inhabitants, interactables, audio), the per-room camera bounds, the Room-to-Room transition selection.

### 3.3 State handoff: Cosmo enters a Room

```
1. RoomHost.enter(ctx):
   a. previousRoom?.exit() — if room change is internal to area, RoomToRoom transition begins
   b. If transition is biome-blend: BiomeBlendTransition.run() drives globalUniforms.biomeIntensity from fromMood→toMood across 1.5–3s while both rooms render briefly (we keep the scene from old room a few frames, fade decorations out as fade-in starts)
   c. cosmoAgent.setPosition(room.anchor)  ← happens at transition midpoint (t=0.5) so Cosmo "lands" with the new mood
   d. CosmoStage.setCameraBounds(room.cameraBounds)
   e. After transition completes, RoomHost calls arrival driver IF this is a fresh-arrival (universe entry or post-portal). Same-universe room hops do NOT replay arrival.
   f. Companion-AI/InteractionManager resumes
```

Arrival animation plays on **Universe entry only** (or explicit `?arrival=replay` debug flag). Within-Universe room hops use the Room-to-Room transition without re-arrival — this is what makes the world "feel continuous" rather than reset-per-room.

### 3.4 Hot-reload story

Vite HMR is the key. The substrate uses `import.meta.glob('/universes/*/behavior.ts', { eager: false })` to discover universes. In dev:

```ts
if (import.meta.hot) {
  import.meta.hot.accept('/universes/forest/behavior.ts', (newModule) => {
    activeRoomHost?.swapBehavior(newModule.default);
  });
}
```

`swapBehavior(newMod)`:
1. Calls current drivers' `dispose()`.
2. Re-builds drivers from `newMod` (or defaults where exports omitted).
3. Calls `enter()` again WITHOUT the arrival animation (we're mid-room; replaying arrival would be jarring).
4. Cosmo position preserved.

Editing JSON files triggers full re-load of the affected scope (room JSON edit → re-enter that room). The existing JSON-fetch path is cache-busted by Vite's module timestamps.

In production builds, HMR is absent — substrate uses static `import('/universes/<name>/behavior.ts')` (Vite emits a chunk per universe behavior).

---

## 4 · Transition driver — per-tier

### 4.1 Room↔Room: biome-blend (default 1.5–3s)

**Reuses `BiomeManager.startCrossfade()` machinery** but the manager currently keys on biome-name from the registry. Two changes needed:

**API extension** (additive, backwards-compatible — the existing `start(initial)` and `requestPlayerSwitch()` keep working):

```ts
class BiomeManager {
  // existing methods unchanged

  /** NEW — substrate path. Crossfades between arbitrary mood targets without
   *  needing them to be in the BIOMES registry. Used by BiomeBlendTransition. */
  startMoodCrossfade(from: BiomePostFXCurve, to: BiomePostFXCurve, durationS: number): Promise<void>;
}
```

Implementation: identical to existing `advance()` but takes external curves and a custom duration, and resolves the promise when `t >= 1`. The existing `update(dt)` loop already drives the lerp; we just add a dedicated state variant `{ kind: 'mood-crossfade', from, to, t, durationS, resolve }`.

**Default behavior**: when `behavior.transitions.roomToRoom` is omitted, `BiomeBlendTransition` resolves the from/to mood from the two rooms' resolved moods (Universe → Area override → Room override), and runs `biomeMgr.startMoodCrossfade(fromCurve, toCurve, 2.0)`. During the crossfade, the new room's drivers are constructed and ticked (so its inhabitants ease in), and the old room's drivers are disposed at `t = 1.0`.

Author override: `behavior.transitions.roomToRoom = (ctx, from, to) => myCustomMushroomPath(ctx)`. Must return a `TransitionDriver` whose `run()` resolves when complete.

### 4.2 Area↔Area: gradient-cut (default 0.6–1.2s)

Single-pass shader on the existing post-FX composer — adds one fullscreen quad to the chain temporarily.

```glsl
// gradientCut.frag (new file, lives in src/substrate/drivers/shaders/)
uniform vec3 fromColor;
uniform vec3 toColor;
uniform float t;          // 0..1
varying vec2 vUv;

void main() {
  // Smooth color shift from fromColor to toColor with a gradient sweep
  // sweeping diagonally so the cut feels directional, not a dip-to-black.
  float sweep = smoothstep(t - 0.15, t + 0.15, vUv.x * 0.5 + vUv.y * 0.5);
  vec3 col = mix(fromColor, toColor, sweep);
  gl_FragColor = vec4(col, t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0); // alpha eases in/out
}
```

`fromColor` = source area's `moodOverrides.primary` (or universe primary if null).
`toColor` = target area's primary.

**Default behavior**: 0.9s, additive blend over the post-FX output. Cosmo continues rendering on top (per cosmoStage.ts compositing trace) — the gradient-cut sits between parallax and Cosmo. Author override identical surface to §4.1.

### 4.3 Universe↔Universe: portal (default 1.4–2.5s)

Reuses `NebulaPortal`. Currently lives in `src/phaser/entities/NebulaPortal.ts` (Graphics-based, Phaser scene). Two options for substrate use:

**Recommended path (minimal change)**: keep NebulaPortal in Phaser; wrap it in a small `PortalTransition` adapter that grabs the active Phaser scene reference (already in main.ts as `phaserGame.scene.getScene('CosmoScene')`) and instantiates the portal there. The substrate's `TransitionDriver.run()` returns a promise that resolves when `portal.close(800)` fires its disposal callback.

**Default behavior**: 1.6s open, hold 0.3s while loading new universe assets, 0.6s close. Hue derives from target universe's `manifest.post` preset (calm-baseline → 0.62, deep-trip → 0.48). Cosmo state persists: `localStorage` save before transition, `traversalHistory` appended on resolve.

### 4.4 Override surface

```ts
behavior.transitions = {
  roomToRoom: (ctx, fromRoomId, toRoomId) => TransitionDriver,
  areaToArea: (ctx, fromAreaId, toAreaId) => TransitionDriver,
  universeToUniverse: (ctx, fromUniverseId, toUniverseId) => TransitionDriver,
};
```

Each returns a `TransitionDriver` with `run(): Promise<void>` and `dispose(): void`. The substrate awaits `run()`, then calls `dispose()`. Tier inheritance: if `roomToRoom` is defined but `areaToArea` is not, the substrate uses default gradient-cut for area transitions even within an authored universe.

---

## 5 · Folder layout

### 5.1 `universes/<name>/` (final shape)

```
universes/<name>/
├── manifest.json             # required — §1.1
├── areas.json                # required — §1.2
├── rooms.json                # required — §1.3
├── behavior.ts               # optional — §1.4
├── README.md                 # required — author's notes; quickstart for forks
├── assets/                   # universe-scoped assets (parallax layers, decals, audio)
│   ├── backgrounds/
│   │   └── <biome-id>/
│   │       ├── composition-spec.json
│   │       └── layer-*.png
│   ├── inhabitants/
│   ├── interactables/
│   └── audio/
└── shaders/                  # optional — universe-scoped GLSL
```

A JSON-only Universe = `manifest.json` + `areas.json` + `rooms.json` + `assets/backgrounds/<biome>/composition-spec.json` + the PNG layers. That's the minimum-viable contract; defaults handle the rest (§7).

### 5.2 `src/substrate/` (new directory layout)

```
src/substrate/
├── SubstrateLoader.ts
├── UniverseHost.ts
├── AreaHost.ts
├── RoomHost.ts
├── ResolveURL.ts             # parses ?universe=&area=&room= with fallbacks
├── ResolveMood.ts            # merges universe + area + room mood overrides
├── PreloadManager.ts         # asset preload from manifest.assets[]
├── StatePersistence.ts       # localStorage + traversalHistory mutations
├── contracts/
│   ├── ManifestSchema.ts
│   ├── AreasSchema.ts
│   ├── RoomsSchema.ts
│   └── BehaviorContract.ts
└── drivers/
    ├── DefaultBackground.ts
    ├── DefaultArrival.ts
    ├── DefaultInhabitants.ts
    ├── DefaultInteractables.ts
    ├── DefaultAudio.ts
    ├── BiomeBlendTransition.ts
    ├── GradientCutTransition.ts
    ├── PortalTransition.ts
    └── shaders/
        └── gradientCut.frag
```

---

## 6 · Migration plan — ParallaxScene → substrate-default-background

### 6.1 Phase A: dual-path coexistence (`?substrate=v2`)

Modify `src/main.ts` to branch on URL flag:

```ts
const useSubstrate = new URLSearchParams(location.search).get('substrate') === 'v2';

if (useSubstrate) {
  // NEW substrate path
  const loader = new SubstrateLoader({
    sceneCanvas, gameMount, uniforms, manager, input, motion,
    audioBridge, eventDirector, biomeMgr,
  });
  await loader.boot(); // parses URL, loads universe/area/room, runs arrival
} else {
  // EXISTING ParallaxScene-direct path (unchanged — verbatim what main.ts does today)
  const parallax = new ParallaxScene(...);
  // ...all current code below this line stays exactly as-is
}
```

Key rule: the legacy branch is untouched verbatim. Zero behavioral risk on `/play/` unless query flag is set.

### 6.2 Phase B: substrate uses ParallaxScene as a driver

`DefaultBackground.ts` is a thin wrapper:

```ts
// pseudo
export class DefaultBackground implements BackgroundHandle {
  private parallax: ParallaxScene;
  private biome: Biome | null;
  constructor(ctx: SubstrateCtx, room: RoomManifest) {
    this.parallax = new ParallaxScene(ctx.sceneCanvas, hooks);
    if (room.biomeKey) this.biome = BIOMES[room.biomeKey];
    else this.biome = synthBiomeFromManifestAssets(ctx.universe, room);
  }
  async enter() { await this.parallax.loadBiome(this.biome); }
  update(dt, u) { this.parallax.update(u, ctx.motion); }
  dispose() { this.parallax.destroy(); }
}
```

This means **the substrate uses identical rendering to today's `/play/`** — same parallax-spec loader, same post-FX, same decoration system. The substrate just drives it via the contract instead of via hardcoded `main.ts` code.

### 6.3 Phase C: cutover (uat-deploy-keeper, end of Wave 21)

When all UAT passes:
1. Delete the legacy branch in `main.ts` (the `else` body above).
2. Substrate becomes default; `?substrate=v2` flag becomes a no-op (kept for one release as alias).
3. The `BIOMES` registry stays — it's the data source for `room.biomeKey` lookups. Not deleted.
4. `BiomeManager` stays — it's the engine for `BiomeBlendTransition`.
5. `ParallaxScene` stays — it's the wrapped class inside `DefaultBackground`.

What gets deleted at cutover:
- `main.ts` lines hardcoding `new ParallaxScene(...)` directly + `await parallax.loadBiome(BIOMES['slow-bloom'])` (now substrate-driven).
- The `loadTrampolineSpotsForBiome()` inline function (moves into `DefaultBackground`).
- The boot-time direct `new BiomeManager(...)` (now owned by `UniverseHost`).

What gets short-term-duplicated (acceptable during phase A→B):
- The CosmoStage + CosmoAgent + CosmoAI initialization — the substrate path constructs them via `UniverseHost`; the legacy path constructs them inline. Both share the same classes; only the construction site differs.

---

## 7 · Default behaviors (CRITICAL for hybrid-contract floor)

The locked-decisions promise: **a JSON-only Universe ships a working experience**. Here's exactly what each default driver does.

### 7.1 Default `background`

`DefaultBackground` reads `manifest.assets[]` and looks for either:
- A `room.biomeKey` field → routes through the existing `BIOMES` registry + composition-spec pipeline. Best path; matches forest's current rendering quality bar.
- Else: synthesizes a minimum-viable biome from the manifest:
  - `ambient` = first asset's average color (sampled at preload), or `#F5EDD8` (mushroom-cream) fallback.
  - `compositionSpecUrl` = `assets/backgrounds/${room.id}/composition-spec.json` if present, else fallback to single 4K plane via `manifest.assets[0]`.
  - Decoration spots = empty.

**Minimum viable JSON for a working background**: one image asset declared in `manifest.assets[]` with `preload: true`. The `DefaultBackground` paints it as a single plane at z=-10, lerped against `ambient` for the bloom pass. That's the floor — but quality bar prefers a `composition-spec.json` with 5–7 layers.

### 7.2 Default `arrival`

```ts
{ kind: 'portal', duration: 1.4, hue: hueFromPreset(manifest.post.preset) }
```

`hueFromPreset`: `"calm-baseline"` → 0.62 (faded-rose-tinted nebula), `"deep-trip"` → 0.48 (saffron-tinted), `"neutral"` → 0.55. `NebulaPortal` already paints in the locked palette, so brand-fit is automatic.

### 7.3 Default `inhabitants`

Empty array. A Room can be empty of small lives — that's fine. The brand-lock doesn't require living things in every room; it requires that anything present feels alive (post-FX breathing, parallax drift, spore motes from the layer-stack).

### 7.4 Default `interactables`

Empty array. NORTH-STAR §3 says every room should have a delight-loop, but that's a quality bar for hand-authored Rooms, not a hard requirement enforced at the substrate level. A JSON-only Universe with no interactables is valid; reviewers will engage on the brand-fit during PR.

### 7.5 Default `transitions`

- `roomToRoom`: `BiomeBlendTransition` with 2.0s duration, mood-curves resolved from from/to rooms.
- `areaToArea`: `GradientCutTransition` with 0.9s duration, primary-color lerp.
- `universeToUniverse`: `PortalTransition` with 1.6s open + 0.3s hold + 0.6s close.

### 7.6 Default `audio`

Silence. If `manifest.assets[]` declares any `audio` entry with `preload: true`, the default audio driver loads it as a looped ambient bed at 0.45 volume. No SFX defaults — that's authored.

### 7.7 The "more than wallpaper" floor

A JSON-only Universe with one composition-spec.json + three rooms gets:
- Breathing parallax (decorations + post-FX baseline).
- Portal arrival (hue from preset).
- Cosmo can walk around (CosmoAgent persists across rooms).
- Biome-blend Room-to-Room transitions (calm).
- Portal Universe-to-Universe transition.

Confidently more than a wallpaper. The trampoline + inhabitants + custom audio are pulled-up via `behavior.ts` exports, but the floor is genuinely playable.

---

## 8 · Open questions (with architect recommendations)

### 8.1 Where does `NebulaPortal` live post-substrate?

Currently in `src/phaser/entities/`. The substrate needs it during Universe-to-Universe transitions, which can fire before the Phaser scene is fully ready (mid-load swap).

- **Option A** (status quo): keep in Phaser, substrate adapts via `phaserGame.scene.getScene('CosmoScene')` lookup. Cheapest. Risk: Phaser-scene-not-ready edge cases during boot transitions.
- **Option B**: lift to `src/three/NebulaPortal3D.ts`, port the Graphics calls to `THREE.Mesh + canvas-texture`. Pure substrate ownership. Cost: ~1 day port + visual UAT.
- **Option C**: dual-instance — keep Phaser one for onboarding, build a 3D one for substrate transitions. Both paint the same palette. Cost: maintenance burden but lowest risk.

**Recommendation**: A for Wave 21 (ship it), revisit in Wave 22 if a non-forest Universe surfaces a real edge case.

### 8.2 How does the substrate signal Cosmo's "between rooms" state to `CosmoAI`?

CosmoAI has 6 idle states (idle/roam/curious/sit/look-around/sniff) + sleep. During a Room-to-Room transition, what state is Cosmo in?

- **Option A**: pause `CosmoAI` for the transition duration. Cosmo stands still through the crossfade. Simplest.
- **Option B**: introduce a new `'traveling'` state. CosmoAI plays a walk-cycle along the path. Matches NORTH-STAR §3's "the path itself is its own experience" but conflates Area-to-Area path-experience (where Cosmo IS the traveller) with Room-to-Room (where the world is shifting around him).
- **Option C**: scale-aware — Room-to-Room pauses AI (option A), Area-to-Area runs the traveling state (option B). Best honors NORTH-STAR's tier semantics.

**Recommendation**: C, but A as Wave-21 ship-state if the traveling-state animation isn't ready.

### 8.3 Should `behavior.ts` see Phaser-scope at all?

The current `weirdoObstacleFactory.ts` and `TrampolineSpots` live in Phaser-space (despite TrampolineSpots actually attaching to `cosmoStage.scene`, which is THREE-space). For external authors, exposing Phaser feels like a leaky abstraction.

- **Option A**: substrate context exposes only THREE primitives (`scene`, `camera`, `globalUniforms`). Phaser is hidden. Authors reach Phaser only for HUD via a separate (later) HUD contract. **Cleanest external story.**
- **Option B**: expose `phaserGame` in the context for power-users.
- **Option C**: A by default, with an explicit `behavior.hud?: (phaserScene) => HudHandle` opt-in for authors who need overlay UI.

**Recommendation**: A for Wave 21 (HUD is internal to the substrate's CosmoScene). Revisit if Wave 22+ authors hit a real wall.

### 8.4 Asset preloading scope

Does `manifest.assets[]` preload run at Universe-load (eager, early) or Room-enter (lazy, just-in-time)?

- **Option A**: eager preload at Universe-load. All `preload: true` assets resolved before arrival completes.
- **Option B**: lazy per-Room — manifest declares which assets each room needs, preload runs on Room-enter.
- **Option C**: hybrid — `manifest.assets[]` is universe-shared (eager), `room.assets[]` (new field) is per-room (lazy with high-priority hint during transition's first half).

**Recommendation**: A for Wave 21 (forest is small; total assets ~15MB). C for Wave 22+ if Universe asset growth makes initial load >5s.

### 8.5 Schema validation: how strict at boot?

- **Option A**: strict — any schema violation hard-fails universe-load → fallback to forest with detailed console error.
- **Option B**: lenient — schema violations log warnings, substrate fills sensible defaults, universe still boots.
- **Option C**: dev=lenient, prod=strict. Good DX in `npm run dev`, hard contract on shipped builds.

**Recommendation**: C. Maps to existing project conventions (`import.meta.env.DEV`).

---

## Critical Files for Implementation

- /Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/src/main.ts
- /Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/src/three/parallaxScene.ts
- /Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/src/three/biomeManager.ts
- /Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/src/three/cosmoStage.ts
- /Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/src/phaser/entities/NebulaPortal.ts

---

*Word count ~3,800. Phase 2 agents (authoring-doc-writer + reference-forest-builder) are unblocked.*
