# Changelog — Cosmos Cosmic Adventure 2026

Alle wijzigingen volgen [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) en [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

De `/updates/` pagina wordt automatisch uit dit bestand gegenereerd via `npm run updates:build`.

## [0.1.0] — 2026-05-01 — Sprint 1: Scaffolding

### Added
- Multi-entry Vite + TypeScript scaffolding (8 HTML entries)
- Site-architectuur naar RoB-blueprint: `/`, `/play/`, `/prd/`, `/updates/`, `/lore/`, `/support/`, `/press/`, `/thanks/`
- Locked CSS design tokens in `public/assets/css/tokens.css` (Cosmos watercolor palette + Cormorant Garamond + Inter + JetBrains Mono)
- Sticky-nav component met paper-grain overlay en vignette
- Reveal-on-scroll IntersectionObserver in `public/assets/js/site.js`
- Auto-generator `scripts/changelog-to-html.mjs` parseert dit bestand naar de updates-page
- Homepage met hero (Cosmo bobbing tegen Cloud Cathedral background), 3-world showcase, numbers grid, about-strip, CTA banner
- Play-launcher placeholder met sprint-progress-bar (Sprint 1/8 = 13%)
- Updates-page met auto-generated timeline-template + first entry (deze release)
- Support-page met "stardust" gamified counter, 4 tiers (Star Spotter / Hint Globe Sponsor / Bonus Room Builder / Episode Patron), 7-vraag FAQ
- Lore-page met 3-bioom verhaal (Slow Bloom · Inkpool Hollow · Cloud Cathedral) + cast-grid
- Press-page met factsheet, key art-grid en 5 suggested angles
- Thanks-page voor post-donation flow

### Decisions
- Visual: B-hybride (Cosmic Watercolor base + kaleidoscope/fluo-pop/datamosh hallucinatie-pieken)
- Architecture: Dual-canvas (Three.js root + Phaser 4 overlay)
- Scope v1.0: MVP — Episode 1 (10 levels)
- Titelthema: eigen-DNA (geen Tush-cover)
- Enemy roster: 12 types + 1 boss (4 buffer boven minimum)
- Site-laag: vanilla HTML/CSS/JS multi-entry Vite (RoB-blueprint, geen framework)
- Donation: Mollie placeholder voor Sprint 5 activatie; e-mail werkt direct in v0.1.0

### Pipeline
- 8 fal.ai showcase-assets (Cosmo + 4 enemies + 3 backgrounds + logo) — verplaatst naar `public/showcase-assets/`
- gitignore-whitelist toegevoegd voor `cosmos-cosmic-adventure-2026/`
- Eerste push naar `github.com/RichardTheuws/game-master.git`
