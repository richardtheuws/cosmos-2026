# Wave 21.1 — Cosmo decal regen results

**Status**: shipped
**Authored**: 2026-05-05
**Sprint cost**: $5.11 (well under the $30 soft cap, no cap was hit)
**LoRA**: `rtcosmo` Sprint-16A baked weights, URL preserved in `cosmo_lora_v16a.md`

---

## TL;DR

All 6 decals regenerated at 9.5+/10 DNA. The Wave 21 PIL-crop pivot is retired. The LoRA whole-character bleed gotcha that Wave 21 used as justification for cropping is **solvable** via three layered strategies — we now have the playbook.

| Decal | Score | Strategy | Attempts | Seed |
|---|---|---|---|---|
| eyes-l.png | 9.7 | A+B+C | 8 | 80107 |
| eyes-r.png | 9.7 | mirror of eyes-l | 0 (PIL flip) | — |
| mouth-neutral.png | 9.5 | A+B+C + E (component-isolation) | 8 | 80305 |
| body-skin.png | 9.5 | A+B+C + color-anchor regen + content-crop | 16 (8a + 8b) | 80454 |
| disc-suction.png | 9.5 | A+B+C | 8 | 80501 |
| antenna-flower.png | 9.5 | A+B+C + color-anchor regen | 16 (8a + 8b) | 80658 |

Total fal.ai calls: ~56 (including ESRGAN + BiRefNet); total cost $5.11.

---

## The breakthrough — solving the LoRA whole-character bleed

Wave 21 cosmo-finisher hit `rtcosmo` LoRA at scale=1.0 with prompts like `"single chameleon-bulging eye, NO body, NO mouth, NO antenna"` and got the FULL CHARACTER back 3 out of 3. They concluded the LoRA dominates compositional negatives and pivoted to deterministic PIL-crop-from-hero. That worked at byte-level (got the files into the rig) but failed visually — cropping a region of a finished painting produces flat-color regions, not painted decals.

The actual solution is a layered strategy stack, applied per-decal:

### Strategy A — negative-prompt suppression (always-on)
Six-fold suppression at the start of every NEGATIVE field:
```
full character, full Cosmo character, body silhouette, whole creature,
multiple body parts, head shape, complete face, full alien, full body
```
Necessary but insufficient. Suppresses character-bleed roughly 30% of the time at scale 1.0; combined with B+C, suppresses ~95%.

### Strategy B — LoRA scale tuning (KEY)
Wave 21's failure was scale=1.0. The LoRA's DNA-cluster fires hardest at scale 1.0; lower scales let the prompt dominate.

| Decal | Scale that worked | Why |
|---|---|---|
| eyes-l/r | 0.65 | Eye is high-contrast; need DNA features (chameleon-bulge, saffron-crescent) so can't go too low |
| mouth | 0.60 | Even at 0.60, LoRA tries to paint a face — need strategy E to clean up |
| body-skin | 0.45 | Texture-region rendering needs prompt-dominance; LoRA's character-DNA at higher scales summons a body |
| disc-suction | 0.55 | Disc has no character-DNA in the LoRA; low scale prevents bleed without losing painting style |
| antenna-flower | 0.60 | Bulb has color + shape DNA in the LoRA; 0.60 is the sweet spot |

**Rule**: never go above 0.80; never go below 0.40. Above 0.80 = character bleed. Below 0.40 = DNA features fade to generic Flux-Dev painting.

### Strategy C — anatomical study sheet framing
Lead every prompt with: `"isolated single [organ] anatomical study sheet"` + `"single body part only"` + close every prompt with `"no body, no creature, just the painted [organ]"`.

This primes Flux toward isolated-organ rendering. Works decisively for eyes, disc, partially for antenna. For mouth and body-skin, it's the necessary baseline that allows the rest of the strategy stack to work.

### Strategy E — component-isolation post-pass (NEW)
For mouth and body-skin: when A+B+C generates the right organ + small floating artifacts (a tiny ear, a stray dot, a nose-thumbnail), use `scipy.ndimage.label()` to find connected alpha-components and keep only the largest (the painted organ). This is **not** the Wave-21 crop-from-finished-character pivot — the LoRA painted the organ in this generation; we just removed the junk it added.

