# Sprint 11A — Cosmo multi-frame HIGH-FIDELITY body-mass re-render

**Date**: 2026-05-01
**Goal**: Restore Hayao×Moebius body-mass to the 6 animation frames; user complaint
"online versie heeft een soort stick puppet — Cosmo en enemies mogen gerust wat
massaler en voller aanvoelen" (Sprint 7A's skeleton-only + control_lora_strength 1.2
produced anemic line-art bodies).
**Status**: BODY-MASS RESTORED across all 6 frames. POSE-SHIFT failed architecturally.

---

## Outcome — honest assessment

| Frame | Body mass | Hayao texture | Faded-rose spots | Antenna+flower | Pearl-drop head | Disc pads | No tail | Chameleon eyes | Pose distinct @120px |
|-------|-----------|---------------|------------------|----------------|------------------|-----------|---------|----------------|----------------------|
| walk-1 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| walk-2 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| jump-up | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | **FAIL** |
| jump-fall | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | **FAIL** |
| cling-right | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | **FAIL** |
| hurt | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | **FAIL** |

**Net**: User's primary complaint (stick-puppet) is FIXED — Cosmo now has full
volumetric Hayao watercolor body in every frame. However, pose differentiation
between frames is minimal — the canonical neutral standing pose dominates all 6
renders. The frames are visually nearly identical, with only minor arm-angle and
spot-density drift.

## Pipeline (final, working for body — not for pose)

```
1. img2img: cosmo-canonical-v2-cleaned.png as image_url
2. ControlNet: programmatic stick-figure skeleton with thick lines + JET-BLACK
   filled hand-discs as control_lora_image_url
3. fal-ai/flux-control-lora-canny:
   - strength = 0.45 (walk-1/walk-2), 0.55 (hurt), 0.65 (jump-up/jump-fall/cling-right)
   - control_lora_strength = 1.20-1.25
   - num_inference_steps = 35
   - guidance_scale = 4.5
   - seed locked = 7777 (face/eye consistency across frames)
   - prompt: style-first stem (Hayao×Moebius watercolor) + character DNA + pose rider + neg-stack
4. PIL alpha-erase tail polygon (Sprint 6A pattern, 0% failure)
5. fal-ai/birefnet/v2 → transparent PNG
6. Overwrite public/assets/sprites/v3/cosmo-{frame}.png
```

## Architectural finding (CRITICAL — promote to memory)

**Flux flux-control-lora-canny with canonical img2img + skeleton ControlNet
CANNOT shift pose meaningfully while preserving body mass.** Tested combinations:

| Test | strength | control_lora_strength | Pose shift | Body mass |
|------|----------|----------------------|------------|-----------|
| Phase 1 sweep | 0.40 / 0.50 / 0.60 | 0.85 | None | PERFECT |
| Phase 1b sweep | 0.55 | 0.95 / 1.05 / 1.15 | None | PERFECT |
| Phase 2 (new skel) | 0.45 / 0.55 | 1.10 / 1.20 | None | PERFECT |
| Phase 3 (extreme) | 0.80 | 1.30 | None (still canonical) | Slight drift |

The canonical noise-init dominates the CFG-conditioned generation. The ControlNet
skeleton appears as a faint ghost in the background of the rendered image but
never replaces the rendered character pose. This is consistent across all
strength/control combinations and matches the Sprint 5B image-to-image findings
("Flux Dev image-to-image uses input-image as noise-init for the denoiser, not as
skeletal anchor"). The img2img branch in flux-control-lora-canny inherits this
property — img2img always wins over ControlNet for character-pose conditioning.

**Implication for future pose-variation work**:

1. **Skeleton-only ControlNet** (no image_url) — Sprint 7A's path — gives pose
   but loses body mass. Body mass loss can be mitigated by drawing skeletons
   with thicker, body-volume-suggestive silhouettes (filled torso + hip + thigh
   regions, not just stick lines). Untested in 11A.
2. **Train Cosmo LoRA** — fine-tune Flux on the canonical renders, then
   use skeleton-only inference. Character gets internalized in weights so
   skeleton drives pose without needing image_url. Larger budget commitment
   ($5-15) but unlocks unlimited pose freedom.
3. **Sketch-to-img per pose** — Richard hand-paints 5-min character thumbnails
   for each pose, use those as image_url at strength 0.85+. Sketch dominates
   pose, prompt+canonical keep style. Manual but reliable.
4. **3D rigged Cosmo via Meshy** — render character from 3D in any pose, then
   img2img stylize. Highest control, highest setup cost.

## Cost summary

| Phase | Cost | Outcome |
|-------|------|---------|
| Phase 1 strength sweep (3) | $0.27 | All near-identical, low pose-shift |
| Phase 1b control_strength sweep (3) | $0.27 | Same neutral pose |
| Phase 2 decisive walk-1 with v11a skel (3) | $0.27 | Confirmed pose-bias ceiling |
| Phase 3 batch 6 main renders | $0.54 | Final renders, body mass excellent |
| Phase 4 extreme-pose retry (3) | $0.27 | NO improvement at strength 0.80 |
| Phase 5 BiRefNet × 6 | $0.30 | All 6 transparent PNGs |
| **Total** | **~$1.92** | Body fixed, pose architectural blocker |

Within $5-8 budget. Further iteration would not help — architectural ceiling
reached after Phase 4. Stopping here is the right call (Sprint 6A learning:
"refinement-passes risk-prone").

## Files produced

- `prev-stickpuppet/` — backup of Sprint 7A's stick-puppet originals (6 PNG)
- `skeletons/` — 6 new pose-distinct skeleton PNGs (improved over Sprint 7A's)
- `strength-tests/` — 9 strength-sweep test renders for walk-1
- `raw/` — 6 final raw renders + 3 extreme-pose retries
- `birefnet/` — 6 BiRefNet transparent + 6 alpha-erased finals
- `side-by-side/` — 6 BEFORE/AFTER comparisons (stick-puppet vs Sprint 11A)

## Wiring — NO CHANGES NEEDED

File paths stay identical (`cosmo-walk-1.png` etc.). Cosmo.ts updateAnim() and
L1Scene preload-keys do NOT need changes. The 6 frames are drop-in replacements.

## Recommendation for Sprint 11A+ follow-up

1. **Accept current frames as the body-mass fix and ship.** The user's complaint
   was specifically "stick-puppet" — that is fixed beyond doubt.
2. **For pose-distinction at runtime**, augment Cosmo.ts:
   - jump-up: scale tween (squash 1.1× horizontal + stretch 0.85× vertical at
     liftoff, normal at apex, opposite at landing)
   - jump-fall: setRotation tilt 8° per frame velocity-direction
   - cling-right: setRotation 90°, setFlipX based on clingSide
   - hurt: Z-spin tween 25° + scale-pulse + tint-flash
   These mechanical animations on top of texture swaps will give pose-distinction
   the static rerender could not.
3. **Future Sprint** — train a Cosmo LoRA from the 6 finalized renders + the
   canonical-v2 (~$5-10 training, ~$0.05/inference). Then unlimited pose freedom.
