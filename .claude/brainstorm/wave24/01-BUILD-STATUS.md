# Wave 24 — BUILD-STATUS (integration runbook)

> Synthesis of the world-builder team output. The orchestrator (Game Master)
> drives integration from here. Order is in §6. Nothing ships until the BLOCK in
> §3 is cleared, tsc is green, and per-universe live UAT passes.

Verify gate (from the build): **tsc = PASS · build = PASS · errors = none.**
Every builder's `npx tsc --noEmit` was clean against the real
`src/substrate/contracts/BehaviorContract.ts`. The only integration risk is the
ONE shared-file BLOCK below, not type-safety.

---

## 1. What each world authored (files)

### Forest — `universes/forest/` (DEEPEN, Phase 1b)
- `behavior.ts` — **M** (+332 lines). Added 3 interactable classes, rewrote
  `forestInteractables` to room-switch (spawn-gated by `room.id` like the
  trampoline). Preserved all existing inhabitants / trampoline / background-
  omission / audio / transitions verbatim.
  - **SunbeamPatch** (Clearing, anchor x+2.5 z-1.6, range 1.6): onUse stretch↔look;
    baseline = beam opacity breathes ±4% on a 9s sine. Additive ground-pool +
    faint shaft on the SHARED scene.
  - **EchoCap** (Deep Grove, anchor x-1.0 z-1.5, range 1.8): onUse duck→look;
    touched cap flares pop-cyan, 4-cap cascade decays ~3s; baseline = offset slow
    pulse. Also the Option-A underglow source (additive over shared slow-bloom bg,
    NO new biome).
  - **BreathingPortalGreeting** (Deep Grove, in front of live portal anchor,
    range 1.6): onUse wave; READS the existing inhabitant's pulse phase
    (`1+0.04·sin(t·0.9)`) to time a cyan glint — owns NO mesh, no 2nd plane/tick
    (v2.2.4 scar honored). Greeting only, no traversal.
- `manifest.json` — **M**. ADDED `sunbeam-patch.png` + `glow-cap-cluster.png`
  (preload:false, `../../public/assets/...`). All existing entries kept.
- `public/updates/index.html` — **M** ← **OUT-OF-SCOPE EDIT, see §3 BLOCK-1**.
- `.claude/brainstorm/wave24/assets-forest.md` — new runbook.
- Fork: §7 told forest to bring ONE of deep-grove/the-hollow to full Sims-density.
  Chose **deep-grove**; the-hollow left as-is. Matches the LOCKED assignment.

### Ink-Ocean — `universes/ink-ocean/` (NEW, biomeKey:null)
- `manifest.json` — biomeKey-null universe, `behaviorModule:true`, post curve
  {bloom 1.1, kaleido 0.7, fluid 1.15, chroma 0.95}, `brandDeviation:null`,
  6 image + 2 audio assets (all `../../public/...`).
- `areas.json` — single area `the-drowned-cathedral`, cool ink-aubergine
  `moodOverrides`, `pathExperience.kind:"drift"` 2.6s.
- `rooms.json` — 2 rooms, both `biomeKey:null`; `light-shafts` (y:0) +
  `the-trench` (y:-4); per-room `audioBed`; vertical pan 1.2/1.4.
- `behavior.ts` — custom `background(ctx)` painting ink-water layers onto the
  SHARED `ctx.parallax.scene` (no 2nd ParallaxScene); `arrival` portal hue 0.55;
  room-filtered inhabitants/interactables; room-keyed audio; `roomToRoom` drift
  override.
- `.claude/brainstorm/wave24/assets-ink-ocean.md` — runbook (8 PNG + 2 bed regen).
- Interactables→clips: Kelp-Organ (light-shafts) walk→stretch→wink; Float-Tap
  (light-shafts) petted + procedural upward bob; Updraft-Current (the-trench)
  walk→jump→fall + procedural buoyant-arc. Inhabitants seen-not-used:
  cyan-jellyfish drift, deep-glow-lure pulse.

