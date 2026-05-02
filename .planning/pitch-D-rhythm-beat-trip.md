# Pitch D — Rhythm Beat-Trip

> *Patatap's percussion-toy met Beat Saber's flow-state, gefilterd door Polyphia music-video aesthetics. De Suno-tracks zijn niet de soundtrack — ze ZIJN de game.*

**Tagline**: "Tap Cosmo's universe into existence." Geen score, geen game-over, geen tutorial. Open de tab, hoor de beat, tik mee. De track speelt sowieso door — wel meedoen = je bent VJ, niet meedoen = je kijkt een muziekvideo.

---

## 1. Core loop (30 seconden)

1. **0:00** — Pagina opent. Title-theme.mp3 (existing!) start meteen op laag volume. Cosmo dead-center, idle-bobbing op de beat (head-bob, antenne-flap, body-pulse op kicks via FFT band-0).
2. **0:04** — Eerste tap-target spawnt: een kleine concentrische ring die naar Cosmo toe pulseert, perfect-on-beat. Geen tekst, alleen het ritme van de visuele puls leert "tap-now".
3. **0:05** — Speler tapt. **Perfect** = pop-color burst (band-shifted bloom), Cosmo doet één spin, kaleidoscope-pass clipt 200ms naar 8-fold (zie `src/three/postFX/kaleidoscope.ts`).
4. **0:06–0:25** — Targets blijven spawnen op vooraf-gemapte beat-grid (16 stappen per maat, ~120 BPM in title-theme = 8 sec/maat). Speler verzamelt onzichtbaar combo. Bij **8-combo** triggert auto-`startHallucination(HALLUCINATION_PEAKS)` — de hallucination-track laidt over de basetrack, fluid-displacement gaat 4× sterker, scherm "drukt naar binnen".
5. **0:25–0:30** — Speler is in flow. Heeft niets gelezen. Tikt door. Track loopt naadloos via `audio.loop = true` (al gewired). Volgend nummer queued na 90s of bij swipe-up.

**Hook moment**: bij elke perfect tap voelt het alsof JIJ de drum-fill triggerde. Dat is de truc — je tikt MET het ritme, het systeem laat je geloven dat je het MAAKT.

---

## 2. Mobile-first input vocabulair

| Gesture | Functie | Mapping |
|---------|---------|---------|
| **Tap-on-target** | Beat hit | Pixel-perfect of "good"/"perfect" via timing-window (±80ms / ±40ms) |
| **Swipe links/rechts** | Tempo-shift / song-skip | Korte swipe = tempo-bend (track pitch ±2%), lange swipe = next track |
| **Hold** | Build-up tension | Langer vasthouden = filter-sweep + bloom-charge; loslaten OP de drop = mega-burst |
| **Two-finger spread** | Kaleidoscope-fold-count | Spread = meer folds (2→8→16), pinch = solid mirror |
| **Shake device** | Glitch-burst | Confetti van pop-bursts; "easter-egg" voor stoners die het ontdekken |

Geen joystick, geen knoppen, geen menu. Eén icoon (mute) in hoek. Klaar.

---

## 3. Cosmo: groot, centraal, levend

- **Schermdekking**: 35–45% verticaal, dead-center horizontaal (op portrait mobile). Op landscape: vertical-center, slight off-axis voor compositie.
- **Beat-rig**: 4 onafhankelijke layers gekoppeld aan FFT-banden (`globalUniforms.audioFFT[0..7]`):
  - Band-0 (sub/kick) → body Y-scale pulse + drop-shadow throb
  - Band-1 (bass) → head-bob amplitude
  - Band-3 (mid/flute) → antenne wave-modulatie
  - Band-6 (air) → eye-twinkle + outline glow
