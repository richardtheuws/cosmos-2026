# Tooling Scan — 30 april 2026
**Project**: Cosmos' Cosmic Adventure 2026 (2.5D psychedelische platformer)
**Scope**: cutting-edge, browser-deployable, actief maintained tools voor onze stack.

---

## 1. 2D sprite engines / platformer kits

### Phaser 4 (RC7 → stable, maart-april 2026)
- Repo: https://github.com/phaserjs/phaser
- Pitch: "Biggest release ever" — node-based WebGL renderer, SpriteGPULayer doet 1M sprites in 1 draw call.
- Waarom voor ons: Unified Filter system (Bloom, Vignette, ColorMatrix, GradientMap, Quantize, Wipe, Pixelate) past *exact* op de "trippy" stijl. setLighting(true) per sprite voor self-shadows. AI-ready met Claude Code skills files.
- Caveats: API dichtbij v3 maar plugin-ecosysteem moet bijtrekken. Geen native WebGPU pad — WebGL2 only (voor nu).

### PixiJS v8.16+ (feb 2026)
- Repo: https://github.com/pixijs/pixijs
- Pitch: WebGPU als core paradigm + WebGL2 fallback, lightweight 2D renderer.
- Waarom voor ons: Als alternatief voor Phaser 4 wanneer we *meer renderlaag* en *minder framework* willen — handig als we Three.js voor de 3D-laag draaien en Pixi enkel voor de gameplay-plane.
- Caveats: PixiJS team raadt zélf nog WebGL aan voor productie wegens browser-inconsistenties op WebGPU.

### Excalibur.js v0.30+
- Repo: https://github.com/excaliburjs/Excalibur
- Pitch: TypeScript-first, klasse-OOP zoals Unity/Godot, ECS optie ingebouwd.
- Waarom voor ons: Sterk type-systeem, ingebouwde tilemap + physics. Goede fit als we ECS-architectuur willen (à la Reign of Brabant bitECS pipeline).
- Caveats: Kleinere community dan Phaser, geen ingebouwde fancy filters.

> **Skip**: Kaboom.js (te beperkt voor commerciële scope), Bevy WASM (15-30MB binaries, overkill voor 2D), Defold (geen JS-ecosystem koppeling).

---

## 2. 3D / Three.js ecosystem

### Three.js r182+ (april 2026)
- Repo: https://github.com/mrdoob/three.js
- Pitch: Production-ready WebGPU sinds r171 (sept 2025), Safari 26 closed het cross-browser gat.
- Waarom voor ons: WebGPURenderer + TSL nodes voor 2.5D parallax + post-FX pipeline op compute shaders. Moderne shadow-pipeline.
- Caveats: r182 toont performance-regressies vs r170 op shadow-heavy scenes — pin op r178-r180 tot dat is opgelost.

### TSL (Three Shader Language)
- Wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- Pitch: Node-based shaders in JS, compileert naar GLSL én WGSL — één source voor WebGL/WebGPU.
- Waarom voor ons: Onze "DMT-trip" effecten (kaleidoscoop, RGB-shift, godrays) als herbruikbare TSL-nodes — renderer-agnostic dus we kunnen later naar pure WebGPU zonder shaders te herschrijven.
- Caveats: NodeMaterial-varianten verplicht (MeshStandardNodeMaterial etc.).

### react-three-fiber v9 + drei v10.7
- Repo: https://github.com/pmndrs/react-three-fiber, https://github.com/pmndrs/drei
- Pitch: React 19-compatible JSX wrapper voor Three.js.
- Waarom voor ons: Component-based scene composition, declaratieve cinematics. **Maar alleen** als we React kiezen — voor een platformer is een vanilla Three.js loop vaak performanter.
- Caveats: WebGPU support nog niet volledig in R3F (begin 2026, in progress).

### Theatre.js 0.7
- Repo: https://github.com/theatre-js/theatre
- Pitch: Studio-grade timeline editor voor cinematic camera/light/material animaties in browser.
- Waarom voor ons: Intro-scenes, level transitions, cutscenes (Alice falls down the hole). Real-time timeline editor in dev, JSON-export voor productie.
- Caveats: Editor-bundle is groot — dev-only inladen.

---

