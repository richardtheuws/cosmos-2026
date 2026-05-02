# Pitch C — Trip-Room Toy

**Tagline**: *"Cosmo woont in je telefoon. Hij doet niks tot jij hem aanraakt — en dan gebeuren er dingen."*

**Genre**: Idle-toy / Digital pet / Hypnotische experience (geen game)
**Inspiraties**: Plug & Play (Etter), Mountain (David O'Reilly), Everything (O'Reilly), Yume Nikki (room-as-mood), Proteus (no-fail exploration), iPad-water-physics-toys, Tamagotchi-zonder-honger
**Doelgroep**: Stoners (primair), focus-zoekers / ADHD-volwassenen, design-twitter, "I downloaded a weird app"-vibe
**Reward-model**: ZERO score. Pure visual+audio feedback. Share-bare moments. Het ding dat je per ongeluk 90 minuten in een Uber zit te aaien.

---

## 1. Core loop (30 seconden — wat speel je MET?)

Cosmo staat midden op je scherm. De wereld ademt. Jij hebt een interactie-vocabulaire van **6 gestures** die elk een ander soort "thing" veroorzaken:

| Gesture | Wat gebeurt |
|---|---|
| **Single tap (op Cosmo)** | Cosmo blinkt, antenne-bloem trilt, audio-pluk |
| **Single tap (op leegte)** | Bubbel verschijnt op die plek, drijft op, pop met chime |
| **Tap-and-hold (op leegte)** | Cosmo loopt rustig naar dat punt — dat is de "doel"-vervanger |
| **Swipe over Cosmo** | Antenne-bloem buigt mee als gras in wind, parallax-tilt mee |
| **Two-finger pinch** | Tijd vertraagt + kaleidoscope-intensity zoomt mee |
| **Long-hold center (3s)** | "Deep trip" mode — 15s peak-immersion van alle post-FX tegelijk |

De 30s loop: jij raakt iets aan → er gebeurt iets visueel-akoestisch beautifuls → je vraagt je af wat ANDERE input zou doen → je probeert het → het werkt of het doet iets onverwachts → herhaal. Géén progress-bar. Géén volgend level. Wel: de wereld zelf cycleert (zie §5).

---

## 2. Mobile-first input

**Tap-anywhere is leidend.** Geen knoppen, geen on-screen-controls, geen menu. Het scherm IS het interactie-vlak. Motion-tilt is **bewust uit** als default (vermoeiend, motion-sickness, slecht voor "gewoon liggen op de bank"). Optioneel toggleable in een verstopt pinch-and-hold-corner setting (3-second hold rechtsboven).

**Respect voor no-input mode**: Als je niets doet, blijft het mooi. De wereld ademt door, Cosmo doet idle-acties (zie §3), de muziek loopt. Sterker nog — na 60s no-input gaat het systeem in **passive trip mode**: TrippyEventDirector verhoogt event-frequency van 8-15s naar 5-10s, omdat je blijkbaar gewoon kijkt. Het systeem leest je gedrag en past zich aan.

**Haptic feedback**: zacht op elke succesvolle gesture. Cruciaal voor "in m'n hand, zonder volume aan, in bed" gebruik.

---

## 3. Cosmo grootte + centering

Cosmo neemt **40-50% van de scherm-hoogte** in op mobile (320-400px op een 768px-tall iPhone). **Dead-center op X-as, rond 60% Y** (lager dan midden zodat antenne-bloem niet de status-bar raakt). Hij is de enige "actor" — alle andere visuals zijn ambient.

**Continue idle-acties zonder triggers** (random elke 4-12s):
- **Breathing-pulse**: scale 1.00 ↔ 1.04 op 0.8Hz, ademt mee met music-BPM (lock op 86BPM = 1.43Hz halftime)
- **Blink**: 200ms eye-close, 1-2x per minuut, soms double-blink
- **Antenne-bloem-sway**: zacht heen-en-weer, alsof er een briesje is, gekoppeld aan parallax-far-layer
- **Cheek-blush-fade**: rode wangetjes pulseren licht in saffron-glow → faded-rose
- **Suction-cup-foot-fidget**: één voet wisselt 3% gewicht-verdeling, micro-shift
- **Look-around**: ogen volgen langzaam de laatste tap-positie van de speler — Cosmo ZIET je
- **Yawn**: 1x per 2-3 minuten, complete pose-reset met antenne-flop

Cosmo is niet animated-with-physics. Hij is **gerigged met breathing+IK voor armen+head-tracking**. Hij voelt aanwezig. Niet als een sprite die loopt — als een wezen dat in je telefoon woont.