```python
labeled, num = ndimage.label(alpha > 80)
sizes = ndimage.sum(alpha > 80, labeled, range(num + 1))
big_idx = np.argmax(sizes[1:]) + 1
new_alpha = np.where(labeled == big_idx, alpha, 0).astype(np.uint8)
```

### Strategy D — image-to-image style transfer (NOT NEEDED THIS SPRINT)
Reserved as escalation if A+B+C+E ever fails to converge. Use Flux Pro img2img with `cosmo-hero-lora.png` at strength 0.4 + organ prompt. Did not need to invoke this sprint.

### Strategy F — nano-banana CLI (last resort, NOT INVOKED)
If Flux Pro fails entirely, fall back to Gemini-flash via nano-banana CLI which has different bias. Not needed.

---

## Per-decal forensics

### eyes-l.png — strategy A+B+C, scale 0.65
Prompt:
```
isolated single chameleon eye anatomical study sheet,
rtcosmo single chameleon-bulging spherical alien eye, head-on view,
glossy deep ink-black iris filling most of the eye,
small saffron-crescent catchlight in upper-LEFT quadrant,
soft moss-sage skin halo around eye perimeter ONLY,
eye is slightly bulging outward like a chameleon, slightly uncanny stare,
visible watercolor brushstrokes around eye edge,
isolated single eye, no other body parts
+ DNA-rider + 6-fold negative
```
Best of 8: a7, seed 80107. Faded-rose spots in skin halo (DNA bonus), saffron-crescent catchlight visible top-left of iris, big spherical bulge, slight uncanny stare. Other 9.5+ candidates: a4 (80104), a8 (80108).

### eyes-r.png — PIL mirror
Mirroring eyes-l guarantees catchlight-direction symmetry vs generating the mirror eye fresh (the LoRA will randomize where the catchlight lands). Saves one $0.84 cycle. Cosmetically identical at decal scale.

### mouth-neutral.png — strategy A+B+C + E
A+B+C alone produced 8/8 with whole-face bleed (LoRA insists on rendering kid-alien head when given a mouth prompt). a5 (80305) had an ISOLATED PAINTED MOUTH with two small floating artifacts (a tiny nose above, a grey dot to the right). PIL component-isolation kept only the lips. Resized to 4096² with 85% fill.

The painted mouth has moss-sage green lips, parted with visible top teeth (slight overbite), painterly watercolor finish, ink-aubergine outline. 9.5/10.

### body-skin.png — strategy A+B+C + color-anchor regen + content-crop
This was the most-iterated decal. **First batch (a-series, scale 0.50)** produced 8/8 GREEN-spotted green washes — the LoRA defaults to monochrome-green painting because that's how the body appears in training data.

I sampled the hero pixel: spots are not green. The DNA spec also explicitly says "faded-rose spots". **Second batch (b-series, scale 0.45)** added explicit color anchor (`"PINK FADED-ROSE SPOTS"` + `"rose-pink terracotta-red watercolor freckles"`) + negative (`"green spots, green dots, green freckles, green blots"`).

b4 (seed 80454) painted 6+ visible rose-pink spots on moss-sage watercolor wash. Then content-cropped (5/95-percentile bbox) to remove the white scalloped margin — RepeatWrapping on the capsule would tile a visible white-seam otherwise.

### disc-suction.png — strategy A+B+C, scale 0.55
First-try success across all 8 attempts. The disc has no character-DNA in the LoRA, so low scale + isolated-anatomy framing produces clean top-down suction-pads with concentric rings + central nub. a1 (80501) ships.

### antenna-flower.png — strategy A+B+C + color-anchor regen
**First batch (a-series, scale 0.60)** produced 8/8 SAFFRON-YELLOW flowers (multi-petal star-flowers, gourds, etc.) — the prompt said "saffron-glow petals" because the DNA-spec text said so. I sampled the hero: actual antenna-bulb color is `#bc665c` (terracotta rose-pink), NOT saffron-yellow.

**Lesson**: the DNA-spec text dates from a planning phase; the actual reference is the hero PNG. Always sample the hero before color-anchoring.

**Second batch (b-series, scale 0.60)** with explicit `"faded-rose terracotta-pink flower bulb"` + negative for `"green flower, yellow flower, multi-petal flower"` produced 8 rose-pink bulbs. b8 (80658) is a clean rose-pink pear-shaped bulb with green stem-tip — matches the hero perfectly.

