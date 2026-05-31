# Wave 24 — Asset Runbook: The Spore-Chart (`universes/_chart/`)

> Every NEW visual asset the chart references, with exact path, dimensions, an
> on-brand fal/nano-banana prompt, and alpha-cut flag. Held to the locked
> brand: Hayao×Moebius watercolor, locked palette (mushroom-cream / moss-sage /
> sky-wash / faded-rose / ink-aubergine / saffron-glow / forest-deep), pop ≤5%
> peak-only. No emoji, no placeholder, no stock. The chart breathes; it does
> not shake.

All paths mirror the forest convention VERBATIM: referenced as
`../../public/assets/<...>` in `manifest.json` (the `../../public/` prefix is
stripped by `PreloadManager.resolveAssetUrl` at runtime; `behavior.ts` resolves
the same via `assetPath('assets/<...>')`). New PNGs live under
`public/assets/backgrounds/` and `public/assets/objects/`; the bed under
`public/assets/audio/music/`.

---

## 1. Visual assets (NEW)

### A. Void backdrop — `public/assets/backgrounds/spore-chart-void-4k.png`
- **Dimensions:** 3840 × 2160 (4K, 16:9), painted to bleed past frame edges.
- **Alpha-cut:** NO (opaque backstop).
- **Role:** the deep ink-aubergine cosmic void, near-still backstop plane (z ≈ -18).
- **Prompt (fal flux-pro / nano-banana):**
  > "A vast hand-painted watercolor cosmic void at deep dusk, ink-aubergine
  > (#2A1F3D) deepening to near-black at the corners, washed with the faintest
  > breath of faded-rose (#E8C4B8) and sky-wash (#B8CDD6) nebula far in the
  > distance. Visible cold-press paper tooth and brush-grain, Hayao Miyazaki sky
  > meets Moebius ink-wash, calm and immense, no stars-as-dots cliché — instead
  > a soft dust-of-light suspended in dark water. No subjects, no horizon, no
  > text. Muted, luminous, headphone-calm. 16:9."
- **Notes:** keep it DARK and quiet — it is a backstop, never the focus. No
  bright spots that would compete with the blooms.

### B. Nebula wash overlay — `public/assets/backgrounds/spore-chart-nebula-wash.png`
- **Dimensions:** 2560 × 1600, soft-edged, transparent margins.
- **Alpha-cut:** YES (soft alpha — feathered transparent edges, no hard cut).
- **Role:** two slow-drifting translucent nebula planes (faded-rose + sky-wash)
  layered over the void, breathing on offset sines.
- **Prompt:**
  > "A single soft watercolor nebula cloud, faded-rose (#E8C4B8) bleeding into
  > sky-wash (#B8CDD6), painted wet-on-wet with feathered translucent edges that
  > fade fully to transparent at all borders, Moebius-calm, no hard outline, no
  > stars, no subject. A drifting veil of dusk-coloured mist. Transparent PNG,
  > soft alpha. 16:10."
- **Notes:** must read at 35–50% opacity over the void without muddying it.
  Tinted by material opacity in code; the PNG itself stays gentle.

### C. Lit spore-bloom core — `public/assets/objects/spore-bloom-core.png`
- **Dimensions:** 1024 × 1024, centered radial bloom, transparent surround.
- **Alpha-cut:** YES (alpha — radial falloff to fully transparent).
- **Role:** the luminous disc body of each lit bloom. Tinted per-universe in
  code (forest warm-cream, ink-ocean cool-aubergine, dunes dusk-saffron), so the
  PNG is painted NEUTRAL-WARM-WHITE so tinting reads true.
- **Prompt:**
  > "A single hand-painted watercolor spore-bloom: a soft luminous disc of light
  > like the underside of a glowing mushroom-cap releasing spores, warm
  > off-white core (#F5EDD8) with a soft saffron-glow (#F2B134) catch-crescent
  > at the upper edge (a single catchlight, like Cosmo's saffron-crescent
  > catchlight), feathered glowing halo fading to transparent, fine ink-line
  > spore-flecks drifting off its rim. Hayao×Moebius watercolor, no hard outline,
  > centered, transparent background, soft alpha. 1:1."
- **Notes:** the code currently draws blooms as tinted `CircleGeometry` discs as
  the conformant floor; this PNG UPGRADES the core into a painted disc — swap the
  `LitBloom` core material `map` to this texture when generated. Painted-neutral
  so the per-universe palette tint (core/halo/glint) lands correctly. Cosmo DNA
  echo: the saffron catch-crescent is intentional brand-thread.

### D. Becoming-bloom (un-opened) — `public/assets/objects/spore-bloom-becoming.png`
- **Dimensions:** 1024 × 1024, transparent surround.
- **Alpha-cut:** YES (alpha).
- **Role:** the dotted ink-circle of a world-not-yet-painted ("your world here").
- **Prompt:**
  > "A hand-drawn dotted ink circle, like a sailor's pen-line on an old chart,
  > faded-rose (#E8C4B8) ink on transparent — a ring drawn but NOT filled, the
  > watercolor wash withheld, only the faintest dust of light inside. Visible pen
  > stutter and hand-drawn imperfection, Moebius ink-line, no color-fill, no
  > glow, intimate and quiet. Transparent background, soft alpha. 1:1."
- **Notes:** must read clearly as POTENTIAL, never as a greyed-out locked level.
  Code currently draws it as a faint faded-rose ring; this PNG upgrades it.

---

## 2. Audio asset (NEW) — listed for the audio pipeline

### `public/assets/audio/music/spore-chart-void.mp3`
- **Role:** the chart's ambient bed (room `audioBed`, looped by DefaultAudio at
  0.45 volume). The between-worlds void — borrows a thread of each universe bed
  so the chart feels like the place all three are reachable from.
- **Suno prompt (verbatim from open-map.md §4a):**
  > "Beatless cosmic-void drone, ~44 bpm felt-pulse (no percussion), a slow
  > swelling pad of bowed glass-harmonica + distant breathy choir-hush + a single
  > deep sub-bloom every ~12s, weightless and suspended, faint shimmer of high
  > air like dust catching starlight, Moebius-calm watercolor, vast but intimate,
  > loopable seamless, headphone-intimate, no melody-hook — the sound of drifting
  > between worlds at dusk."
- **loop:** yes · target LUFS: quiet (sits under SFX) · 90–120s seamless.
- **Event SFX (ElevenLabs)** — generated separately, wired by the substrate's
  audio/portal layers (NOT chart-folder assets, but tracked for the sound team):
  1. **Bloom-focus / hover** — "soft warm watercolor bloom-swell, a single low
     chord opening like a flower, ~600ms, shimmer-tail tinted toward the focused
     bloom's mood, no click, all breath."
  2. **Portal-open (travel peak)** — "rising ceremonial chord-bloom with a soft
     chime-cluster, ~1.4s, gentle and momentous, no impact-hit." (Owned by the
     shared portal transition — see §3.)
  3. **Becoming-bloom touch** — "a single faint, hopeful ascending two-note
     shimmer with a long open tail, ~900ms, like a question gently asked — warm,
     never a notification-blip." (Fires when the invitation card drifts up.)

---

## 3. SHARED-SUBSTRATE CHANGES the orchestrator must make (I did NOT implement these)

These two changes live OUTSIDE `universes/_chart/` (in `src/substrate/*`), so per
the conflict-free-parallelism rule I only SPECIFY them. Both resolve open items
O11 + the §4.2 portal-in-reverse from `00-FIRST-SETUP.md`.

### Change 1 — Substrate-provided default "Look up" way-mote overlay (resolves O11)
- **What:** every room of every universe gets, FOR FREE, a single faint
  top-of-frame painted way-mote (a spore of light) + English hover microcopy
  *"Look up."* No universe authors it; no universe can trap a player without a
  return path. Per-universe art (forest floating-star / ink-ocean rising bubble /
  dunes first-star) is an OPTIONAL override, not required.
- **Where:** `src/substrate/SubstrateLoader.ts` (mount the overlay once per
  room-enter) + a new tiny `src/substrate/drivers/WayMoteOverlay.ts` (a DOM or
  THREE billboard pinned to the top-center of the frame). It must NOT be a
  per-universe `behavior` export (that would make it author-cost, defeating the
  point) and must NOT construct a 2nd ParallaxScene.
- **Gesture contract:** tap the mote / single upward-swipe / `M` key →
  (1) play Cosmo `look` (shipped clip), then (2) trigger the portal-in-reverse
  return to the chart (Change 2). The way-mote is purely the trigger; it carries
  no per-room state.
- **Return target:** the chart triple `?substrate=v2&universe=_chart&area=the-void&room=the-chart`.
  IMPORTANT: `_chart` is skipped by `discoverUniverses()` (it is not a
  destination bloom), so the loader's universe-validity check must EXEMPT the
  reserved `_`-prefix from the "invalid universe → forest" fallback when the
  request is the explicit chart-return — otherwise looking-up would bounce the
  player to the forest instead of the chart. Add `_chart` (and any `_`-prefixed
  reserved id) to an allowlisted set the resolver treats as a valid loadable
  place even though it is excluded from discovery/enumeration.

### Change 2 — Portal-in-reverse return + forward bloom-open portal (resolves §4.2)
- **What (return):** leaving a universe back to the chart is the ceremonial
  portal played in reverse — the room recedes UP into its bloom on the chart.
  Today the chart's `navigateToUniverse()` performs an honest reload into the
  target triple (brand-true, no router invented); the orchestrator should
  upgrade BOTH directions to the animated portal so the transition is the
  ceremony the design calls for.
- **What (forward):** tapping a lit bloom should iris that bloom outward into the
  full portal tinted by `behavior.arrival().hue` for the target universe
  (forest 0.62 / ink-ocean 0.55 / dunes saffron-warm), then resolve into that
  universe's `entryRoom`. The chart already computes the correct triple +
  exposes the per-bloom `arrivalHue` (from each manifest's preset / arrival); the
  substrate's `PortalTransition` should consume that hue.
- **Where:** `src/substrate/drivers/PortalTransition.ts` +
  `src/substrate/SubstrateLoader.ts` (the universe→universe transition path).
  The chart provides the hue + triple; the substrate owns the animation. Keep it
  1.4s, breathing not shaking, no flash.
- **Hook the chart already gives you:** `chartArrival()` returns
  `{kind:'portal', duration:1.4, hue:0.55}` (the cool between-worlds hue) for the
  chart's own arrival; reuse the same `PortalTransition` for the reverse return.

### Optional follow-on (NOT blocking this wave)
- **Rig reference for Cosmo's chart-drift:** `CosmoChartDrift` (in
  `behavior.ts`) reads an OPTIONAL `ctx.scene.userData.cosmoRig`
  (`{ current: CosmoV2Rig | null }`) and an OPTIONAL `rig.playClip(name)` method.
  If the runtime parks the rig there and exposes `playClip`, Cosmo will drift and
  autonomously `look`/`wave` at the blooms on the chart. If absent, the driver is
  simply omitted (Cosmo keeps the substrate default idle) — never blocks, never
  errors. The orchestrator may wire `scene.userData.cosmoRig` + a `playClip`
  shim on the rig to light this up.

---

## 4. Conformance notes
- All player-facing strings are ENGLISH: bloom labels (`displayNameEn` +
  `summaryEn` first sentence), "your world here", the invitation card copy
  (verbatim from open-map.md §6), "Look up" microcopy (Change 1).
- `[Copy the prompt]` copies the README "Quickstart — pair with Claude in three
  lines" block VERBATIM (mirrored into `README_QUICKSTART_PROMPT` in
  `behavior.ts`). Single source of truth; re-sync if README changes.
- Becoming-bloom count is exactly 3 (`BECOMING_BLOOM_COUNT`), Richard's Fork-5
  call. They cannot be discovered (no folder) so the count is a chart-local
  constant (resolves O9).
- `brandDeviation: null` on the chart manifest — the chart composes inside the
  locked brand, adds no deviation.
- Cosmo motion on the chart uses ONLY shipped clips: `look`, `wave` (+ default
  `idle`); the drift is a procedural transform over idle. No new clip requested.
