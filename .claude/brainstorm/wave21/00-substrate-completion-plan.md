# Wave 21 — Substrate completion + Cosmo finalization

**Status**: planning, locked decisions, agent-pack briefing
**Authored**: 2026-05-04
**Pivot ledger entry**: NORTH-STAR.md §6 (2026-05-04)

> Read `NORTH-STAR.md` first. This plan implements §3 (Universe→Area→Room) and §3b (open-universes substrate) into running infrastructure. Read `UNIVERSE-AUTHORING.md` to see the contract that exists today (which omits Area — that gap is what this wave closes).

## 1 · The vision-check finding

NORTH-STAR §3 has always declared `ROOM → AREA → UNIVERSE`. The shipped `UNIVERSE-AUTHORING.md` contract goes Universe→Room directly — Area is missing. The forest universe folder is a skeleton: `manifest.json` and `rooms.json` exist; `background.ts`, `arrival.ts`, `inhabitants.ts`, `interactables.ts`, `transitions.ts` are documented but not implemented. The substrate runtime in `src/main.ts` does not load Universes by URL — it hardcodes `ParallaxScene`. Cosmo's eye-region smear from the v1.5.2-era is acknowledged in `next_session.md` and his procedural anim director is not yet built.

**This wave closes all of it in one coordinated push.**

## 2 · Locked decisions (authority for agents)

These are decided. Agents do not re-litigate; they implement.

### 2.1 Hierarchy
**`Universe → Area → Room`** is the canonical authoring direction (top-down). The runtime nesting reads bottom-up (`Room is inside Area is inside Universe`). Both phrasings are valid; the substrate-contract uses top-down because that's how authors think when they design.

### 2.2 Area layer (the missing tier — added now)

Every Universe MUST declare at least one Area. Single-Area universes are valid (the forest is currently single-Area). Each Area has:

- `id` (slug)
- `displayName` (any language) + `displayNameEn` (~100 chars)
- `description` (1–3 sentences, mood + what makes it distinct)
- `moodOverrides` (palette tweaks layered over the universe defaults — optional; null means inherit)
- `pathExperience` (how the path *between* this Area and adjacent Areas feels — its own thing, not a loading screen, per NORTH-STAR §3)
- `rooms[]` — the Room ids that belong to this Area (Rooms still live in `rooms.json` at the universe level for flat-lookup; `areas.json` declares the grouping)

**Manifest split rationale**: Rooms remain at the universe level (`rooms.json`) because the substrate often needs a flat lookup (`getRoom(id)`) without traversing area-membership. `areas.json` is the *grouping + path-experience* layer.

### 2.3 Hybrid authoring contract (declarative spine + optional behavior.ts)

A Universe ships **mandatory JSON** + **optional TypeScript**:

- **JSON spine (mandatory)**: `manifest.json`, `areas.json`, `rooms.json`. A Claude-Code paste-in author or any contributor without TS chops can ship a working Universe with **only JSON** — the substrate provides default behaviors (composition-spec parallax, fade arrival, default room-blend transitions).
- **`behavior.ts` (optional)**: a single TS module that exports any of `{ background, arrival, inhabitants, interactables, transitions }`. Each export is independently optional. Authors override only what they want richer than the defaults. The substrate auto-detects which exports exist.

This pattern matches Astro content-collections (declarative content + optional dynamic loaders) and Phaser scene-specs (data-driven entities + optional `create()` hook). Verplicht-makkelijk, optioneel-krachtig.

### 2.4 Layered transitions (calm baseline preserved)

| From → To | Transition | Duration | Reason |
|---|---|---|---|
| Room ↔ Room (within Area) | **biome-blend** | 1.5–3s | continuous, ambient, "world breathes" |
| Area ↔ Area (within Universe) | **gradient-cut** | 0.6–1.2s | brief mood-shift, deliberate but light |
| Universe ↔ Universe | **portal** | 1.4–2.5s | ceremonial, event-tier, matches nebula-portal precedent |

If *every* transition were a portal, the world shakes. If *none* were portals, the substrate flattens. Layered tiers preserve §3's "calm baseline + event-driven peaks" at the spatial-traversal level too.

Authors can override per-tier via `behavior.ts::transitions`, but the defaults match this table.

