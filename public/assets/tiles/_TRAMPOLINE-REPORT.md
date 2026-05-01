# Sprint 5A — Trampoline assets generation report

**Date**: 2026-04-30
**Cost**: ~$0.075 (3x Flux Dev @ $0.025 + 1x BiRefNet ~$0.001)
**Target dir**: `public/assets/tiles/`

## Asset 1 — `tile-trampoline.png`

**Status**: SHIPPED met caveat — landschap-trap ondanks rider-prefix-FRONT
**Model**: fal-ai/flux/dev
**Aspect**: 1024x512 (2:1 strip)
**BiRefNet**: skipped (correct, per asset_learnings.md regel)

**Wat goed ging**:
- 2:1 strip-formaat correct gerenderd
- Rode/magenta mushroom-cap met blauwgrijze stem prominent links — wel het kerngevoel van de trampoline
- Saffron-glow hemel-wash + fluo-pop accenten zijn coherent met locked palette
- Heavy ink linework zichtbaar, paper-grain aanwezig
- Bottom edge heeft een grass/moss-strook met saffron-glow underglow die als bovenkant van een platform kan dienen

**Wat fout ging — BEKENDE TRAP**:
Asset_learnings.md tile-trap heeft toegeslagen, ondanks rider-prefix-FRONT met "NO horizon NO sky NO scene". Flux Dev rendert hier opnieuw een full landscape met:
- maan rechtsboven
- bergketens midden-horizon
- volledige sunset-sky met wolken
- mushroom-tree-trio rechts (vermeld in BG layer rider, niet in tile-rider)

De canonical STEM-zinnen "Moebius Arzach woodcut illustration" en "HEAVY INK LINEWORK" blijven scene-magneten omdat ze training-data-sample-bias triggeren naar "Moebius landscape illustration".

**v2 retry**:
Sterker stripped prompt zonder STEM-magneten, "top-down close-up macro" en oval trampoline shape. Resultaat: nog steeds scene met moon/mountains/trees, maar met een herkenbare ovale trampoline als foreground object met touw-coil-rand. Bewaard als `tile-trampoline-v2-alt.png` voor potentieel gebruik als pickup/icon.

**Recommendation**:
1. **Korte termijn**: gebruik v1 in-engine met multiply-blend en crop op bottom 50% (de moss-strook + spring-glow). Dat geeft een werkbare platform-strip.
2. **Middellange termijn**: probeer v3 met **Recraft V3** (vector-style) ipv Flux — Recraft heeft minder landscape-bias voor "isolated tile element" prompts (per memory-pattern bij logo's).
3. **Lange termijn**: maak procedural in Phaser canvas — roundRect met magenta-pink fill + dark stem + lime moss-pad + ink-stroke outline. Tile-trap is nu 6/7 pogingen mislukt over Sprint 4.5+5A — de canonical STEM is incompatibel met flat-strip tiles. Stop met fal.ai voor tile-strips.

## Asset 2 — `pickup-bounce-burst.png`

**Status**: SHIPPED — prima resultaat, geen retry nodig
**Model**: fal-ai/flux/dev + BiRefNet remove-bg
**Aspect**: 1024x1024 (square_hd)
**Bestandsgrootte**: 1.2MB RGBA PNG (gezond, niet leeg)

**Resultaat**:
- Centered explosion-burst, magenta-pink met saffron-yellow center-glow
- Painted watercolor splash-bleeds met visible ink-line edge spatters
- Particles radiating outward in starburst pattern, fluo-pop palette
- Transparante achtergrond clean (BiRefNet werkt prima op dominant-subject pickups, conform learning)
- Geen character/object/figure-bias — pure abstract burst

**Pickup-rider-FRONT pattern bevestigd**: square pickups met "single floating object on neutral grey card" + STEM erna leveren nog steeds 100% bruikbare resultaten op (4/4 in Fase B + 1/1 hier = 5/5).

## Cost summary

| Item | Calls | Cost |
|------|-------|------|
| Flux Dev tile v1 | 1 | $0.025 |
| Flux Dev burst | 1 | $0.025 |
| BiRefNet burst | 1 | ~$0.001 |
| Flux Dev tile v2 retry | 1 | $0.025 |
| **Total** | **4** | **~$0.076** |

Onder cost-target ($0.10).

## Updated learnings → asset-generator.md

1. Tile-trap is nu 6/7 mislukt over Sprint 4.5 Fase B + Sprint 5A. Canonical STEM is fundamenteel incompatibel met flat-strip tiles in Flux Dev. **Stop met fal.ai voor pure tile-strips.** Procedural canvas of Recraft V3 zijn de enige routes vooruit.
2. Pickup-burst-VFX assets werken nu bewezen 5/5 met de pickup-rider-FRONT + STEM pattern. Dit is een stable workflow.
3. v2 retry met "top-down macro" toevoegt iets meer foreground-object-dominantie maar lost de scene-bias niet op.
