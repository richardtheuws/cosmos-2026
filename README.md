# Cosmo's Universe

> *Your Cosmo can visit my forest. My Cosmo can visit your world.*

A new form of collaborative game development — built by people who pair with Claude.

**Live**: [theuws.com/games/cosmos-2026](https://theuws.com/games/cosmos-2026/play/) · **Charter**: [`NORTH-STAR.md`](./NORTH-STAR.md) · **Contracts**: [`UNIVERSE-AUTHORING.md`](./UNIVERSE-AUTHORING.md) · **Integrations & costs**: [`INTEGRATIONS.md`](./INTEGRATIONS.md) · **Substrate version**: 2.0.0 (in flight)

---

## Quickstart — pair with Claude in three lines

Open [Claude Code](https://claude.com/claude-code) in any folder and paste this:

```
Clone https://github.com/RichardTheuws/cosmos-2026 into this folder.
Read NORTH-STAR.md and UNIVERSE-AUTHORING.md.
Then ask me: "shall we build a Universe together?"
```

That's it. Claude will pull the repo, read the charter, and meet you where you are.

If you'd rather start manually:

```bash
git clone https://github.com/RichardTheuws/cosmos-2026.git
cd cosmos-2026
npm install && npm run dev
```

The local dev server opens at `http://localhost:5174/play/`.

---

## What this is

**Cosmo** is a small green being who lives on your screen. He has his own life — he wanders, he sits, he gets distracted, he sleeps if you leave him alone, he gets curious if you tap. He started as a memory from 1992; he became a watercolor painted in the shape of that memory.

**Cosmo's Universe** is the substrate he lives in. Three things at once:

- **A runtime** — Cosmo's rig, his companion-AI, his life-system, room-loading, and the traversal between worlds.
- **A first world** — a watercolor mushroom forest. The entry-Universe. More tomorrow.
- **An open invitation** — any developer can author a new Universe and plug it into the same runtime. Cosmo travels into your Universe; characters from your Universe travel into mine. State persists. The being is the constant. The world keeps growing.

This is **a new form of cooperative game development** — not "we made a game, you can mod it", but "we made a substrate, and the being who lives in it can walk through anyone's imagination". Your Universe doesn't ask permission. It just plugs in.

## Why this exists

Pair-programming with Claude is no longer rare. There is now a real population of developers who build small, weird, well-crafted things in close collaboration with an AI companion. This project is a meeting place for that population — a shared anchor, a shared character, a shared bar.

We are deliberately ambitious about what this can become. A substrate that hosts dozens of authored Universes, all visitable by the same being, each carrying the signature of whoever made it. A network of small worlds with one wandering observer. Something that could not have been made by one person, and could not have been organized by a committee — but can be authored, in parallel, by a hundred people each pairing with Claude on their own corner of the imagination.

Whether one or one hundred Universes ship, the substrate is the same. Whether your Universe lives for one weekend or one decade, Cosmo can visit it. That is the entire ambition.

## How to join

There are three levels of contribution. Pick the one that fits where you are.

### 1 · Visit
Just play. Open the live link, watch Cosmo, see what he does when you stop touching the screen.

### 2 · Author a Universe
You build a self-contained Universe under `universes/<your-name>/` that satisfies the [Universe contract](./UNIVERSE-AUTHORING.md). The contract requires four things:

1. A **background renderer** (Three.js scene module or composition-spec.json)
2. A **room-list + traversal graph** (which Rooms exist in your Universe, how they connect)
3. An **asset manifest** (everything your Universe needs to run, with URLs)
4. A **Cosmo-arrival hook** (how Cosmo enters your Universe — portal, fade, drift, surprise)

That's it. Open a PR titled `universe: <your-name>`. Reviewers engage on brand-fit, contract-correctness, and posture-alignment. The mushroom-forest in `universes/forest/` is the canonical reference.

### 3 · Improve the runtime
Bug fixes, new companion-AI behaviors, new Cosmo capabilities, performance work. Open an issue first describing what and why. The brave-reconsideration principle (NORTH-STAR §4) governs how decisions get made — read that before proposing architectural changes.

## All languages welcome

Code and docs in this repo are in English so the substrate is maximally accessible. **Pull requests, issues, and Universe authoring may be in any language.** Reviewers and contributors are encouraged to converse in whatever language fits the moment. If a Universe's in-world copy is in your native language, that is a feature, not a friction — Cosmo travels through *your* world, not a translated one.

If your Universe README is in your language, leave a 100-word summary in English at the top so other contributors can find their bearings. That is the only language requirement. Everything else is up to you.

## What we are not

- **Not a platform with TOS.** No content moderation policy. PR review enforces brand-fit; Universes that don't compose are forked, not policed.
- **Not a marketplace.** Universes aren't monetized through us. Authors are free to monetize their own Universes if they wish.
- **Not a framework with a marketing site.** It's an open repository with clear documents. The repository *is* the project.
- **Not a committee.** Decisions are authored, then challenged via PR. The Pivot Ledger in `NORTH-STAR.md` records what changed and why.

## Brand contract

Non-negotiable without a Pivot Ledger entry:

- **Visual base**: Hayao×Moebius watercolor; mushroom-cream / moss-sage / sky-wash / faded-rose / ink-aubergine / saffron-glow / forest-deep palette; pop-accents capped at 5%.
- **Voice**: poetic but grounded. The 1992 origin is referenced obliquely, never explicitly.
- **Never**: emojis, placeholder graphics, standard-stock visuals, always-on trippy chaos.

Universes that intentionally deviate from the brand can document the deviation in their own README. Reviewers will engage seriously with the argument.

## P2P — what it means here

The first version of cross-Universe travel is **asynchronous + content-portable**: every Universe is a static deployable, and Cosmo carries his state with him as he travels (mood, memory, traversal history). No realtime peer-to-peer is required for v1.

True realtime P2P — your Cosmo and my Cosmo together in the same Room — is a future possibility, not a near-term commitment. The substrate is designed so it isn't blocked by adding it later (state model is serializable; rooms can host multiple Cosmo instances).

## Tech

Three.js (3D scene, primitive-skeleton rig, post-FX) + Phaser 4 (HUD overlay, scene management) on a dual-canvas. Vite multi-entry build. fal.ai + Suno + ElevenLabs for asset generation. Authored alongside [Claude](https://claude.com/claude-code) as the development companion.

Full transparency on every paid service, current pricing, per-sprint costs, and reusable asset-gen scripts is in [`INTEGRATIONS.md`](./INTEGRATIONS.md). Forks are encouraged to **improve and replace** these integrations — the asset-gen pipelines are first-class artifacts of this project, not internal tooling. Improvements upstream and benefit every Universe author.

## Repository

```
cosmos-cosmic-adventure-2026/
├── NORTH-STAR.md              ← project charter; read first, always
├── CONTRIBUTING.md            ← how to work on this project
├── UNIVERSE-AUTHORING.md      ← how to author a new Universe (the contract)
├── src/                       ← Cosmo runtime (rig, AI, life-system)
│   ├── three/cosmoV2.ts       ← Cosmo rig (primitive skeleton + decals)
│   ├── phaser/entities/       ← AI, agent, onboarding
│   └── ...
├── universes/                 ← Universes live here (mono-repo, PRs add new ones)
│   └── forest/                ← canonical entry Universe
└── public/assets/             ← shared character + brand assets
```

## License

[MIT](./LICENSE). Code and Cosmo's painted assets alike. We ask, but do not legally require, that derivative Cosmos remain visually consistent with the 1992 DNA documented in `NORTH-STAR.md`. Authoring an entirely different character for your Universe is also great — that's what Universes are for.

## Credits

- **Author**: [Richard Theuws](https://theuws.com)
- **Development companion**: [Claude](https://claude.ai/code)
- **Origin**: a night in a year that doesn't need naming

> *Adem mee. Hij blijft niet stil.*
