# Cosmo Animation Frames — Generation Report

**Date**: 2026-04-30
**Sprint**: 2 — Phaser 4 controller
**Strategy**: Optie B — individuele frames via `generate-asset.sh` (Flux Dev sprite + BiRefNet remove-bg)

## Strategie-selectie

**FalSprite endpoint NIET beschikbaar via fal.ai-hosted API.** Getest:
- `https://fal.run/fal-ai/falsprite` → `{"detail": "Application 'falsprite' not found"}`
- `https://queue.fal.run/fal-ai/falsprite` → idem

Conclusie: lovisdotio/falsprite is een lokale CLI-tool, geen fal.ai-endpoint. Doorgegaan met **Optie B** (parallel individuele frames via bestaande pipeline).

## Frame-by-frame status

| Frame | File (cleaned) | Source | Pose | Kawaii-bias | Status |
|-------|----------------|--------|------|-------------|--------|
| walk-1 | `cosmo-walk-1-cleaned.png` | gen v1 | side mid-stride left fwd | medium (blush + grin) | KEEP — pose werkt, lichte kawaii drift acceptabel |
| walk-2 | `cosmo-walk-2-cleaned.png` | gen v2 | side profile neutral standing | low (single eye visible, ragged outline) | KEEP — v2 regenerated (v1 was blurry + front-view) |
| walk-3 | `cosmo-walk-3-cleaned.png` | gen v2 | side profile mid-stride right fwd | LAAG — best frame, Tenniel ragged ink achieved | KEEP — exemplary stijl |
| jump-up | `cosmo-jump-up-cleaned.png` | gen v1 | mid-air running pose | medium-low | KEEP — dynamic pose, sucker-fingers zichtbaar |
| jump-fall | `cosmo-jump-fall-cleaned.png` | gen v2 | side falling arms outstretched | medium | KEEP — v2 regenerated (v1 was blurry + dancing pose) |
| cling | `cosmo-cling-cleaned.png` | gen v1 | front-view sucker hands raised | medium-high (still kawaii) | KEEP met caveat — sucker-finger-tips zichtbaar maar staat los i.p.v. pressed against wall |

## Anti-kawaii drift bevindingen

**Wat werkte:**
- "uncute angular" + "sharp focus high detail" + "crisp ink lines" voorin prompt zetten — walk-2-v2 en walk-3-v2 kregen aanzienlijk minder kawaii-glans en meer Tenniel-grit
- "profile side-view facing right" (i.p.v. "side-view facing right") forceerde betrouwbaarder een echt profiel met één zichtbaar oog → minder schattig
- "NOT blurry NOT soft focus" als negative loste blur-artefact op (dat optrad in v1 walk-2 en jump-fall)

**Wat NIET werkte:**
- Veel negatives stapelen ("NOT kawaii NOT chibi NOT blush") → bleef gedeeltelijk doorkomen (zie walk-1, cling)
- Specifieke pose-instructies aan einde van prompt → werden soms genegeerd (cling werd "hands raised" ipv "pressed flat against wall")

**Volgende keer:**
- Voor cling-pose: gebruik referentie image als anchor (image-to-image variant) i.p.v. tekst-only
- Voor extreme uncute look: verhoog "Tenniel woodcut" en "Moebius arzach grit" frequentie tot 2-3x per prompt

## Aanbeveling Phaser

**READY voor Phaser anims** — alle 6 cleaned PNGs zijn:
- Transparante achtergrond geverifieerd via BiRefNet
- 1024x1024 source (Phaser kan resizen naar 256x256 of 128x128 voor sprite)
- Stilistisch consistent genoeg voor walk-cycle (3 frames) + jump-up/fall (2 frames) + cling (1 frame)

**Optionele v2 verbeteringen** (later, niet blocker):
- `cosmo-cling`: regenereer met expliciete "body and hands flat against vertical wall surface" + "viewed from outside the wall" — huidige asset is OK voor MVP

## Bestanden

```
public/assets/sprites/
├── cosmo-walk-1.png          (raw, mushroom-cream bg)
├── cosmo-walk-1-cleaned.png  (transparent, USE THIS)
├── cosmo-walk-2.png
├── cosmo-walk-2-cleaned.png  (USE THIS)
├── cosmo-walk-3.png
├── cosmo-walk-3-cleaned.png  (USE THIS — best stijl)
├── cosmo-jump-up.png
├── cosmo-jump-up-cleaned.png (USE THIS)
├── cosmo-jump-fall.png
├── cosmo-jump-fall-cleaned.png (USE THIS)
├── cosmo-cling.png
└── cosmo-cling-cleaned.png   (USE THIS, caveat: not pressed-against-wall)
```

## Manifest

Zie `assets-generated.json` in game root voor model + prompt per asset.