### Dunes — `universes/dunes/` (NEW, biomeKey:null + composition-spec)
- `manifest.json` — `name:"dunes"`, `defaultArea:"the-singing-flat"`, calm-baseline
  post (kaleido 0.6 / bloom 1.1), 7 assets all `../../public/assets/...`.
- `areas.json` — one area `the-singing-flat`, `pathExperience.kind:"drift"`,
  ambient `#E8C4B8`.
- `rooms.json` — `long-dune` (anchor 0,0,0) + `the-windless-hollow` (y:-2); both
  `biomeKey:null` + `audioBed` → `dune-drone-open.mp3` / `dune-drone-hollow.mp3`.
- `behavior.ts` — `background()` builds a synthetic `Biome` and calls
  `ctx.parallax.loadBiome()` on the SINGLE shared instance (never a 2nd
  ParallaxScene); room-filtered interactables; declared-EMPTY `inhabitants`;
  per-room audio handle; hush-blend `roomToRoom`; saffron arrival (hue 0.1);
  lateral dusk-mirage `universeToUniverse` (no vortex).
- `public/assets/backgrounds/biome-dusk-{dune,hollow}/composition-spec.json` —
  6-layer / 5-layer parallax stacks, locked palette.
- `.claude/brainstorm/wave24/assets-dunes.md` — runbook.
- Interactables→clips: Slide-Crest walk→look→fall+procedural lateral-glide→stretch;
  Bead-Bloom walk→duck→wink; Singing-Bowl walk→dance→petted→idle. Pop-magenta is
  engine-driven, peak-only (zero at hollow baseline).
- Fork 3(a) confirmed (RESOLVED 2026-05-31 Richard).

### Chart — `universes/_chart/` (NEW reserved pseudo-universe, auto-skipped)
- `_`-prefix = auto-skipped by the live `discoverUniverses()` glob (no shared edit).
- `manifest.json` / `areas.json` / `rooms.json` — conformant, English,
  `biomeKey:null`, `audioBed` set, `brandDeviation:null`, forest-verbatim paths.
- `behavior.ts` — `background(ctx)` paints ink-void + 2 drifting nebula-wash planes
  on the SHARED scene; `inhabitants(ctx)` = one LitBloom per discovered universe
  via `import.meta.glob('/universes/*/manifest.json',{eager})` (skips `_`-prefix),
  palette-keyed, Cormorant-Italic labels from `displayNameEn` + first `summaryEn`
  sentence, + exactly **3** becoming-blooms; lit-bloom tap writes the existing
  `?substrate=v2&universe=&area=&room=` triple (no router invented); becoming-bloom
  tap opens the invitation card ([Copy the prompt] copies README quickstart
  verbatim); `arrival` cool hue 0.55; `CosmoChartDrift` drives autonomous
  look/wave (shipped clips only, no-op if no rig).
- `.claude/brainstorm/wave24/assets-chart.md` — runbook (5 assets + 2 substrate
  changes spec).

---

## 2. Verify verdict + EXACT errors to fix

**tsc=true · build=true · errors: (none).**

There are **no compile/build errors to fix.** All four builders' files are
type-clean against the real contract. The integration blockers are CONFORMANCE
(§3), not the verify gate.

---

## 3. Conformance BLOCK / FLAG — numbered fixes

### BLOCK-1 — Forest edited a shared file (`public/updates/index.html`)  **[must fix before any commit]**
- **What:** the forest builder added a 28-line v2.4.4 article to the player-visible
  Updates/changelog page — a substrate-level page, NOT under `universes/forest/`.
  Wave-24 contract: a per-universe builder edits ONLY its own paths.
- **Fix (a):** REVERT the edit out of the forest change-set:
  `git checkout -- public/updates/index.html`. The forest content work
  (`behavior.ts`, `manifest.json`) stays.
