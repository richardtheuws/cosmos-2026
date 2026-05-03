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

### Spatial model: ROOM → AREA → UNIVERSE

The world is structured in three nested scales. This is the canonical model; everything we build slots into it.

- **ROOM** — the focused scene Cosmo inhabits right now. One screen, fully alive. Cosmo can be at full presence here, walking, jumping on a trampoline, exploring small interactables. Sims-like density: a single room is *packed* with little side-quests, side-activities, things to discover. The current view of the mushroom forest *is* a Room, but with full movement instead of a fixed framing.
- **AREA** — a cluster of Rooms connected by a psychedelic path. The path itself is its own experience (not a loading screen). Walking the path is a thing you do, with its own feel, lighting, sounds. An Area has a coherent mood; its Rooms vary that mood.
- **UNIVERSE** — a top-level container holding multiple Areas. Each Universe has its own identity, palette, rules. The mushroom-forest Universe is the first.

### Future scale: open universes
Long-horizon: **other (Claude) devs are invited to hook in and add their own Universes.** This is a deliberate architectural commitment that shapes how we build now — internal data models, world-loading, transitions, and the Cosmo rig itself stay generic enough to host third-party Universes without invasive changes. We're not building a game; we're building a substrate for an ever-growing set of small worlds with one companion who can travel between them.

### The forest (current)
- Watercolor cosmic-mushroom forest, soft pastel cosmic horizon — the entry Room of the entry Area of the entry Universe.
- This is **the entry point**, not the destination.

### What "expansion" means
Expansion happens at every scale:
- **Inside a Room**: more side-quests, more interactables, more small lives. Density.
- **Inside an Area**: more Rooms + the psychedelic paths between them.
- **Inside the Universe**: more Areas + how Cosmo moves between them (traveling itself is content).
- **Beyond**: Universes from other authors, plugged into the same Cosmo + companion-AI scaffolding.

The forest will not be replaced. Cosmo will simply learn to walk farther.

### Primary interaction loop (locked)
**The trampoline.** A regular trampoline, in the room. Cosmo can walk to it and jump on it. He loves it. The user loves watching him love it. They keep coming back. This is the canonical "delight loop" — every Room should have at least one of these (not always literally a trampoline, but its analog: a small, juicy, repeatable joy).

### What's possible (seeds, not roadmap)
- Canopy / sky-Room above the forest
- An Area of an ink-ocean
- A village Universe with multiple small beings
- A dream-Area Cosmo enters when he sleeps
- Seasons / moods that wash over existing Rooms
- A second companion who joins him in a specific Room
- Universes contributed by other authors

We hold none of these as roadmap. They are seeds. The future will tell us which ones grow.

### Visual language (locked, do not re-ask)
The current vibe and color palette are exactly right and **not subject to re-asking**:
- Hayao×Moebius watercolor base
- Mushroom-cream / moss-sage / sky-wash / faded-rose / ink-aubergine / saffron-glow / forest-deep
- Pop-accents (max 5%): pop-magenta / pop-lime / pop-cyan
- Calm baseline + weirdness on event-pieken

Do not propose pivots to "bolder pop", "graphic novel", "anime", or any style shift. The brand answers the brief. Future questions about visuals must be **implementation-concrete** (which crop, which dimension, which decal-region) — not "which mood".

## 3b. The collaboration substrate (open-universes)

This project is **deliberately authored as a substrate** for other developers to plug into. The repo is GitHub-public from day one and structured for external contribution.

### Who we're building this with
**Claude game devs** — developers who, like Richard, build alongside Claude as their pair-development companion. This population is real and growing. The project is an open invitation: bring your own Universe, plug it in, watch your Cosmo visit my Forest while my Cosmo visits your World. *That sentence is the entire pitch.*

This is not floaty. It is a concrete technical proposition:
- **Cosmo is portable.** His rig (`CosmoV2Builder`) and state (mood, inventory, traversal-history) live in a shared module. Any Universe can host him.
- **Universes are pluggable.** Each Universe is a self-contained module that satisfies a documented contract (background, room-list, traversal-rules, asset-pack). Universes can be authored, deployed, and shared independently.
- **Travel between Universes is a first-class mechanic.** Not "load a different game" — Cosmo walks (or drifts, or dreams) from one Universe into another, his state preserved.