## 3. Post-processing & VFX (KEY)

### postprocessing (pmndrs)
- Repo: https://github.com/pmndrs/postprocessing
- Pitch: EffectPass merget meerdere effects in één render-pass — orde van magnitude sneller dan Three.js' EffectComposer.
- Waarom voor ons: Bloom + Glitch + ChromaticAberration + Noise + Vignette stapelen zonder framerate-killer.
- Caveats: WebGL only — voor WebGPU pad gebruiken we Three.js' eigen TSL-postprocessing.

### react-postprocessing
- Repo: https://github.com/pmndrs/react-postprocessing
- Pitch: R3F-bindings voor postprocessing — `<EffectComposer><Bloom/><Glitch/></EffectComposer>`.
- Waarom voor ons: Snel pluggen/spelen met effects als we R3F kiezen.

### Codrops "Efecto" patterns (jan 2026)
- Article: https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/
- Pitch: Open-source ASCII + dithering shader toolkit.
- Waarom voor ons: Alice-in-Wonderland momenten (vintage mode bij DMT-peak), retro/dither secties.

### Pavel Dobryakov WebGL Fluid Simulation (16k+ stars)
- Repo: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
- Pitch: Navier-Stokes + curl noise + vorticity confinement op GPU, real-time.
- Waarom voor ons: Liquid-trip backgrounds, smoke trails, "the air is melting" momenten. Production-tested fluid solver.
- Caveats: Standalone — port naar Three.js render-target nodig.

### Audio Shader Studio
- Repo: https://github.com/sandner-art/Audio-Shader-Studio
- Pitch: Live GLSL editor met 512-FFT audio uniforms al voorgekauwd.
- Waarom voor ons: Music-reactive shaders zonder zelf de FFT-bridge te schrijven — past direct op onze Suno-soundtrack.

---

## 4. Sprite tooling 2026

### FalSprite
- Repo: https://github.com/lovisdotio/falsprite
- Pitch: Tekst-prompt → animated sprite sheet, powered by Nano-banana-2 + BRIA + OpenRouter via fal.ai.
- Waarom voor ons: **Killer fit** — gebruikt onze bestaande fal.ai key, levert transparente backgrounds + animated preview, kies grid + actions (walk/attack/idle).

### sprite-sheet-creator (Blendi)
- Repo: https://github.com/blendi-remade/sprite-sheet-creator
- Pitch: 2D characters + maps generator, fal.ai powered.
- Waarom voor ons: Backup-pipeline / cross-validatie tegen FalSprite-output.

### LoongBones (formerly DragonBones)
- Pitch: Open-source skeletal 2D animator, exporteert Spine-compatible.
- Waarom voor ons: Gratis Spine-alternative voor onze hoofdpersoon — als we van pure spritesheets naar bone-rigged willen voor smoothere animatie.
- Caveats: Web-runtime is community-maintained.

### free-tex-packer-cli
- Repo: https://github.com/odrick/free-tex-packer-cli
- Pitch: NPM CLI om losse PNG's naar atlas + JSON te packen (Phaser/Pixi/Godot exports).
- Waarom voor ons: Pipeline-stap tussen fal.ai outputs en game-runtime.
- Caveats: NPM package laatst geüpdatet jaren geleden — maar de Github repo is wel actief.

---

## 5. Audio web libs

### Howler.js v2.2+
- Site: https://howlerjs.com
- Pitch: Battle-tested audio playback met format fallback + spatial audio + sprites.
- Waarom voor ons: SFX en muziek-loops, simpele API, kleine footprint.

### Tone.js v15+
- Repo: https://github.com/Tonejs/Tone.js
- Pitch: Web Audio synthesizer + scheduler met `Tone.GrainPlayer` voor granular.
- Waarom voor ons: **Procedural** trippy audio — granular synthesis om Suno-tracks te time-stretchen tijdens DMT-peaks zonder pitch-shift, of korte SFX te morphen. Combineer met Howler (Howler voor static, Tone voor procedural).

### Strudel.cc
- Repo: https://codeberg.org/uzu/strudel
- Pitch: TidalCycles pattern language in browser — algoritmische muziek live-coden.
- Waarom voor ons: Wildcard — "DMT-peak" sequence kan een Strudel-pattern zijn die hallucinerend reageert op gameplay events. Niche maar uniek.

