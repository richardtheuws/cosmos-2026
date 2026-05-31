# The Singing Dunes — a dusk that decided to last

> *Emptiness itself is the strangeness.*

A windless dusk over an endless sand-ocean that hums when you move across it (Wave 24, Universe 3). Committed over Crystal Cavern (would re-tread the ocean's enclosed-glow/cyan register) and Cloud-Temple (its thermal-updraft thrill fights the hands-free pocket-escape target). The most distinct Universe on every spatial axis: **sparse, horizontal, vast-open, dry, low raking saffron dusk** — the most meditative-psychedelic within the locked palette.

## Files
`manifest.json` · `areas.json` · `rooms.json` · `behavior.ts` · this README. Background is `biomeKey: null` + a per-room `composition-spec.json` (no new biome-registry keys) under `public/assets/backgrounds/biome-dusk-{dune,hollow}/`.

## Area: The Singing Flat (single Area, dusk mood, `pathExperience.kind: "drift"`)

## Rooms
- **The Long Dune** (`long-dune`, entry, y:0) — high on a crest, mostly sky, a vista (`cameraBounds` the widest in the project). *Interactables:* Slide-Crest (`walk`→`look`→`fall`+procedural lateral-glide→`stretch`), Bead-Bloom (`walk`→`duck`→`wink`).
- **The Windless Hollow** (`the-windless-hollow`, y:-2) — the quiet inside the vastness; sheltered, cradling, the tightest `cameraBounds`. *Interactable:* Singing-Bowl (`walk`→`dance`→`petted`-posture→`idle`).

## Deliberate stillness (declared per the Dweller Lens)
**The Windless Hollow intentionally ships ONE interactable and an empty `inhabitants()` list.** This is a *declared* exception to Sims-density, not a gap: the room's whole purpose is hush — it is where the visitor lands and slows to rest (the longest, most enveloping peak-decay in the Universe). Sims-density is met by the parallax-layer life + the bowl + the slow ripple-shimmer; a second interactable would crowd the stillness the room exists for. (NORTH-STAR §1 dweller-lens permits deliberate stillness *only when declared* — this is that declaration.)

## Brand
Locked palette: **saffron-glow / ink-aubergine / faded-rose** (+ mushroom-cream highlights). Pop-accent is **pop-magenta**, engine-driven and **peak-only** (the desert-glass beads' last-light glint; the hollow's bowl-ring rim-light) — at the hollow's calm baseline there is ZERO pop, which makes the peak feel earned. Pop-magenta is NOT baked into any PNG. Calm baseline, event-peaks. English-only in-game. `brandDeviation: null`.

## Known / hand-offs
- **`slide` clip is a hard fast-follow:** Room A's headline Slide-Crest joy ships a `fall`+procedural-glide+`stretch` fallback rated only "acceptable" — the real painted `slide` clip is tracked as a dependency (brief in `.claude/brainstorm/wave24/assets-dunes.md`). `circle-sway` (Room B) is a nice-to-have with a strong `dance`+orbit fallback.
- Visual assets (dune/hollow parallax layers, slide-crest, glass-bead-bloom, wind-bowl) to generate per the runbook.
- Event SFX named in `behavior.ts` await the substrate SFX-emit hook.

See `.claude/brainstorm/wave24/00-FIRST-SETUP.md` §U3.