### 2.5 Cosmo finalization scope (full visual + procedural anim)

**Visual finish**:
- Regenerate all 6 CosmoV2 decals (eyes-l, eyes-r, mouth-neutral, body-skin, disc-suction, antenna-flower) at final Hayao×Moebius watercolor quality, using `rtcosmo` LoRA trigger. Resolve eye-region smear that's been accepted as "weirdo charm" since v1.5.2.
- Spot-check antenna and disc-arms proportions per Cosmo v2.0.1 tune (away-from-green-pill).
- Decals delivered as 4096² RGBA PNG with BiRefNet alpha (no white halos).

**Procedural CosmoAnimDirector** (new module `src/three/cosmoAnimDirector.ts`):
- `idle-breath`: subtle scale-y pulse on root, 0.4 Hz, ±2%
- `blink`: decal-y-scale collapse, every 4–7s random
- `head-track`: head quaternion lerps to face Cosmo's current focus point (mouse for desktop, gyro for mobile, idle-AI for autonomous)
- `antenna-bob`: spring-driven secondary motion on antenna bone, lags head movement by 80ms
- `walk`: leg-disc oscillation when MotionController velocity > threshold
- `jump-arc`: 3-phase (anticipation 0.15s → launch 0.4s → settle 0.25s) per legacy spec
- `climb`: root.rotation.z = π/2 with disc-walk oscillation perpendicular to gravity

All driven by deltaTime, stateless where possible, composable (multiple animations stack).

### 2.6 Rollout: feature-flag during build, hard-cutover at wave-close

`?substrate=v2` activates the new room/area/universe runtime; absent flag = current ParallaxScene path. Both ship in the same bundle. When reference-forest + Cosmo-finish + authoring-docs all pass UAT, hard-cutover: remove the flag, delete the old code path, ship.

**Why feature-flag this time** (vs Cosmo v2 hard-cutover): substrate is **invasive** (URL-loader, room-graph, transitions). Derden need to test their Universes against `?substrate=v2` *before* it's the default. Cosmo v2 was internal — this is an external contract.

## 3 · Agent breakdown (sequenced, not all parallel)

Truly parallel-from-start (independent): **architect** + **cosmo-finisher**.
Phase 2 (depend on architect): **authoring-doc-writer** + **reference-forest-builder**.
Phase 3 (depend on phase 2): **runtime-wirer**.
Phase 4 (depend on all): **uat-deploy-keeper**.

### 3.1 substrate-architect (Plan agent, runs now)

**Briefing** (prompt-summary):
- Read `NORTH-STAR.md` §3 + §3b, `UNIVERSE-AUTHORING.md`, `universes/forest/{manifest,rooms}.json`, `src/main.ts`, `src/three/parallaxScene.ts`, `src/three/cosmoStage.ts`, `src/core/biomeManager.ts` (already implements crossfading → reusable for biome-blend).
- Output: `.claude/brainstorm/wave21/01-substrate-architecture.md`. Sections required:
  1. **JSON contracts** — full schemas for `manifest.json` (extended), `areas.json` (new), `rooms.json` (extended with area-membership lookup), `behavior.ts` interface (TypeScript signature for each optional export).
  2. **URL grammar** — `?universe=<u>`, `?universe=<u>&area=<a>`, `?universe=<u>&area=<a>&room=<r>`. Defaults at each level. Invalid-id fallback policy.
  3. **Runtime architecture** — module diagram for SubstrateLoader → UniverseHost → AreaHost → RoomHost → BackgroundDriver / TransitionDriver / InhabitantsDriver / InteractablesDriver / AudioDriver. Lifecycle (load, enter, tick, exit, dispose). State-handoff between Cosmo + new Room.
  4. **Transition driver** — per-tier implementations (biome-blend reuses BiomeManager crossfade machinery; gradient-cut is a single-pass shader on globalUniforms; portal reuses NebulaPortal class from onboarding). API surface authors override.
  5. **Folder layout** — `universes/<name>/` final shape, `src/substrate/` runtime layout.
  6. **Migration plan** — how `src/main.ts`'s current ParallaxScene path becomes the default-background-driver under the substrate, behind `?substrate=v2`.
  7. **Open questions** (max 5, structured-options format) — anything genuinely unsettled. Don't invent open Qs to defer decisions.