---

## 4. Visuele hierarchie

**Geen UI. Geen score. Geen menu. Geen pause-button.** Het is altijd "aan". Bij app-resume is Cosmo precies waar je hem liet, in dezelfde mood-cycle.

Lagen (back-to-front):
1. **Sky-layer** (parallax 0.05x) — slow-bloom-v2 bg-sky met breathing palette-shift
2. **Far-mountains** (0.15x) — distant mushrooms, pulsen in unison op 4-bar muziek-cycli
3. **Mid-canopy** (0.4x) — bloemen, vines, subtle wave-distortion
4. **Cosmo** (1.0x — locked center)
5. **Particle-bubbles** (1.2x) — speler-gegenereerd, drijven op
6. **Foreground-glow** (subtle vignette + film-grain, niet parallax-shifted)

**Niets verstoort.** Geen pop-ups. Geen "tip!"-coach. Geen achievement-toast. Wanneer je voor het eerst een nieuwe gesture unlockt (zie §6), licht alleen Cosmo's antenne-bloem **één keer extra** op — geen tekst, geen "NEW UNLOCK!" banner. De speler ontdekt zelf wat het was.

---

## 5. Muziek-koppeling

**Continue base-music als hartslag.** Geen game-states, geen track-changes per "level". Eén lange seamless-loop per **biome-cycle** (3-5 min per biome). De Suno-tracks (`slow-bloom-l1`, `inkpool-hollow-l4`, `cloud-cathedral-l7`, `bonus-warp-l9`) worden **biome-mood-loops** — niet per level maar per *vibe*.

**Biome-cycles automatisch elke 3-5 min**:
- Slow Bloom (mushroom forest, daytime warmth) → 4 min
- Inkpool Hollow (cave reflection, ghost-mode) → 5 min
- Cloud Cathedral (industrial-organic, height) → 4 min
- Bonus Warp (paradise-bliss) → 3 min, als reward voor "long sit"
- Cycle herhaalt met crossfade — palette + bg + particles morphen mee

**Gestures triggeren hallucination-overlays** bovenop de base-music:
- Single tap → percussion-pluck in scale (D-minor pentatonic, random note)
- Bubbel-pop → koto-arpeggio fragment (3 notes)
- Swipe → granular pad-sweep (filter-cutoff volgt swipe-velocity)
- Long-hold center / deep trip → kaleidoscope-friendly arpeggio uit `inkpool-hollow-l5` als 15s overlay
- TrippyEventDirector events triggeren al gesynchroniseerde stings uit de FFT-audio-bridge

Resultaat: jouw input wordt **muziek**. Niet het systeem antwoordt op jou — jij **bespeelt** Cosmo's wereld als een kalimba.

---

## 6. "Progressie" zonder score

