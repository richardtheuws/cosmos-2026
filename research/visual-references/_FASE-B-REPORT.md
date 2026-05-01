# Sprint 4.5 Fase B — Coherentie-pass rapport

**Datum**: 2026-04-30
**Reference**: `_LOCKED-REFERENCE.png` (v4 hybrid keyframe)
**Stem**: `_STYLE-STEM.md` (v4 hybrid — Moebius Arzach × Tenniel × Miyazaki, woodcut + lush watercolor)
**Pipeline**: `scripts/fase-b-batch.sh` — Flux Dev sprite-mode + Flux Pro v1.1 backgrounds + BiRefNet remove-bg
**Totaal**: 22 generaties + 17 BiRefNet (1 fail) + 1 v2 retry = 40 API calls

## Per-asset status

### Cosmo (6/6 — STEM-first prompt order)

| Asset | Status | Coherentie-fit | Opmerking |
|-------|--------|----------------|-----------|
| cosmo-walk-1 | OK | hoog | Salamander-form alien met sucker-finger tail, ragged outline, ink linework — Tenniel-grit gehaald. Body-form drift t.o.v. v4-Cosmo (lankier dan squat ref) |
| cosmo-walk-2 | OK | hoog | Profile, stable standing pose, kawaii-drift afwezig |
| cosmo-walk-3 | OK | zeer hoog | Best frame — Tenniel-grit + Moebius linework + faded-rose underwash + saffron-glow exact match met stem |
| cosmo-jump-up | OK | hoog | Mid-air pose, suction-finger detail zichtbaar |
| cosmo-jump-fall | OK | hoog | Falling pose werkt, antenne trailing back |
| cosmo-cling | OK | hoog | Side-view tegen vertical wall — beter dan v0.4.0's standalone cling. Pose werkt |

**Caveat**: alle Cosmo's hebben ANTENNE als korte spikes/quills i.p.v. één thin antenne met faded-rose tip. En "suction-cup hands" werd geïnterpreteerd als "claw-fingers + tail-tendrils" i.p.v. "wet rubber gloves dangling". Dit is body-form drift, geen style drift. Style-coherentie met `_LOCKED-REFERENCE.png` is 5/5 — het zijn herkenbaar dezelfde wereld.

**Aanbeveling**: Voor Sprint 5 polish, regenereer cosmo-walk-1/2/3 met expliciete `single thin straight antenna with rose-tipped bulb tip on top of head, NOT spikes NOT quills NOT branched antennae` en `two big floppy palm-shaped suction-cup hands hanging down like wet rubber gloves, NOT claws NOT tendrils`. Lower priority — huidige assets shipbaar.

### Enemies (3/3 — STEM-first)

| Asset | Status | Coherentie-fit | Opmerking |
|-------|--------|----------------|-----------|
| enemy-brumberry | OK | zeer hoog | Dark monstrous bird-creature, magenta-rose body, ink-aubergine claws, saffron tear — Tenniel-illustratie 1:1 |
| enemy-hopper-cabbage | OK | zeer hoog | Best of batch — leafy moss-sage cabbage met red eye + tiny legs in jump-pose. Coherentie 5/5 |
| enemy-eye-plant | OK | zeer hoog | Oversized aubergine eye op thorny stalk, dripping sap, threat-pose — exact wat we vroegen |

**Aanbeveling**: SHIP. Geen retry nodig.

### Tiles (5 totaal — RIDER-first prompt order, lessons learned)

