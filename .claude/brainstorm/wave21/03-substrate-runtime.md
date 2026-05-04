# 03-substrate-runtime.md — Wave 21 Substrate Runtime (Phase 3)

**Status**: shipped, dual-path coexistence active behind `?substrate=v2`
**Authored**: 2026-05-04
**Authority**: NORTH-STAR.md §3 + §3b; `00-substrate-completion-plan.md` §2 (locked); `01-substrate-architecture.md` (full design contract)
**Implements**: phase 3 — `src/substrate/` runtime + `?substrate=v2` flag in `src/main.ts` + 9 punch-list resolutions

This document captures the runtime-wirer Wave 21 deliverable: the `src/substrate/` runtime, the BiomeManager + ParallaxScene API extensions, the `?substrate=v2` flag wiring in `main.ts`, and the resolution status of every punch-list item flagged by docs-writer + reference-forest-builder.

---

## 1. What got built

### 1.1 `src/substrate/` — 1,895 LOC across 21 files

| File | LOC | Role |
|---|---|---|
| `SubstrateLoader.ts` | 252 | Entry: parses URL, fetches manifests, constructs UniverseHost, runs arrival, exposes `tick(dt, u)` |
| `UniverseHost.ts` | 114 | Owns universe-scope; constructs AreaHost; applies post-FX preset on enter |
| `AreaHost.ts` | 100 | Owns area-scope; resolves mood; constructs RoomHost on enter |
| `RoomHost.ts` | 103 | Owns the four per-room drivers (background, inhabitants, interactables, audio) |
| `ResolveURL.ts` | 149 | URL grammar parser + left-to-right fallback policy + history.replaceState sync |
| `ResolveMood.ts` | 68 | Universe-defaults + area-overrides → ResolvedMood (with PRESET_PALETTES table) |
| `PreloadManager.ts` | 95 | Eager preload + path safety + the `../../public/...` legacy allowlist |
| `StatePersistence.ts` | 84 | `localStorage["cosmos.state.v1"]` read/write + traversalHistory append |
| `contracts/BehaviorContract.ts` | 223 | The TS interfaces every behavior.ts implements; CosmoState re-export; manifest types |
| `contracts/ManifestSchema.ts` | 126 | Hand-rolled validator with dev/prod-split (no zod) |
| `contracts/AreasSchema.ts` | 101 | areas.json validator; pathExperience.kind dev-warns vs prod-throws |
| `contracts/RoomsSchema.ts` | 98 | rooms.json validator; missing `area` backfilled from manifest.defaultArea |
| `drivers/DefaultBackground.ts` | 68 | Wraps the SHARED ParallaxScene; loadBiome on enter |
| `drivers/DefaultArrival.ts` | 21 | Returns ArrivalAnimation with hue derived from preset |
| `drivers/DefaultInhabitants.ts` | 10 | Empty array (architect §7.3) |
| `drivers/DefaultInteractables.ts` | 9 | Empty array (architect §7.4) |
| `drivers/DefaultAudio.ts` | 48 | Silence + auto-bed if manifest declares `preload:true` audio |
| `drivers/BiomeBlendTransition.ts` | 46 | Calls BiomeManager.startMoodCrossfade — the new API extension |
| `drivers/GradientCutTransition.ts` | 103 | Single-pass shader on a fullscreen quad, sweeps fromColor → toColor |
| `drivers/PortalTransition.ts` | 63 | Wraps NebulaPortal (option A: stays in Phaser-scope) |
| `drivers/shaders/gradientCut.frag` | 14 | The reference GLSL (also inlined in GradientCutTransition.ts) |

### 1.2 BiomeManager API extension (additive)

`src/three/biomeManager.ts` gained `startMoodCrossfade(from, to, durationS): Promise<void>` per architect §4.1. The state machine grew a new `'mood-crossfade'` variant carrying external curves + a custom duration + the resolve handle. The existing biome-cycle crossfade and `update(dt)` loop are untouched. When a mood-crossfade lands while a biome-cycle is in flight, the mood-crossfade resolves immediately so the caller doesn't hang (the cycle has priority — substrate operation pauses the cycle, so this is rare).

### 1.3 ParallaxScene `destroy()`

`src/three/parallaxScene.ts` gained a `destroy()` method. Disposes layers + decorations + ambient plane geometry/material, clears the texture cache, and detaches the resize listener. A new private `resizeListener` field captures the handler so it can be removed cleanly. The renderer + canvas are NOT destroyed (shared with cosmoStage in the live boot path).