**Gradually unlock interaction-vocabulary** door pure tijd-en-discovery, niet door performance:
- **Minuut 0**: alleen single-tap doet iets (bubbel)
- **Minuut 2**: tap-and-hold reveals (Cosmo loopt) — hint: Cosmo kijkt naar je tap-locatie
- **Minuut 5**: swipe reveals (door per ongeluk een swipe — Cosmo's antenne reageert)
- **Minuut 10**: pinch reveals (zachte schermpuls suggereert 2-finger)
- **Minuut 30**: deep-trip mode unlockt **permanent** (long-hold center werkt vanaf nu altijd)
- **Minuut 60+**: "secret" gestures verschijnen — three-finger-tap, edge-swipe, double-tap-and-hold — elk een nieuwe biome-mutator

**Geen UI vertelt je dit.** Het ontdekken IS de progressie. Discord/Reddit/TikTok zal de community-bron worden voor "wist je dat als je drie vingers..."

---

## 7. Virale haakjes (5 share-momenten zonder score)

1. **Kaleido-state screenshot** — long-hold + screenshot → de kaleidoscope-pose wordt een instant-poster. Auto-watermark "cosmo lives at theuws.com/games/cosmos" in een bijna-onleesbare paint-stroke onderin.
2. **60s gameplay-clip met audio** — built-in record button (verstopt als 3-finger-hold-bottom-edge) recordt 60s screen+audio, exporteert als MP4 met Cosmo-tag. Optimaal voor TikTok/Reels.
3. **"Vibe check" daily generated screensaver** — elke dag genereert je Cosmo-instance een unieke wallpaper-versie van je trip-room (palette/biome/Cosmo-pose) — exportable als phone-wallpaper. Daily-ritual = retention.
4. **Audio-loop quote-card** — favorite muziek-moment? Tap-and-hold op de music-FFT-band-zone (verstopt) → genereert een 8s audio-loop + visual-card "Cosmo says: [random eigen-DNA-quote]". Shareable als IG-story.
5. **Friend-bring-the-trip link** — `cosmos.app/trip/[seed]` URL deelt JOUW exacte room-state (huidige biome, palette-mutator, unlocked-gestures). Vriend opent → krijgt jouw exact-getransponeerde Cosmo. **Inheritance van vibes**.

---

## 8. Onboarding

**Geen tutorial.** App opent → Cosmo staat in slow-bloom biome → muziek-fade-in → Cosmo blinkt 1x → wacht. Eerste tap = bubbel. Klaar. Alles wat je daarna doet is serendipiteit. **De afwezigheid van instructies IS de hook** — stoners haten tutorials, dit feels like discovering an artifact.

---

## 9. Anti-stress

**Impossible to fail.** Geen timer. Geen high-score. Geen "you missed". Cosmo wordt nooit boos, nooit moe, nooit dood. Als je 6 uur niet opent — Cosmo staat exact zo op je terug te wachten. **Apple Mindfulness-app vibes voor stoners.** Het ergste wat kan gebeuren is dat je de app sluit — en zelfs dat is okay, Cosmo wacht.

Bonus: **System-light-mode-detection**. Telefoon op DND? Cosmo gaat in fluister-modus, muziek -6dB. Telefoon op silent? Hij gaat slapen, breath verdiept, één ster valt langzaam achter hem.

---

## 10. Stoner-specifiek

- **Rabbit-hole-design**: elke biome heeft 3-5 verstopte interaction-zones (bv. één specifieke bloem die als je hem 30s vasthoudt een nieuwe muziek-laag onthult). Stoner-brain LOVES dit.
- **Geen tijdsdruk ooit** — geen energy-meters, geen "come back in 2 hours".
- **"Ik zat 90 min in deze fucking app vast"-testimonial-engineering** — opnemen-functie + share-friend-trip + screenshot-collector geven die exacte pull-quote feedback-loop op TikTok/Twitter.
- **Munchies-pause**: app pauseert zichzelf NIET. Je kunt naast je telefoon eten zonder dat je iets mist. Cosmo blijft.
- **Couch-co-experience**: scherm horizontaal-modus toont Cosmo in iets bredere room — perfect voor "kijk wat ik gevonden heb"-naast-elkaar-zitten.

---

## 11. Existing assets reuse

| Bestaand | Gebruik |
|---|---|
| `cosmo-canonical-v2-cleaned.png` | **Centrepiece** — opnieuw gerigged met breathing+blink+IK in Spine of DragonBones; geen nieuwe character-design |
| `slow-bloom-v2/*.png` (5 lagen) | **Biome 1** intact, alleen palette-shift-shader er overheen |
| `inkpool-hollow/*` (achtergronden Sprint 6+) | **Biome 2**, idem |
| Suno tracks 2/4/7/9 (slow-bloom, inkpool, cathedral, bonus-warp) | **Biome-base-loops** — geen nieuwe muziek nodig, hooguit re-edit voor seamless 4-min loops |
| Post-FX stack v0.4.0 (bloom/chroma/fluid/kaleido/datamosh) | **Direct hergebruik** — kalibreer richting "always-on subtle, gestures piek hard" |
| TrippyEventDirector | **Direct hergebruik** — config-tweak naar "passive mode na 60s no-input" |
| AudioFFT-bridge (Sprint 6D) | **Direct hergebruik** — drijft palette-pulse en mushroom-pulse |
| 7-locked-palette + pop-accents | **Direct gelocked** — geen palette-werk nodig |

**Gedeprecate**: alle enemy-sprites, bomb-systeem, tile-grid, level-progression, HUD, score, lives, save-slots, levels 1-10. Sprint 6B/6C/7D code blijft in repo maar is niet gemount in deze pitch.

---

## 12. Grond-up rebuild scope: 4-6 sprints

**Sprint 1 (1 week) — Stripped foundation**
- Verwijder Phaser-gameplay-canvas; behoud alleen Three.js + post-FX
- Cosmo-as-DOM/Canvas-sprite dead-center, breathing-rig
- Single tap → bubbel (één gesture werkt)
- Slow Bloom biome statisch, music-loop draait

**Sprint 2 (1 week) — Interaction vocabulary**
- 6 gestures geïmplementeerd
- Cosmo walk-to-tap met IK
- Antenne-sway + idle-actions
- Audio-on-gesture pluk-system in Tone.js

**Sprint 3 (1 week) — Biome-cycles + TrippyEventDirector tuning**
- 4 biomes met crossfade
- Auto-cycle 3-5 min
- Palette-mutator shaders
- Passive-mode na 60s no-input

**Sprint 4 (1 week) — Progression & deep-trip**
- Gradual unlock-vocabulary (timer-based)
- Long-hold deep-trip 15s mode
- Pinch-time-dilation
- Hidden gesture #1-3

**Sprint 5 (1 week) — Virale haakjes**
- Screenshot-watermark
- 60s record-and-export
- Daily wallpaper-generator
- Friend-trip-link met seed-system
- Audio-quote-card

**Sprint 6 (1 week) — Polish + LIVE**
- Mobile-perf-pass (60fps op iPhone 12+, gracefull degrade lager)
- Haptic-feedback fine-tune
- iOS Safari + Android Chrome QA
- Deploy theuws.com/games/cosmos-2026 als PWA met "add to home screen"

**Totaal: 6 sprints / 6 weken** — agressief maar haalbaar dankzij ~70% asset-hergebruik.

---

## Waarom een TOY zonder score viraler kan zijn dan een GAME met score

Een **game-share** is altijd: "kijk wat IK heb gedaan" (high-score, level reached, achievement). Het is **prestatie-georiënteerd** en daardoor zelf-centred. De share-trigger is ego, en ego-shares hebben een natuurlijke ceiling — niet iedereen wil flexen, en de kijker voelt zich ook niet uitgenodigd ("leuk voor jou, maar ik ga geen 80 uur stoppen om jouw score te halen").

Een **toy-share** is fundamenteel anders: "kijk wat IK gevonden heb" / "kijk hoe MOOI dit is" / "je MOET dit zien". De share-trigger is **ontdekking + esthetiek + gevoel** — niet ego maar stimulatie-deling. De kijker hoeft niets te bereiken, alleen openen. De drempel om de app zelf te proberen is daardoor **veel lager** ("oh dit duurt 3 seconden om te openen, ik mis niks als ik het saai vind"). Plug & Play, Mountain en Everything bewezen dit: zonder score, zonder doel, met pure stimulatie + persoonlijkheid → miljoenen views op clips, jaren-lange longevity, en een brand die NIET aan je high-score hangt maar aan je *vibe-association*. TikTok en IG zijn voor toys gebouwd: korte clip, geen context nodig, kijker wordt direct geraakt door beeld+geluid. Een score-screenshot vereist context. Een Cosmo-kaleidoscope-clip vereist niets — hij is óf hypnotiserend óf niet, in 3 seconden duidelijk, en dat is precies de TikTok/Reels-loop.

Bovendien: stoners en focus-zoekers **zoeken actief** anti-game-content. Ze zijn moe van XP-treadmills, daily-quests, FOMO. Een toy biedt *de antithese* — en dat is een eigen groeiende markt (zie Calm, Headspace, maar dan zonder mindfulness-jargon, gewoon trippy alien op je scherm).

## Grootste risico

**Mensen verwachten een GAME en bouncen direct.** App store + landing-page zullen Cosmo introduceren — als de copy zegt "platformer" of "adventure", komt iedereen verkeerd binnen, opent de app, ziet "alleen een alien die ademt", denkt "kapot? leeg? broken?", en sluit binnen 8 seconden. Dat is de game-over voor virality, want low-engagement = algoritme-doodsteek.

**Mitigatie**: positionering MOET vanaf seconde één eerlijk zijn. Landing-page-tagline: *"Geen game. Geen score. Geen tutorial. Cosmo woont hier — raak hem aan."* Trailer = 15 seconden pure visual zonder UI, geen gameplay-shots, geen "click to play" overlay. App-store-screenshots = kaleidoscope-poses, niet een fake HUD. Eerste user-impressie: muziek + ademende Cosmo = "oh, dit is een **vibe-app**" — en de juiste user blijft 90 minuten. De verkeerde user verdwijnt in 8 seconden, en dat is fine, want hij was nooit de doelgroep.

Het secundaire risico — "te weinig om te doen" — wordt afgevangen door §6 (gradual unlock-vocabulary, 60min onboarding-curve) en §10 (rabbit-holes per biome). De experience hoort dun te beginnen en exponentieel diep te worden naarmate je meer tijd erin steekt — niet andersom.