---

## 6. Wildcards

### @react-three/rapier + ecctrl
- Repos: https://github.com/pmndrs/react-three-rapier, https://github.com/pmndrs/ecctrl
- Pitch: Rapier physics (Rust→WASM, 2-5× sneller in 2025) als R3F-componenten + kant-en-klare character controller.
- Waarom voor ons: Als we 2.5D met écht physics-driven jumps willen. Rapier 2026 roadmap = GPU rigid bodies via rust-gpu.

### DeepMotion / RADiCAL (browser mocap)
- Sites: https://deepmotion.com, https://radicalmotion.com
- Pitch: Video → 3D animation in browser, AI pose-tracking.
- Waarom voor ons: Snelle reference-animatie voor 2.5D parallax-NPC's of trippy creature-bewegingen — nemen, exporten als FBX, projecteren op sprite-rig.

### Cascadeur (desktop, AI-keyframe)
- Site: https://cascadeur.com
- Pitch: AI-assisted keyframe animator met physics-aware in-betweens.
- Waarom voor ons: Hoofdpersoon-animaties polishen na DeepMotion-mocap.

---

## Recommended Stack 2026 (12 tools)

Onze "DMT-trip platformer" stack — geoptimaliseerd voor 2.5D met heavy post-FX:

| # | Tool | Rol |
|---|------|-----|
| 1 | **Three.js r178-r180** (WebGPURenderer) | 3D parallax-laag, achtergrond, post-FX pipeline |
| 2 | **TSL (Three Shader Language)** | Custom psychedelische shaders (kaleidoscope, RGB-shift, fluid) — renderer-agnostic |
| 3 | **Phaser 4** | 2D gameplay-plane met SpriteGPULayer + Filter system, ingebed via shared canvas of overlay |
| 4 | **postprocessing (pmndrs)** | Bloom + Glitch + ChromaticAberration + Vignette stack |
| 5 | **Pavel Dobryakov fluid sim** (geport) | Liquid-air backgrounds, smoke trails op DMT-peaks |
| 6 | **Theatre.js** | Cinematic intro + level-transitions ("falling down the rabbit hole") |
| 7 | **FalSprite** (fal.ai) | Hoofdpersoon + enemy spritesheets uit prompts |
| 8 | **free-tex-packer-cli** | Atlas-pipeline tussen fal.ai output en Phaser |
| 9 | **Howler.js** | SFX + muziek playback met spatial audio |
| 10 | **Tone.js** (GrainPlayer) | Procedural audio-morphs op trip-momenten |
| 11 | **Audio Shader Studio patterns** | FFT-uniform bridge naar onze TSL-shaders voor music-reactive visuals |
| 12 | **Meshy v6 + Blender pipeline** (bestaand) | 3D parallax-props, Alice-creatures, environment objects |

**Architectuur-keuze**: Three.js draait als root-renderer met Phaser 4 op een tweede canvas/render-target voor de 2D gameplay-laag. TSL-shaders bridgen beide werelden (zelfde uniforms, audio-FFT, time). Als alternatief: alles in Phaser 4 v3-port met Three.js enkel als WebGL-context-share voor de 3D background-pass — minder elegant maar simpler te builden.

**Niet adopted**: Bevy WASM (te zware bundle), Kaboom (te beperkt), R3F (overkill — wij hebben geen React-elders en de WebGPU-status is nog niet 100%), tsParticles (geen GPGPU), Spine (commercial license — LoongBones is gratis equivalent).

---

**Sources** (selectie):
- Phaser 4: https://phaser.io/news/2026/04/gamefromscratch-reviews-phaser-4-the-biggest-release-ever
- PixiJS v8.16: https://pixijs.com/blog/8.16.0
- Three.js WebGPU 2026: https://www.utsubo.com/blog/threejs-2026-what-changed
- TSL field guide: https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- pmndrs postprocessing: https://github.com/pmndrs/postprocessing
- Codrops Efecto (jan 2026): https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/
- FalSprite: https://github.com/lovisdotio/falsprite
- Rapier 2026 goals: https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/
- Theatre.js: https://www.theatrejs.com
