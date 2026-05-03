# North Star — Cosmos Cosmic Adventure 2026

**Status**: living document
**Ratified**: 2026-05-03 (Wave 19 → Wave 20 strategic pivot)
**Read order**: this file FIRST in every new session, ALWAYS, before any other planning doc.

---

## 1. Vision

> **A psychedelic companion in an ever-growing world that keeps expanding in any way imaginable.**

Cosmo is a being. Not a character in a game.
The world begins in a forest.
Where the world goes from there is uncertain — *anything is possible*.

What we are building is **not a level-based platformer**, **not a runner**, **not a rhythm game**, **not a parody, remake, or homage**. Those were earlier attempts to give it a shape. They served their purpose and were discarded the moment they no longer matched what the work wanted to become.

What we *are* building:

- **A companion** that has its own life on screen, regardless of whether anyone is watching.
- **A world** that surrounds Cosmo and breathes with him.
- **An expansion vector** — every release adds a new biome, a new set of activities, a new way Cosmo can be encountered. The world grows without ever resetting.
- **A trip** in the original sense — slow, weird, hypnotic, occasionally funny, always alive.

## 2. Origin

Cosmo is loosely based on a real personal memory from 1992 — a being someone glimpsed on a night they don't have to specify. He has no plot, no quest, no enemies. He's just *here*, painted thirty years later in watercolor, on a planet that exists only while you're looking at it.

This origin is intentionally abstract. We do not name it directly in marketing. The work points at it; readers who recognize the wavelength will understand. Others can simply enjoy a small green being who lives on their screen.

## 3. The growing world

### The forest (current)
- Watercolor cosmic-mushroom forest, soft pastel cosmic horizon.
- This is **the entry point**, not the destination.

### What "expansion" means
The world is **modular and additive**. Each future biome ships as:
- A new background-set + composition-spec
- A set of inhabitants (not enemies — *inhabitants*, weird small lives)
- A handful of new activities Cosmo does there
- Optional: new movement-modes (climb a tree, swim through ink, drift through stars)

The forest will not be replaced. Cosmo will simply learn to walk farther.

### What's possible
Open-ended on purpose. Examples we've discussed but not committed to:
- A canopy / sky-layer above the forest
- An ocean of ink
- A village of other small beings
- A dream-realm Cosmo enters when he sleeps
- Seasons or moods that wash over the existing biomes
- A second companion that joins him

We hold none of these as roadmap. They are *seeds*. The future will tell us which ones grow.

## 4. The principle of brave reconsideration

This is the operating principle of this project:

> **We dare to reconsider any decision the moment the future asks for something else.**

This is not flakiness or thrash. It is the discipline that:
- Already turned a level-based platformer (v0.x) into a rhythm-trip (v1.0), into a motion-companion world (v1.3), into a calm + alive forest (v1.4 → 1.5), and is now turning that into a true expanding world (v2.0+).
- Already killed an Apogee-spoof framing the moment it stopped fitting (v1.5.0 lore migration).
- Already abandoned three patches to a broken rig (v1.5.0/1/2) and committed to a hybrid rebuild the moment patching stopped converging.

### Rules for reconsideration

1. **Sunk cost is never an argument to keep something.** Hours invested in code, assets, or framing do not buy that thing a future. Only fitness for the current vision does.
2. **A pivot is announced, not snuck in.** When we decide a reconsideration is needed, it gets a one-paragraph entry in this file's Pivot Ledger (§6) so future readers can trace why.
3. **Pivots happen at the smallest scope that solves the problem.** A failing mechanic gets a redesign. A failing redesign gets a paradigm-shift. We do not blow up everything when only one layer is broken.
4. **The pivot before the work, not the work before the pivot.** If we sense we're about to pour effort into a frame that no longer fits, we stop and re-examine *first*. Never finish a feature just because it was started.
5. **What survives a pivot is documented.** When we leave something behind, we note what about it stays — the LoRA-locked DNA survived multiple pivots; the calm-baseline post-FX survives still; the brand voice ("Een aquarel-trip die zichzelf voortzet als jij stilzit") survived three rig attempts.

