# Cosmo animation frames — Sprint 5B image-to-image rapport

**Datum**: 2026-04-30 / 2026-05-01
**Doel**: 6 distinct animation frames vanuit `_COSMO-CANONICAL.png` via fal.ai/flux/dev/image-to-image
**Resultaat**: **POSE-SET NIET READY VOOR WIRING — alle 6 frames behouden canonical neutral standing pose**

---

## Aanpak

`fal-ai/flux/dev/image-to-image` endpoint, queue-flow met polling. Canonical raw URL als `image_url`,
twee strength-passes geprobeerd:

1. **Attempt 1** (strength 0.50–0.60, conservative): pose-info als rider achteraan, character-DNA voorop
2. **Attempt 2** (strength 0.55–0.82, aggressive): action-verb + pose VOORAAN, character-DNA in midden, anti-patterns achteraan

Bestanden van attempt 1 in `_attempt1/`, finale uitkomst van attempt 2 in deze directory.

---

## Per-frame status

| File | Strength | Pose-shift? | Suction-cup hands? | Bijbehorende issues |
|---|---|---|---|---|
| `cosmo-walk-1.png` | 0.75 | NEE — neutral standing side-view | NEE — kleine lizard-claws | Kawaii eyelashes verschijnen |
| `cosmo-walk-2.png` | 0.55 | n.v.t. (was canonical-pose-target) | NEE — claws | Tail aanwezig |
| `cosmo-walk-3.png` | 0.75 | NEE — identiek aan walk-1 | NEE | Kawaii drift sterker |
| `cosmo-jump-up.png` | 0.80 | NEE — staat nog steeds rechtop | NEE — claws | Eyelash-drift, frons toegevoegd (`angry`) |
| `cosmo-jump-fall.png` | 0.80 | NEE — staat nog steeds rechtop | NEE | Onesie-suit drift (lichaam wordt outfit), signature `Celine` random toegevoegd |
| `cosmo-cling.png` | 0.82 | NEE — neutral standing front-ish view | NEE — claws | Tail nog dikker |

**Score**: 0/6 acceptabel. Geen enkel frame is bruikbaar voor in-engine wiring.

---

## Conclusie / Diagnose

**Flux Dev image-to-image kan onze canonical-Cosmo NIET in andere poses zetten.** De pose-anchor van de
input-image is sterker dan elk text-instruction we kunnen geven, zelfs op strength 0.82 — bij die strength
verliezen we begin character-detail (eyelashes drift, body becomes onesie) zonder pose-shift te krijgen.

Dit is consistent met de Fase C lessons in `asset_learnings.md`: Flux training-data heeft **sterke
sample-bias** voor "small green alien standing neutral side-view" wanneer character-DNA prompts gebruikt
worden. Zelfs met een strength van 0.82 (meestal genoeg voor totale herinterpretatie) blijft die bias
domineren.

**Suction-cup-hands**: weer 6/6 fail. Dit bevestigt dat het probleem niet alleen text-only is — ook
image-to-image met een canonical die ZELF geen suction-cups heeft, faalt. De model-bias voor "alien-kid
hands → biped fingers/claws" is universeel.

---

## Aanbeveling voor volgende stap

**Stop met flux-image-to-image voor pose-variation.** Twee alternatieve pipelines:

1. **OpenPose / ControlNet skeleton-rig** — fal.ai heeft `fal-ai/flux-controlnet` of vergelijkbaar.
   Eerst skelet-pose tekenen (stick-figure) → ControlNet dwingt die pose op character. Dit
   ontkoppelt pose van character-DNA en breekt de canonical-anchor.
2. **Manual sketch-pose + img-to-img** — Richard tekent ruwe stick-poses (5 min werk per frame),
   dan img-to-img met sketch als image_url i.p.v. canonical. Strength ~0.85, character-DNA in prompt.
3. **Inpainting met masked pose-area** — werkt voor hands maar niet voor full-body re-pose.

Voor **suction-cup-hands** specifiek: dit moet **OF** in canonical zelf gefixt worden (Photoshop comp +
img-to-img refinement) **OF** als post-step met masked inpainting per frame. Niet brute-forcen.

---

## Cost
- 6× image-to-image attempt 1 = ~$0.18
- 6× image-to-image attempt 2 = ~$0.18
- **Totaal: ~$0.36 zonder bruikbaar resultaat**

Goedkope les, maar die les **moet** nu in `asset_learnings.md` zodat we deze pipeline-fout niet
opnieuw maken.

**Status**: Frame X needs re-do (alle 6). Pose-set NIET ready voor wiring.