- Reference: locked decisions §2 above are AUTHORITY; do not re-litigate Area-layer or hybrid-contract.

### 3.2 cosmo-finisher (Asset Generator → 3D Animation Director, runs now)

**Briefing** (prompt-summary):
- Phase A — visual decals (Asset Generator memory `.claude/agents/memory/asset-generator.md` + `.claude/agents/memory/shared.md` first):
  - Regenerate 6 decals using fal.ai Flux LoRA (RTcosmo trigger word, LoRA URL stored in `cosmo_lora_v16a.md` memory). Decals: eyes-l, eyes-r, mouth-neutral, body-skin, disc-suction (×4 on hand+foot tips, may be one shared decal), antenna-flower.
  - Quality bar: 10/10 DNA criteria (ref Sprint 16A LoRA-hero), no green-pill drift (ref v2.0.1 proportion-tune), no eye-region smear.
  - Each decal: 4096² RGBA PNG, BiRefNet alpha, regen 3–5x if needed.
  - Output to `public/assets/cosmo/decals/v2-final/`. Update `src/three/cosmoV2.ts` to load these.
  - Cost budget: ~$8–15 (3–5 regens × 6 decals × ~$0.30–0.80 per Flux Pro w/ LoRA).
- Phase B — CosmoAnimDirector (new file `src/three/cosmoAnimDirector.ts`):
  - Implement all 7 animations per §2.5 above. Composable, deltaTime-driven, stateless.
  - Wire into `src/three/cosmoStage.ts` (replace any ad-hoc anim code with CosmoAnimDirector calls).
  - Test on desktop (mouse-track) + mobile (gyro-track) + idle (no input → companion-AI focus point).
  - Output: code committed, plus `.claude/brainstorm/wave21/02-cosmo-finalization.md` with: which decals were regen'd, which prompts/seeds worked, anim director API, integration notes.
- Reference: NORTH-STAR §3 brand-lock (no green-pill, no kawaii, watercolor only). Sprint 16A learnings (`cosmo_lora_v16a.md`). Cosmo v2.0.1 proportion-tune.

### 3.3 authoring-doc-writer (Phase 2 — blocked by architect)

**Briefing** (prompt-summary):
- Reads architect output + locked decisions §2.
- Rewrites `UNIVERSE-AUTHORING.md` for the new hybrid contract + Area layer. Keeps the README-quickstart pattern.
- Writes new `AREA-AUTHORING.md` — how to design an Area (mood-overrides, path-experience between Areas, when to split a Universe into multiple Areas vs keep one).
- Writes new `ROOM-AUTHORING.md` — how to design a Room (Sims-like density, the trampoline-analog principle, interactables, inhabitants).
- All three docs include a **paste-in-Claude-Code quickstart**: a single block a contributor can paste into Claude Code that creates the scaffold for their tier (universe / area / room).
- Brand fit + `brandDeviation` field documentation reused.
- Output: 3 markdown files in repo root, plus a quickstart-snippet appendix in each.

### 3.4 reference-forest-builder (Phase 2 — blocked by architect)

**Briefing** (prompt-summary):
- Reads architect output + locked decisions §2.
- Implements the canonical reference forest:
  - `universes/forest/areas.json` (new) — declares 1 Area "the-mushroom-stand" containing all 3 existing Rooms, with mood-overrides null (inherit), path-experience defined for inter-Room paths.
  - `universes/forest/behavior.ts` — exports `background` (extracts ParallaxScene logic from `src/three/parallaxScene.ts`), `arrival` (uses NebulaPortal — duration 1.4s, hue 0.62 per current onboarding), `inhabitants` (eyeball-sentry + mouth-pillar + breathing-portal + floating-star, ports from `weirdoObstacleFactory.ts`), `interactables` (the trampoline — primary delight loop per NORTH-STAR §3), `transitions` (uses biome-blend default + a custom mushroom-path Room-Room transition for character).
  - Updates `universes/forest/manifest.json` to add `behavior.ts` reference + asset-list updates.
  - Updates `universes/forest/README.md` from skeleton-state to "this is the working reference, copy this for your own Universe".
