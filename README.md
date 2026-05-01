# Cosmos Cosmic Adventure 2026

> **Een aquarel-droom met zuignap-handen.**
> 2.5D browser-platformer remake van Cosmo's Cosmic Adventure (Apogee, 1992) als psychedelische Ghibli-Tenniel-Moebius beleving met hallucinaire breekpieken.

**Status**: v0.1.0 · Sprint 1/8 · In active development
**Live**: [theuws.com/games/cosmos-2026](https://theuws.com/games/cosmos-2026/) (vanaf v1.0)
**Repo**: [github.com/RichardTheuws/cosmos-2026](https://github.com/RichardTheuws/cosmos-2026)

---

## TL;DR

- **Gameplay**: 2D platformer met suction-cup wallcling (signature mechanic), 3 HP base, save-anywhere zonder mid-checkpoints, star-collectibles met bonus-room thresholds.
- **Visuele stijl**: Cosmic Watercolor — Ghibli × Moebius × Tenniel-Alice. Hallucinatie-pieken (kaleidoscope op power-ups, fluo-pop op collectibles, datamosh op damage).
- **Tech**: Three.js (3D parallax + post-FX) + Phaser 4 (2D gameplay) **dual-canvas**. WebGPU production. TSL shaders. Vite multi-entry build.
- **Audio**: 12 Suno tracks (folktronica + ambient-koto, eigen-DNA — geen Tush-cover). ElevenLabs Hint Globe voices. Tone.js GrainPlayer voor procedural morphs op DMT-peaks.
- **Scope v1.0**: 1 episode (10 levels), 12 enemy-types + 1 boss. Episodes 2 & 3 als post-launch DLC.

---

## Project structuur

```
.
├── index.html              # Homepage
├── play/index.html         # Game launcher
├── prd/index.html          # PRD showcase (v1.0 spec)
├── public/
│   ├── updates/            # Auto-generated changelog page
│   ├── lore/               # Het Verhaal
│   ├── support/            # Donation page (stardust counter)
│   ├── press/              # Press kit
│   ├── thanks/             # Post-donation
│   ├── showcase-assets/    # fal.ai generated key art (tracked)
│   └── assets/
│       ├── css/tokens.css  # Locked design tokens
│       └── js/site.js      # Reveal-on-scroll + tracking stub
├── src/                    # Game engine (Three.js + Phaser dual-canvas)
│   ├── core/               # Shared globalUniforms, canvas manager
│   ├── three/              # 3D parallax + TSL shaders + cinematics
│   ├── phaser/             # 2D scenes, entities, systems
│   ├── audio/              # Howler + Tone.js bridge
│   └── data/               # Levels, enemies, hint lines
├── scripts/
│   └── changelog-to-html.mjs   # Auto-rendert /updates/ uit CHANGELOG.md
├── research/               # Recon + visie-documenten (5 files)
├── .claude/plans/PRD-v1.0.md
├── CHANGELOG.md            # Bron-van-waarheid voor /updates/
└── VERSION
```

---

## Development

```bash
npm install
npm run dev          # Vite dev server op localhost:5173
npm run build        # tsc + vite build → dist/
npm run preview      # Preview production build
npm run typecheck    # TypeScript check zonder emit
npm run updates:build  # Regenereer /updates/ uit CHANGELOG.md
```

Voor elke nieuwe sprint:
1. Werk de feature af.
2. Update `CHANGELOG.md` met een nieuwe `## [x.y.z] — datum — Sprint N: titel` sectie.
3. Run `npm run updates:build` (gebeurt ook automatisch in `npm run build`).
4. Bump `VERSION`.
5. Commit + push.

---

## Locked Decisions

Zie `.claude/plans/PRD-v1.0.md` voor de volledige spec. Kort:

- **Visual**: B-hybride (Cosmic Watercolor + kaleidoscope/fluo-pop/datamosh)
- **Architecture**: Dual-canvas (Three.js root + Phaser 4 overlay)
- **Scope v1.0**: MVP — Episode 1 (10 levels)
- **Title theme**: eigen-DNA (geen Tush-cover)
- **Enemy roster**: 12 types + 1 boss (4 buffer)
- **Frozen RoB easter egg**: geparkeerd voor E2 (DLC-fase)
- **Site-laag**: vanilla HTML/CSS/JS multi-entry Vite (RoB-blueprint)

---

## AI Pipeline

| Tool | Use |
|------|-----|
| **fal.ai** (Flux Dev/Pro) | Sprites + backgrounds + logo's |
| **Meshy v6 + Blender** | 3D parallax-props + creature-models |
| **Suno** | OST (12 tracks in D-minor) |
| **ElevenLabs** | Hint Globe voices + SFX |
| **Claude Code** | Orchestrator (deze repo!) |

---

## License

(c) 2026 Richard Theuws — Theuws Consulting. All rights reserved.

Cosmo is a homage to Apogee's *Cosmo's Cosmic Adventure* (1992). No claim is made on the original IP.