- **Fix (b):** If the changelog entry is wanted, the substrate/Updates owner (the
  orchestrator) re-lands it AFTER the §3 BLOCK-2 emoji fix, as a separate
  substrate change — not attributed to forest.

### BLOCK-2 — Emoji on the public Updates page (compounds BLOCK-1)  **[must fix before re-landing]**
- **What:** the reverted diff contains `<li>🔴 <code>ink-ocean-shafts</code>...`.
  Brand contract forbids emoji in any player-visible surface; the Updates site is
  player-visible.
- **Fix:** when the orchestrator re-lands the changelog entry, replace the
  red-circle emoji with a text/CSS marker — e.g. a `<span class="tag tag--known">`
  pill or a literal word ("KNOWN ISSUE"). No unicode icon-as-graphic.
- **Scope note (verified):** NO emoji exists in any in-game string or in any
  `behavior.ts`. All non-ASCII in the four behaviors is in English comments
  (Hayao×Moebius, ≤, box-drawing, arrows). The breach is confined to the one
  Updates-page line.

### FLAG-3 — Missing `README.md` in the 3 new universes (dunes / ink-ocean / _chart)
- **What:** design-bible §3 lists 4 required artifacts per universe; the 4th is
  `README.md`. `universes/forest/` ships one; the three new universes do NOT.
  NOT loader-enforced (substrate auto-discovers without it), so this is FLAG not
  BLOCK — but it breaks two contract dependencies for **dunes** specifically:
  (a) the dweller-lens "deliberate stillness allowed only if declared in the
  README" — dunes returns empty `inhabitants()` and justifies it only in a
  behavior.ts comment; (b) any `brandDeviation` must be README-documented (here
  null, low risk).
- **Fix:** before ship, author `README.md` in `universes/{dunes,ink-ocean,_chart}/`.
  For dunes the README MUST declare the deliberate-stillness (empty inhabitants)
  choice. `brandDeviation:null` everywhere, so no deviation section needed.

### FLAG-4 — Forest onUse y-offset not self-resetting (drift risk)
- **What:** forest onUse handlers are honest procedural bridges
  (`root.position.y` / `rollZ` / `pitchX`) with named-clip drive deferred to
  CosmoAnimDirector. The y-nudges (e.g. `cosmo.root.position.y += 0.04`) are not
  visibly self-resetting in the shown code.
- **Fix:** confirm the rig/director zeroes these per-frame; if not, make the
  onUse nudges relative-to-baseline or clamp them, else repeated onUse drifts
  Cosmo up/down over time.

### FLAG-5 — Dunes "slide" clip fallback is only "acceptable"
- **What:** Room A headline joy (Slide-Crest) ships a doc-rated "acceptable"
  fall+procedural-glide fallback; the real `slide` clip is a REAL dependency. The
  headline delight-loop is below the "feels good every time" bar until the clip
  lands. `circle-sway` (Room B) is a nice-to-have with a strong dance+orbit fallback.
- **Fix:** track `slide` as a hard fast-follow animation-request (see §4 clip list).
  Acceptable to ship the fallback this wave, but flag the gap.

### FLAG-6 — Chart link string uses `→` (U+2192)
- **What:** `behavior.ts:342` renders `Read how it works →`. Design-bible §2 says
  "no unicode symbols." Mitigant: it is a typographic arrow inside copy that is
  VERBATIM from approved open-map.md §6 (`[ Read how it works → ]`) — sanctioned
  copy, not an icon-as-graphic.
- **Fix (reviewer call, low priority):** render the arrow with a CSS `::after`, or
  drop it to be literal to the no-unicode gate. Not blocking.

### FLAG-7 — SFX named but not wired (all 3 new universes)
- **What:** event SFX are named in comments/runbooks but the current contract has
  no SFX-emit hook. Honest, declared gap — runtime-wirer follow-up, not a
  violation. See §4 wiring.

