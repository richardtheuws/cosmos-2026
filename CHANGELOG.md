# Changelog — Cosmos Cosmic Adventure 2026

Alle wijzigingen volgen [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) en [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

De `/updates/` pagina wordt automatisch uit dit bestand gegenereerd via `npm run updates:build`.

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