### What "P2P" means here (initially)
The first version of cross-Universe travel is **asynchronous + content-portable**: Universes are static deployables, Cosmo carries his state (localStorage or signed token) when he travels between them. No realtime peer-to-peer required for v1.

True realtime P2P (your Cosmo and my Cosmo in the same Room at the same time) is on the long horizon as a possibility, not a near-term commitment. We design the substrate so it's *not blocked* by adding it later (state model is serializable; rooms can support multiple Cosmo instances).

### What contributors get + give

**Get**:
- The CosmoV2 rig + companion-AI + life-system as a dependency they don't have to build
- A documented Universe contract with examples
- A canonical brand-lock so their work composes visually with the rest
- The `brave-reconsideration` working method as a shared posture

**Give**:
- A Universe that satisfies the contract
- Adherence to the brand contract (or a documented intentional deviation, with rationale)
- The same posture: pivots are announced, sunk cost is not an argument, vision is editable

### What we are NOT
- Not a platform with TOS and content moderation. The repo enforces brand contract via PR review; Universes that don't compose are forked, not policed.
- Not a marketplace. Universes are not monetized through us.
- Not a "framework" with a marketing site. It's an open repository with clear documents.

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

### 2026-05-03 — Public substrate for Claude-dev collaboration
Project promoted from "Richard's game" to **a substrate any Claude-dev can plug a Universe into**. Cosmo + companion-AI + room-runtime are shared dependencies; Universes are external authored modules satisfying a documented contract. The pitch is one sentence: *your Cosmo can visit my forest, my Cosmo can visit your world*. P2P scope for v1 is **asynchronous + content-portable** (state travels with Cosmo, Universes are static deployables) — true realtime co-presence is reserved as a future possibility but not a near-term commitment. Repository becomes GitHub-public-first: README rewrite, CONTRIBUTING.md, UNIVERSE-AUTHORING.md, Universe contract spec, issue templates. We are not a platform; we enforce brand contract via PR review, not policy.

### 2026-05-03 — World model: ROOM → AREA → UNIVERSE
Vision sharpened mid-Wave-20a. The world is now formally a three-scale nested model: **ROOM → AREA → UNIVERSE**. A Room is the immediate Sims-dense scene Cosmo inhabits, full-movement, packed with side-quests; an Area is a cluster of Rooms connected by traversable psychedelic paths; a Universe is a top-level container holding Areas. Long-horizon: **other Claude devs invited to author their own Universes**, plugged into the same Cosmo + companion-AI scaffolding — we are no longer building a game, we are building a substrate. Primary delight-loop locked: a regular trampoline Cosmo walks to and joyfully jumps on (and you watch him want to keep doing it). Visual language locked at the current Hayao×Moebius watercolor + 1992-DNA palette — future questions about visuals must be implementation-concrete, not mood-shifting. Wave 20a (CosmoV2 builder) is unaffected — Cosmo himself is the same being. Wave 20b adds the first Room with the trampoline. Wave 21+ formalizes Area-paths and the Universe plug-in interface.

### 2026-05-03 — Cosmo v2 hybrid rebuild (Wave 20)
After three consecutive rig-fix attempts (v1.5.0/1.5.1/1.5.2) failed to fully eliminate Cosmo's eye-melting, we reconsidered the *entire* rig. The Meshy-imported GLB had structurally bad weights and out-of-place eye-bones; patching it was Sisyphean. Decision: replace the GLB with a primitive-skeleton (Three.js Object3D bones) wearing painted-texture decals (fal.ai watercolor PNGs). Honors the existing `cosmo-animation-spec.json` line that always said `"implementation": "procedural-object-transforms"` — we just hadn't actually built it that way. Architecture in `.claude/brainstorm/wave20/01-cosmo-v2-architecture.md`. Wave 19b (Life System + mic-input) is paused; it will build on the new rig.

**Locked choices (2026-05-03)**:
- *Cutover*: hard cutover on Wave 20a deploy. v1 GLB-rig is removed; no parallel feature-flag.
- *Silhouette*: capsule body, kid-alien proportions — preserves Sprint 16A LoRA-locked DNA.
- *Decal-style*: strict Hayao×Moebius watercolor — full visual continuity with v1.5.x lore + landing pages.

These choices favor brand integrity over experimentation. They are revisitable per §4 if a future wave shows them limiting.

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