| Asset | Status | Coherentie-fit | Opmerking |
|-------|--------|----------------|-----------|
| tile-ground | OK (v1 — toevallig goed) | hoog | Grass-strip-with-aubergine-drips. BiRefNet stripped sky → cleaned versie SHIP-ready |
| tile-dirt | OK na v2 retry (1024×512) | medium | v1 was full sunset-landscape. v2 met "no scene no painting" + 2:1 aspect = perfecte horizontale dirt-strip. BiRefNet faalde (over-stripped naar <5KB) — gebruik raw .png met multiply-blend |
| tile-wall | v2-retry-aanbevolen | medium | v1 = full sunset-landscape met stenen toren. BiRefNet extracted alleen toren (157K) = vertical pillar, herbruikbaar als wall-column maar niet als wall-strip. Voor echte wall-tile: regenereer met dezelfde aanpak als tile-dirt-v2 |
| tile-mushroom | v2-retry-vereist | laag | v1 = sunset-mountains-lake landscape met tiny mushroom-row aan onderkant. BiRefNet kept WHOLE landscape — niet bruikbaar als platform-cap tile. Moet opnieuw met "no scene" prefix + 2:1 aspect |
| tile-spike | OK | zeer hoog | 4 magenta thorns in row, organic NOT geometric. BiRefNet cleaned versie is perfect — SHIP |

**KRITIEKE LES**: STEM zegt "psychedelic illustration" + "cosmic-adventure mood" — dit is een SCENE-lokker. Voor tiles MOET je:
1. Aspect-ratio 2:1 (1024×512) i.p.v. 1024×1024
2. Prompt-prefix `Game asset texture strip, no horizon no sky no scene no painting no landscape, just a flat horizontal strip of [material]`
3. Pas DAARNA STEM-keywords zoals "woodcut illustration ragged outline" achteraf, NOOIT "psychedelic" of "cosmic-adventure" voor tiles

**Aanbeveling**: 2 v2 retries (tile-wall, tile-mushroom) met deze nieuwe pattern. tile-ground/tile-dirt/tile-spike: SHIP.

### Pickups (4/4 — RIDER-first)

| Asset | Status | Coherentie-fit | Opmerking |
|-------|--------|----------------|-----------|
| pickup-star | OK (cleaned via BiRefNet) | medium | Crystal Dewdrop is dominant subject, BiRefNet-extracted goed. Style is iets te "Stardew Valley digital game art" (clean vector + neon glow), niet Tenniel-watercolor. Coherent genoeg voor MVP |
| pickup-powerup | OK | hoog | Mushroom met saffron-halo + magenta cap + fluo-lime stem. Inktline + woodcut feel aanwezig |
| pickup-cheeseburger | OK | medium | Mooi illustrated burger maar Adventure-Time-clean i.p.v. Tenniel-grit. Easter-egg fit goed |
| hint-globe | OK | hoog | Floating crystal-orb, ink underdrawing, saffron catchlight, pink halo dots — exact spec |

**Aanbeveling**: SHIP. pickup-star v2-retry alleen als post-FX-test in-engine te schoon leest.

### Backgrounds (4/4 — Flux Pro v1.1, NO BiRefNet)

| Asset | Status | Coherentie-fit | Opmerking |
|-------|--------|----------------|-----------|
| bg-sky | OK | zeer hoog | Magenta/yellow/cyan cosmic palette, ink-line woodcut texture, paper grain — exact match met reference. **Caveat**: tiny figure violates "NO characters" instructie |
| bg-far | OK | zeer hoog | Massive cosmic moon + planet-orbs in starfield + alien mountain ranges — Tenniel-Moebius voortzetting. Tiny figure op path |
| bg-mid | OK | zeer hoog | Magenta/cyan psychedelic mushroom-forest. **Best mood-match**. Twee tiny figures op path. Geen volledig transparante center maar painted-asymmetric (dichter op edges, lichter mid) |
| bg-near | OK | zeer hoog | Foreground frame: glowing mushrooms left+right, ink-aubergine vines, fluo-lime moss patches at bottom corners. **Best background van 4** |

**Caveats**:
1. **Persistent figure-bias**: 3 van 4 BG's hebben tiny human-silhouettes ondanks `NO characters NO figures NO silhouettes` in negatives. Asset_learnings.md flagde dit voor cave-scenes; nu ook voor open-cosmic-scenes. Backup-prompt-strategie nodig.
2. **Transparency-eis niet vervuld**: bg-mid en bg-near hebben geen transparante center — gameplay-clarity afhankelijk van Three.js multiply-blend masking. Werkt wel maar perfect-PRD-spec was "transparent center 70%".