- **Tap-response**: bij perfect tap doet Cosmo één frame "stretch+squash" (cartoon-bounce, niet komisch — alsof hij meeshockt). Bij 8-combo = volledige spin met motion-trails.
- **Idle persoonlijkheid**: Cosmo's H3-canon (Hayao × Moebius × chameleon, zie v0.5.1) blijft. Subtiele kleur-shift over 30s op `slow-bloom-loop.mp3`.
- **Asset-pipeline**: bestaande `public/assets/cosmo/` sprites blijven bruikbaar; we voegen alleen 4–6 beat-pose-frames toe via Nano Banana.

---

## 4. Visuele hiërarchie — post-FX als feedback

De post-FX stack v0.4.0 (`postFX.ts`, `fluidDisplacement.ts`, `kaleidoscope.ts`, `trippyEventDirector.ts`) wordt opnieuw verkabeld voor tap-precision:

| Tap-precision | Post-FX response |
|---------------|------------------|
| **Perfect** (±40ms) | Bloom intensity 1.0 → 1.6 voor 200ms, kaleido fold-count +2, fluid wobble +30% |
| **Good** (±80ms) | Bloom 1.0 → 1.2 voor 120ms, lichte chromatic aberration |
| **Miss** (>±80ms) | Geen punishment-flash, alleen 600ms "flat" — bloom dipt naar 0.7. Aesthetic, geen rood scherm. |
| **8-combo** | `TrippyEventDirector` triggert "halluc-mode": fluid 2.5×, kaleido 16-fold, +HALLUCINATION_PEAKS overlay |

De `audioFFTBridge` is al klaar — band-data drijft de continue baseline; tap-events drijven de discrete bursts. Beide additief.

---

## 5. Muziek-koppeling (zeven tracks worden zeven "tracks")

| Existing file | Rol in Beat-Trip | Beat-pattern |
|---------------|------------------|--------------|
| `title-theme.mp3` | Track 1 — "Welcome / chill intro" | 16-step grid, 64 taps/loop, easy |
| `slow-bloom-loop.mp3` | Track 2 — "Float" | 8-step grid, hold-heavy, ambient |
| `inkpool-loop.mp3` | Track 3 — "Descent" | 32-step grid, density rising, swipe-prompts |
| `hallucination-peak-1.mp3` | Auto-trigger op 8-combo (loopt al via `startHallucination()`) |
| `hallucination-peak-2.mp3` | Idem, alterneert via `pickFrom()` |
| `damage-warp-1.mp3` | Re-purposed: "tempo-shift" stinger op swipe |
| `boss-stinger.mp3` | Track 4 — "Challenge minute" — 60s opt-in, 128-step dense grid, scoring telt hier wel. |

**Beat-pattern authoring**: per track een `.json` of `.beatmap.ts` met `{ time: 0.42, type: 'tap'|'hold'|'swipe', strength: 1 }`-events. Voor 4 tracks ~250-400 events totaal. Initieel handmatig getapt-tegen-de-track door Richard (2-3 uur per track). Later: heuristisch FFT-extracted via `audioFFTBridge.snapshot()` → onset-detection script.

---

## 6. Scoring + progressie (minimalistisch)

- **Per-song combo-record** (localStorage). Vorige record toont alleen als ghost-flicker bij gelijkstand, niet groot in beeld.
- **Total taps lifetime** (Cosmo-cookie). Bij milestones (1000/10000/100000) zachte unlock — kleur-palette voor Cosmo, of nieuwe kaleido-mode.
- **"Perfect run" badge**: hele track 100% perfect = shareable replay-card. Niet verplicht, niet zichtbaar tot het gebeurt.
- **GEEN levels, leaderboards, XP, achievements-popup**. De track is de progressie.

---

## 7. Virale haakjes — TikTok-first

1. **60s clip-export** — auto-recorded laatste 60s van je sessie, met audio + jouw tap-graphic overlaid (ring-pulses + cosmo-spins). One-tap share. Watermerk Cosmo-logo. **Dit is het hoofdkanaal.**
2. **Perfect-run replay** — als je een hele track perfect doet, krijg je een animated MP4 met je naam erop. Shareable.
3. **Daily-song challenge** — elke dag wordt 1 track "featured". Alle scores van die dag verschijnen in een opt-in feed.
4. **Friend-pass-the-tap** — share een track-link met een specifieke combo-target. Vriend opent → moet die combo halen om "back to sender" te krijgen. Asyncroon, geen account nodig.
5. **Audio-only "I tapped this"** — voice-quote van Cosmo (we hebben al `globe-l1-1/2/3.mp3` ElevenLabs voices) overlay op je clip. Stoner-energie: "yo… I made this happen."

