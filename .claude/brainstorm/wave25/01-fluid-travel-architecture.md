# Wave 25 — Fluid Travel (the missing orchestrator)

> Read NORTH-STAR.md first. This wave makes the dweller's journey BETWEEN worlds
> feel like travel/arrival — "the world breathes, doesn't shake" — instead of a
> page reload. P2 of the post-v2.4.10 priorities.

## The finding (from 4 parallel code explorations, 2026-06-07)

The substrate is ~90% built for fluid in-app travel, but **the orchestration
layer that drives it is entirely missing**, and universe switches currently
reload the page so none of it ever fires.

- **Persistence is solved.** Cosmo (stage/agent/AI) + the shared ParallaxScene
  are constructed once in `main.ts` and survive every room/area/universe swap.
  No blink. Room→room is already in-app (AreaHost.enterRoom, no reload).
- **The drivers are authored but DEAD.** `TransitionDriver.run()` is never
  called anywhere; `behavior.arrival()` is never invoked. PortalTransition,
  GradientCutTransition, BiomeBlendTransition + per-universe HushBlend / Drift /
  MushroomPath / DuskMiragePortal all exist and mostly just resolve a timer.
- **Universe switch = full reload.** `WayMoteOverlay.ts:169`
  `window.location.search = …`. The S2 "portal both directions" is a documented
  stub.
- **Audio snaps hard.** `DefaultAudio.exit()` is a no-op; `setMusicTrack()` is a
  source-swap with no gain ramp. No crossfade. (Beds themselves now play
  correctly per universe — fixed v2.4.11.)
- **Cosmo rig has no travel channel.** `playClip()` is private; the substrate
  has no API to schedule a `slide`/travel clip, and tick-order (substrate tick
  before agent tick) would race it.

## The keystone: a SubstrateNavigator

One coherent piece, not ten patches. A travel-orchestrator that, on a
navigation intent (no reload):

1. **captures intent** — replace `location.search=` with a `cosmos-navigate`
   event + `popstate` listener; URL via `history.pushState`.
2. **selects + runs the transition** — pick roomToRoom / areaToArea /
   universeToUniverse driver (behavior override ?? default), `await run()`.
3. **plays arrival** — invoke `behavior.arrival()` (currently dead), run the
   returned animation.
4. **schedules Cosmo's travel clip** — new public `cosmoAgent.scheduleTransitionClip('slide')`,
   consumed at the TOP of `agent.update()` so it beats the state-machine.
5. **crossfades audio** — `AudioFFTBridge.crossfadeToTrack()` (dual gain) +
   optional travel-whoosh on the existing stingerGain sub-bus.
6. **swaps the host** — `SubstrateLoader.switchUniverseInPlace(u,a,r)` mirroring
   boot, but disposing + reconstructing only the host hierarchy.

Supporting gaps to close alongside: expose `sfxBus` on `SubstrateCtx` (S5);
generate the `slide` clip (hard-dep, fal Kling i2v pipeline); the 3-beat depart→
between→arrive structure for the orchestrator to hang feel on.

## The one decision that is Richard's: what should travel FEEL like?

The architecture is mine to drive. The *feel* is the brand/vision call. Three
grounded options (all expressible with the existing driver vocab):

- **A — Portal ceremony (symmetric).** The world irises UP into its bloom on
  exit; the destination bloom irises outward into the new world on arrival. Calm,
  dream-logic, ceremonial. Closest to the already-implied design. ~2.5s.
- **B — Cosmo carries you.** Cosmo is the fixed point; worlds dissolve/condense
  around a constant companion (he stretches via `slide`). Maximizes the
  companion-continuity vision; less "gateway", more "the companion is home,
  worlds are weather."
- **C — Per-universe signature travel.** Each world owns its travel texture —
  ink-ocean you sink/rise, dunes you heat-shimmer-dissolve, chart you float
  between stars. Richest "taste the vibe", heaviest (per-universe work).

**Recommended synthesis (A∘B∘C):** the orchestrator runs a 3-beat travel —
*depart* (tinted by origin's signature, C) → *between* (the calm chart-void
breath, A's portal as the universal frame) → *arrive* (tinted by destination's
signature, C) — with Cosmo as the constant companion threaded through all three
(B). One frame, room for per-world soul, companion never breaks. Build the frame
first (A+B), add per-world signatures (C) incrementally so breadth scales.

## DECIDED (Richard, 2026-06-07): the 3-beat synthesis.

Build order — frame first, signatures incremental:

- **Phase 1 — Navigator (the spine).** `SubstrateLoader.switchTo(u,a,r)` disposes
  + reconstructs the host hierarchy in-place (no reload). Replace WayMoteOverlay /
  chart-bloom `location.search=` with a `cosmos-navigate` event + listener.
  *Verifiable:* tap "Look up." → chart appears with no page reload.
- **Phase 2 — Run the dead drivers.** Inside switchTo, select + `await run()` the
  transition driver, then invoke `behavior.arrival()`. The 3-beat depart→between→
  arrive structure lives here. *Verifiable:* a portal/biome transition actually
  plays on switch.
- **Phase 3 — Cosmo continuity.** Public `scheduleTransitionClip()` consumed at
  the top of `agent.update()`; `slide` clip (hard-dep — fal Kling gen; placeholder
  with an existing clip until rendered). *Verifiable:* Cosmo plays a travel beat,
  no rig race.
- **Phase 4 — Audio crossfade.** `AudioFFTBridge.crossfadeToTrack()` (dual gain) +
  travel-whoosh on the stingerGain sub-bus; expose `sfxBus` on `SubstrateCtx` (S5).
  *Verifiable:* beds morph, no hard snap.
- **Phase 5 — Per-world signatures (C).** Flesh out HushBlend / Drift /
  DuskMirage / MushroomPath depart+arrive textures, one world at a time.

Each phase ships + commits independently. Frame (1+2) is the keystone.