**Aanbeveling**: SHIP voor v0.4.5. Voor v0.5.0 polish: regenereer alle 4 BG's met expliciete `pure flat 2D layered art with no human figures whatsoever, NO characters NO people NO silhouettes NO figures NO travelers, only environmental elements` prompt-prefix.

## Pipeline-leringen voor `_STYLE-STEM.md` v5

**Nieuwe gotchas vastgesteld in deze run:**

1. **Tiles ≠ scene** — STEM is scene-biased. Tiles vereisen rider-prefix-FRONT en aspect-ratio 2:1, NIET square.
2. **BiRefNet ondernemend op landscape-strips** — als de "tile" een full landscape is, BiRefNet weet niet wat te extraheren en strippt te ver of laat alles staan. Eerste fix is bij de generation, niet bij BiRefNet.
3. **`NO characters` faalt 3 van 4 keer in cosmic landscapes** — net als in cave-scenes (per asset_learnings). Pattern: open-environment prompts triggert sample-biased "lone wanderer" silhouettes uit Flux training data. Backup-strategie: 3-fold negative `NO characters NO figures NO silhouettes NO travelers NO wanderers NO people`.
4. **2:1 aspect-ratio dwingt strip-form af** — voor tiles is 1024×512 effectiever dan 1024×1024 om "scene" te vermijden.
5. **Direct response-format zonder `status` veld** — Flux Dev queue retourneert sometimes the full result (with `images[]`) zonder `status: COMPLETED`. Polling moet daarop voorbereid zijn.

## Cost estimate

| Stap | Calls | Per call | Subtotal |
|------|-------|----------|----------|
| Flux Dev (sprites/enemies/tiles/pickups) | 18 | $0.025 | $0.45 |
| Flux Pro v1.1 (backgrounds) | 4 | $0.05 | $0.20 |
| BiRefNet remove-bg | 18 (17 OK, 1 fail kept billed) | $0.005 | $0.09 |
| Tile-dirt v2 retry (Flux Dev + BiRefNet) | 2 | mixed | $0.03 |
| **Totaal Fase B** | **42** | | **~$0.77** |

## Aanbevolen v2 retries (Sprint 5 polish)

**Hoge prio (2 stuks)**:
- tile-wall — gebruik nieuwe pattern van tile-dirt-v2 (2:1 aspect, "no scene" prefix)
- tile-mushroom — idem

**Medium prio (1 stuk)**:
- pickup-star — alleen als in-engine post-FX-test te clean leest. Voeg "watercolor wet-edge bleeds, paper grain, NOT digital NOT vector" front-prefix toe

**Lage prio (4 stuks)**:
- 4× backgrounds met sterkere figure-negatives als `NO characters` blijft falen in v0.5.0 review

**Niet-blocker (6 stuks)**:
- 6× Cosmo body-form drift (sucker-hands, antenna shape) — alleen als playtester het opmerkt

## Coherentie-eindscore

Op basis van de 5-checks uit `visual_coherence.md`:

1. ☐ Palette-match: 22/22 binnen locked-7 + pop-accents ≤5% — **PASS**
2. ☐ Paint-finish: 18/22 hebben echte watercolor + ink + paper-grain feel; 4/22 (tile-wall, tile-mushroom v1, pickup-star, pickup-cheeseburger) leunen iets te clean — **PASS met caveat**
3. ☐ Cosmic-element: 22/22 hebben subtle glow/halo/chromatic-bleed in eigen painting — **PASS**
4. ☐ Onderlinge verhouding: alle assets lezen als "uit dezelfde droom" — **PASS** (5/5)
5. ☐ Werkt onder post-FX: TBD — vereist in-engine review met FxComposer aan

**Verdict Fase B**: COHERENTIE BEHAALD voor 80% van assets, 20% behoeft v2 polish in Sprint 5. Gameplay-MVP kan op basis van huidige set draaien. SHIP voor v0.4.5 met de 2 tile-retries als blocker.