---

## 8. Onboarding (zonder tekst)

- 0–3s: Cosmo idle-bobs. Track speelt al.
- 3–5s: Eerste tap-ring spawnt MET een single-frame finger-icon (geen tekst, geen pijl). Verdwijnt na eerste tap.
- 5–10s: Tweede en derde tap volgen. Speler heeft het door.
- 10–15s: Eerste hold-target verschijnt — ring is concentrisch, "vraagt" om vasthouden via puls. Loslaten op de drop = visuele bevestiging.
- 15s+: Speler speelt.

Geen "Press Start". Geen "Tutorial complete!". De track gaat door — als de speler niets doet kijken ze gewoon naar Cosmo grooven (auto-VJ-mode).

---

## 9. Anti-stress design (kritiek voor stoner-doelgroep)

- **Geen game-over screen**. Ooit.
- **Geen rode flash, geen punishment-sound, geen vibratie op miss**.
- **Miss = aesthetic dip**, niet correctie. Het wordt een "rust"-moment in de beat.
- **Auto-VJ-mode**: als 10s geen tap → game speelt zichzelf met procedurele auto-taps op 60% perfect, post-FX blijft draaien. Speler kijkt mee. Zodra speler weer tapt → handover.
- **Geen timer, geen levensbalk, geen counter-popup**. Combo-getal staat KLEIN in hoek, fade-in pas vanaf 4-combo.

---

## 10. Stoner-specifiek (locked-in design)

- **"One more song" loop** — bij track-eind queueed automatisch volgende. Skip mogelijk via swipe-up. Heel makkelijk om 20 minuten te verliezen.
- **Geen verbale instructies**. Geen "tap here". Geen captions. Pure visuele communicatie.
- **Donker scherm-default** met selectieve neon — past bij avond-gebruik.
- **Tactiele continuïteit**: elke tap heeft haptic (mobile vibrate API), zachte 8ms pulse, niet nervig.
- **Lock-screen-friendly**: track loopt door als scherm dimt. (Web Audio + `wakeLock` API).

---

## 11. Existing assets — reuse audit

| Asset | Status | Reden |
|-------|--------|-------|
| **7 audio tracks** | KEEP — kerncomponent | De hele game draait om deze 7 files. Goud. |
| **`audioFFTBridge.ts`** | KEEP — werkt al perfect | 8-band FFT → uniforms is exact wat we nodig hebben |
| **Cosmo H3 canon (sprites/3D)** | KEEP — character is cement | 4–6 beat-pose-frames bijgenereren |
| **Post-FX stack (`postFX/`, `kaleidoscope`, `fluidDisplacement`, `trippyEventDirector`)** | KEEP — backbone | Alleen herkalibreren voor tap-events i.p.v. platformer-events |
| **GlobalUniforms** | KEEP — al gewired | Tap-events worden nieuwe uniform-bron |
| **`sfxBus.ts`** | KEEP — Howler+SFX nog gebruikt voor pop-bursts | |
| **Cosmo voices (ElevenLabs)** | KEEP — viral hook | Audio-only quotes |
| **Tile-set (`public/assets/tiles/`)** | DROP | Geen platformer-niveaus meer |
| **Enemies (`public/assets/sprites/` enemies)** | DROP | Geen vijanden |
| **Bombs / pickups** | DROP / herbruik visueel | Pop-burst-asset kan vermomd worden uit bomb-particles |
| **Level-data (`levelL1.ts`, etc.)** | DROP | Geen levels |
| **Trampolines (Sprint 5)** | KEEP visueel als tap-target ring | Hergebruiken als spawning ring-graphic |

