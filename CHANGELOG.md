# Changelog — Cosmos Cosmic Adventure 2026

Alle wijzigingen volgen [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) en [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

De `/updates/` pagina wordt automatisch uit dit bestand gegenereerd via `npm run updates:build`.

## [1.3.0] — 2026-05-02 — Sprint 17: motion-controlled world explorer + companion-mode

**Gameplay-shift**: weg van runner ("ren naar rechts"), naar **motion-controlled world explorer + stoned-watching companion**. Cosmo blijft center, wereld scrollt NIET. Camera pant binnen biome-scene op gyro/mouse. Trampolines op fixed posities zijn enige interactie. 8s no-input → companion-AI neemt over, Cosmo wandelt zelf rond, kijkt, zit, slaapt na 90s met hallucination-particles. Embrace the weirdness.

### Added (17A — Cosmo handmade-rig)

GLB rig (10 bones, 4 anim clips, 22k tris, 10MB):
- `bone_root/spine/head/eye_l/eye_r/antenne/arm_l/arm_r/disc_l/disc_r`
- Distance-based weight-painting met head-zone-lock + arm-zone-lock
- 4 NLA clips → glTF: idle (4s loop, breath-pulse + blink), wave (1.5s arm-raise + slow eye-lock), stretch (2s arms overhead + spine arch), sit (6s squat + sniff-twitch)
- Mesh hergebruikt van Sprint 16B (geen nieuwe Meshy run, voorkomt LoRA-tail-drift in 3D)

**Caveat**: 4 LoRA-pose-PNGs gegenereerd MAAR DNA-drift terug naar gecko-archetype met tail+fingers (LoRA training-dataset bevatte tail-references). Skip de 2D-PNGs als asset, gebruik alleen GLB met embedded animation clips. Sprint 18 ticket: retrain LoRA op disc-only/no-tail dataset. Cost $1.08.

### Added (17B — DeviceOrientation motion-control)

`MotionController` met 4-source priority (companion-drift > gyro > pointer > none):
- iOS 13+ `requestPermission()` op first-touch (eenmalig)
- gyro mapping: gamma → panX (-1..1, /45°), beta → panY (-1..1, neutral 45°)
- Magnitude < 0.04 = phone-op-tafel-noise-gate
- Desktop pointermove fallback always-on
- **Companion-drift**: na 8s no-input → `panX=sin(t·0.21)·0.6`, `panY=sin(t·0.18)·0.4` (non-rationele freqs, geen sync-loop)

`CosmoStage.followCamera` (runner-volgende-camera) → `panCamera(motion, dt)` (camera pant binnen biome-bounds ±1.6 X / ±0.6 Y). Cosmo.worldX locked op 0 (geen scroll meer). Head-track via bone-search "head"/Mixamo: `restQuat · yaw(Y, ±0.4) · pitch(X, ±0.2)` na mixer.update().

### Added (17C — Composed worlds, 25 layered PNGs)

Per biome 5-7 transparante PNG-layers via Flux Pro Ultra (1024×1536), BiRefNet HEAVY 17/17 clean cutout via `BG_BLACK_FOR_BIREFNET` rider:
- **slow-bloom** (7 layers): twilight forest met giant pink mushroom + jellyfish creature. Weirdo 9/10
- **inkpool** (6): bioluminescent cave met crystal-spires. Weirdo 8/10
- **cathedral** (6): bloom-pierced temple met body-horror multi-wing angels. Weirdo 9/10
- **boss** (6): saffron-magenta storm met disembodied gaping mouths + uncanny eyes. **Weirdo 10/10**

`composition-spec.json` per biome met `parallaxMultiplier`, `xOffset`, `yOffset`, `scale`, `zPosition`, `blendMode`, `opacity`, `role`. First-pass 24/25 (96%). Cost $1.90.

### Added (17D — Trampolines + pet-Cosmo)

`TrampolineSpots`: per biome 3-5 fixed posities uit `composition-spec.interactionSpots.trampolines`. Hover-bob met phase-offset (geen sync-loop). THREE.Raycaster pick op tap-NDC.

`CosmoAgent.walkTo(x, z, 'bounce')`: 1.5s ease-in-out cubic naar trampoline → `bounce()` → playClip('stretch') + sin-arc 0→0.6→0 over 0.8s. On bounce: kaleidoTrigger += 0.6 + 30% kans `audioBridge.startHallucination(HALLUCINATION_PEAKS)`.

`petAffect()` long-hold-Cosmo (500ms threshold, raycaster check op Cosmo bounds): 0.8s window met blush (saffron emissive lerp) + antenne-bone tilt ±0.35rad over 2 sine cycles. Op release → wave-clip.

VibeMeter triggers: 5 bounces in 30s OR ≥2s cumulative pet → DeepTripMode auto-engage.

`ObstacleManager` als compat-shim (alle public API behouden, update() no-op). Runner-spawn-pool definitief weg.

### Added (17E — Companion-AI passive vibe)

`CosmoAI` 7-state machine: `idle | roam | curious | sit | look-around | sniff | sleep`.

Triggers:
- 8s no-input → companion-mode (kaleido bloom-pulse 0.18)
- 90s no-input → sleep latch (pulse 0.45)

Transitions weighted: roam 35% / curious 18% / sit 17% / look-around 18% / sniff 12%. Sub-phases voor curious (approach→inspect→wave→leave) en sniff (approach→dip→leave).

Sleep-state hallucination-particles: lazily-built `THREE.Points` 24 particles, radial-falloff canvas-drawn texture (geen asset), pop-magenta+saffron, AdditiveBlending, drift+recycle.

Mixer-coupling: per frame `playClip(d.clip, loop)` met 180ms crossfade. `mixer.timeScale` lerp naar 0.4 (sleep) of 1.0. Position-chase met biome-bounds clamp X±1.6 / Z-4..0.

Soft-coupling met 17D's `trampolineSpots.positions()` als interaction-targets-provider voor curious-state.

### Added (17F — Multi-layer parallax-scene + decoration placement)

`parallaxScene.loadBiome(biome)` refactored van single-4K-plane naar N-layer composition consumer:
- Per layer: `mesh.position.x = baseX + motion.getPanX() * parallaxMultiplier * 1.6`
- BlendMode mapping: additive / multiply / normal
- Texture cache prevents re-fetch on biome-cycle

Per biome 3 environmental decoration objects geplaatst (uit Sprint 15C library):
- **slow-bloom**: upside-down-tree + eyeball-sentry deep right + floating-star
- **inkpool**: breathing-portal + melting-clock-bubble drift + eyeball-sentry
- **cathedral**: breathing-portal skybox + upside-down-tree top-hang + floating-star
- **boss**: secret-crystal hidden + mouth-pillar + eyeball-sentry

mouth-pillar pingpong-frame (Sprint 16C compat) + secret-crystal hidden tot kaleidoTrigger > 0.8 (Sprint 16E compat) behouden.

### Pre-deploy live-test (17G)

Combined `tsc --noEmit` exit 0. Build 521 files in /tmp staging. Vite preview boot test alle 6 critical assets 200 OK (HTML, GLB, composition-spec, layer-PNG, music, cosmo-coo). 0 TODO/FIXME in alle 10 src-files. Code-review groen.

### Cost Sprint 17

~$3 totaal (17A: $1.08 LoRA-poses + Blender-rig + ESRGAN, 17C: $1.90 25 layered PNGs + BiRefNet).

### Open voor Sprint 18

- LoRA retrain op disc-only/no-tail dataset (huidige LoRA reactiveert tail-bias bij pose-variation)
- DRACOLoader integratie → GLB 10MB → 752KB
- Biome-cycling auto elke 90s via crossfade (deels ge-implementeerd, full DeepTripMode auto needs CosmoScene exposure)
- ElevenLabs custom voice library uitbreiden (meer cosmo-coo + biome-specific stingers)

## [1.2.0] — 2026-05-02 — Sprint 16: DNA-correcte Cosmo via LoRA + 6 polish-fixes

v1.1.0's live demo was niet speelbaar: PIL-painted 2D-eyes werden 3D-blobs op de mesh, NL voice-over uit Hint-Globe-archief brak de vibe, mouth-pillar toonde 4 frames tegelijk, secret-crystal default zichtbaar, music stopte na track-end, onboarding skipte voor return-users. Sprint 16 fixt alles met **harde quality-gate**: orchestrator draait nu zelf pre-deploy live-test (browser-MCP playwright iPhone-emulation indien Docker UP, anders curl + tsc + GLTF-headless validate) — geen "live verify door user" meer als enige check.

### Fixed (16A — Cosmo-LoRA fine-tune, eindelijk DNA 10/10)

**6-sprint-blokker eindelijk opgelost.** Flux LoRA training op 10 hand-curated DNA-correct images:
- Endpoint: `fal-ai/flux-lora-fast-training`, 2000 steps, trigger word `rtcosmo`
- Re-usable LoRA URL bewaard in memory voor toekomstig hergebruik
- Hero gen via `fal-ai/flux-lora` met LoRA + ESRGAN 4× → `cosmo-hero-lora.png` 4096² RGBA
- DNA-checklist **10/10**: pearl-drop ✓, chameleon bulging eyes ✓, geen blozende wangen ✓, single antenne+flower ✓, **two clean black flat suction-cup discs** ✓ (organisch, geen PIL-paint workaround), faded-rose spots ✓, no tail ✓, no vinger-handen ✓, watercolor + paper-grain ✓, slight uncute ✓
- Halo fringe 14.3px (Sprint 14A was 24px — verbeterd)
- Cost ~$3-5 (training + 10 generation attempts + ESRGAN). Recoupt na ~10 toekomstige Cosmo-renders ($0.05 via LoRA vs $0.45 via PIL-painting)

**Memory-leering**: canonical-v2's kawaii-eye-bias propageerde door 5B/6A/7A/11A/13D/14A. LoRA bakt DNA in model-weights → permanente fix. PIL-paint workarounds zijn nu deprecated.

### Fixed (16B — Cosmo 3D rebuild met clean LoRA-input)

Sprint 15A's `cosmo.glb` (image-to-3D vanaf canonical-v2 met PIL-painted eyes) renderde off-brand in 3D — de 2D-paint werd 3D-blobs op de mesh-surface. Hypothese in screenshot bevestigd via side-by-side compare.

Nieuwe pipeline met 16A LoRA-Cosmo als input:
- Meshy v6 image-to-3D, 2 art_style attempts (realistic vs sculpture)
- Winner 16B-A realistic: 22k tris, 15137 verts, 10.08MB raw GLB
- **3D bulging eye-spheres als geometrie** (NIET 2D-blob)
- Suction-cup discs als floating disc-meshes
- DNA 7/8 (alle behalve "watercolor texture" — Meshy PBR is mild plastic, acceptabel)
- Cost $0.60

Draco-compressed 752KB versie ALSO geleverd in case-study, maar engine heeft geen DRACOLoader → ship raw 10MB voor compat. **Toekomstig ticket Sprint 17**: voeg DRACOLoader toe → 13× kleiner zonder visual diff.

Pre-deploy live-test via `p8_live_test.mjs` (headless GLTFLoader): mesh.geometry intact, polycount binnen tolerance, verts=15137, tris=21978 → SHIP.

### Fixed (16C — Mouth-pillar single-frame ping-pong)

Live screenshot toonde 4 monden tegelijk. Fix: per-spawn-geklonen texture met `repeat.set(0.25, 1) + offset.x = frame * 0.25`. Ping-pong cycle `0,1,2,3,2,1` over 4s @ 92BPM = closed → quarter → half → open → half → closed. Alle live mouths breathing in lock-step via `audioBridge.musicCurrentTime()` (drift-vrij). Geen custom shader nodig.

### Fixed (16D — ElevenLabs gibberish-coo + audio-loop hardened)

NL voice-over uit Hint-Globe brak de vibe. Vervangen door 3 ElevenLabs Sound-Generation varianten:
- `cosmo-coo-1.mp3` (3-syllable nonsense babble)
- `cosmo-coo-2.mp3` (4-syllable melodic)
- `cosmo-coo-3.mp3` (ascending 3-tone gurgle)
- 0.9-1.2s elk, 128kbps stereo
- `COSMO_COO_POOL` random-pick in `CosmoScene.playGibberishCoo`

Audio-loop bug: `audioFFTBridge.createStreamedTrack` had al `audioEl.loop = true` (Sprint 9-fix). Defensief in `BiomeManager.notifyTrackEnded()` no-op'd met expliciete jsdoc dat het NOOIT advance() mag triggeren. Cycle nu enkel via `requestPlayerSwitch()` (long-hold-3s).

Cost: $0.20 ElevenLabs.

### Fixed (16E — Spawn-balance + secret-crystal hidden)

Live screenshot toonde te dichte spawns + crystal default-zichtbaar:

| Param | Was | Nu |
|---|---|---|
| Fallback spacing | 1.6-2.4s | 2.4-3.8s |
| Beat-loose period | 4 beats | 6 beats (~4.2s) |
| Tall cooldown | — | 8.0s |
| Max same-id run | — | 2 (re-pick op 3e) |
| Crystal threshold | — | kaleidoTrigger > 0.8 |
| Trampoline weight (low) | 50% | 40% (60% star) |

`pickWeighted()` cumulative selection. Gap-pool dynamisch: crystal append (weight 30) alleen als post-FX peak. Statistische sim: 18 spawns/60s, 44.5% trampoline-aandeel, crystal 8% bij k=0.9, max-same-id-run 2 ✓.

### Fixed (16F — Onboarding force-show + version-reset)

Sprint 15D's localStorage flag blokkeerde portal-arrival voor return-users. Fix:
- Nieuwe state `MINI_FLASH` (0.6s) tussen AWAIT_TOUCH en WALKING_FIRST_HINT
- Priority: `?onboard=1` URL > `opts.skipPortal` > LS read
- LS upgrade naar JSON `{version, completedAt}`. Legacy `"true"` string treated as old-version → reset
- `ONBOARDING_VERSION = 'v1.2'` bump invalideert alle stored completions
- 35/35 deterministic state-machine tests pass

### Added (16G — Pre-deploy live-test protocol)

`.planning/v1.2-pre-deploy-checklist.md` met **STOP-conditions**: DNA-incorrect Cosmo / NL voice / music drop-out / 4-monden / crystal default / console errors / FPS<30 → geen deploy. Orchestrator draait test ZELF, niet via user.

### Cost Sprint 16

~$4 totaal (16A: $3-5 LoRA training + gen + ESRGAN, 16B: $0.60 Meshy x2, 16D: $0.20 ElevenLabs).

### Open voor Sprint 17

- DRACOLoader integratie → swap raw GLB naar 752KB Draco asset (13× kleiner)
- Per-biome obstacle-pool variations (boss-biome krijgt eigen weirdo-set)
- Cosmo-LoRA pose-variation: 6 walk/jump/cling frames via LoRA + procedural skeletons
- ElevenLabs custom voice library: meer cosmo-coo + biome-specific stingers

## [1.1.0] — 2026-05-02 — Sprint 15: 3D Cosmo + weirdo auto-runner

GROND-UP gameplay-rebuild #2. Pivot van rhythm-trip naar **weird auto-runner met agency** — Cosmo loopt door een 3D-scene op de muziek, speler begeleidt met swipes/taps, Cosmo heeft eigen agenda (negeert input 20% v/d tijd, knipoogt zomaar, loopt achteruit). Geen game-over. WEIRDO-energy expliciet ingebakken: niet een speelervaring waarin de speler de baas is over een schattig wezen, maar één waarin een eigenaardig wezen JOU laat meelopen in zijn dag.

### Added (15A — Meshy 3D Cosmo)

- `public/assets/3d/cosmo.glb` — image-to-3D vanaf Sprint 14A canonical-v2 (de PIL-painted-eyes versie). 9/10 DNA-correct: pearl-drop ✓, chameleon-eyes met saffron crescent ✓, antenne+rose-flower ✓, faded-rose spots ✓, no tail ✓, uncanny-vibe ✓. Suction-cups partial (residual claws boven discs).
- 22.5k verts, 8MB raw GLB, 3 PBR maps embedded (baseColor + normal + ORM).
- Cost $0.20 (van $3-5 budget).
- **Memory-leering**: Meshy auto-rig faalt deterministisch op alien anatomy (HTTP 422 op 4 parameter-varianten + 2 source-tasks). Pose-estimator is humanoid-trained. Workaround: procedural anim direct vanuit `cosmo-animation-spec.json` (idle-breath/walk/jump-up/jump-fall/cling/wave-uncanny). Skip AnimationMixer voor cleaner FFT-control.

### Added (15B — Weirdo gameplay-stack)

8 nieuwe files vervangen het rhythm-tap-systeem:
- `CosmoStage` (Three.js sub-renderer met PerspectiveCamera + lights + camera-follow met deadzone, rendered ON TOP van parallax via `autoClear=false + clearDepth`)
- `CosmoAgent` (GLB wrapper + state-machine + agency-RNG; 2D billboard fallback met `cosmo-hero-4k.png` tot GLB async loadt)
- `ObstacleManager` (pool 12, kinds low/tall/gap, beat-loose timing op `audioBridge.musicCurrentTime()` met 1.6-2.4s drift-fallback, `setObstacleFactory()` exposed)
- `InteractionManager` (gestures → CosmoAgent decisions + transient platform-meshes — trampoline torus + mushroom)
- `VibeMeter` (Phaser Graphics ring rond geprojecteerde screen-pos, 5%/s decay, full → DeepTripMode)
- `DeepTripMode` (5s post-FX peak + hallucination-track + dance)
- `CosmoScene` (Phaser is HUD-only nu)

**Agency-RNG tuning** (de WEIRDO-touch):
- 0.5%/frame @ 60fps = ~3.3s avg random event, 4.5s cooldown
- Distributie: 25% knipoog · 30% walk-backward · 30% eigen-jump · 15% petal-spew
- Action-commit: 80% op swipe, **50/50** op tap-jump-of-duck
- Decision-delay 120-280ms random
- **Geen "voorspelbare modus" toggle** — per brief verboden
- Failure (tall-obstacle collision tijdens niet-jumping) → forceFall 1.2s opacity-fade → respawn 1.5s 2-4 worldX vooruit, vibe -10%. Geen game-over.

### Added (15C — 8 weirdo objects)

Alle 8 fal.ai-generated, $1.85, geen code aangeraakt:

- **eyeball-sentry** 9/10 (chameleon-iris die volgt) — first-pass STANDOUT via Flux Pro Ultra
- **breathing-portal** 8/10 (adem-cycle saffron→magenta→cyan) — first-pass STANDOUT
- **organic-flesh-trampoline** 8/10 (ademende membraan, body-horror)
- **mouth-pillar-sheet** 8/10 (4-frame PIL-composite — single-image sheet bias unbreakable)
- **upside-down-tree** 7/10 (V4 success na 3 fails — drop noun, gebruik 3-zone shape-prompt)
- **melting-clock-bubble** 7/10 (Dali via "watercolor painting" lead-prefix)
- **secret-crystal** 7/10 (hidden tot post-FX kaleido > 0.8)
- **floating-star** 5/10 (collectable +5 vibe-meter)

**Memory-leerings**:
- Sprite-sheet symmetry-bias unbreakable: diffusion kan GEEN sequential-animation-states in één image renderen → 4 separate calls + PIL composite is werkende patroon
- Sample-bias rond bekende nouns: drop het noun, beschrijf 3 SHAPE-zones — transferable
- Flux Pro Ultra forceert photo-aesthetic op organische subjects; Flux Dev pliabler voor stylized watercolor + body-horror

### Added (15D — Onboarding magic-moment)

3-second hook met WEIRDO-energy:
- `OnboardingDirector` state-machine: AWAIT_TOUCH → PORTAL_OPENING (1.5s) → COSMO_ARRIVING (1.5s) → BONDING (1.0s) → WALKING_FIRST_HINT → COMPLETE
- `NebulaPortal` (Phaser canvas-drawn, 6 concentric rings, ease-out-cubic radial expand, palette saffron→faded-rose→ink-aubergine, per-ring breath + lichte rotation-eccentriciteit)
- `HintGlyph` chevron-arrow + Cormorant-Garamond italic "veeg omhoog", anchored aan closest live obstacle, 1.6Hz bob → 3Hz intensify-pulse na 5s no-input
- **Wave-uncanny** clip: te-traag, te-lang, te-gelocked. Eyes-locked-on-camera. "Alsof Cosmo JOU ontdekt"
- Audio-stinger: bestaande `globe-l1-1.mp3` (3-syllable Hint Globe voice — kid-alien babble)
- localStorage `cosmosOnboardingComplete` skip portal+arrival voor return-users
- Geen text-instruction in stappen 0-2.5s

### Added (15E — Wiring + deploy)

- `weirdoObstacleFactory.ts` — vervangt canvas-primitive defaults door 15C's 8 objects als billboarded planes met THREE.TextureLoader + cache. Per kind random pool-pick zodat playthrough nooit repetitief voelt.
- 3 ObstacleKinds → pools: low (trampoline + star), tall (sentry + tree + mouth-pillar), gap (portal + crystal + clock-bubble)
- Pre-warm bij boot zodat eerste spawn niet pop't

### Cost Sprint 15

$2.05 totaal (15A: $0.20 + 15C: $1.85 + 15B/D/E: $0).

### Open voor Sprint 16

- **Cosmo-LoRA fine-tune** ($10-15) voor permanente DNA-fix in 4K renders + procedural-anim variants
- Draco compress cosmo.glb (8MB → 2MB) in build-pipeline
- 2 extra weirdo objects: levitating-tongue-bridge + antenna-flower-rain
- Per-biome obstacle-pool variations
- ElevenLabs custom Cosmo gibberish-voice library (3 varianten)

## [1.0.1] — 2026-05-02 — Sprint 14: complete-experience polish

v1.0.0's eerste live demo had drie zichtbare gebreken: kawaii Cosmo, dubbele blended backgrounds, en HUD-clutter. Sprint 14 fixt alle drie + voegt drift-loose default mode toe (geen rhythm-druk, hypnose first).

### Fixed (14A — Cosmo vol-DNA via PIL deterministic paint)

Sprint 13D's hero was kawaii-drift. Flux text-only failde 8/8 op chameleon-eye criterion (kawaii bias unbreakable in training data). Doorbraak via PIL deterministic paint van zwarte spheres + saffron crescent + white catchlight direct over kawaii eyes. Tail alpha-erase (Sprint 6A pattern). ESRGAN 4× RGB-only + Lanczos alpha + threshold-tighten halo. Final 4096² RGBA: chameleon eyes ✓, no tail ✓, suction-cups ✓, antenne+flower ✓, faded-rose spots ✓. Cost $0.45.

**KRITIEKE memory-leering**: canonical-v2 zelf is DNA-incorrect op eye-criterion (Sprint 6A had al kawaii pink eyes — bias propageerde 5B/7A/11A/13D). Voor permanente fix: Cosmo-LoRA fine-tune $10-15 (Sprint 15+).

### Fixed (14B — Background dedup, single 4K plane per biome)

`BiomeLayer` interface + `baseLayers()` factory verwijderd. `Biome` heeft nu `bgUrl: string` direct naar `biome-{slow-bloom,inkpool,cathedral,boss}-4k.png`. `parallaxScene.loadBiome()` rendert één opaque plane (transparent: false), overscan 1.15. `main.ts` wired `biomeMgr.onChange(biome → parallax.loadBiome(biome))` — parallax swapt na crossfade-end.

### Added (14C — Drift-loose mode default, beat-lock opt-in)

Mode-toggle ladder: URL `?mode=beat` > `B`-key > `localStorage.cosmosBeatLockMode` > **default drift-loose**. Beat-lock lazy-loadt `title-theme.json` (Sprint 13B beatmap), `BeatmapScheduler` synced op `audioBridge.musicCurrentTime()`. JSON-fail = silent fallback. Saffron-ring rond Cosmo (FFT band-0 pulsed) als visuele cue beat-mode. FFT → post-FX onaangeroerd in beide modes.

### Added (14D — HUD invisible-by-default)

Combo: 0 → tap 240ms fade-in / 0.6s hold / 1.2s fade-out. Version-pill: 4s intro → fade-out, pinch-zoom-out reveal 4s. Top-nav: opacity 0.25 scale 0.92 default, hover/focus reveal 1/1. AutoVJ engaged: alles forced 0. Mobile reveal: 80px `.hud-reveal-zone` hot-strip, touchstart/mousedown → 3s reveal-window.

### Cost

Sprint 14: $0.45 (alleen 14A asset-gen). 14B/C/D = code-only.

### Open voor Sprint 15+

- Cosmo-LoRA fine-tune ($10-15, permanente DNA-fix)
- Alpha-lerp crossfade tussen biomes (visuele transitie ipv hard-swap)
- Asset-cleanup: legacy slow-bloom-v2/, tile/enemy assets uit dist
- Bubble-textures + hallucination-particles wiren in BeatTarget/TrippyEventDirector

## [1.0.0] — 2026-05-02 — Cosmos rhythm-trip rebuild (D + C-vibe pivot)

GROND-UP REBUILD. Pivot van platformer-experiment naar mobile-first hypnotische rhythm-trip. *"Geen game. Geen score. De track is de game."*

5 sprints (13A-13E) parallel: foundation strip + BeatScene + CosmoRig 8-band FFT-rig + AutoVJ + 5 mobile gestures (13A); JSON-DSL beatmap-loader + onset-detector Python + 4 base-track beatmaps (13B); BiomeManager 4-state crossfade + share-stack 60s clip + screenshot peak-detector + daily-streak + friend-seed (13C); premium $1.75/$10 asset-gen — Cosmo 4K hero, 4 biome-4K backgrounds (inkpool + boss 10/10 first-pass), 8 cosmic-bubbles, 6 hallucination-particles, splash-hero (13D); deploy v1.0.0 (13E).

Verwijderd: alle platformer-entities (L1Scene, Cosmo, Bomb, BreakableWall, HintGlobe, Star, Trampoline, alle enemies, HudOverlay, levelL1, oude biomes). Herzien: InputController gesture-bus, TouchOverlay simplified, audioFFTBridge.musicCurrentTime + setMusicTrack getters.

## [0.9.0] — 2026-05-01 — Sprint 13C: biome-cycling + share-mechanismen

Tweede helft van de v2.0-rebuild. Sprint 13C bouwt het post-FX-cycling-systeem
en de virale haakjes uit PRD §5/§7 — biome-state-machine met crossfade,
synesthesia-piek-detector, 1080×1920 share-card capture, 60s clip-recorder met
audio-tap, glassmorph-overlay en daily-streak counter.

### Added

- **`src/three/biomeManager.ts`** — 4-biome state-machine (slow-bloom →
  inkpool → cathedral → boss). 4s linear crossfade van `biomeIntensity`
  uniforms; track-end auto-cycle; long-hold-3s player-trigger via
  `requestPlayerSwitch()`. Hooks voor track-swap zodat de AudioFFTBridge
  de eigenaar blijft van `<audio>`-elementen.
- **`src/share/peakDetector.ts`** — vuurt op (`lows > 0.7` 0.5s sustained)
  AND (combo > 5 OR boss-biome). 30s cooldown zodat de auto-screenshot
  zeldzaam voelt. Callback-based — geen extra deps.
- **`src/share/captureScreen.ts`** — composiet 1080×1920 portret van de
  Three+Phaser canvases met glassmorph card (track-naam, biome, combo,
  taps, watermerk + URL) en optionele Cosmo-cirkel.
- **`src/share/captureClip.ts`** — `ClipRecorder` met `MediaRecorder`
  (vp9/opus → mp4/avc1 fallback), eigen rAF tikt offscreen-canvas op
  30fps, audio-tap via `AudioFFTBridge.captureStream()`. 60s default,
  manual stop ondersteund.
- **`src/share/shareCardOverlay.ts`** — DOM-modal met preview, "Save to
  Photos", "Copy share link", auto-dismiss na 8s. Plus `showStreakPill()`
  voor de "Dag X in de trip"-toast.
- **`src/share/dailyStreak.ts`** — localStorage streak counter
  (`cosmosLastVisit`, `cosmosStreak`, `cosmosLongest`), milestones day-7
  / day-30. Local-date YYYYMMDD, idempotent intra-session.
- **`src/share/urlSeed.ts`** — `?seed=YYYYMMDD&combo=NN` URL-helpers met
  FNV-1a + xorshift hash voor deterministische beatmap-shuffle.
- **`AudioFFTBridge.captureStream()`** — `MediaStreamAudioDestinationNode`
  tap zodat clip-recorder analyser-output kan opnemen zonder live
  playback te verstoren.
- **`globalUniforms.biomeIntensity`** — bloom/kaleido/fluid/chroma/parallax
  multipliers; `postFX.ts` schaalt zijn base targets ermee.
- **Biome-presets** uitgebreid van 1 → 4 biomes met `bpm`, `trackUrl`,
  `chroma` en `BIOME_CYCLE_ORDER`.

### Notes

- BeatScene-integratie en deploy zijn voor Sprint 13D/13E.
- iPhone Safari MediaRecorder ondersteunt mp4/avc1 vanaf iOS 14.3 — webm
  faalt daar bewust soft (geen exception, alleen `onError`-callback).

## [0.8.0] — 2026-05-01 — Sprint 11: visual + audio overhaul

Op live playtest van v0.7.3 viel direct op dat de online versie er als 1992 uit zag — Cosmo was een stick-puppet, HUD was clipart, tiles waren patroon-tegels, en muziek speelde **helemaal niet**. Sprint 11 pakt alles in één klap aan: 4 parallelle teams (Cosmo HD-rerender, HUD volledige redesign, tile-set redesign, audio-debug) en deploy.

### Fixed (11D — audio bug)

**Root cause**: `audioEl.play()` werd in `init()` aangeroepen vóór gesture; browser blokkeerde met `NotAllowedError` die `.catch()` stilletjes wegslokte. `ensureRunning()` deed alleen `ctx.resume()` op gesture, **retried play() niet**. AudioContext en HTMLAudioElement hebben gescheiden autoplay-locks — context werd unsuspended, audio-element bleef paused, MediaElementSource pompte stilte.

**Fix**: `MusicSource` interface kreeg `audioEl?: HTMLAudioElement`, `createStreamedTrack()` exposeert het, `ensureRunning()` retry'd play() bij paused. Idempotent op subsequent gestures. Bonus: error-listener logt nu `audio.error.code/message`. Headless Chromium grant autoplay automatisch — daarom miste eerdere oppervlakkige tests dit (memory-gotcha gedocumenteerd).

### Added (11A — Cosmo poses HD-rerender)

6 pose-frames (walk-1, walk-2, jump-up, jump-fall, cling-right, hurt) re-rendered met **img2img + ControlNet/canny** (canonical-v2 als image_url strength 0.45–0.65, control_lora 1.20–1.25, seed 7777 voor face-consistency). **Body-mass volledig gerestaureerd** — Hayao×Moebius watercolor textuur, chameleon eyes, suction-cup discs, faded-rose spots. Stick-puppet-bug **gefixt**.

**Bekend architectural ceiling**: 13 strength-combinaties getest, in alle gevallen wint canonical noise-init van canny-conditioning → poses lijken statisch. Pose-distinction vereist Cosmo-LoRA fine-tune of Meshy 3D rig (Sprint 12+). Cost: $1.92 (van $5–8 budget).

**In-engine compensatie** (Sprint 11E inline): `Cosmo.updateAnim()` past nu scale + rotation per state toe zodat elke frame visueel onderscheidbaar is op 120px:
- jump-up: scale(0.94, 1.08) + 6° tilt opposite-facing (anticipation squash)
- jump-fall: scale(1.0) + 8° forward-tilt (T-pose-falling)
- run: Y-bob `sin(walkPhase × π) × 0.03` (gait pulse)
- idle: subtle breathing pulse `sin(animPhase × 1.6) × 0.02`
- cling: neutral (setFlipX al voldoende)
- damage/death: rotation-tween al in `takeDamage` (Sprint 8D)

### Added (11B — HUD/UI volledige redesign)

Cosmic Cathedral pill-architectuur, glassmorph + Hayao×Moebius elegance:

- **Top-left game-info pill**: backdrop-blur(20px) saturate(140%), `rgba(20,16,26,0.55)` background, 1px stroke `#F4A261` 0.3 alpha, border-radius 18px. Cormorant-Garamond italic 18px voor "Cosmos · L1 First Steps", JetBrains-Mono 14px voor metrics. Hartjes als canvas-drawn watercolor heart-primitives (filled = saffron-glow + faded-rose halo, outline = ink-aubergine 1.5px stroke). Bomb + star als canvas-primitives.
- **Top-right nav pill**: synchroon met game-info, version-pill als ink-aubergine sub-bouwsteen met monospace tekst. Hover: saffron-glow background-overgang met `ease-out-expo 220ms`.
- **Bottom-center controls-hint pill**: auto-hide na 8s, fade-in 600ms easeOutExpo, re-fade-in 4s op keypress.
- `src/phaser/hud/HudOverlay.ts` (18KB) — class met canvas-rendering + tween-management, attach/detach lifecycle hooks via Phaser scene events.
- `'♥'.repeat()` glyphs **definitief weg**.
- Mobile responsive: pills compact op <600px, controls-hint hidden (touch-overlay heeft eigen guidance).

### Added (11C — Tile-set redesign)

10 nieuwe painted-watercolor assets in `public/assets/tiles/` (v3-suffix), Hayao×Moebius style coherent met Cosmo + enemies, locked palette respected:

- ground / dirt / wall / wall-cracked / mushroom / spike (per-tile fallback) / trampoline (8 squares, 256² seamless)
- spike-strip (1024×128 continue strip — niet wired, future per-row refactor)
- ladder (256×1024 vertical organic vine — preloaded, future L-grid char)
- bg-grass-strip (1024×128 painted bottom-band — preloaded)

**Cost**: $0.68 (van $4–6 budget). Quality > quantity: 10 first-pass + 5 retries.

**Belangrijke nieuwe leringen** (memory):
- **Flux Pro "macro close-up" border-bias**: interpreteert prompt als professional product-photography met ring-around-empty-center. Fix: front-rider `"SEAMLESS UNIFORM TEXTURE filling 100 percent" + "NO empty center NO border-only NO subject-at-edges"`.
- **Stylized illustration tiles → Flux Dev** ipv Flux Pro. Trampoline 3× retry in Pro, 1-shot in Dev met "illustration of plump mushroom-cap dome from 3/4 angle".
- **Strip aspect-ratios werken first-try** (8:1 horizontal + 1:4 vertical) — composition-bias trad NIET op.

### Sprint 11 architectuur-leringen

- **Vite's MediaElementSource gesture-protocol**: AudioContext en HTMLAudioElement hebben gescheiden autoplay-locks. Resume context is niet genoeg — moet OOK audio.play() retry op gesture.
- **img2img+ControlNet pipeline ceiling voor pose-variation**: canonical noise-init wint van canny-conditioning ongeacht 13 strength-combinaties. Voor onderscheidbare poses: LoRA fine-tune of 3D rig. Tussenoplossing: in-engine scale/rotation tweens.
- **Glassmorph + canvas-primitives** voor HUD geeft 2026-feel zonder bitmap-icons of glyph-fallbacks.
- **Per-asset model-pick** matters: Flux Pro voor textures, Flux Dev voor stylized illustrations.

### Cost

~$2.60 totaal Sprint 11 (11A: $1.92 + 11C: $0.68; 11B/D: code-only). Ruim binnen budget.

### Niet gedaan (Sprint 12+)

- Cosmo-LoRA fine-tune of Meshy 3D rig (echte pose-variation, niet via img2img)
- Walk-1/walk-2 eye-drift fix (per-frame seed-lock pass, $0.18)
- Spike-strip wiring (decodeLevel refactor om contiguous `^` runs te detecteren)
- Ladder + grass-strip in L-grid (nieuwe legend-char `L` voor klimroutes)
- Bonus damage-warp variant (1-line pool append)
- Per-biome music-switch
- Hallucination ducking music-gain

## [0.7.3] — 2026-05-01 — Sprint 10: insanity live — hallucinations + damage warps

Sprint 9 leverde één base-track per biome; v0.7.3 voegt **mesmerizing insanity overlays** toe — psychedelic peaks die random uit een pool crossfaden bovenop de base-music. Plus hot-fix voor een `String.repeat(-1)` crash in de HUD bij dubbele damage-hits.

### Added (Sprint 10 — insanity overlays)

- **3 nieuwe Suno tracks** in `public/assets/audio/music/`:
  - `hallucination-peak-1.mp3` (3:24, microtonal koto + reversed flute fragments)
  - `hallucination-peak-2.mp3` (3:24, alt variant — random-picker schakelt elke trigger tussen variant 1 en 2)
  - `damage-warp-1.mp3` (28s, sub-bass pulse + tape-warp glitch + reversed pluck)
  - Loudnorm-pass identiek aan Sprint 9 (−14 LUFS, 112kbps); originelen in `_originals/`.
- **Multi-source audio architectuur** in `audioFFTBridge.ts`:
  - Aparte `stingerGain` sub-bus naast `musicGain`; beide → analyser → masterGain. Post-FX shaders reageren dus ook op insanity-events (lows pulsen bloom, mids drijven kaleido, highs sturen fluid).
  - `playStinger(pool)` voor one-shots (auto-dispose op `ended`)
  - `startHallucination(pool)` voor sustained overlays (max 30s, 1s fade-in / 4s fade-out, één-tegelijk dedupe)
  - `pickFrom(pool)` random-picker pattern; pools (`HALLUCINATION_PEAKS`, `DAMAGE_WARPS`) zijn `readonly string[]` constants — pool-uitbreiding is een 1-line append zonder code-changes elders.
- **Trigger-wiring**:
  - `Cosmo.takeDamage` → `audioBridge.playStinger(DAMAGE_WARPS)` (3 sites: hazard-overlap, enemy-touch, projectile-overlap)
  - `TrippyEventDirector.fire` → 25% kans op `audioBridge.startHallucination(HALLUCINATION_PEAKS)` per kaleidoscope-spike. Bridge dedupe voorkomt overlapping hallucinations.
- **Pattern**: dezelfde event triggert random tracks → anti-fatigue. Bridge dedupe (één hallucination tegelijk) voorkomt soundscape-smear.

### Fixed (Sprint 10 — HUD crash)

- `L1Scene.updateHUD` crashte met `RangeError: Invalid count value: -1` op `'♥'.repeat(c.hp)` als `hp` onder 0 zakte (mogelijk bij gelijktijdige damage-hits voorbij death). Fix: clamp in HUD (`Math.max(0, Math.min(maxHp, hp))`) + clamp in `Cosmo.takeDamage` (`hp = Math.max(0, hp - 1)`). Defense-in-depth — beide paths beschermd.

### Architectuur-leringen Sprint 10

- **Random-picker pattern voor anti-fatigue**: zelfde event-trigger, telkens andere track. Pool-as-readonly-array maakt uitbreiding triviaal. Werkt ook voor SFX-variation (toekomst: 3 jump-sounds, 3 stomp-sounds).
- **Aparte stinger-bus die door analyser komt** = post-FX reageert ook op overlays. Goedkoop trippy: damage-warp pulse drijft vanzelf bloom + kaleido.
- **One-tegelijk dedupe** voor sustained tracks voorkomt cacophonie. Voor stingers (one-shot) is overlap juist gewenst.

### Open voor Sprint 11+

- 2e damage-warp variant (Suno regenerate, ~20s). Pool kan vandaag 1 track aan; uitbreiding is 1-line append in `DAMAGE_WARPS`.
- Per-biome music-switching (slow-bloom-loop voor L1, inkpool-loop voor L2). Vereist biome-event op level-load.
- Ducking: music gain dimmen tijdens hallucination zodat de overlay duidelijker uitkomt.

## [0.7.2] — 2026-05-01 — Sprint 9: music live — Suno × audio-FFT bridge

Sprint 8B leverde de bridge en de scaffold; nu hangt er **echte muziek** aan. 4 D-minor folktronica tracks gerenderd via Suno Pro (handmatig, copy-paste prompts), loudnorm-pass naar −14 LUFS browser-standaard, swap van placeholder-synth naar streamed `<audio>` source. De wereld ademt nu mee met de title-theme zodra je op het canvas klikt.

### Added (Sprint 9 — music)

- **`public/assets/audio/music/title-theme.mp3`** — 3:09, 92 BPM, D-minor. Slow build, wooden flute + koto + granular pads, brushed kick @ 1:00. 4-note motif D–A–F–D in koto, fluit antwoordt octaaf hoger. Suspended A-minor → D-minor loop point.
- **`public/assets/audio/music/slow-bloom-loop.mp3`** — 2:50, 86 BPM. Mystieke alien-mushroom forest. Geen percussie, alleen ademende flute + koto + crickets. Discovery-feeling voor L1.
- **`public/assets/audio/music/inkpool-loop.mp3`** — 3:18, 78 BPM. Reflective ink-aubergine cave. Ambient koto-drone, lange flute, reverse-reverb tape, 78-BPM hand-drum heartbeat.
- **`public/assets/audio/music/boss-stinger.mp3`** — 2:47 (langer dan PRD-doel 0:45 maar werkt als mini-loop). Ominous wooden flute drone + koto-tremolo build. Suspended D-minor finale.
- **Loudnorm pass**: ffmpeg `loudnorm=I=-14:TP=-1.5:LRA=11 -b:a 112k`. Spread −13.1 → −13.9 LUFS (binnen 0.8 LU); file-sizes ~halved (2.3–2.8 MB elk). Originelen in `_originals/` (gitignored).
- **`audioFFTBridge.ts` swap**: `MUSIC_TRACK = assetPath('assets/audio/music/title-theme.mp3')`. Placeholder-synth opzij; streamed `<audio>` element + MediaElementAudioSourceNode neemt over. AudioContext-resume wired aan eerste click/keydown/touchstart (browser autoplay-policy).

### Architectuur-notitie

- Suno's wrapper-services (sunoapi.org) gebruiken aparte credit-systemen los van suno.com Pro. gcui-art/suno-api wrapper vereist 2Captcha bovenop SUNO_COOKIE. **Conclusie**: voor MVP-aantal tracks (≤10) is handmatig genereren via suno.com + copy-paste prompts goedkoper en simpeler dan elke API-route.
- Memory bijgewerkt: `suno_api.md` documenteert sunoapi.org endpoints + scaffold (Sprint 8B `suno_client.py` blijft optioneel pad voor later batch-renders).

### Open voor Sprint 10

- 2 extra "mesmerizing insanity" companion-tracks (`hallucination-peak.mp3` voor kaleidoscope-pieken, `damage-warp-stinger.mp3` voor damage/death/portal). Prompt-bundle gedeeld; Richard rendert + plaatst in Downloads.
- Per-biome track-switching (TrippyEventDirector kan tussen slow-bloom-loop en hallucination-peak crossfaden bij intense events).
- L2 (`inkpool-hollow`) gebruikt `inkpool-loop.mp3` zodra er een biome-switch entity-flag is.

## [0.7.1] — 2026-05-01 — Sprint 8: hot-fix — asset paths, Cosmo polish, Suno-prep

Live playtest van v0.7.0 toonde alleen Phaser fallback-rectangles in plaats van sprites — alle 31 asset-loads gingen naar `theuws.com/assets/...` ipv `theuws.com/games/cosmos-2026/assets/...`. Sprint 8 patcht het, plus build-pipeline veiligheid, Cosmo state-machine polish, en Suno-API integratie (klaar voor music-swap zodra credits getopt zijn).

### Fixed (8A — Asset BASE_URL paths, KRITIEK)

- **`src/core/assetPath.ts`** (nieuw): single helper die `import.meta.env.BASE_URL` als prefix gebruikt voor runtime-strings. Vite herschrijft alleen HTML/import-paden, niet runtime-strings die naar Phaser's `this.load.image()` of Three's TextureLoader gaan.
- 31 hardcoded `/assets/...` paden gerouteerd via `assetPath()` in `L1Scene.ts` (25), `sfxBus.ts` (2), `parallaxScene.ts` (1).
- Productie-build-bundle bevat nu correct `"/games/cosmos-2026/"` prefix; preview-test 3/3 200 op alle paden.

### Fixed (8C — Build pipeline force-overwrite + sentinel)

- `scripts/postbuild-copy-public.mjs` herschreven van `--ignore-existing` (silent-skip) naar **byte-equal verify + force-overwrite**. Eliminates een hele klasse van silent-drift tussen `public/` en `dist/`.
- 4 SENTINEL_FILES (cosmo-cling-right, cosmo-hurt, bomb-throw, bomb-boom) die exit-1 forceren als ze na de copy ontbreken — voorkomt herhaling van Sprint 7E mysterie.
- Diagnose: pipeline was sinds commit `bca9cf0` al correct; Sprint 7E observatie kwam vermoedelijk van stale dist/ vóór die commit. Maar het silent-skip-risk was reëel — nu gehard.

### Changed (8D — Cosmo state-machine polish)

- `Cosmo.ts`: `bombCooldown` was hardcoded 0.4 — drift met `BOMB.COOLDOWN_S` (0.35). Single source of truth.
- Death-state krijgt **Z-rotation tween** (90° easeIn 600ms, sign volgt facing). Sprint 7A open issue closed.
- `setTimeout` voor damage→fall reset vervangen door `scene.time.delayedCall` (respecteert Phaser-pause).
- `bombTargets[]` unbounded growth gedocumenteerd als L2-pass cleanup; `dead`-guard voorkomt crash.

### Added (8B — Suno API integratie, scaffold + wiring)

- **`scripts/sprint8b/suno_client.py`** (nieuw): Python client met `credits`/`generate`/`wait_for_task`/`download`/`transcode_to_mp3`. CLI subcommands. Cosmos-style suffix + negative tags hardcoded (folktronica, koto, wooden flute, D minor, no blues rock).
- **`scripts/sprint8b/generate_mvp_tracks.py`** (nieuw): batch driver voor 4 MVP tracks (title-theme, slow-bloom-loop, inkpool-loop, boss-stinger). Pre-flight credit check, sequential 15s gap, .json sidecars.
- **`audioFFTBridge.ts`** voorbereid op 1-line swap (`MUSIC_TRACK = assetPath(...)`); `<audio>.error` listener toegevoegd voor swap-mistake debugging.
- **Memory** (`suno_api.md`): endpoint inventory, prompt-structuur, gotchas (callBackUrl required, 429-as-HTTP-200, 8 credits/V4_5 generate, soft rate-limit).
- **Status**: account heeft 2.0 credits, 32 nodig. **0 tracks gerenderd**. Top-up bij sunoapi.org Basic $5 → 1000 credits → 125 generations. Daarna `python3 scripts/sprint8b/generate_mvp_tracks.py` rendert ~12 min unattended.

### Architectuur-leringen Sprint 8

- **Vite's BASE_URL replace werkt alleen op HTML + import-paden**, NIET op runtime-string-literals naar engine-loaders. Single helper (`assetPath()`) is de duurzame fix; alternatieven (postbuild regex, build-time-codegen) zijn brittle.
- **Silent-skip semantics in build-pipeline = silent regression risk**. Force-overwrite + sentinel-guard maakt regressies hard-fail bij build-tijd ipv runtime in productie.
- **sunoapi.org returns code-in-body voor errors** (HTTP 200 + `code:429` voor insufficient credits). Always inspect body, never trust HTTP status alone.
- **`callBackUrl` is required field** in sunoapi.org generate endpoint, ook bij polling. Dummy `https://example.com/no-callback` voldoet.

### Cost

$0 (alleen code; Suno top-up door gebruiker, kosten daar bekend: $0.005-0.04 per track op Basic plan).

### Niet gedaan (Sprint 9+)

- 4 Suno tracks renderen (blocked op credit top-up — single python-script-run zodra opgelost)
- Walk-1/walk-2 eye-drift fix (per-frame seed-lock, $0.18) — TODO-comment in Cosmo.ts
- Bomb pickup → Cosmo invuln-frames bij death state (edge-case)
- L2/L3/L4 levels
- Save-state / progressie tracking

## [0.7.0] — 2026-05-01 — Sprint 7: parallel-team — anim, mobile, sprites, bundle

Vier agents tegelijk: multi-frame Cosmo anim (7A), mobile/touch-controls (7B), bundle-size optimalisatie (7C), enemy + bomb sprite-generation pass (7D). Resultaat: Cosmo loopt en springt nu echt anders, mobile is speelbaar, main bundle is van 2.2MB naar 48KB en alle 12 enemies + bomb-stack hebben definitieve assets.

### Added (7A — Multi-frame Cosmo anim)

- **6 pose-frames** in `public/assets/sprites/v3/`: cosmo-walk-1, cosmo-walk-2, cosmo-jump-up, cosmo-jump-fall, cosmo-cling-right, cosmo-hurt — alle BiRefNet'd transparant
- **Pipeline-doorbraak**: `fal-ai/flux-control-lora-canny` met **programmatische stick-figure skeletons** (PIL-rendered, geen handgetekende sketches nodig). Recipe: skeleton-only + control_lora_strength 1.2 + style-first prompt
- **Sprint 5B/6A failure-modes definitief opgelost**: image-to-image als pose-anchor (nee), text-only suction-cups (nee), inpaint-refinement (nee). ControlNet/canny met skeletons geeft hard pose-constraint.
- Cosmo state-machine: `playStateAnim()` vervangen door `updateAnim(dt)` texture-swap. Walk-cycle alterneert walk-1/walk-2 elke 133ms via `walkPhase` accumulator. Cling: `setFlipX(clingSide < 0)` voor left-wall mirror. Damage + death gebruiken cosmo-hurt.

[grid: /assets/case-study/cosmo-multi-frame/skeletons/skeleton-walk-1.png /assets/sprites/v3/cosmo-walk-1.png /assets/case-study/cosmo-multi-frame/skeletons/skeleton-jump-fall.png /assets/sprites/v3/cosmo-jump-fall.png "Skeleton walk-1 control-input · Walk-1 result · Skeleton jump-fall · Jump-fall result"]

[grid: /assets/sprites/v3/cosmo-walk-1.png /assets/sprites/v3/cosmo-walk-2.png /assets/sprites/v3/cosmo-jump-up.png /assets/sprites/v3/cosmo-jump-fall.png /assets/sprites/v3/cosmo-cling-right.png /assets/sprites/v3/cosmo-hurt.png "walk-1 · walk-2 · jump-up · jump-fall · cling-right · hurt"]

**Pose-fidelity**: 5/6 frames excellent (8-10/10), walk-1/walk-2 ship-quality op 120px in-game (style-thinness barely visible). Cost ~$0.88. Open issue: walk-1/walk-2 eye-drift (1 vs 2 oogvariant) — per-frame seed-lock fix is $0.09 elk indien storend in playtest.

### Added (7B — Mobile + touch-controls)

- **`src/ui/touchOverlay.ts`** (nieuw): 4 canvas-drawn knoppen (LEFT/RIGHT 80px d-pad bottom-left + BOMB 80px / JUMP 100px bottom-right). Canvas-glyphs (chevron-arrows + ink-aubergine bomb-disk + saffron pressed-state). **Geen emoji's, geen unicode-icons** — pure canvas-primitives volgens project-regel.
- **`src/core/deviceDetect.ts`** (nieuw): `isTouchDevice = (touch-capable) && (innerWidth < 1024)`. iPad Air landscape blijft desktop UX, iPad Mini portrait krijgt overlay, hybride laptops ≥1280 ook geen overlay.
- **`InputController.setVirtualInput()`**: rising-edge merge van virt + kb signals voor jump/bombJustPressed. Cosmo state-machine en fysica niet aangeraakt — alleen input-mapping.
- **Responsive HUD**: pills 16/14/12px (desktop / <1024 / <600), safe-area paddings rond HUD én overlay-root, viewport-fit=cover voor iPhone notch.
- **Cosmo display-size**: 120px desktop, 80px mobile via Phaser scale. Body geometry pixel-identiek (180×380 op 1024px source) → collision invariant.
- **"Best on desktop" disclaimer-pill** met 6s auto-dismiss + close-button.
- **Playwright-tests** op iPhone 14 Pro / iPad Mini / desktop allen groen.

### Added (7D — Sprite-generation pass)

12 nieuwe assets, $0.84 totaal, geen `spriteTodo: true` flags meer.

[grid: /assets/sprites/v4/enemy-parachute.png /assets/sprites/v4/enemy-pinkworm.png /assets/sprites/v4/enemy-ghost.png /assets/sprites/v4/enemy-spittingwall.png /assets/sprites/v4/enemy-dragonfly.png /assets/sprites/v4/enemy-flyingwisp.png "parachute · pinkworm · ghost · spittingwall · dragonfly · flyingwisp"]

[grid: /assets/sprites/v4/enemy-suctioncrawler.png /assets/sprites/v4/enemy-tuliplauncher.png /assets/sprites/v4/enemy-spark.png /assets/bombs/bomb.png /assets/bombs/bomb-pickup.png /assets/tiles/tile-wall-cracked-painted.png "suctioncrawler · tuliplauncher · spark · bomb · bomb-pickup · cracked-wall"]

- **9 enemy-sprites** in `public/assets/sprites/v4/` (8× one-shot, spark v2)
- **3 bomb-assets** in `public/assets/bombs/` + `public/assets/tiles/tile-wall-cracked-painted.png` (cracked-wall v3 — eerst 2× tile-trap)
- **2 SFX** via ElevenLabs: `bomb-throw.mp3` (9KB) + `bomb-boom.mp3` (15KB), wired in `sfxBus.ts` SFX_MANIFEST
- **EnemyTypes.ts**: 9 enemies → spriteTodo:false, dedicated keys, tint:0
- **Bomb.ts**: texture-key `'bomb'` met `'bomb-procedural'` als fallback
- **BreakableWall.ts**: Graphics ink-crack overlay verwijderd — cracks zitten nu baked in de texture

### Changed (7C — Bundle-size manualChunks)

- `vite.config.ts` — `build.rollupOptions.output.manualChunks` toegevoegd: `three-vendor` (three + postprocessing), `phaser-vendor` (phaser), `audio-vendor` (howler + tone)

| Chunk | Before | After |
|---|---:|---:|
| main-*.js | 2,228 kB (gz 510) | **48 kB (gz 15)** — −98% |
| three-vendor | — | 536 kB (gz 129) |
| phaser-vendor | — | 1,609 kB (gz 358) |
| audio-vendor | — | 36 kB (gz 10) |

Total gzip ~gelijk; winst zit in parallel-loading. Geen logic-changes, geen dynamic imports nodig.

### Sprint 7 architectuur-leringen

- **Programmatische stick-figure skeletons + Flux Control LoRA Canny** geeft hard pose-constraint. Skeleton-only (geen image_url als style-ref) op control_lora_strength 1.2 + style-first prompt is de werkende recipe. Geen handsketch nodig.
- **Suction-cup-pads werkten one-shot op 4-legged crawler** waar 12/12 op biped Cosmo faalden. Patroon: matching style-association + non-biped anatomy omzeilt training-bias. Toekomstige Cosmo-DNA NPCs kunnen hierop bouwen.
- **BiRefNet polling**: `response_url` is HTTP 400 tijdens IN_QUEUE — poll `status_url` tot COMPLETED, dan response_url fetchen. Algemene fal.ai gotcha — gefixed in Sprint 7D `generate.py`.
- **Tile-trap fix-recipe**: drop "psychedelic illustration" + "cosmic-adventure mood" termen (scene-magnets) en gebruik stripped close-up macro prompt + stacked anti-landscape negatives.
- **Spark-hazard fix**: lead met "ONE tiny X hazard, NOT a creature NOT a body NOT fur" upfront — voorkomt body-growth rond abstract concept.
- **Touch-overlay threshold (1024px) bewust over UA-sniffing gekozen** — touch+viewport heuristic is duurzamer en respecteert hybride devices.

### Cost

~$1.72 fal.ai + ElevenLabs (7A: $0.88 inpaint-pipeline + 7D: $0.84 sprite-gen). Sprint 7B/7C = $0 (alle code).

### Niet gedaan (Sprint 8)

- Walk-1/walk-2 eye-drift fix (per-frame seed-lock — $0.09 per frame indien storend in playtest)
- Suno-tracks genereren (handmatig via suno.com — niet binnen agent scope)
- L2/L3/L4 levels (alleen L1 First Steps speelbaar tot nu)
- Save-state / progressie tracking
- Settings-knop `?touch=1` override voor iPads ≥1024px die toch touch willen

## [0.6.0] — 2026-05-01 — Sprint 6: parallel-team — gameplay verticaal compleet

Vier agents tegelijk: Cosmo canonical inpaint-fix (6A), enemies + damage-systeem (6B), bombs + VFX + breekbare walls (6C), audio-FFT bridge (6D). Resultaat: L1 is van een speel-loop met items + parallax naar een **echte gameplay-sandbox** met vijanden, kills, bombs, walls, en muziek-reactieve post-FX.

### Added (6A — Cosmo canonical v2)

- **`cosmo-canonical-v2-cleaned.png`** wired in L1Scene (`src/phaser/scenes/L1Scene.ts:88`) — extended-arm geometry met zwarte disc-pads aan de tips, tail bijna volledig verwijderd
- **Pipeline-doorbraak**: Flux Fill (`fal-ai/flux-lora-fill`) bleek wél te werken voor *ADD-geometry* in lege bg-space (anders dan image-to-image die alleen noise-init was). Combineren met **PIL alpha-erase** voor *REMOVE-geometry* (tail) — deterministisch, $0.
- 15-image case-study series in `public/assets/case-study/cosmo-inpaint-process/` met manifest

[grid: /assets/case-study/cosmo-inpaint-process/01-source.png /assets/case-study/cosmo-inpaint-process/08-mask-extended-arms.png /assets/case-study/cosmo-inpaint-process/09-result-extended-arms.png /assets/case-study/cosmo-inpaint-process/15-final-v4.png "Bron canonical (v053) · Mask voor extended arms · Flux Fill output · Final v4 in-engine"]

> Wat NIET werkte: tail-inpaint met "no tail no lizard" prompt (Flux regenereerde identieke lizard-tail — sample-bias is anti-prompt-resistent), hand-inpaint op torso-edge (renderde als over-ear headphones door face-level Y-coord), refinement-pass op v3 (Flux voegde mini-extra-head toe aan disc).

> Wat WEL werkte: extended-arm-mask in PAPER bg-area (Flux Fill genereerde nieuwe arm-anatomie out of nothing) + alpha-erase post-BiRefNet voor cosmetische cleanup. Cost ~$0.25 binnen budget.

**Open**: disc-fuse niet 100% (claws zichtbaar rond pads, acceptabel op 120px display), mini tail-stub remnant (cosmetisch), multi-frame anim nog steeds onopgelost (ControlNet/sketch-to-img blijft Sprint 7).

### Added (6B — 12 enemies + damage-systeem)

- **12 enemy-kinds** in `src/phaser/entities/enemies/` (Enemy.ts + EnemyTypes.ts + EnemyProjectile.ts): brumberry, hopper, parachute, eyePlant, pinkWorm, ghost, spittingWall, dragonfly, flyingWisp, suctionCrawler, tulipLauncher, sparkHazard
- **11 gedragsknopen** wired: patrol (met edge-flip probe), hop (timed), drifter (post-stomp fall), wallTurret (aimed projectile), burrow (proximity-surface), proximityGhost (chase only-when-faced-away), homing (lerp), sinusoid + dive-alignment, wallCrawler (placeholder), tulipLauncher (friendly bounce), rail
- **Stomp-detectie**: `cosmo.vy > 60` AND `cosmo.bottom <= enemyTop + 35% * height + 8px` → kill + bounce-up. Side-touch → damage met invuln-frames.
- **Eye Plant + Spitting Wall** zijn `bombOnly` (skippen stomp-branch, alleen bom-kill). **Ghost + Spark** zijn `invincible`.
- **Hint Globe L1-1/2/3** voices wired aan trigger-zones (col 2/50/30)
- Legend uitgebreid met 12 lower-case enemy-chars (b/h/p/e/w/g/s/d/f/c/t/z) — geen botsing met bestaande tile-chars
- 3 echte sprites + 9 hergebruikt-met-tint (`spriteTodo: true` flag voor toekomstige asset-gen — geen canvas-primitives, geen emoji's)

### Added (6C — Bombs + explosion VFX + breekbare walls)

- **Bomb entity** (`src/phaser/entities/Bomb.ts`): throw-arc ±320X / -450Y, 1.5s fuse met red/cream blink-tween in laatste 0.6s, 64px explosion-radius, 0.4s throw-cooldown
- **Cosmo throw-action**: `bombJustPressed` AND `bombs > 0` → squash-tween + spawn (bestaande `bombs` counter wordt nu echt gebruikt)
- **BreakableWall entity** (`src/phaser/entities/BreakableWall.ts`): legend `B`, ink-crack overlay (Graphics, 3 lijnen + saffron tip-dot), 280ms scale/alpha tween-out bij explosion-overlap
- **Bomb-pickup** (legend `Q`): overlap-only sprite, `cosmo.pickupBomb(1)`, scale-up + fade-tween
- **BombTarget contract** afgestemd met 6B: enemies registreren in `bombTargets[]`, `vulnerableToBomb` flag wordt gerespecteerd
- **Explosion VFX**: kaleidoTrigger +0.9 (drives bloom +0.45 + chroma +0.004), damagePulse +0.6 (drives datamosh-tear ~0.3s), 3-laag canvas flash-circle (faded-rose halo / saffron core / cream center) r 8→74px alpha 1→0 over 400ms easeOut. NO emoji-fallback.

**Sprite-status**: Bomb + pickup zijn procedural (`bomb-procedural`, `bomb-pickup-procedural`) met TODO voor Asset Generator. Cracked-wall hergebruikt `tile-wall-painted` + Graphics-overlay.

### Added (6D — Audio-FFT bridge)

- **`src/audio/audioFFTBridge.ts`** (nieuw): AnalyserNode op een dedicated `musicGain` sub-bus (deelt Howler.ctx, geen extra AudioContext-leak), fftSize 256, smoothing 0.8
- **8-band log-aggregator**: edges `[2, 4, 8, 16, 32, 64, 96, 128]` — denser in lage frequenties (matcht palet kick/bass/koto-pluck). Per frame `getByteFrequencyData()` → 8-band → `mix(prev, new, 0.4)` lerp → `globalUniforms.audioFFT`
- **Shader-mapping**:
  - `bloom.intensity += lows*0.6` (avg band 0–1)
  - `kaleido.strength += mids*0.25`, `kaleido.angle += mids*0.6` (avg band 2–4)
  - `fluid.amplitude = 0.022 + highs*0.025` (avg band 5–7)
  - 1-line mapping-comment toegevoegd in `kaleidoscope.ts` en `fluidDisplacement.ts`. Bestaande uniforms hergebruikt — geen rename, geen sloop.
  - **Three Pass Rule** intact: FFT is geen extra convolution-pass.
- **Placeholder-synth** voor dev: triangle 110Hz + saw 55Hz door swept lowpass (LFO 0.07Hz) + tremolo 1.1Hz. Excitet alle 8 bands voor visuele verificatie. **Suno-swap = 1 line** (`MUSIC_TRACK = '/assets/audio/music/title-theme.mp3'` → `createStreamedTrack()` neemt over via `<audio>` + MediaElementAudioSourceNode).
- **UI**: `M` mute music (alleen sub-bus, SFX onaangetast), `F` FFT-snapshot in console. AudioContext-resume idempotent gewired aan click/keydown/touchstart.

### Changed

- `src/main.ts` — audioFFTBridge boot wiring + key-handlers M/F
- `src/three/postFX/postFX.ts` — audioFFT consumeert in update() (lows→bloom, mids→kaleido, highs→fluid)
- `src/data/levelL1.ts` — legend uitgebreid (12 enemy-chars, B breakable-wall, Q bomb-pickup) + sample placements row 18
- `src/phaser/scenes/L1Scene.ts` — enemiesGroup + enemyProjectilesGroup + bombTargets[] + 209 regels Sprint 6B/6C wiring
- `src/phaser/entities/Cosmo.ts` — `attachBombHooks({ throwBomb })` injection-pattern (avoid scene/entity import-cycle), squash-tween, `pickupBomb()` exposed

### Cost

~$0.25 fal.ai (6A inpaint pipeline). Sprint 6B/6C/6D = $0 (alle code, geen asset-gen calls).

### Sprint 6 architectuur-leringen

- **Flux Fill werkt voor ADD-geometry** in lege canvas-zones, **niet voor REMOVE met semantic anti-prompt** (sample-bias wint). Voor REMOVE: PIL alpha-erase deterministisch, $0.
- **Refinement-passes zijn risk-prone** (Flux interpreteerde gemaskeerde claw-zone als "small entity attached to disc" → mini-extra-head op v4). Stop bij eerste werkbare result.
- **Injection-pattern voor scene→entity hooks**: `cosmo.attachBombHooks({ throwBomb })` voorkomt circular import (Cosmo zou anders L1Scene moeten importeren).
- **BombTarget interface** als runtime-contract laat 6B en 6C parallel werken zonder file-conflicts. Pattern voor toekomstige cross-system features (e.g. damage-modifiers, status-effects).

### Niet gedaan (Sprint 7)

- Multi-frame Cosmo anim (ControlNet of sketch-to-img — image-to-image bewezen niet)
- Suno-tracks genereren (handmatig via suno.com — niet binnen agent scope)
- Mobile/touch-controls
- Bundle-size optimalisatie (`manualChunks` voor Three.js + Phaser zou de 2.2MB main chunk halveren)

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