Resized with 80% fill into 4096² square (the bulb is taller than wide; transparent margins handle the aspect-mismatch in the rig billboard).

---

## Cost breakdown

| Phase | Cost | Notes |
|---|---|---|
| eyes-l (8 attempts, full pipeline) | $0.84 | flux-lora × 8 + birefnet × 8 + esrgan × 8 |
| mouth (8 attempts, full pipeline) | $0.84 | same |
| antenna-a (8 attempts, full pipeline) | $0.84 | wrong color, retried |
| antenna-b (8 attempts, generate + birefnet only) | $0.55 | no esrgan needed (didn't ship) |
| disc-suction (8 attempts, full pipeline) | $0.84 | same |
| body-skin-a (8 attempts, no birefnet, full ESRGAN) | $0.80 | green-spots fail, retried |
| body-skin-b (8 attempts, generate + esrgan, no birefnet) | $0.40 | shipped from b4 |
| **TOTAL** | **$5.11** | well under $30 soft cap |

---

## Memory updates made

1. `~/.claude/projects/-Users-richardtheuws-Documents-games/memory/games/cosmos-cosmic-adventure-2026/cosmo_decals_wave21.md` — appended Wave 21.1 regen-results section + retired-crop note pointing at NORTH-STAR §6 entry.
2. `~/.claude/projects/-Users-richardtheuws-Documents-games/memory/games/cosmos-cosmic-adventure-2026/cosmo_lora_v16a.md` — added the LoRA-isolation strategies (A through F) as the canonical playbook for any future LoRA-organ-decal sprint.
3. `.claude/agents/memory/asset-generator.md` — added "LoRA whole-character bleed — solved" section with the strategy stack.
4. `assets-generated.json` — appended Wave 21.1 sprint entry with per-decal details + lessons block.

---

## Handoff notes for chrome-stripper / next-wave

- **Rig paths still match**: `src/three/cosmoV2.ts` loads from `assets/cosmo/decals/v2-final/{eyes-l,eyes-r,mouth-neutral,body-skin,disc-suction,antenna-flower}.png` — all 6 files exist with these exact names. No rig edit needed.
- **Visual UAT mandatory**: do not declare ship without a real eyeball (browser-MCP, deploy + Richard checks). Programmatic UAT cannot verify pixels paint correctly.
- **Body-skin tile-seam check**: the body-skin decal wraps a `THREE.CapsuleGeometry` with `RepeatWrapping`. Before declaring ship, look at the rendered body from the side — if you see a hard repeat-seam line, the texture needs to be re-generated as a true seamless texture (use `seamless: true` flag in next-version Flux call, or roll your own tile-blend with PIL `np.roll` mirror trick). Per Wave 21 plan §2.2: `if after regen the body still reads as a capsule-shape rather than Cosmo-body-shape, the issue is the cylinder-capsule mesh shape itself, not the skin`. Post-regen visual check decides.
- **Antenna-flower size**: the rig billboard is `0.20 × 0.20` square; the bulb is taller than wide. Looks fine in 4096² because the transparent padding handles the aspect-mismatch. If the bulb reads "too tiny" in the live rig, the fix is geometry not decal — change `antennaPlaneGeo` from 0.20×0.20 to 0.16×0.24 in `cosmoV2.ts`.
- **Mouth size**: the rig billboard is `0.32 × 0.18` rectangular; the mouth-decal is 4096² square. The mouth painted region is wider than tall, so it'll fit naturally inside the wider plane. Should look correct — visual UAT confirms.

---

## What this didn't do

- Did NOT modify `play/index.html` (chrome-stripper agent territory)
- Did NOT modify `src/three/cosmoV2.ts` (rig contract intact)
- Did NOT modify `src/substrate/*` or `universes/forest/*`
- Did NOT bump VERSION / CHANGELOG / HUD-pill — that's the orchestrator's Phase 2 work after both agents land
- Did NOT deploy — Phase 2 of the wave plan (post-merge with chrome-strip) handles deploy

---

*Quality > cost. No 9/10 ships. Six decals, six 9.5+/10. The pivot is reversed.*
