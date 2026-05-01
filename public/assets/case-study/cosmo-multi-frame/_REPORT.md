# Sprint 7A — Multi-frame Cosmo via Flux Control LoRA Canny

**Date**: 2026-05-01
**Goal**: 6 distinct animation pose-textures wired to Cosmo state machine
**Status**: SHIPPED — all 6 frames generated + wiring complete + build green

---

## Pipeline (final, working)

```
1. PIL renders skeleton-{pose}.png — thick black lines, BIG black discs at hand-tips
2. fal-ai/flux-control-lora-canny — skeleton as control_lora_image_url (NO image_url!)
   - control_lora_strength = 1.2 (sweet spot)
   - num_inference_steps = 35
   - guidance_scale = 4.5
   - style-first prompt (Ghibli/Moebius FIRST, character DNA SECOND)
3. fal-ai/birefnet/v2 — transparent PNG
4. Wire: L1Scene.preload + Cosmo.updateAnim() texture-swap state machine
```

## Per-frame fidelity (1-10)

| Frame | Pose | Character | Notes |
|-------|------|-----------|-------|
| walk-1 | 7 | 6 | Style-flat (closer to outline drawing) but pose holds, single ink eye |
| walk-2 | 8 | 6 | Mirror pose works, but 2 black-disc-eyes drift (not 1 ink-eye) |
| jump-up | 9 | 9 | Knees-tucked apex pose, arms reaching up with discs above head — best frame |
| jump-fall | 10 | 9 | T-pose falling, both discs at outstretched arm-tips — second-best |
| cling-right | 9 | 9 | Side-profile, both discs reach right (toward wall) |
| hurt | 9 | 9 | Knockback splay with bonus faded-rose blush spots |

**Overall**: 5/6 frames are excellent, walk-1/walk-2 have minor style-thinness but ship-quality
in-game at 120px display size.

## Cost summary

| Step | Cost | Result |
|------|------|--------|
| Test v1 (with canonical image_url) | $0.09 | FAILED — canonical bias dragged pose back |
| Test v2 (skeleton-only str 1.2) | $0.09 | Pose OK but anemic line-art style |
| Test v3 (skeleton-only str 1.0) | $0.09 | Style OK but pose collapsed to A-pose |
| Test (str 1.2, style-first prompt) | $0.09 | PRODUCTION — walk-1 final |
| Batch 5 frames | $0.43 | All ship-quality |
| Redo walk-2 (eye-drift) | $0.09 | Slightly better but kawaii eyes persist |
| **Total** | **~$0.88** | within $1.00-1.50 budget |

## Wiring (done)

- `src/phaser/scenes/L1Scene.ts:79-99` — preload 6 distinct pose textures (no longer
  loads canonical-v2-cleaned for run/jump/cling)
- `src/phaser/scenes/L1Scene.ts:156` — Cosmo init texture changed to `cosmo-walk-1`
- `src/phaser/scenes/L1Scene.ts` — removed redundant `swapCosmoTexture()`; logic moved
  into `Cosmo.updateAnim()`
- `src/phaser/entities/Cosmo.ts` — replaced `playStateAnim()` with `updateAnim(dt)`
  texture-swap state machine. Added `walkPhase` + `walkFrameToggle` for ~133ms walk-cycle
  alternation.

State → texture mapping:
- `idle` → cosmo-walk-1 (also resets walk-cycle phase)
- `run` → alternate cosmo-walk-1 / cosmo-walk-2 every 133ms
- `jump` → cosmo-jump-up (vy<0) or cosmo-jump-fall (vy>=0)
- `fall` → cosmo-jump-fall
- `cling` → cosmo-cling-right (setFlipX based on clingSide)
- `damage` / `death` → cosmo-hurt

## Key learnings (memory)

1. **Flux Control LoRA Canny + skeleton-only is THE working pose-pipeline.** Sprint 5B
   confirmed image-to-image fails. Sprint 7A confirms control-lora WITH image_url also
   fails (canonical drags pose back). Skeleton + canny + NO image_url + control_lora_strength
   1.2 is the recipe.
2. **control_lora_strength sweet spot = 1.2.** At 0.85 skeleton barely matters; at 1.0 the
   prompt wins and pose collapses to A-pose; at 1.2 pose holds and prompt gets enough
   weight for character DNA.
3. **Programmatic stick-figures with BIG black discs solve the suction-cup problem.** Not
   a sample-bias issue (which can't be fixed with text), it's a CONTROL issue solved by
   canny edge. The model renders jet-black discs because canny SHOWS jet-black discs.
4. **Style-first prompt at high control-strength** preserves more painterly look. Putting
   "Studio Ghibli watercolor with ink-aubergine outline" FIRST and character DNA after
   keeps the watercolor finish.
5. **Queue wait times can hit 150s** for control-lora-canny — bump deadline to 600s.

## Open issues

- Inter-frame eye-style drift (some frames get 1 ink-eye, others 2 black-disc-eyes). At
  120px in-game this is fine; for a future pass, seed-lock + per-frame iteration could fix.
- cling-right uses `setFlipX` for left-wall cling — visually OK but body asymmetry means
  the suction-cups will appear on the "wrong" side of the body when flipped.
- hurt-frame is reused for death state with no rotation — playtest first, add Z-rotation
  tween if needed.
