# Changelog — Cosmos Cosmic Adventure 2026

Alle wijzigingen volgen [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) en [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

De `/updates/` pagina wordt automatisch uit dit bestand gegenereerd via `npm run updates:build`.

## [0.5.2] — 2026-05-01 — Sprint 5: parallel-team — trampolines, polish, deploy

Vier agents tegelijk: trampolines (5A), Cosmo multi-frame anim test (5B), production deploy (5C), visual polish (5D). Resultaat: cosmos-2026 is **live**.

### 🚀 LIVE op productie
- **https://theuws.com/games/cosmos-2026/** — alle 7 routes HTTP 200
- 87 files / ~19MB FTP upload (~35s)
- Cosmos-card toegevoegd aan `theuws.com/games/` portfolio
- `INVENTORY.md` updated met Cosmos onder "Vlaggenschip Projecten"

### Added (5A trampolines)
- **Trampoline entity** (`src/phaser/entities/Trampoline.ts`) met beat-jump fysica (-820 Y velocity, ~1.8x normal jump), 0.3s cooldown, on-bounce squash-tween, kaleidoscope-spike trigger 1.0
- **Trampoline tile** in level grid: nieuwe `T` legend-character, 2 paren in L1 row 17
- `tile-trampoline.png` (full-scene Flux scene-bias workaround, bottom 25% via `setCrop`)
- `pickup-bounce-burst-cleaned.png` voor on-bounce particle VFX

### Added (5D polish)
- `tile-wall-v2.png` (eindelijk werkend — Flux landscape-bias gefixed met aspect 1024×512)
- `tile-mushroom-v2.png` (close-up mushroom-cap photoreal-then-tinted approach)
- `bg-near-v2.png` lichtere foreground frame voor gameplay-zicht

### Added (5C deploy infra)
- `scripts/postbuild-rewrite-paths.mjs` — herschrijft anchor hrefs en residuele absolute asset paths in `dist/*.html` naar productie-base. Zonder dit breken cross-page navigatie-links op subpath-deploy.

### Changed
- `vite.config.ts` is nu **command-aware** — dev-server blijft op `/`, production-build gaat naar `/games/cosmos-2026/`. Override met `VITE_BASE=/ npm run build` voor root-deploys.
- `package.json` build-script wired postbuild-rewriter aan `npm run build`
- L1Scene preload swap: `tile-wall-v2` + `tile-mushroom-v2` ipv v1
- Slow Bloom biome `bg-near` switcht naar `bg-near-v2.png` met scaleY 0.85

### Sprint 5B image-to-image learnings (productive failure)
- 12 image-to-image attempts (strength 0.55-0.82) → 0/6 pose-shift, 0/6 suction-cup hands
- Diagnose: fal.ai/flux/dev/image-to-image gebruikt input als noise-init, niet als skeletal anchor
- Suction-cup-hands fail is universeel (text-only én image-to-image)
- Workaround voor pose-set: ControlNet/openpose of sketch-to-img (Sprint 6+)
- Workaround voor suction-cups: canonical-fix via Photoshop of masked inpainting eerst
- Frames in `public/assets/sprites/v3/cosmo-walk-*.png` zijn archive-only, NIET wired

### Deploy notes
- Naam-mismatch: lokaal `cosmos-cosmic-adventure-2026`, server `cosmos-2026` (vergt handmatige FTP, `deploy-ftp.sh` gebruikt folder-naam = upload-path)

### Cost
~$0.51 fal.ai (5A: $0.076 + 5B: $0.36 mislukte attempts + 5D: $0.20)

## [0.5.1] — 2026-05-01 — Sprint 4.5 Fase C: Cosmo canonical case study

Cosmo's huidige verschijning was technisch bruikbaar maar miste karakter. De gebruiker speelde Cosmo's Cosmic Adventure in 1992 onder invloed van psychedelica — Cosmo werd onderdeel van die persoonlijke trip-herinnering. Cosmos 2026 is dus geen aesthetic homage maar een herontwerp van een eigen acid-droom. Cosmo moest TE GEK worden + prominenter.

> Die moet echt wel heel duidelijk de 2026 versie van de 'oude' zijn, dat was ook al zo'n trippy ventje met zuignaphanden — Richard, 2026-05-01

### Stap 1 — 6 redesign varianten

We genereerden 6 expliciete bridge-interpretaties van het 1992-DNA naar 2026 cosmic-Moebius. Elk met identieke standing-pose voor 1-op-1-vergelijking.

[grid: /assets/case-study/cosmo-redesigns/cosmo-v1-acid-tenniel.png /assets/case-study/cosmo-redesigns/cosmo-v2-cosmic-hayao.png /assets/case-study/cosmo-redesigns/cosmo-v3-moebius-mainline.png /assets/case-study/cosmo-redesigns/cosmo-v4-pulse-trip.png /assets/case-study/cosmo-redesigns/cosmo-v5-bart-mushroom.png /assets/case-study/cosmo-redesigns/cosmo-v6-wide-eye-astronaut.png "V1 Acid Tenniel · V2 Cosmic Hayao · V3 Moebius Mainline · V4 Pulse-Trip · V5 Bart Mushroom · V6 Wide-eye Astronaut"]

**Kritieke vondst**: Flux Dev kan **NIET text-only zuignap-handen renderen** — 8 van 8 generaties leverden ofwel mensen-vingers ofwel hagedis-klauwen ondanks aggressieve emphasis. Sample-bias > prompt. Workaround: image-to-image of inpainting na text-pass.

### Stap 2 — Richard kiest hybrid

> Hayao met chameleon-eyes, eventueel iets bollere ogen — Richard

We genereerden 4 hybrid-iteraties met chameleon-style bulging eyes. Eerste 2 misten doel (te tame), H3 raakte de roos.

[grid: /assets/case-study/cosmo-redesigns/cosmo-h1-hayao-moebius-suction.png /assets/case-study/cosmo-redesigns/cosmo-h2-hayao-moebius-suction.png /assets/case-study/cosmo-redesigns/cosmo-h3-hayao-chameleon.png /assets/case-study/cosmo-redesigns/cosmo-h4-hayao-chameleon-bigger.png "H1 + H2 Hayao×Moebius (te tame) · H3 chameleon (te gek!) · H4 alt-iteration"]

> H3 is te gek! — Richard

### Stap 3 — Locked canonical

H3 werd canonical: pear-drop Hayao-head + single antenna met faded-rose flower-bulb tip + BIG bulging chameleon-eyes + soft Hayao watercolor body + faded-rose spots + pink-peach moon halo backdrop. BiRefNet'd voor in-game gebruik.

![Locked canonical Cosmo — Hayao×Moebius+chameleon hybride (H3)](/assets/case-study/_LOCKED-REFERENCE.png)

### Added
- `research/visual-references/_COSMO-CANONICAL.png` — Cosmo H3 locked
- `public/assets/sprites/v3/cosmo-canonical-cleaned.png` — BiRefNet-cleaned version voor in-game gebruik
- `cosmo_dna.md` memory-file met de complete 1992-DNA-tabel + Fase C learnings
- L1Scene laadt nu canonical Cosmo voor alle 6 states (multi-frame anim komt via image-to-image in Sprint 5+)

### Changed
- Cosmo display-size 80 → 120px voor "TE GEK + prominenter" eis
- Tail wegcrop nog niet gedaan (text-prompt-bias) — kunnen we negeren door body-crop in Phaser

### Known issues
- 6 cosmo-state textures wijzen naar dezelfde canonical PNG (geen multi-frame anim yet)
- Lizard-tail nog zichtbaar op canonical
- Hands zijn niet specifiek zuignap-vorm (sample-bias) — fix via image-to-image of inpainting in Sprint 5

### Cost
~$0.30 fal.ai (10 character-generaties + 1 BiRefNet)

## [0.5.0] — 2026-05-01 — Sprint 4.5: visuele coherentie-pass + TrippyEventDirector

We zochten een visuele waarheid voor de hele game door 4 keyframe-iteraties van een complete L1-scene te renderen. Elke iteratie probeerde een andere art-direction en we lockten v4 (hybrid v1-cosmic-palette × v3-Moebius-linework) als canonical style-stem.

[grid: /assets/case-study/keyframes/L1-keyframe-v1.png /assets/case-study/keyframes/L1-keyframe-v2.png /assets/case-study/keyframes/L1-keyframe-v3.png /assets/case-study/keyframes/L1-keyframe-v4.png "v1 Pixar-children-book (kawaii drift) · v2 Moebius woodcut (te abstract) · v3 Tenniel woodcut (te dark) · v4 cosmic+Moebius hybrid (LOCKED)"]

> Kies B-hybride (Cosmic Watercolor + kaleidoscope/fluo-pop/datamosh hallucinatie-pieken) — visie-document, locked

Met het v4 keyframe als visuele waarheid genereerden we 22 nieuwe in-game assets allemaal met letterlijk dezelfde style-stem-prefix. Resultaat: ~80% coherentie tussen Cosmo, enemies, tiles, pickups en backgrounds.

### Added
- **TrippyEventDirector** — autonome event-scheduler die elke 8-15s een diëgetisch trippy event vuurt: cosmic-eclipse / spore-cloud / synesthesia-flash / reality-tear / gravity-wobble / star-rain / mushroom-pulse. Weighted-random, 4s cooldown
- **Canonical style-stem** locked in `research/visual-references/_STYLE-STEM.md` op basis van keyframe v4 (hybrid Moebius woodcut + cosmic-saturated palette)
- **22 nieuwe in-game assets** allemaal met letterlijk dezelfde style-stem: 6 Cosmo frames + 3 enemies + 5 painted tiles + 4 painted pickups + 4 parallax-layers
- **4-laagse parallax** (sky / far / mid / near) ipv 3 — biome-config supports optional sky-layer voor extreem diepe cosmic backdrop
- `cosmo_dna.md` memory voor 1992→2026 character-bridge eis

### Changed
- L1Scene preload + populateLevel switcht van procedural Graphics-tiles naar painted PNG tiles
- Star + HintGlobe entities accepteren textureKey parameter — gebruiken painted pickup-art ipv canvas-graphics
- Slow Bloom biome wijst nu naar `slow-bloom-v2/` met de nieuwe 4 layers (cosmic moon-nebula sky, ink-aubergine mountains, glowing magenta-mushroom mid, foreground vines)
- Cosmo display-size 80x80 met aangepaste body-offset voor de painted 1024 sprite

### Visuele richting
v4 keyframe locked: Moebius/Tenniel/Miyazaki linework + cosmic-luminous saturated watercolor palette + paper grain. NIET dusk, NIET kawaii. Het 1992 origineel komt door Cosmo's design heen (moss-sage groen + faded-rose vlekken + antenne met flower-tip + suction-cup-feet).

### Memory
- `visual_coherence.md` uitgebreid met diepte-eis (4 parallax-lagen) + onverwachte-events-eis (TrippyEventDirector)
- `asset_learnings.md` met cosmos-specifieke gotchas: tile-asset trap, BiRefNet niet voor landscapes, fal.ai queue quirks
- `_STYLE-STEM.md` met per-asset-rider templates (sprite / tile / pickup / background-layer)

### Known issues (volgende sprint)
- tile-wall + tile-mushroom v1 werden full landscapes ondanks rider — v2-retry-pattern gevalideerd
- Cosmo's suction-cups landden op voet ipv hands — Fase C (Cosmo case study) gaat dit fixen
- 3/4 backgrounds hebben tiny human-figures ondanks `NO characters` — bekend Flux-bias
- HUD pill version-string nog v0.3.0 — fix volgende sprint

### Cost
~$0.77 fal.ai (22 generaties + 18 BiRefNet + 1 v2-retry)

## [0.4.0] — 2026-05-01 — Sprint 4: post-FX stack — constant trippy

### Added
- **`pmndrs/postprocessing` EffectComposer** stacked op de Three.js parallax renderer — elke frame gaat door post-FX voor render
- `src/three/postFX/postFX.ts` — orchestrator met 3 effect-passes (UV transforms / per-pixel / convolution + composite)
- `src/three/postFX/kaleidoscope.ts` — custom radial-mirror UV shader (N-fold symmetry), strength-driven
- `src/three/postFX/fluidDisplacement.ts` — custom curl-noise 2D-hash displacement, time-driven gentle wobble
- `src/three/postFX/datamosh.ts` — custom horizontal stripe-shift + RGB channel-split, voor damage-pulse

### Permanent base stack (constant-trippy)
- **Bloom** intensity 0.7-1.15 met breathing sine, mipmap radius 0.85 — saffron sun + stars + globes glowen continu
- **ChromaticAberration** offset 0.005-0.009 met radialModulation — cyan/magenta fringing op alle randen
- **FluidDisplacement** amplitude 0.022 frequency 2.6 — wereld wiggelt zachtjes als waterverf in beweging
- **Kaleidoscope** ambient strength 0.16-0.24 met angle rotatie 0.12rad/s — subtiele constante 8-fold symmetry-shimmer
- **Vignette** darkness 0.55, offset 0.28
- **Noise** overlay opacity 0.32 — paper-grain feel constant
- **Datamosh** strength 0 default; spike to 1.0 on damage, decays over 200ms

### Triggered peaks
- Star pickup → `kaleidoTrigger += 0.35` (kaleido pop). Elke 5e star → `kaleidoTrigger = 1.0` (volle peak)
- Spike contact → `damagePulse = 1.0` → datamosh-tear horizontale stripes, decay 200ms

### Changed
- Bg-mid + bg-near layers terug naar `blend: normal` (raw png's hebben transparant gebied al)
- ParallaxScene render gebruikt nu `composer.render()` ipv `renderer.render()`

### Pipeline note
Twee EffectPass-conflicten opgelost door drie aparte passes:
- pass 1: UV-transform (fluid + kaleido)
- pass 2: per-pixel (datamosh)
- pass 3: convolution + composite (chroma + bloom + vignette + noise)

## [0.3.1] — 2026-05-01 — Sprint 3.1: per-biome parallax + visuele polish

### Fixed
- **Parallax-stack toonde 3 verschillende biomes door elkaar** (cathedral / jungle / cave). Refactor: per level wordt nu **één biome** geladen — drie layers (far / mid / near) van DEZELFDE scene. PRD §5.3 conform
- Mushroom-tile zag eruit als dobbelstenen (3 kleine roze stippen). Vervangen door painterly cream-band met faded-rose underglow en flush-zijden voor naadloze tile-merge
- Ground-tile box-grid weggehaald; vervangen door grass-band variatie + sub-ground hint
- Wall-tile vertical wood-grain band ipv volledige rand-outline
- Black backdrop wanneer mid/near layers transparant zijn — ambient clear-color is nu opaque biome-tint

### Added
- `src/data/biomes.ts` — 3 biome configs (Slow Bloom / Inkpool Hollow / Cloud Cathedral) met per-layer parallax-multipliers en LEVEL_TO_BIOME mapping
- 3 nieuwe Slow Bloom backgrounds via Flux Pro: `bg-far.png` (sky + mountains), `bg-mid-cleaned.png` (cream mushroom canopy met BiRefNet alpha), `bg-near-cleaned.png` (faded-rose foreground frame met BiRefNet alpha)
- 3 nieuwe Inkpool Hollow backgrounds (bonus generation) — staan klaar voor S5 wanneer L4-L6 levels landen
- L1Scene gebruikt nu de echte FalSprite Cosmo-frames (walk-1/walk-2/walk-3 + jump-up + jump-fall + cling) met per-state texture-swap

### Changed
- ParallaxScene API: `loadBiome(biome)` ipv hardcoded `loadDefaultBiome()`. Biome wordt geconfigureerd in main.ts en kan straks dynamisch wisselen tussen levels.

## [0.3.0] — 2026-05-01 — Sprint 3: L1 + asset pipeline + audio

### Added
- **L1 "First Steps"** — Bloomroot Veld biome speelbaar op `/play/`. 60×22 grid-level uit `src/data/levelL1.ts` met decoder voor cosmo-spawn, stars, hint-globes, walls, mushroom-platforms, dirt, ground, spikes
- `src/phaser/entities/Star.ts` — bobbing fluo-pop Dewdrop met magenta+lime halo, collect-tween + cleanup
- `src/phaser/entities/HintGlobe.ts` — pulsing saffron+sky-wash orb met proximity-trigger en linger-latch tegen spam
- `src/audio/sfxBus.ts` — Howler-backed SFX + voice playback, lazy-load, silent-fail bij missing files
- `src/phaser/scenes/L1Scene.ts` — eerste echte level scene met SFX-wired collisions, hint-tekst-overlay (Cormorant Garamond italic), ↑↓ camera-pan-offset, debug-HUD met live state

### Audio (8 SFX + 3 voices via ElevenLabs)
- SFX: cling/jump/stomp/hurt + pickup-star/bonus + globe-trigger + bonus-warp (totaal ~$0.37 API kosten)
- Voices: 3 NL Hint Globe lines met Sarah voice (`EXAVITQu4vr4xnSDxMaL`, multilingual_v2, stability 0.6 / similarity 0.8 / style 0.4)
- Suno-prompts gedocumenteerd in `public/assets/audio/music/_SUNO_PROMPTS.md` — 12 tracks D-minor, mapped naar Surface/Hollow/Cathedral biomes
- `_HOWLER_CONFIG.json` met 23 logical-name → file mappings, levelMusicMap, globeVoiceMap
- ElevenLabs sound-generation min-duration is 0.5s (niet 0.3) — SFX-targets aangepast

### Changed
- SandboxScene verwijderd — vervangen door L1Scene als hoofd-scene
- Cosmo controller wired naar sfx-bus: cling-pop / jump / hurt vuren via Howler
- play/index.html HUD-pill nu `v0.3.0 · L1 First Steps`

### Fixed
- Above-fold IntersectionObserver fired niet voor `[data-reveal]` items in viewport — toegevoegd `requestAnimationFrame` first-paint pass + threshold 0.05

### Pipeline
- 6 Cosmo animation-frames staan klaar in `public/assets/sprites/` voor S4 atlas-pack
- Star + HintGlobe entities gebruiken procedural Graphics-textures (geen externe assets nodig)

## [0.2.0] — 2026-05-01 — Sprint 2: Cosmo controller + dual-canvas

### Added
- Three.js + Phaser 4 dual-canvas live op `/play/` — Three.js draait 3-layer parallax achter, Phaser overlay-canvas met transparante background voor 2D gameplay
- `src/core/globalUniforms.ts` — gedeelde state tussen renderers (time, audioFFT, cosmoX/Y/state, kaleidoTrigger, damagePulse)
- `src/core/canvasManager.ts` — single-rAF orchestrator met decay-uniform-helper
- `src/core/inputController.ts` — keyboard met just-pressed-edge-detection voor jump en bomb
- `src/three/parallaxScene.ts` — Three.js OrthographicCamera + 3 textured planes met parallax-multipliers (0.18 / 0.42 / 0.78)
- `src/phaser/entities/Cosmo.ts` — Cosmo controller met state-machine (idle/run/jump/fall/cling/damage/death), suction-cup wallcling, coyote-time, stomp-bounce, i-frames
- `src/phaser/scenes/SandboxScene.ts` — test-arena met procedural tile-textures, ground/walls/stair-steps/high-platform, debug-HUD overlay
- `src/main.ts` — boot-flow met dev-mode `window.cosmos` exposure

### Gameplay
- Suction-cup wallcling werkend — `body.velocity.y > -50` + `!onFloor` + side-touching = cling met `CLING_GRAVITY` 220
- Walljump fires van cling-state met `WALL_PUSHOFF_X` 230 en `WALL_CLIMB_VELOCITY` -320
- Run-speed 200, jump-velocity -460, gravity 1300 — strakke arcade-feel zonder Sonic-acceleration

### Visual
- Procedurele Cosmo placeholder (moss-sage met saffron eye-glow + faded-rose antenna-tip) — 1:1 body-texture match
- Procedurele tile-set (ground sage / walls aubergine / stairs faded-rose / high-platforms saffron)
- Three.js parallax laadt automatisch 3 showcase-backgrounds (cathedral / jungle / cave)

### Fixed
- Body-offset mismatch op cosmo-hero.png (1024×1024 texture vs 28×36 body) opgelost door procedural texture in S2
- `state === jump` werd direct overschreven door post-frame on-floor-check — nu pas overschreven als velocity.y >= 0
- Vite `allowedHosts: true` toegevoegd zodat MCP browser-tests via `host.docker.internal` werken

### Pipeline
- 6 nieuwe Cosmo animation-frames gegenereerd via fal.ai (`public/assets/sprites/cosmo-walk-1/2/3`, `cosmo-jump-up`, `cosmo-jump-fall`, `cosmo-cling`) — staan klaar voor Sprint 3 atlas-pack
- FalSprite gebleken niet als hosted fal.ai endpoint te bestaan; teruggevallen op individuele Flux Dev frames met BiRefNet remove-bg
- 4 nieuwe lessen genoteerd in `shared/reference_asset_gen.md` (FalSprite-status, anti-blur prefix, profile-side-view-wint, tekst-only pose-limits)

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