## 5. Working method (holistic mode)

Each session opens with this question, in order:

1. **Does the vision (§1) still hold?** If anything Richard or Claude has said since the last session would alter §1, edit §1 first.
2. **What is the smallest piece of the world we can grow next?** Not the most spectacular — the smallest that compounds.
3. **What survives, what pivots, what gets discarded?** Apply the brave-reconsideration rules (§4) to anything in flight.
4. **Then plan the wave.** Brainstorm docs in `.claude/brainstorm/waveN/` before code, parallel agents where independent, single-thread where the work braids.
5. **Always honor the brand**: trippy-cosmic-watercolor + 1992-DNA + calm baseline + weirdness on event-pieken. Never cheap stoner clichés. Never emojis. Never placeholders. Never Apogee-style level-list framing.

### Investment posture
We are no longer in proof-of-concept mode. This is **a prestige project**. That changes:
- Quality > cost on assets (already locked in `budget_policy`).
- Quality > speed on every shipped piece of the world. We'd rather ship one biome that's fully alive than three half-alive ones.
- Cooperation between Richard and Claude is now **co-authorship**, not "user requests, Claude executes". Strategic direction is set together; execution is mine to drive autonomously inside that direction.

## 6. Pivot Ledger

Every accepted pivot gets a one-paragraph entry. Newest first.

### 2026-05-03 — Cosmo v2 hybrid rebuild (Wave 20)
After three consecutive rig-fix attempts (v1.5.0/1.5.1/1.5.2) failed to fully eliminate Cosmo's eye-melting, we reconsidered the *entire* rig. The Meshy-imported GLB had structurally bad weights and out-of-place eye-bones; patching it was Sisyphean. Decision: replace the GLB with a primitive-skeleton (Three.js Object3D bones) wearing painted-texture decals (fal.ai watercolor PNGs). Honors the existing `cosmo-animation-spec.json` line that always said `"implementation": "procedural-object-transforms"` — we just hadn't actually built it that way. Architecture in `.claude/brainstorm/wave20/01-cosmo-v2-architecture.md`. Wave 19b (Life System + mic-input) is paused; it will build on the new rig.

### 2026-05-03 — Apogee-spoof framing retired (Wave 19a)
Game began as a 1992 Apogee Cosmo's Cosmic Adventure spoof. It had drifted too far for that frame to fit. We migrated five HTML pages, killed the press-kit (redirect to /lore/), and re-anchored the brand on a 146-word backstory that points obliquely at 1992 without naming it. New tagline: *"Een aquarel-trip die zichzelf voortzet als jij stilzit."* Logo swap to LoRA-locked hero. Game-code itself was already spoof-free.

### 2026-05-02 — Smoothness + calm baseline (Wave 18)
The game had become **constantly distorted**: every effect always-on, breathing sines locked in lockstep, a placeholder synth fluitje forever audible. We reconsidered the post-FX philosophy from "always trippy" to "calm baseline + event-driven peaks". Bloom -44%, fluid -55%, kaleido ambient → 0, event cadence 18-30s. Plus the placeholder synth was killed, the gyro deadband fixed, the AI mixer-clobber-bug fixed. The world now breathes; it doesn't shake.

### 2026-04-29 — Rhythm-trip → motion-explorer (Sprint 17)
The "tap on the beat" framing was always a button-game in disguise. It was replaced with a motion-controlled world-explorer + 8s-idle companion AI. Cosmo stopped being something you score against and started being something you keep company.

### 2026-04 — Level-based platformer → rhythm-trip (v1.0)
The earliest framing was a 10-level Apogee-style platformer. It was retired the moment we realized we cared about the *being* more than the *levels*.

---

## 7. What this document is, and isn't

It is **not** a roadmap. Roadmaps live in brainstorm docs and the memory `next_session.md`. They change wave by wave.

It is **not** a PRD. PRDs become snapshots. This document stays alive.

It **is** the contract between Richard and Claude about what we are building together, why, and how we change our minds.

If the work ever stops matching this document, **the document is the one that gets challenged first**, not the work.

---

*Adem mee. Hij blijft niet stil.*