### PASS summary (non-blocking, recorded)
- ink-ocean: **PASS** — no shared-file edits; all forks correct; contract exact;
  English-only; palette + ≤5% pop locked; calm-baseline. (FLAGs: no README §FLAG-3;
  SFX unwired §FLAG-7; both beds are 19.8s stubs needing regen §4.)
- dunes: **FLAG** (README §FLAG-3 + slide clip §FLAG-5) — otherwise forks correct,
  no shared edits, palette + peak-only pop-magenta locked, English-only,
  calm-baseline, type-clean.
- chart: **PASS** — scope clean, forks correct (3 becoming-blooms, README-verbatim
  prompt, biomeKey:null), contract conformant, palette + one pop-cyan mote,
  no 2nd ParallaxScene, shipped clips only. (FLAG-6 arrow only.)
- forest CONTENT: conformant + strong (palette PASS, calm-baseline PASS, contract
  PASS, double-tick scar PASS) — the BLOCK is purely the out-of-scope shared edit.

---

## 4. SHARED-SUBSTRATE work — orchestrator-only

These touch `src/substrate/*` or shared pipelines; no builder did them. None block
tsc, but several block a *good* live experience.

### S1 — "Look up" way-mote overlay  (resolves O11; chart + all universes need it)
- Every room of every universe gets a FREE faint top-of-frame painted way-mote +
  English microcopy **"Look up."** No universe authors it (author-cost would defeat
  the point); no universe can trap a player without a return path.
- Where: `src/substrate/SubstrateLoader.ts` (mount once per room-enter) + new
  `src/substrate/drivers/WayMoteOverlay.ts` (DOM or THREE billboard pinned
  top-center). MUST NOT be a per-universe behavior export; MUST NOT build a 2nd
  ParallaxScene.
- Gesture: tap mote / single upward-swipe / `M` key → play Cosmo `look` → trigger
  the portal-in-reverse return (S2). Carries no per-room state.
- **Resolver exemption (critical):** the return target is the chart triple
  `?substrate=v2&universe=_chart&area=the-void&room=the-chart`. `_chart` is skipped
  by `discoverUniverses()`, so the loader's "invalid universe → forest" fallback
  must EXEMPT the reserved `_`-prefix when the request is the explicit chart-return
  — else looking-up bounces the player to the forest. Add `_chart` (and any
  `_`-prefixed reserved id) to an allowlisted set the resolver treats as a valid
  loadable place even though it is excluded from discovery/enumeration.

### S2 — Portal-in-reverse return + forward bloom-open portal  (resolves §4.2)
- **Forward:** tapping a lit bloom irises that bloom outward into the full portal
  tinted by the target universe's `behavior.arrival().hue` (forest 0.62 /
  ink-ocean 0.55 / dunes saffron-warm 0.1), then resolves into its `entryRoom`.
  The chart already computes the triple + exposes per-bloom `arrivalHue`; the
  substrate's `PortalTransition` consumes that hue.
- **Return:** leaving a universe back to the chart = the ceremony played in reverse
  (room recedes UP into its bloom). Today chart `navigateToUniverse()` does an
  honest reload; upgrade BOTH directions to the animated portal.
