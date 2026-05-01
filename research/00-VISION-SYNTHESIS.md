# Cosmos Cosmic Adventure 2026 — Vision Synthesis

**Datum**: 2026-04-30
**Status**: Synthese van 3 recon-agents — input voor PRD
**Vorm**: 2.5D hybrid platformer (2D gameplay-plane + 3D parallax + heavy post-FX)

---

## TL;DR — wat we weten

1. **Het origineel** is een 30-level platformer (3 episodes × 10 levels) met één **signature mechanic** (suction-cup wallcling), **3 HP base**, **save-anywhere zonder mid-checkpoints**, **Bobby Prince soundtrack** met ZZ Top "Tush" titelthema, en een **plot-twist ending** (ouders waren nooit in gevaar — Disney World-trip). Engine-DNA: 8×8 tiles, 16-color EGA, 3-layer parallax, voorloper Duke Nukem II.

2. **De stack 2026** centreert op **Three.js r178-r180 + TSL + Phaser 4 + pmndrs/postprocessing**, met **FalSprite** als killer-fit voor onze fal.ai-pipeline en **Pavel Dobryakov's fluid sim** voor "lucht smelt"-momenten. WebGPU is production-ready, maar pin op stabiele Three.js versie. **Architectuur-vraag staat nog open** (zie keuze-vraag 2 onder).

3. **Visual direction**: 3 varianten op tafel. Asset Generator beveelt **Variant B "Cosmic Watercolor"** aan als basis, met **gerichte invaten van A** (kaleidoscope op power-ups, fluo-pop op collectibles) en **C** (datamosh-tear bij damage). Argument: portfolio-differentiatie — A en C overlappen met RoB neon en 3D-landing CRT-glitch. **Aquarel + ink linework is wat AI in 2026 nog slecht doet** — dus onderscheidend wanneer goed gedaan.

---

## Wat dit een "beleving" maakt (creatieve thesis)