**Code-deletion estimate**: ~40% van `src/` weg (entity-systeem, level-loader, collision, enemy-AI, platformer-physics). Behouden: `core/`, `audio/`, `three/postFX/`, `ui/touchOverlay`. Nieuw: `src/rhythm/` (beatmap-loader, tap-judge, combo-state, target-spawner).

---

## 12. Sprint scope — 4-6 sprints ground-up

| Sprint | Scope | Output |
|--------|-------|--------|
| **R1 — Skeleton** | Strip platformer, behoud audio+postFX+Cosmo. Cosmo center, idle-bob op FFT. | Cosmo grooved op de tracks, geen interactie |
| **R2 — Tap-judge** | Beatmap loader (.json), tap-target spawner, timing-window judge, perfect/good/miss feedback. 1 track gemapt. | Speelbare prototype op 1 track |
| **R3 — Visual feedback** | Post-FX herkalibratie op tap-precision, kaleido-fold ramp, fluid-displacement-burst, halluc-mode op 8-combo. | Het VOELT goed |
| **R4 — Mobile input + hold/swipe** | Touch-overlay refactor, hold-targets, swipe-tempo-shift, two-finger kaleido-control. 4 tracks volledig gemapt. | Volledige gameplay |
| **R5 — Virale features** | 60s clip-export (MediaRecorder API), perfect-run replay-card, share-links. Auto-VJ-mode polish. | TikTok-ready |
| **R6 — Polish + ship** | Onboarding-tuning, haptic, wakeLock, lock-screen audio, Cloudflare deploy, daily-song-challenge backend (kan static JSON zijn). | LIVE |

**Realistische tijdslijn**: 5 sprints à ~1 week effectief = 5 weken. R5 (clip-export) is het grootste risico op scope-creep.

---

## Waarom rhythm-koppeling de viraalste route is

**TikTok is een audio-eerst platform**. Een visuele game met losse audio = weinig native traction. Maar een game waar de speler-input + visuele feedback PERFECT op de track zit, met 60s clip-export inclusief audio + tap-graphic — dat is direct re-postable contentmateriaal. Het algoritme houdt van originele audio met visuele synergie; wij leveren beide kant-en-klaar. Bovendien: muziek-content triggert duet/stitch-cycles (mensen reageren op andermans clips door zelf de track te tappen). Patatap (2014) ging viraal puur op browser-percussie zonder share-mechanic — wij hebben share-mechanic + Suno-grade audio + post-FX die andere browser-rhythm-games niet halen. De Suno-tracks zijn gerendered en betaald — we verzilveren die investering door ze de hoofdrol te geven, niet de achtergrondmuziek.

## Grootste risico: tap-pattern designwerk

**Beatmap authoring is non-trivial**. Per track 60-100 hand-getapte events, dan iteratief polishen tot het ritme "klopt". 4 tracks × 3-4 uur = 12-16u puur authoring werk. Schaalt niet als we later meer tracks willen. Mitigatie-opties:

1. **Externe DSL** — bestaande tools zoals osu! `.osz` formaat of StepMania `.sm` adopteren, dan kunnen anderen patterns maken
2. **Auto-extractor** — onset-detection via Web Audio (FFT spectral-flux peaks) genereert candidate beatmap, mens polisht
3. **Community-mode** — speler-gemaakte beatmaps uploaden, top-rated worden featured

R2-sprint moet beslissen: handmatig tappen voor MVP (snelst) vs. tooling investeren (schaalbaarder maar +1 sprint). Aanbeveling: handmatig voor R2, auto-extractor onderzoeken in R5 als virale traction begint.

---

**Verdict**: van platformer naar "Patatap met cinematic post-FX en je eigen Suno-soundtrack" is een radicale pivot, maar het verzilvert exact wat al af is (audio, FFT-bridge, post-FX, Cosmo-canon) en dropt wat verzwakt (level-design, enemy-AI, platformer-feel-tuning). Mobile-first, viraal-first, stoner-first.
