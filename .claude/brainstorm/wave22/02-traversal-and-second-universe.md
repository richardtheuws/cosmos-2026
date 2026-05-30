# Wave 22 — Room traversal + the second Universe

> Read `NORTH-STAR.md` first. This doc honors §3 (ROOM→AREA→UNIVERSE), §3b
> (open substrate, portable Cosmo), §4 (brave reconsideration), and the
> 2026-05-30 Pivot Ledger entry (hard cutover + a real second Universe).
> **Visual language is LOCKED** — every option below stays inside
> Hayao×Moebius watercolor + the cosmic-luminous palette. No mood-pivots.

---

## A) Wire one real room-to-room traversal (D2)

### Current state (verified in code)
`SubstrateLoader.boot()` calls `host.enterAreaRoom(area, room)` **once** at boot
(`SubstrateLoader.ts:142`) and never again. `rooms.json` declares
`clearing → deep-grove` (via `left-mushroom-path`, distance 12) and
`clearing → the-hollow`, but nothing reads `room.exits`. `MushroomPathTransition`
exists in `behavior.ts` and is fully wired through
`UniverseBehavior.transitions.roomToRoom`, yet no caller invokes it. Rooms are a
static diorama. The trampoline already proves the right interaction shape:
`InteractionManager.handleTap` raycasts `TrampolineSpots`, then calls
`agent.walkTo(x, z, 'bounce')` — tap → walk-to → action-on-arrival.

### Mechanic: a walk-to path affordance (mirror the trampoline, don't invent)
Reuse the existing tap→walkTo→arrival loop verbatim. The path **is** the content
(§3) because Cosmo physically walks the edge before the transition paints.

1. **Path affordance object.** Add a `PathSpots`-style billboard (one per
   `room.exits[]` entry) — a watercolor mushroom-path marker placed at the room
   edge in the exit's direction (derive a world anchor from the exit `distance`
   and a fixed left/right/down convention: `left-mushroom-path` → `x = -panRangeX*scale`,
   `down-burrow` → `y` drop). Render it exactly like `TrampolineSpots` (textured
   plane + hover-bob) so it composes visually. The painted asset is a
   nectar-lit path-mouth, not a UI arrow.
2. **Tap → walk-to-edge.** Extend `InteractionManager.handleTap` to also raycast
   the path-spots. On hit: `agent.walkTo(edge.x, edge.z, 'traverse')`. This needs
   a new `'traverse'` action on `CosmoAgent.walkTo` (today only `'bounce'|'idle'`,
   `CosmoAgent.ts:490`) whose arrival callback fires a host-level
   `requestTraversal(exit.to)` rather than a bounce.
3. **Arrival fires the transition + enterAreaRoom.** `requestTraversal` lives on
   the SubstrateLoader (it owns the host). It:
   - looks up `toRoom` and the `from→to` mood pair,
   - constructs the driver via `behavior.transitions.roomToRoom(ctx, from, to)`
     (forest → `MushroomPathTransition`; default → `BiomeBlendTransition`),
   - `await driver.run(dt)` **while** also calling
     `biomeMgr.startMoodCrossfade` so the world actually re-tints during the walk
     (today `MushroomPathTransition` is a 2.0s no-op timer — see §below),
   - then `host.enterAreaRoom(area, toRoom.id)`, re-applies `cameraBounds`,
     repositions `cosmoAgent.root` to the *new* room anchor (entering from the
     reciprocal edge, not the center, so it reads as continuous),
   - `appendTraversal(state, …)` + `saveState` + `syncURL` so the URL self-heals
     to `?...&room=deep-grove` and reload resumes there.
4. **Same-area = no portal.** `clearing→deep-grove` share `the-mushroom-stand`,
   so `enterAreaRoom` keeps the AreaHost and only swaps RoomHost — correct per
   the layered-transition rule (Room↔Room = biome-blend, never a portal).