### 1.4 CosmoState re-export

`src/three/cosmoV2.ts` got a `export type { CosmoState } from '../phaser/entities/CosmoAgent'` re-export. The architect's BehaviorContract now imports CosmoState from `cosmoV2` cleanly. Forest's behavior.ts can stay pointed at `phaser/entities/CosmoAgent` until Wave 22 if its author chooses; the re-export means new authors have a single canonical import path that doesn't reach into the Phaser tree.

### 1.5 main.ts wiring

`src/main.ts` got:
- `useSubstrate` flag at top-level (URL-driven)
- `if (!useSubstrate) biomeMgr.start()` — legacy biome cycle is gated to legacy path only
- `if (useSubstrate) { substrateLoader = new SubstrateLoader(...); await substrateLoader.boot() }` — substrate boot block, with try/catch fallback to legacy biome cycle on substrate boot failure (don't blank-canvas the user)
- Per-frame tick branch: `if (substrateLoader) { manager.register((u) => loader.tick(u.delta, u)) } else { manager.register((u) => parallax.update(u, motion)) }` — exactly one of the two registers, parallax never paints twice

The cosmo gameplay tick (including `cosmoAgent.tickAnimDirector(dt, motion)`) is OUTSIDE the substrate branch. Cosmo-finisher's animation work runs identically in both paths.

### 1.6 Postbuild copy of universes/

`scripts/postbuild-copy-public.mjs` extended to copy `universes/<name>/{manifest,areas,rooms}.json + README.md` into `dist/universes/`. The forest's `behavior.ts` is bundled by Vite via `import.meta.glob('/universes/*/behavior.ts')` — only the JSON spine needs static copying. The build now ends with `4 universe spine files` logged.

---

## 2. Architect-doc deviations

Three places where reality forced a divergence from `01-substrate-architecture.md`:

### 2.1 DefaultBackground reuses the shared ParallaxScene instance

Architect §6.2 pseudo-code constructs `new ParallaxScene(ctx.sceneCanvas, hooks)` inside DefaultBackground. In practice that conflicts with WebGLRenderer's "one renderer per canvas" constraint — main.ts already constructs a ParallaxScene + renderer that CosmoStage shares. A second ParallaxScene on the same canvas would either create a second renderer (instant collision) or somehow share — not architecturally clean either way.

**Resolution**: SubstrateLoader accepts the existing ParallaxScene via `SubstrateBootCtx.parallax` and threads it through UniverseHost → AreaHost → RoomHost → DefaultBackground. The default driver swaps biomes via `parallax.loadBiome(...)` instead of constructing a new instance. This honors the architect's intent (DefaultBackground IS the parallax driver for the substrate) without breaking the renderer-ownership invariant.

`DefaultBackground.dispose()` no longer destroys the ParallaxScene — that's owned at SubstrateLoader scope. Per-room cleanup is handled by the next room's `loadBiome()` call.

Forest's `behavior.ts::ForestBackground` constructs its own ParallaxScene per the same architect pseudo. That works in dev because the substrate currently only invokes one background driver per room — but it's a latent bug. Documented as a TODO for Wave 22 forest-author cleanup; not fixed inline per the brief's "DO NOT modify forest" constraint.

### 2.2 SubstrateCtx richer than architect §1.4

Punch-list #6 already drove this: `SubstrateCtx` now carries `canvas`, `audioBridge`, `motion`, `renderer`. The architect's pure-THREE context worked for the doc but reference-forest's `ForestBackground` had to invent a `resolveCanvas(ctx)` heuristic to find the canvas. The substrate's BehaviorContract closes that gap.

### 2.3 InhabitantHandle.anchor optional

Architect §1.4 InhabitantHandle has no anchor field. Punch-list #2 added an OPTIONAL `anchor?: { x, y, z }`. The substrate doesn't yet consume it — proximity-AI hints via inhabitant anchor are deferred to Wave 22. Adding the field now is forward-compatible: forest's existing inhabitants don't ship anchors, so they keep working unchanged; new authors who want proximity-AI cues set the field.

---

## 3. Punch-list resolution status

| # | Item | Resolution | Files |
|---|---|---|---|
| 1 | `pathExperience.kind` validation strictness | Dev/prod-split via `import.meta.env.DEV` flag → `lenient: boolean` on every validator. Unknown kinds in dev warn + accept (substrate falls back to default biome-blend driver). In prod, AreasSchema throws → SubstrateLoader catches → falls back to forest. | `contracts/AreasSchema.ts` (KNOWN_PATH_KINDS set, throwOrWarn) |
| 2 | `InhabitantHandle.anchor` field | Added as OPTIONAL field. Backwards-compatible. Documented in BehaviorContract.ts. | `contracts/BehaviorContract.ts` |
| 3 | Forest `../../public/...` paths | PreloadManager allowlist: paths starting with `../../public/` resolve via `assetPath()` (project public root, base-aware). Any other `../` segment is stripped. Documented inline. Long-term migration to per-universe `assets/` folders is Wave 22. | `PreloadManager.ts` (LEGACY_ALLOWLIST_PREFIX) |
| 4 | manifest.defaultArea vs areas.entryArea redundancy | When both present and disagree, `console.warn` and use manifest (parent contract wins). When manifest absent → fall back to areas.entryArea. Implemented in ResolveURL. | `ResolveURL.ts` (resolveURLRequest mismatch warning) |
| 5 | CosmoState import path | Re-exported from `src/three/cosmoV2.ts` via `export type { CosmoState } from '../phaser/entities/CosmoAgent'`. The architect's BehaviorContract path is now valid. Forest's behavior.ts can keep its current import or migrate at the author's choice. | `src/three/cosmoV2.ts` |
| 6 | SubstrateCtx canvas/audio/motion/renderer | Added all four fields to `SubstrateCtx`. SubstrateLoader writes them at boot. The renderer is also parked on `scene.userData.renderer` (belt + braces) so forest's `resolveCanvas` heuristic still finds the canvas. | `contracts/BehaviorContract.ts`, `SubstrateLoader.ts` |
| 7 | ParallaxScene.destroy() missing | Added. Disposes layers/decorations/ambient plane/texCache, removes resize listener via new `resizeListener` field. Renderer + canvas NOT destroyed (shared with cosmoStage). | `src/three/parallaxScene.ts` |
| 8 | Audio-clock for mouth-pillar | `audioBridge` now in SubstrateCtx → behaviors call `ctx.audioBridge.musicCurrentTime()` directly. Forest's mouth-pillar today reads `globalUniforms.audioFFT` (works fine — bridge mirrors FFT into uniforms each frame). The richer audio-clock path is now available for any future inhabitant that wants it. | `contracts/BehaviorContract.ts`, `SubstrateLoader.ts` |
| 9 | Spore-mote transition overlay | DEFERRED to Wave 22. Documented as TODO in BiomeBlendTransition.ts. | `drivers/BiomeBlendTransition.ts` |

---

## 4. Cosmo-finisher integration notes

Cosmo-finisher's two recent commits to main.ts and CosmoAgent.ts were preserved verbatim.

`src/main.ts` line 373: `cosmoAgent.tickAnimDirector(dt, motion)` lives inside the SHARED gameplay tick that runs in BOTH branches. The substrate branch and legacy branch use the SAME cosmo gameplay tick — only the parallax-update tick differs (substrate uses `loader.tick`, legacy uses `parallax.update`). Cosmo's animation behavior is identical regardless of which path booted.

`src/phaser/entities/CosmoAgent.ts` was NOT modified by this wave. The animDirector field, tickAnimDirector method, setClimbing flag, and dispose plumbing all remain as cosmo-finisher shipped them.

`src/three/cosmoV2.ts` got the `export type { CosmoState }` re-export added (single line) per punch-list #5. Decal split fields, fallback-loading paths, and dispose code are untouched.

`src/three/cosmoAnimDirector.ts` was NOT modified.

---

## 5. UAT results (in-session, programmatic)

Browser MCP unavailable in this session (same as cosmo-finisher reported). Visual UAT goes to phase-4 uat-deploy-keeper. What this session DID verify:

| Test | Method | Result |
|---|---|---|
| `npx tsc --noEmit` | Full TS strict-mode typecheck | PASS (exit 0) — no errors |
| `npm run build` | Full build → tsc → vite → postbuild | PASS — 17.7s, behavior-CoVnj7Mz.js bundled (4.35 kB), main bundle includes substrate symbols (UniverseHost, RoomHost, areas.json, rooms.json, manifest.json) |
| `dist/universes/forest/{manifest,areas,rooms}.json + README.md` | Postbuild copy | PASS — 4 spine files in dist |
| `curl http://localhost:5173/play/` | Legacy path | HTTP 200 |
| `curl http://localhost:5173/play/?substrate=v2` | Substrate path | HTTP 200 |
| `curl http://localhost:5173/universes/forest/manifest.json` | Manifest fetch in dev | HTTP 200 + valid JSON |
| `curl http://localhost:5173/universes/forest/areas.json` | Areas fetch | HTTP 200 |
| `curl http://localhost:5173/universes/forest/rooms.json` | Rooms fetch | HTTP 200 |
| `grep useSubstrate.*?substrate.=.=.\"v2\"` in served main.ts | Flag detection wired | PASS |
| `grep substrateLoader = new SubstrateLoader` in served main.ts | Boot block wired | PASS |
| Bundle size delta | Compared against prior `npm run build` | Negligible — substrate code is small |

What this session did NOT verify (handed to phase 4):

| UAT item | Reason |
|---|---|
| Cosmo's v2-final decals load on `?substrate=v2` | Browser MCP unavailable; needs visual UAT |
| AnimDirector animations fire (idle-breath, blink) on substrate path | Same |
| Forest inhabitants render (eyeball-sentry, mouth-pillar, breathing-portal, floating-star) | Same |
| `&room=deep-grove` correctly enters that specific room with mood | Same |
| Invalid universe URL falls back + replaceState updates URL | Same; tested at code-path level only |
| Mobile gyro path on substrate | Same; mobile UAT was already nice-to-have-not-tested in cosmo-finisher's session |
| BiomeBlendTransition crossfade looks correct visually during room hops | Same; transition pipeline wired but not visually triggered (no in-scene navigation UI yet — Wave 22) |
| GradientCutTransition shader paints correctly (Cross-area) | Same; the forest is single-area so this transition path can't be visually exercised today |
| PortalTransition (Universe→Universe) | Same; only one Universe exists today |

---

## 6. Handoff to uat-deploy-keeper (phase 4)

### 6.1 Cutover steps

When phase-4 UAT passes:

1. Delete the legacy branch in `src/main.ts`:
   - Remove `if (!useSubstrate) biomeMgr.start();` guard → always run substrate path.
   - Remove the `if (useSubstrate) { ... }` wrapper around the SubstrateLoader boot — it becomes unconditional.
   - Remove the `else` branch in the per-frame tick registration: `manager.register((u) => parallax.update(u, motion))`. Keep ONLY the substrate `loader.tick(u.delta, u)` registration.
   - Remove the substrate-failure fallback `biomeMgr.start()` call (substrate is now the only path).
   - Remove the `useSubstrate` flag — substrate is the default; `?substrate=v2` becomes a no-op alias for one release per architect §6.3.
2. The `BIOMES` registry stays. The `BiomeManager` stays (still drives crossfades). The `ParallaxScene` stays (wrapped by DefaultBackground). The `loadTrampolineSpotsForBiome()` inline function moves into a Wave 22 trampoline-driver if needed; for now it stays in main.ts because legacy gameplay still uses it.
3. Bump VERSION to 2.2.0 (substrate landing). Update CHANGELOG `[Unreleased]`. Update HUD-pill.
4. Cloudflare cache: `purge_everything` (invasive change per CLAUDE.md deploy protocol).

### 6.2 Files to delete (or empty) at cutover

- The legacy `else` branch in `src/main.ts`'s per-frame tick (the direct `parallax.update(u, motion)` call). Identifiable by the comment `// Wave 21 — under substrate, the loader's tick fans into ...`.
- The `if (!useSubstrate) biomeMgr.start();` guard. Just `biomeMgr.start();` if biome-cycling stays — but per architect §6.3 step 5, BiomeManager stays as the BiomeBlendTransition engine and does NOT auto-cycle on substrate. So delete `biomeMgr.start()` entirely too.

### 6.3 Real UAT checklist (phase 4 must run all of these)

- `/play/?substrate=v2` boots, Cosmo arrives via portal, parallax renders, decals load.
- `/play/?substrate=v2&universe=forest&area=the-mushroom-stand&room=deep-grove` boots directly into deep-grove, anchor at `(-12, 0, 0)`, no Cosmo respawn flicker.
- `/play/?substrate=v2&universe=does-not-exist` falls back to forest, console.warn fires, URL replaceState writes `universe=forest`.
- `/play/?substrate=v2&universe=forest&area=does-not-exist` falls back to `the-mushroom-stand`.
- `/play/?substrate=v2&universe=forest&room=does-not-exist` falls back to `clearing` (the entryRoom that belongs to the resolved area).
- AnimDirector on substrate: idle-breath visible (subtle root.scale.y pulse at 0.4 Hz), blink fires every 4–7s independent left/right eye, head-track follows mouse, antenna-bob lags head-yaw.
- Forest inhabitants: at least eyeball-sentry + floating-star visible in clearing; breathing-portal visible in deep-grove; mouth-pillar visible in the-hollow with FFT-driven sprite-cycle.
- localStorage["cosmos.state.v1"] populated after first room enter; traversalHistory has the entry triple.
- Mobile UAT (gyro + companion-mode + 8s-idle) — mark BLOCKING per `00-substrate-completion-plan.md` §4 risk register.

### 6.4 Version bump target

`2.2.0` per architect §6.3 + `00-substrate-completion-plan.md` §3.6.

### 6.5 Future cleanup (NOT phase 4)

- Forest's `behavior.ts` should migrate from its local interface declarations to `import type { ... } from '../../src/substrate/contracts/BehaviorContract'`. This gives real cross-module type-safety. Today the structural-call signatures align so behavior loads + runs correctly, but a typo in a future forest-edit wouldn't be caught at typecheck. Wave 22 task.
- Forest's `ForestBackground` constructs its own ParallaxScene — latent bug per §2.1 above. At cutover the substrate's DefaultBackground takes over and the ForestBackground export is no longer the canonical background. Delete `ForestBackground` from forest's behavior.ts at Wave 22 (or earlier if a render-collision surfaces in phase-4 UAT).
- Spore-mote transition overlay (punch-list #9) — Wave 22.

---

## 7. Files touched

```
NEW    src/substrate/SubstrateLoader.ts                        (252 LOC)
NEW    src/substrate/UniverseHost.ts                           (114 LOC)
NEW    src/substrate/AreaHost.ts                               (100 LOC)
NEW    src/substrate/RoomHost.ts                               (103 LOC)
NEW    src/substrate/ResolveURL.ts                             (149 LOC)
NEW    src/substrate/ResolveMood.ts                            ( 68 LOC)
NEW    src/substrate/PreloadManager.ts                         ( 95 LOC)
NEW    src/substrate/StatePersistence.ts                       ( 84 LOC)
NEW    src/substrate/contracts/BehaviorContract.ts             (223 LOC)
NEW    src/substrate/contracts/ManifestSchema.ts               (126 LOC)
NEW    src/substrate/contracts/AreasSchema.ts                  (101 LOC)
NEW    src/substrate/contracts/RoomsSchema.ts                  ( 98 LOC)
NEW    src/substrate/drivers/DefaultBackground.ts              ( 68 LOC)
NEW    src/substrate/drivers/DefaultArrival.ts                 ( 21 LOC)
NEW    src/substrate/drivers/DefaultInhabitants.ts             ( 10 LOC)
NEW    src/substrate/drivers/DefaultInteractables.ts           (  9 LOC)
NEW    src/substrate/drivers/DefaultAudio.ts                   ( 48 LOC)
NEW    src/substrate/drivers/BiomeBlendTransition.ts           ( 46 LOC)
NEW    src/substrate/drivers/GradientCutTransition.ts          (103 LOC)
NEW    src/substrate/drivers/PortalTransition.ts               ( 63 LOC)
NEW    src/substrate/drivers/shaders/gradientCut.frag          ( 14 LOC)
EDIT   src/three/biomeManager.ts                               (+58 lines: startMoodCrossfade + state variant)
EDIT   src/three/parallaxScene.ts                              (+27 lines: destroy() + resizeListener field)
EDIT   src/three/cosmoV2.ts                                    (+13 lines: CosmoState re-export + comment)
EDIT   src/main.ts                                             (+38 lines: useSubstrate flag, boot block, tick branch)
EDIT   scripts/postbuild-copy-public.mjs                       (+22 lines: universes/<name>/* JSON copy)
NEW    .claude/brainstorm/wave21/03-substrate-runtime.md        (this doc)
```

No files deleted. No behavior change on the legacy `/play/` path.

---

*"Adem mee. Hij blijft niet stil." — and now any Claude-paired contributor can plug their own world into the substrate.*