- Quality bar: a contributor can `cp -r universes/forest universes/their-name`, edit the JSON, and have a working (if mood-shifted) Universe. The forest is the teaching example.
- Output: working forest universe, all four required artifacts + 3 optional artifacts implemented.

### 3.5 runtime-wirer (Phase 3 — blocked by phase 2)

**Briefing** (prompt-summary):
- Reads architect output + reference-forest output.
- Implements `src/substrate/` runtime modules per architect's design.
- Wires `src/main.ts` to detect `?substrate=v2` and branch to substrate path; default branch keeps existing ParallaxScene behavior.
- Implements URL grammar parsing (`universe`, `area`, `room` query params with sensible defaults).
- Implements TransitionDriver with three tier implementations.
- Hot-reload support: `universes/<name>/` file changes reload that universe in dev.
- Output: working substrate runtime, `?substrate=v2` boots into reference forest with rooms traversable.

### 3.6 uat-deploy-keeper (Phase 4 — blocked by all)

**Briefing** (prompt-summary):
- Real UAT per NORTH-STAR §7 / CLAUDE.md: bundle-content grep for new code-markers, all changed pages reachable via curl, HUD-pill version match, CF-cache headers correct.
- Test matrix: `/play/` (current), `/play/?substrate=v2`, `/play/?substrate=v2&universe=forest&area=the-mushroom-stand&room=clearing`, invalid-universe fallback to forest, invalid-area fallback to first-area, invalid-room fallback to entry-room.
- Cosmo visual check on all states. CosmoAnimDirector behaviors all firing.
- When all green: hard-cutover (remove `?substrate=v2` flag, substrate becomes default, delete old ParallaxScene-direct path).
- Bump VERSION to 2.2.0 (substrate landing). CHANGELOG entry. HUD-pill update. `next_session.md` update.
- Cloudflare cache purge (purge_everything for substrate-landing — invasive change).
- Memory: update `INDEX.md`, write topical memory files for substrate-architecture + cosmo-anim-director.

## 4 · Risk register

| Risk | Mitigation |
|---|---|
| Architect designs a contract authoring-doc-writer can't make Claude-Code-paste-in-friendly | Authoring-doc-writer has explicit veto on architect via review-pass before phase 2 starts |
| Cosmo decal regens drift back to green-pill / kawaii | LoRA-locked + 3–5 regens + brand-lock memory injected into Asset Generator briefing + manual veto pass |
| `behavior.ts` escape hatch becomes the *required* path because defaults are weak | Architect MUST design defaults strong enough that JSON-only universes ship a real (if minimal) experience. Quality bar: a JSON-only universe must be more than a wallpaper — at least default arrival, default inhabitants-empty, default room-blend. |
| Substrate v2 ships broken on mobile (current weak spot) | Mobile UAT in phase 4 is BLOCKING for cutover, not nice-to-have |
| Wave creep: Wave 22 work leaks into Wave 21 | Hard scope: ONE non-forest Universe is Wave 22. Wave 21 only ships forest + substrate. Trampoline mechanic IS in Wave 21 (it's an interactable in the reference). |

## 5 · Memory + git pre-flight

- `next_session.md` is currently outdated (says Wave 20 kickoff). It will be rewritten at end-of-wave by uat-deploy-keeper.
- `INDEX.md` "Snel-context" is at v2.0.0; will be re-summarized at end-of-wave.
- Git state: `main` clean, in sync with origin. New work can branch off main directly per project convention.
- Brainstorm dir `wave20/01-cosmo-v2-architecture.md` remains as historical record; wave21 references it but doesn't supersede it (Cosmo v2 still stands; we're finishing it, not replacing it).

## 6 · Out of scope (explicit)

- Wave 22 — first non-forest Universe (proves the substrate from outside)
- Realtime P2P co-presence (NORTH-STAR §3b explicitly defers)
- Universe marketplace / TOS / moderation (NORTH-STAR §3b: not what we are)
- Audio finalization (separate wave when Suno integration matures)
- Mobile-specific optimization sweep (separate wave)

---

*"Adem mee. Hij blijft niet stil." — and now the world he lives in is finally pluggable.*