### Make the path feel like content, not a loading screen
`MushroomPathTransition.run()` is currently a bare `requestAnimationFrame` timer
(`behavior.ts:459`) — visually identical to a freeze. Two concrete fixes (both
small, both inside locked palette):
- **Drive the crossfade for real**: pass `biomeMgr` into the transition (via
  `TransitionCtx` — add a `biomeMgr` field, it's already in `SubstrateBootCtx`)
  and call `startMoodCrossfade(fromCurve, toCurve, 2.0)` so the canopy re-tints
  as Cosmo walks. This un-stubs the documented `TODO(wave22)` in both
  `BiomeBlendTransition.ts:31` and `behavior.ts:465`.
- **Spore-mote drift overlay** (the deferred punch-list #9): a single fullscreen
  additive quad of drifting `#F5EDD8` motes at hip height, alpha-ramped
  0→peak→0 over the 2.4s `pathExperience.duration`. Sits at `renderOrder 999`,
  behind Cosmo (same compositing slot as `GradientCutTransition`).

**FLAG — live visual UAT required**: the walk-out → mote-drift → re-tint →
walk-in sequence must be screenshot-verified (Playwright UAT per the Pivot
Ledger). Programmatic checks cannot see whether it reads as "a path" vs "a fade".

---

## B) The second Universe (proves the contract is generic)

Candidates drawn from §3 seeds. Scored 1–5 on **pluggability-proof /
buildability / vision-fit**.

| Candidate | Pluggability | Buildability | Vision-fit | Total |
|---|---|---|---|---|
| **Ink-Ocean Universe** (drifting Area below the forest) | 5 | 4 | 5 | **14** |
| Canopy / Sky-Room (Area *above* the forest) | 2 | 5 | 4 | 11 |
| Village Universe (small beings) | 4 | 2 | 4 | 10 |

- **Sky-Room** scores low on pluggability — it's an Area inside the *forest*
  Universe, so it proves Area-traversal, not cross-Universe travel. It does NOT
  exercise §3b. Good Wave 23 content; wrong proof for Wave 22.
- **Village** forces the contract hardest (inhabitants with their own AI) but the
  asset load (multiple coherent painted beings) is heavy and the 21.2.x
  inhabitant-coherence failures make it risky this wave.

### Top pick: **Ink-Ocean Universe** (`universes/ink-ocean/`)
A second *Universe* (not just Area) is the only thing that exercises the portal
transition + cross-universe StatePersistence — the literal "your Cosmo visits my
world." Ink-ocean stays in palette: `ink-aubergine` deep-water base,
`sky-wash` surface light, `saffron-glow` bioluminescent motes, one
`pop-cyan` accent (≤5%). Mood is genuinely different from the forest (cool,
buoyant, slow-drift) without any style shift — proves the substrate isn't
forest-hardcoded.

**Manifest shape** (copy `universes/forest/`, edit ids — the documented path):
- `manifest.json`: `name: "ink-ocean"`, `defaultArea: "the-drift"`,
  `post.preset: "calm-baseline"` with a cooler `intensityCurve` (higher `fluid`,
  lower `bloom`), `behaviorModule: true`, brand-locked assets.
- `areas.json`: one area `the-drift`, `pathExperience.kind: "drift"`
  (already a valid kind in `PathExperience`).
- `rooms.json`: `entryRoom: "the-shallows"`, plus `the-deep`; `the-shallows`
  declares an exit `via: "surface-portal"` that targets the **forest** (the
  cross-universe hop).
- `behavior.ts`: real `background` (un-no-op it — D4: own ParallaxScene biome via
  the shared instance now exposed in `SubstrateCtx`), `inhabitants` (one
  drifting jelly-being), `interactables` (the delight-loop analog: a current Cosmo
  rides up and down — the trampoline's cousin), `audio` (slow tonal bed).

**Cross-universe TRAVEL mechanic** (§3b async + content-portable):
- A **surface-portal** path-affordance in `the-shallows` (and a reciprocal
  forest-side portal in `deep-grove`, which already declares a `breathing-portal`
  inhabitant — repurpose it as the egress).
- Tap → `walkTo('traverse')` → arrival fires `requestUniverseTravel('ink-ocean')`.
- This uses the **PortalTransition** (ceremonial 2.5s nebula) — the correct scale
  per the layered rule (Universe↔Universe = portal).
- State travels via `StatePersistence`: `saveState` writes `lastUniverse/Area/Room`
  + appends traversal **before** the portal closes; the substrate tears down the
  forest host and `discoverUniverses()` (today hard-coded to `['forest']`,
  `SubstrateLoader.ts:184`) must add `ink-ocean`; SubstrateLoader re-boots the new
  universe with the *same injected Cosmo* (mood/inventory/history intact in
  localStorage). v1 is one-tab async — no realtime co-presence, matches §3b.
- **`discoverUniverses` upgrade**: switch to `import.meta.glob('/universes/*/manifest.json')`
  so adding a folder = adding a Universe (the contributor promise).

**Minimum to be a credible proof (not a stub)**:
1. Two real rooms, each with a painted background biome (not the forest's).
2. One working delight-loop interactable (the rising-current ride).
3. At least one inhabitant rendering correctly (single coherent painted being —
   learn from the 21.2.4 mouth-pillar retirement: ship ONE good asset, not four).
4. A working round-trip: forest → portal → ink-ocean → portal → forest, with
   Cosmo's traversalHistory showing all four triples on reload.

**FLAG — live visual UAT required** on: (a) ink-ocean background reads as
watercolor-in-palette, (b) the portal round-trip preserves Cosmo visually, (c)
the inhabitant is coherent (the recurring failure mode).

---

## Decision for Richard
The **final second-universe choice is yours.** I'm surfacing Ink-Ocean as the
top pick because it's the only candidate that forces *both* D4 (substrate owns
its background) and a real cross-Universe portal + StatePersistence round-trip —
the exact proof the open-substrate pitch demands — while staying fully inside the
locked palette. Sky-Room and Village remain valid for later waves.