Het origineel was een **leuke jaren-90 platformer met zuignap-handen**. Onze 2026-versie wordt een **psychedelische droom met zuignap-handen** — zelfde core-mechanic, totaal andere zintuigelijke laag. De 2.5D hybrid form is precies wat dit mogelijk maakt: het **2D-gameplayplane blijft strak en eerlijk** (Cosmo's identiteit blijft "tactiel zuignap-platforming"), terwijl de **3D-parallax + post-FX laag breekt en bloeit** rond hem heen.

De spanning zit in de **breuk tussen rust en hallucinatie**. We bouwen geen constante DMT-aanval — we bouwen een aquarel-Ghibli-droom die **kantelt** op power-ups, boss-intro's, damage-momenten en bonus-room transities. De wereld is zacht-aquarel tot hij dat niet meer wil. Op de bonus-room-warp valt het scherm in een fractal-tunnel; bij damage scheurt de tape; bij het oppakken van een Dreamgem floept het volledige palet 1 frame open in fluorescent magenta.

Dit is **Alice in Wonderland in vorm, niet in narratief**. We houden de **Cosmo-plot** (familie naar Disney-equivalent, valse-alarm-blob, plot-twist) intact. Het is Cosmo-DNA met een Tenniel-pen en een Moebius-bril.

---

## Iconic Cosmo-DNA — wat blijft non-negotiable

Uit recon-rapport, gerangschikt naar prioriteit:

| # | Element | Wat we doen in 2026-versie |
|---|---------|----------------------------|
| 1 | **Suction-cup wallcling** | Behoud exact: alleen vertical walls, niet ceilings. Verticale wallclimb via spring+cling+spring. Tactile "plop" SFX bij elke cling. Three.js camera mag nooit het 2D collision-plane breken. |
| 2 | **Look-up/down camera pan** | Behoud — sterren liggen vaak boven schermrand. Pijltjes omhoog/omlaag = camera pan. |
| 3 | **3 HP, max 5 via cheeseburgers** | 2 verborgen cheeseburgers per episode → +1 max HP. Save-anywhere via slots, geen mid-level checkpoints. |
| 4 | **Stars + bonus rooms (25/50)** | Star-collectibles met thresholds voor bonus-rooms. Geen tijdslimiet in bonus rooms. |
| 5 | **Hint Globes** | Zwevende sprekende bollen — moderniseren met ElevenLabs voice-lines (echte stem in plaats van text-popup). 12.800 punten als je ze opblaast. |
| 6 | **Bobby Prince soundtrack-stijl** | Suno-prompts die funky-rock + banjo + AdLib-character kanaliseren. **Tush-cover als titelthema is niet-onderhandelbaar** — we maken een 2026-remix in dezelfde toonsoort. |
| 7 | **Final-boss-as-blob + plot-twist** | Ouders blijken nooit in gevaar. Komische ontknoping. Cutscene via Theatre.js. |
| 8 | **Frozen Duke Nukem easter egg** | E2 L7. **Optie**: vervang door cross-over met onze eigen portfolio (frozen RoB-eenheid? frozen Last Call cocktail-bender?). Discussie open voor de PRD. |

**Designrisico expliciet**: Three.js camera mag niet "draaien" in 3D rondom de 2D-plane. Strakke 8×8-grid feel onder de Meshy-3D parallax — model: **New Super Mario Bros U**.

---

## Drie grote keuzes voor de PRD

### Keuze 1: Visuele direction (definitief)

| Optie | Wat | Pro | Contra |
|-------|-----|-----|--------|
| **B-puur** | Cosmic Watercolor — Ghibli × Moebius, aquarel + ink linework, paper grain dither + soft bloom + fluid distortion lite | Portfolio-onderscheidend, vakwerk-vooraan, eerlijk aan Tenniel-bron, AI-image-models doen dit slecht (= unieke output) | Kan "te gezellig" worden zonder hallucinaire druk |
| **B-hybride** *(aanbeveling Asset Gen)* | B als basis + kaleidoscope op power-ups (5s) + fluo-pop op collectibles/HUD (5% pixel-budget) + datamosh-tear bij damage (200ms) | Behoud rust + hallucinaire piek, breuk = beleving, beste van beide | Meer technische complexiteit (3 effect-systemen + 1 base-stijl) |
| **A-puur** | Saturated Dream — Lisa Frank × Yume Nikki, fluo-neon | Direct visueel overweldigend, hyperpop-audio matcht | Vierde neon-game in portfolio, geen onderscheid van RoB |
| **C-puur** | Glitchwave Synth — VHS, scan-lines, vaporwave | Sterke aesthetic, retro-futurisme | Overlapt met 3D-landing CRT-glitch, "tape kapot" thema is op het randje van clichee |

**Mijn aanbeveling**: **B-hybride**. Dit is precies waar onze pipeline (fal.ai + Meshy + Suno + ElevenLabs) tot z'n recht komt: aquarel-aesthetic (fal.ai Flux Pro) + 3D parallax (Meshy) + Hisaishi/BoC-muziek (Suno) + voiced Hint Globes (ElevenLabs) — met de 3 effect-pieken (kaleidoscope/fluo/datamosh) als technisch tour-de-force.

---

### Keuze 2: Architectuur

| Optie | Wat | Pro | Contra |
|-------|-----|-----|--------|
| **A: Dual-canvas** | Three.js als root (3D parallax + post-FX) + Phaser 4 op tweede canvas voor 2D gameplay. Gedeelde uniforms (time, audio-FFT) via TSL. | Beste-van-beide-werelden, max effects-capability, schoon scheidingsmodel gameplay/visuals | Complexer te orkestreren, sync-overhead, debugging is dubbel |
| **B: Phaser-first** *(aanbeveling tooling-recon als simpler pad)* | Phaser 4 als hoofd-engine met ingebouwd Filter-systeem (Bloom/Glitch/ColorMatrix). Three.js alleen als background-pass voor 3D parallax. | Simpler bouwen, 1 engine, Phaser 4's nieuwe filter-stack doet 80% van post-FX out-of-the-box | Minder flexibel voor TSL-shaders, fluid sim porting wordt lastiger, geen WebGPU-pad |
| **C: All-Three.js** | Geen Phaser. Vanilla Three.js met handmatige 2D collision + sprite-systeem. Pixi-achtig op render-target voor sprites. | Maximaal technisch elegant, 1 renderer, full TSL toegang | We bouwen Phaser-features (tilemap, physics, animaties) zelf opnieuw — scope-balloon |

**Mijn aanbeveling**: **A: Dual-canvas**. Argument: de "beleving" zit precies in de 3D-laag die we volledig willen kunnen sturen (TSL-shaders, fluid sim, music-reactive uniforms). Phaser 4 voor de 2D-gameplay is een gedragen keuze (we krijgen tilemap, physics, sprite-systeem cadeau). De sync-overhead is werkbaar — beide canvases delen `requestAnimationFrame` en een `globalUniforms` object.

Phaser-first (B) is verleidelijk voor snelheid, maar als de 3D-laag gewoon "een Three.js background-pass" wordt, verliest hij precies de hallucinatie-controle die deze game uniek maakt.

---

### Keuze 3: Scope v1.0

| Optie | Wat | Tijdschatting |
|-------|-----|---------------|
| **MVP — 1 episode (10 levels)** | Alleen E1 "Forbidden Planet" (jungle/forest/ghost-haunt). Volledige mechanics-set, 1 boss, 1 bonus-room, 1 cheeseburger-rescue (max-HP), Hint Globes met voices, Theatre.js cutscene-intro + ending. | 6-8 sprints |
| **Mid — 2 episodes (20 levels)** | E1 + E2 (Forbidden Planet + Inside the Creature). Twee biome-werelden, twee bonus-rooms, twee cheeseburger-finds, Duke Nukem (of portfolio-cross-over) easter egg. | 12-15 sprints |
| **Full — 3 episodes (30 levels)** | Origineel volledig. Drie biomes, drie bonus-rooms, complete plot-twist ending. | 18-24 sprints |

**Mijn aanbeveling**: **MVP — 1 episode**. We hebben 28 andere games in portfolio die parallel onderhouden worden. Een polished 10-level versie met onze full asset-pipeline (fal.ai sprites + Meshy 3D + Suno OST + ElevenLabs voices + 3 visual effect-pieken) is **al een van de meest ambitieuze browsergames die we ooit hebben gemaakt**. Episode 2 en 3 worden vervolgens content-uitbreidingen (DLC-stijl) — dat geeft ook een gezond release-momentum.

Als je full-scope wilt direct: prima, maar dan reken op een 6-maanden-actief-werk project naast RoB. Dat moet een bewuste keuze zijn, geen ambitie-bias.

---

## Tech-stack lock-in (na keuze 2)

Vooronderstelt **Keuze 2 = A (Dual-canvas)**. Pas aan als je B of C kiest.

| Laag | Tool | Versie |
|------|------|--------|
| 3D root renderer | Three.js (WebGPURenderer) | r178-r180 (pin) |
| Shader DSL | TSL (Three Shader Language) | bundled with Three.js |
| 2D gameplay engine | Phaser 4 | stable (april 2026) |
| Post-FX stack | pmndrs/postprocessing | latest |
| Fluid sim | Pavel Dobryakov port | manual integration |
| Cinematics | Theatre.js | 0.7+ |
| Sprite generation | FalSprite (fal.ai) | latest |
| Sprite atlas-pack | free-tex-packer-cli | latest |
| 3D models | Meshy v6 + Blender (bestaand) | n.v.t. |
| Audio playback | Howler.js | 2.2+ |
| Procedural audio | Tone.js (GrainPlayer) | 15+ |
| Music-reactive bridge | Audio Shader Studio FFT-pattern | reference, niet als dep |
| Bundler | Vite | latest stable |
| Language | TypeScript | strict mode |
| Physics (optioneel) | Rapier (via Phaser, niet R3F) | latest |

**Niet adopted**: R3F (we hebben geen React elders), Bevy WASM (bundle te zwaar), Kaboom (te beperkt), Spine (commercial — gebruik LoongBones als we skeletal nodig hebben).

---

## Asset-pipeline (samenvatting)

```
fal.ai Flux Dev/Pro          →  BiRefNet remove-bg     →  free-tex-packer-cli  →  Phaser atlas
(sprites + backgrounds)         (transparante PNG's)      (atlas + JSON)          (in-game)

FalSprite                    →  spritesheet PNG + JSON →  Phaser animations
(prompted character anims)      (grid + actions)          (.play("walk-right"))

Meshy v6                     →  Blender cleanup        →  GLTF                 →  Three.js parallax
(3D parallax props)             (poly-budget per layer)   (compressed)            (instanced meshes)

Suno                         →  Howler.js loops        →  Tone.GrainPlayer     →  TSL FFT-uniform
(OST + boss-stingers)           (static playback)         (DMT-peak morphs)        (music-reactive shaders)

ElevenLabs                   →  Howler.js sprites      →  Hint Globe trigger
(Hint Globe voices)             (one-shot SFX)            (proximity-based)
```

---

## Wat ik nu nodig heb van jou

**Drie korte keuzes** zodat ik de PRD kan schrijven:

1. **Visual direction**: B-puur, **B-hybride** (mijn aanbeveling), A-puur, of C-puur?
2. **Architectuur**: **A Dual-canvas** (mijn aanbeveling), B Phaser-first, of C All-Three.js?
3. **Scope v1.0**: **MVP 1 episode** (mijn aanbeveling), Mid 2 episodes, of Full 3 episodes?

Plus één optionele:
4. **Frozen Duke Nukem easter egg**: behouden als-is, of cross-over met portfolio (RoB-eenheid / Last Call cocktail-bender / iets anders)? Niet blokkerend voor PRD.

Zodra je 1+2+3 beantwoordt schrijf ik **PRD v1.0** met level-architectuur, sprint-breakdown, asset-budget, milestones.