- Where: `src/substrate/drivers/PortalTransition.ts` + `SubstrateLoader.ts`
  (universe→universe path). 1.4s, breathing not shaking, no flash. Reuse the same
  `PortalTransition` the chart's `chartArrival()` (`{kind:'portal',duration:1.4,
  hue:0.55}`) implies for the reverse return.

### S3 — Cosmo rig handoff to behaviors (lights up chart drift + named clips)
- `CosmoChartDrift` reads OPTIONAL `ctx.scene.userData.cosmoRig`
  (`{current: CosmoV2Rig|null}`) + OPTIONAL `rig.playClip(name)`. If the runtime
  parks the rig there + exposes `playClip`, Cosmo drifts and autonomously
  look/waves; if absent, the driver is a no-op (never errors).
- The cross-cutting dependency ALL interactables share: a **named-clip scheduler**
  (CosmoAnimDirector honoring onUse clip requests). Until it exists, every onUse
  drives procedural channels (root.y / rollZ / pitchX) as the bridge. Wire
  `scene.userData.cosmoRig` + a `playClip` shim to light this up.

### S4 — Animation clips to author (CosmoAnimDirector; 8×8 atlas, count 61, cell 256, fps 12)
- **`slide`** (Dunes Room A) — HARD dep (§FLAG-5). ~1.6s one-shot: Cosmo sledding
  down a slope on his backside, arms out, body angled downslope, antenna
  streaming, slight grin, suction-cups trailing. Fallback shipped = "acceptable".
- **`drift-swim`** (Ink-Ocean) — ONE new clip: weightless underwater locomotion
  loop (replaces `walk` underwater). 8×8 / count 61 / cell 256 / fps 12. `walk`
  is the shipped fallback at each call-site.
- **`circle-sway`** (Dunes Room B) — nice-to-have, strong dance+orbit fallback.
- Weightless idle (ink-ocean) is PROCEDURAL hover-drift over `idle` — NO new clip.

### S5 — Audio regen + SFX wiring  (runtime-wirer / audio-director)
- **Ink-Ocean bed regen (REQUIRED before Phase 3):** `ink-ocean-shafts.mp3`
  (currently 19.8s) and `ink-ocean-trench.mp3` (currently 19.8s) → seamless ~90s
  loops. Suno prompts in `assets-ink-ocean.md` §AUDIO.
- **Per-room audioBed swap** + the event-SFX scheduler are the Phase-0 substrate
  seams the dunes/ink-ocean audio handles + onUse calls assume. No SFX-emit hook
  exists in the current contract — add one, then route the named SFX (below).
- **SFX to route (all ElevenLabs, named in runbooks):**
  - Ink-Ocean: kelp-organ-swell, jellyfish-chime, bubble-release, updraft-ride,
    deep-glow-pulse, surface-call, submersion-swell (portal).
  - Dunes: sand-slide boom, glass-bead glint, crest-wind, bowl-ring,
    ripple-settle, hollow-hush.
  - Chart: bloom-focus/hover, portal-open (shared w/ S2), becoming-bloom touch.
  - Forest: stretch/look/duck/wave are shipped clips; no new forest SFX.
- Also drive the `roomToRoom` vertical camera drift + post.bloom/post.fluid peak
  nudges for ink-ocean (documented inline in its behavior).

### S6 — Vite / copy / registry wiring
- **New manifest assets are auto-copied to dist by postbuild** (forest confirmed:
  "no registration"). New PNGs under `public/assets/...` need no vite edit.
- **Substrate auto-discovers** the 3 new universe folders (no loader edit;
  ink-ocean + dunes + chart all confirmed zero `src/` references). `_chart` is
  auto-skipped by the `_`-prefix glob.
- **Optional dunes DECORATION_SPECS registry:** the shared decoration layer does
  not know `slide-crest` / `glass-bead-bloom` / `wind-bowl`. Dunes sidesteps it by
  rendering its own decal planes in `behavior.ts` (no blocker). ONLY if you want
  them rendered via `composition-spec.decoration_spots`, add those 3 ids to the
  registry.
- **Chart LitBloom core upgrade (optional):** chart currently draws blooms as
  tinted `CircleGeometry`; swap the `LitBloom` core material `map` to
  `spore-bloom-core.png` when generated (painted neutral-warm-white so per-universe
  tint lands).

---

## 5. ASSET-GENERATION runbook (consolidated)

**Count: 21 new PNGs to generate + 2 audio beds to REGEN + 1 new audio bed +
3 new clip sheets (slide, drift-swim, circle-sway) + ~21 SFX.**
Brand gate on EVERY gen: Hayao×Moebius watercolor, locked palette only, pop-accent
≤5% peak-only, no emoji/placeholder/stock. Additive assets painted on pure black.
Regenerate 3–5× and pick the most painterly result. No `rtcosmo` needed (no Cosmo
in any of these). Full prompts live in the per-world runbooks; paths below.

### GROUP A — Backgrounds (7 PNG)
| Path | Dims | Alpha | Universe | Runbook |
|---|---|---|---|---|
| `public/assets/backgrounds/ink-water-surface-4k.png` | 4096×2731 | no | ink-ocean | assets-ink-ocean §1 |
| `public/assets/backgrounds/ink-water-abyss-4k.png` | 4096×2731 | no | ink-ocean | assets-ink-ocean §2 |
| `public/assets/backgrounds/spore-chart-void-4k.png` | 3840×2160 | no | chart | assets-chart §1A |
| `public/assets/backgrounds/spore-chart-nebula-wash.png` | 2560×1600 | soft alpha | chart | assets-chart §1B |
| `public/assets/backgrounds/biome-dusk-dune-4k.png` | 3840×2160 | no | dunes (fallback) | assets-dunes §3 |
| `public/assets/backgrounds/biome-dusk-hollow-4k.png` | 3840×2160 | no | dunes (fallback) | assets-dunes §3 |

### GROUP B — Dunes composition layers (11 PNG, alpha-cut per table)
All under `public/assets/backgrounds/biome-dusk-{dune,hollow}/`. Generate as
separate transparent parallax layers (NOT a flat image), dims match the spec.
- **biome-dusk-dune/** (6): `layer-1_dusk-sky-gradient.png` 2048×1024 (full),
  `layer-2_heat-shimmer-horizon.png` 2048×512, `layer-3_far-dune-ranks.png` 2048×600,
  `layer-4_mid-dunes.png` 2048×640, `layer-5_near-crest.png` 2048×720,
  `layer-6_foreground-sand-grain.png` 2048×1024 (additive).
- **biome-dusk-hollow/** (5): `layer-1_narrow-dusk-sky.png` 1536×1024 (full),
  `layer-2_far-dune-wall.png` 1536×700, `layer-3_cupping-dune-walls.png` 1536×900,
  `layer-4_rippled-bowl-floor.png` 1536×640,
  `layer-5_settling-sand-shimmer.png` 1536×1024 (additive).
- Prompts: assets-dunes §1. Palette: saffron-glow / ink-aubergine / faded-rose /
  mushroom-cream. Keep cyan/lime OUT (dunes pop is magenta, on decals only).

### GROUP C — Objects (13 PNG, all under `public/assets/objects/`, all alpha-cut)
| Path | Dims | Blend | Universe | Runbook |
|---|---|---|---|---|
| `sunbeam-patch.png` | 1024×1024 | additive | forest | assets-forest §1 |
| `glow-cap-cluster.png` | 768×768 | additive | forest | assets-forest §2 |
| `kelp-organ.png` | 1024×1536 | normal | ink-ocean | assets-ink-ocean §3 |
| `updraft-current.png` | 1024×1536 | additive | ink-ocean | assets-ink-ocean §4 |
| `jellyfish-cyan.png` | 512×640 | additive (pop-cyan) | ink-ocean | assets-ink-ocean §5 |
| `deep-glow-lure.png` | 512×512 | additive (pop-cyan) | ink-ocean | assets-ink-ocean §6 |
| `light-shaft.png` | 512×1536 | additive (×3 instanced) | ink-ocean | assets-ink-ocean §7 |
| `water-motes.png` | 1024×1024 | additive | ink-ocean | assets-ink-ocean §8 |
| `slide-crest.png` | 1024×512 | additive sheen | dunes | assets-dunes §2 |
| `glass-bead-bloom.png` | 512×384 | normal (pop-magenta point ≤5%) | dunes | assets-dunes §2 |
| `wind-bowl.png` | 1024×512 | normal (rim added in-engine) | dunes | assets-dunes §2 |
| `spore-bloom-core.png` | 1024×1024 | alpha (neutral-warm-white, tinted in code) | chart | assets-chart §1C |
| `spore-bloom-becoming.png` | 1024×1024 | alpha (dotted ink ring) | chart | assets-chart §1D |

Pop-accent discipline by universe: **forest** pop-cyan on EchoCap flare only
(sunbeam = none); **ink-ocean** pop-cyan ONLY on jellyfish + lure; **dunes**
pop-magenta ONLY on bead/bowl peaks (do NOT bake into PNG); **chart** one
pop-cyan mote on the ink-ocean bloom only.

### GROUP D — Audio (`public/assets/audio/music/`)
- **REGEN (required, Phase 3 blocker):** `ink-ocean-shafts.mp3` 19.8s → ~90s seamless;
  `ink-ocean-trench.mp3` 19.8s → ~90s seamless. Suno prompts: assets-ink-ocean §AUDIO.
- **NEW:** `spore-chart-void.mp3` ~90–120s seamless. Suno prompt: assets-chart §2.
- Forest beds (`clearing-bloom-loop.mp3`, `deep-grove-loop.mp3`) + dune beds
  (`dune-drone-open.mp3`, `dune-drone-hollow.mp3`) already ship — no action.

### GROUP E — Cosmo clips (CosmoAnimDirector) + SFX
- Clips: `slide` (hard), `drift-swim` (new), `circle-sway` (nice). See §4 S4.
- SFX: ~21 named in §4 S5 — generate via ElevenLabs once the SFX-emit hook lands.

---

## 6. Recommended integration order

1. **Clear the BLOCK first (no commit before this).**
   `git checkout -- public/updates/index.html` to revert the out-of-scope forest
   edit (§3 BLOCK-1). Re-author the changelog entry later as a substrate change
   with the emoji removed (§3 BLOCK-2).
2. **Author the 3 READMEs** in `universes/{dunes,ink-ocean,_chart}/` (§3 FLAG-3),
   with the dunes deliberate-stillness declaration. Re-run `npx tsc --noEmit` —
   should stay green (no code change). Commit the four-universe content set
   (forest behavior+manifest, ink-ocean, dunes, chart, READMEs, runbooks).
3. **Generate assets** (§5): Groups A→C (21 PNG), Group D audio (2 regen + 1 new),
   then queue Group E (clips + SFX). Assets auto-copy to dist (§4 S6) — no vite edit.
4. **Wire the substrate** (§4): S1 way-mote + resolver `_chart` exemption →
   S2 portal both directions → S3 rig handoff + named-clip scheduler →
   S5 audioBed swap + SFX-emit hook + ink-ocean bed regen wiring. Optional:
   S6 chart LitBloom map swap, dunes DECORATION_SPECS.
5. **Fix FLAG-4** (forest onUse y-offset self-reset) once the named-clip scheduler
   (S3) is in — confirm the rig zeroes per-frame.
6. **Live UAT per universe** (real UAT, not header-grep, per project CLAUDE.md):
   for forest / ink-ocean / dunes / chart — bundle ref in HTML matches deployed
   bundle; bundle reachable via curl; bundle contains a logic-marker string from
   the new behavior; the universe loads at its triple; rooms switch; calm-baseline
   reads as breathing-not-shaking; onUse peaks fire and decay; "Look up" returns to
   chart; portal tints correct per arrival hue. Purge Cloudflare cache. Bump
   HUD-pill version + CHANGELOG `[Unreleased]` + memory.

**Single next step:** run `git checkout -- public/updates/index.html` to clear
BLOCK-1, then commit the conformant four-universe content set (after the 3 READMEs)
— that unblocks the whole pipeline.
