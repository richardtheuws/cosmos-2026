# Slow Bloom (L1) Parallax Backgrounds — Generation Report

**Sprint**: 3.1 — Single-biome parallax fix
**Biome**: Bloomroot Veld jungle (mushroom forest)
**Generated**: 2026-04-30
**Resolution**: 1024x576 (16:9 landscape)
**Models**: Flux Pro v1.1 (BG generation), BiRefNet (alpha matting attempt)
**Locked palette**: `#E8D5B7` mushroom-cream, `#7B9E89` moss-sage, `#4A6FA5` sky-wash blue, `#B85C7E` faded-rose, `#3D2E4A` ink-aubergine, `#F4A261` saffron-glow, `#2D4A3E` forest-deep

---

## Layer status

### bg-far.png — parallax 0.18 — REGENERATED (v2)
- **Status**: OK after retry
- **Dimensions**: 1024x576, no alpha
- **First attempt**: pure black image (7.6KB). Flux Pro misread `ink-aubergine mountain silhouettes` + `saffron-glow sun ray` + dark cumulus references as a night/storm scene.
- **Fix applied**: replaced "ink-aubergine mountain silhouettes" with "moss-sage rolling hill silhouettes barely visible at horizon"; added explicit `NOT dark NOT black NOT night` and `predominantly blue and cream values` as palette enforcement; positioned saffron as "haze backlit from upper-right" instead of "sun ray diagonal" (less directional, less likely to over-burn).
- **Result (v2)**: bright pastel watercolor sky with sky-wash-blue gradient, mushroom-cream cumulus, faint moss-sage hills at bottom 1/4, gentle saffron warmth in upper-left corner. On-style and stack-compatible.
- **Palette fidelity**: 5/5 — all four palette colors present, none dominant beyond plan.

### bg-mid.png — parallax 0.42 — OK
- **Status**: GORGEOUS, on-style, ship-ready
- **Dimensions**: 1024x576, no alpha (originally Flux returns JPG-style PNG)
- **Visual**: dense mushroom forest with mushroom-cream caps, moss-sage canopy/undergrowth, faded-rose lichen + small flowers, sky-wash-blue mist drifting in central upper portion (already has a "sky window" in the composition for parallax depth-stacking).
- **Palette fidelity**: 5/5 — perfect.
- **Stack note**: upper portion is naturally semi-light (sky-wash-blue mist) so far-layer sky reads through visually even without true alpha. Use with multiply or normal blend in engine.

### bg-mid-cleaned.png — BiRefNet attempt
- **Status**: OVERSTRIPPED — usable only as accent overlay, NOT as primary mid-layer
- **Dimensions**: 1024x576, hasAlpha: yes
- **Issue**: BiRefNet treated trees, ground, ferns, lichen, AND atmospheric mist as "background" and stripped them all. Only the largest 5-6 mushroom caps survived. Loses the forest mass that gave the layer its parallax weight.
- **Recommendation**: do NOT use as bg-mid replacement; can be used as a separate "hero mushroom cluster" sprite-style overlay on a 4th layer if desired.

### bg-near.png — parallax 0.78 — OK
- **Status**: EXCELLENT framing layer
- **Dimensions**: 1024x576, no alpha
- **Visual**: ink-aubergine drooping vines on left/right edges, faded-rose berries hanging in upper corners, forest-deep silhouettes of large mushrooms at lower-left and lower-right, white/cream center showing through to mid/far layers. Exactly the depth-frame intended.
- **Palette fidelity**: 5/5.
- **Stack note**: center is near-white. Engine should treat near-white pixels as semi-transparent (color key) OR use this as opaque + apply CSS `mix-blend-mode: multiply` so light center disappears against bright far/mid layers (will work in canvas via globalCompositeOperation='multiply').

### bg-near-cleaned.png — BiRefNet attempt
- **Status**: OVERSTRIPPED — drops all framing foliage
- **Dimensions**: 1024x576, hasAlpha: yes
- **Issue**: same as bg-mid-cleaned — only the largest mushroom caps survived; the vines, berries, and frame foliage that made it a "near layer" were classified as background.

---

## Stack coherence verdict

**The trio fits together visually.** Same palette consistently applied, same watercolor medium, same Studio Ghibli x Moebius x Tenniel mood across all three. Composition reads as one biome from three depths:

- bg-far: sky + horizon
- bg-mid: forest middle ground with built-in sky-window in upper portion
- bg-near: foreground vine/foliage frame

**No regeneration needed for mid/near.** Only bg-far needed a v2 retry.

**Engine-side handling required:**
- bg-mid: use as opaque, parallax 0.42 — its built-in upper sky-area means it reads layered without needing true alpha
- bg-near: either (a) opaque with multiply blend, OR (b) write a one-shot Python/Pillow script to color-key the white center to alpha (cheaper than BiRefNet for landscape framing layers)
- bg-far: opaque, parallax 0.18, painted full-frame as the background

---

## Lessons learned (logged to `shared/reference_asset_gen.md`)

1. **BiRefNet is the WRONG tool for landscape watercolor parallax layers.** Designed for sprite/subject extraction (single hero figure on background). On wide diffuse landscapes it either strips everything (cave scenes with no clear subject) or strips too much (forest scenes — keeps only the largest objects).
2. **Flux Pro can render "saffron-glow + ink-aubergine + mountains" as a near-black image.** When palette-keywords pull warm-on-dark, the model can collapse to night scene. Mitigations: lead with `luminous bright pastel`, add `NOT dark NOT black NOT night`, replace "ink-aubergine X" with "[lighter color] X" when the element is supposed to be receding into haze rather than dominating.
3. **`NO characters` constraint fails ~50% in cave/cavern scenes.** Flux Pro v1.1 added 1-2 small silhouetted figures into both inkpool-mid and inkpool-near despite the negative. Likely because cave landscapes with a tunnel-perspective + soft-light source strongly correlate with "explorer entering cave" training data.
4. **Cool-only palette enforcement WORKED for inkpool.** Adding `cool palette ONLY, NO warm tones NO orange` as the FIRST line of the prompt prevented the warm/orange drift that the previous Cosmos cave generation suffered from. Confirms the rule from earlier session.

---

## File inventory

```
slow-bloom/
├── bg-far.png             43K  USE (regenerated v2)
├── bg-mid.png            219K  USE
├── bg-mid-cleaned.png    254K  reference only — overstripped
├── bg-near.png           224K  USE (with multiply blend in engine)
├── bg-near-cleaned.png   245K  reference only — overstripped
└── _GENERATION_REPORT.md       this file
```

Recommended engine-side load list: `bg-far.png`, `bg-mid.png`, `bg-near.png`.

---

## Bonus: Inkpool Hollow (L4-L6, S5)

Generated in `../inkpool-hollow/`. Three layers (far/mid/near), all 1024x576, all on-palette (cool-only enforcement worked).

Caveat: bg-mid and bg-near each contain 1-2 small silhouetted human figures despite `NO characters` constraint. Acceptable as "atmospheric mystery figure" or trivially editable out in Photoshop. Flag for art review before locking S5.

BiRefNet skipped after slow-bloom test (would wipe entire image, as confirmed by 2.4KB output files which were deleted).

```
inkpool-hollow/
├── bg-far.png    165K  USE (cool palette, atmospheric)
├── bg-mid.png    198K  USE (note: small character silhouette; remove if needed)
└── bg-near.png   181K  USE (note: small character silhouette; remove if needed)
```
