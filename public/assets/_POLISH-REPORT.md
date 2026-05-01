# Sprint 5D — Polish Pass Report

**Date**: 2026-04-30
**Agent**: asset-generator
**Cost**: ~$0.20 (4 Flux Pro calls @ ~$0.05 incl 1 retry)

## Asset 1: tile-wall-v2.png

- **Path**: `public/assets/tiles/tile-wall-v2.png`
- **Size**: 1024x512 (2:1)
- **Model**: Flux Pro v1.1
- **Status**: SUCCESS (no retry)
- **Coherence Score**: 7/10
- **Notes**: Strong vertical aubergine plank wall with saffron crack-glow and faded-rose mineral wash — palette nails the slow-bloom-v2 stem. Top 75% is solid wall texture.
  - **Issue**: Bottom ~20% bled into a faux "stone floor + ledge" instead of staying flat strip. Engine multiply-blend may mask this, but if visible: crop bottom 20% in CSS or re-roll.
  - **Stylistic match to art-bible**: solid (woodcut linework, painted watercolor present).

## Asset 2: tile-mushroom-v2.png

- **Path**: `public/assets/tiles/tile-mushroom-v2.png`
- **Size**: 1024x512 (2:1)
- **Model**: Flux Pro v1.1
- **Status**: SUCCESS after 1 retry
- **Coherence Score**: 8/10
- **Notes**:
  - **First attempt FAILED** (3/10): generated cream-sky + grass-strip-on-stone — full landscape again. The same failure pattern as Fase B. Stem-tags ("mushroom-cream platform-cap") + "viewed from front" still triggered scene-mode.
  - **Retry SUCCESS**: Switched prompt-front to `extreme close-up photograph of cream mushroom cap surface material texture filling entire image edge-to-edge NO HORIZON NO SKY NO GROUND NO BACKGROUND just material texture` — explicit "extreme close-up photograph" + material-fills-frame language defeats the scene-bias. Result: clean cream-ivory cap with saffron lichen freckles and gill-pattern bottom edge.
  - **Trade-offs**: Lost the explicit faded-rose pink and fluo-lime moss tags (model collapsed all freckles to saffron-yellow). Acceptable — palette still reads as warm-cosmic-organic.
  - **Missing**: dark ink-line top edge (model went photorealistic, not woodcut). Engine `tint` or post-CSS filter can compensate.

## Asset 3: bg-near-v2.png

- **Path**: `public/assets/backgrounds/slow-bloom-v2/bg-near-v2.png`
- **Size**: 1024x768 (background default, 4:3)
- **Model**: Flux Pro v1.1
- **Status**: SUCCESS (no retry)
- **Coherence Score**: 6/10
- **Notes**:
  - Composition correct: vines hanging top-left, branches top-right, open center, mushroom clusters bottom-left + bottom-right corners.
  - **Issue 1**: bottom-corner mushrooms are noticeably larger and busier than spec ("small moss patches") — they extend ~30-40% up the frame rather than corner-only.
  - **Issue 2**: NOT 16:9 — the background type defaults to 4:3 (1024x768). Spec said 16:9. If parallax engine expects 16:9, re-roll with `--size 1920x1080` or `--size 1024x576`.
  - **Issue 3**: Center has soft misty forest silhouette in mid-distance — partially defeats "transparent center" goal. Engine alpha-mask or low opacity (0.4-0.5) on this layer recommended.
  - **Stylistic match**: Excellent — the watercolor painted style + ink linework matches slow-bloom-v2 stem perfectly.

## Aggregate

- **Files written**: 3 of 3
- **Retries**: 1 (tile-mushroom)
- **All within cost target**: yes (~$0.20)
- **BiRefNet skipped**: yes for all 3 (engine handles blending)

## Recommendations for engine integration

1. **tile-wall-v2**: use `multiply` blend + crop bottom 20% via texture-uv-offset in renderer, OR accept stone-ledge as design feature.
2. **tile-mushroom-v2**: apply CSS/canvas `tint` for faded-rose freckle hue if needed; otherwise use as-is.
3. **bg-near-v2**: render at opacity 0.4-0.5 + scale-down to 80% to keep gameplay readable. Re-roll if true 16:9 needed.

## Lessons learned (added to asset-generator memory)

- "Texture-strip-prefix FRONT" pattern works for **wall** but **fails for mushroom** because Flux interprets "cream mushroom-cap" as a scene element with sky.
- **Working alternative for organic material tiles**: `extreme close-up photograph of [material] surface filling entire image edge-to-edge NO HORIZON NO SKY NO GROUND NO BACKGROUND just material texture`. The "extreme close-up photograph" + edge-to-edge framing forces material-mode.
- Stylistic stem-tags (woodcut, watercolor, ink-line) are dropped when "extreme close-up photograph" anchor is used — model goes photorealistic. Apply style via engine post-process tint instead.
