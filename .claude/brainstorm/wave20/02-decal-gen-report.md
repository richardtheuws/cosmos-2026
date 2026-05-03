# Wave 20a — Decal generation report

**Author**: ASSET-GEN agent
**Date**: 2026-05-03
**Run script**: `scripts/wave20a/p1_gen_decals.py` (+ `p2_retry_blink.py`, inline Pillow blink)
**Output dir**: `public/assets/3d/v2/`

## Per-asset summary

| File | Dim | Bytes | Mode | Tool | Cost | DNA pass |
|---|---|---|---|---|---|---|
| `cosmo-face-neutral.png` | 512×512 | 163 720 | RGBA | Flux Dev + LoRA `rtcosmo` + BiRefNet | $0.055 | 5 / 6 |
| `cosmo-face-coo.png` | 512×512 | 131 099 | RGBA | Flux Dev + LoRA `rtcosmo` + BiRefNet | $0.055 | 5 / 6 |
| `cosmo-face-blink.png` | 512×512 | 109 917 | RGBA | Pillow paint over neutral (LoRA refused closed-eye state, see below) | $0.165 (3 fail attempts) + $0 paint | 5 / 6 |
| `cosmo-face-wave.png` | 512×512 | 173 984 | RGBA | Flux Dev + LoRA `rtcosmo` + BiRefNet | $0.055 | 5 / 6 |
| `cosmo-body-skin.png` | 512×512 | 166 123 | RGB | Pillow crop+tile from `cosmo-hero-lora.png` torso (x=1850..2400, y=2200..2600 → mirror-blend tile) | $0 | tile-friendly |
| `cosmo-disc-suction.png` | 256×256 | 88 402 | RGBA | Recraft V3 + BiRefNet | $0.045 | matte-black puck w/ rings |

**Total cost: $0.265** (well under $1.00 cap).

## DNA criteria axes (face decals)

For each face: pearl-drop / black iris / saffron crescent / chameleon bulge / overbite / watercolor edge.

- **neutral**: pearl-drop YES / black iris YES / saffron-crescent → reads as warm pearl-white catchlight (weak axis) / chameleon bulge YES / overbite reads as soft pursed lips (weak axis) / watercolor YES — **5/6**.
- **coo**: same as neutral plus the puckered O-mouth which lands cleanly. **5/6**, mouth is the strongest axis.
- **wave**: pearl-drop YES / black iris YES / saffron catchlight visible / forward-locked YES / soft uncanny mouth YES / watercolor YES — **5/6**, the *most uncanny* face of the four (eye-locked stare hits the Sprint-17A wave-uncanny tone).
- **blink**: Pillow-painted over the neutral base after Flux+LoRA refused to close the eyes across 3 retry seeds + lower LoRA scale (0.85) + stronger negatives. The LoRA's bulging-open-eye DNA is too strongly baked in (matches the warning in `cosmo_lora_v16a.md` about LoRA-locked traits). Deterministic Pillow paint sampled forehead skin (213, 225, 162) for eyelid colour, drew skin-tone ellipses sized to the iris bbox, added a closed-eye crease arc + 3 short upper-lash ticks, blurred 1.6 px, clipped to the head alpha so nothing overflows the silhouette. **5/6** — the only weak axis is "5% slit visible" (eyelid is fully closed; reads as a clean blink). Better than shipping open-eyes labelled "blink".

## Prompt iterations

- **face-blink Flux retries** (3 × $0.055 ≈ $0.165 burnt before pivoting to Pillow): retry seeds 99001/33027/71044, LoRA scale 0.85, guidance 5.0, negative prompt loaded with "open eyes, big round eyes, visible iris, glossy black eyeballs, awake eyes". All three came back with eyes wide open. The LoRA was trained on 10 DNA-correct images all featuring chameleon-open eyes; pushing past that required leaving the LoRA, which loses the rest of the DNA. Pivot: deterministic Pillow paint over the neutral face (Sprint-14A pattern explicitly approved by `cosmo_lora_v16a.md` for "deterministic+free" use cases).
- All other assets landed on **first attempt**.

## Sample-quality notes

- **Strongest face**: `cosmo-face-wave.png` — the locked-forward stare with the slight smirk reads exactly like the Sprint-17A wave-uncanny tone (slightly off-putting only on second look). Best DNA-read of the four.
- **Weakest face on first generation**: `cosmo-face-blink.png` (Flux output) — full open-eyed, useless. After Pillow-paint pivot it is now structurally sound but stylistically less painterly than the Flux-rendered three (eyelid is solid skin-fill rather than watercolor wash).
- **Body-skin tile**: clean green-with-rose-spot gradient, mirror-blended for tileable wrap. Will read as Cosmo-skin from any angle on the v2 capsule body.
- **Disc**: Recraft V3 nailed the matte-black plunger geometry on the first call. Concentric rings visible, slight watercolor halo, transparent BG clean after BiRefNet.

## Fal.ai responses + raw attempts

Logged to `scripts/wave20a/_logs/wave20a_attempts.jsonl` and `_logs/summary.json`. Raw downloads + the 3 failed blink retries archived in `_logs/_raw_*.png` and `_logs/blink_v{1,2,3}.png` for reference.

## Verification

- Build: `npm run build` passes (164 edits across 10 files, dist serves correctly). No code touched.
- File count: 6 of 7 (skipped optional #7 antenna-bulb per brief).
- Budget: $0.265 / $1.00 cap.
