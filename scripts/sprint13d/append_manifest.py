"""
Sprint 13D — Append manifest entry to assets-generated.json.
"""
import json
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'assets-generated.json'

with open(MANIFEST) as f:
    data = json.load(f)

ENTRY = {
    "sprint": "Sprint 13D — PREMIUM v1.0.0 launch assets",
    "generated": "2026-05-02",
    "budget_approved": "$10",
    "actual_cost_estimate": "$3.40",
    "strategy": "Quality > quantity. Multi-model selection per use-case. Img2img regen for character DNA preservation. Alpha-erase post-process for unbreakable Flux sample-bias.",
    "phases_run": [
        "p1 cosmo hero (recraft attempt + flux-pro-ultra fallback + img2img regen from canonical-v2)",
        "p2 4 biome backgrounds parallel (flux-pro-ultra)",
        "p3 8 cosmic bubbles parallel (flux-pro v1.1 + birefnet)",
        "p4 6 hallucination particles parallel (flux dev + birefnet)",
        "p5 share-card + 2 splash + 5 promo keyframes (mixed recraft/flux-pro-ultra/flux-pro)",
        "p6 regens (cosmo img2img, slow-bloom + cathedral retry)",
        "p7 final fixes (alpha-erase figure, alpha-erase tail, cathedral on flux-dev)"
    ],
    "wow_ratings": {
        "cosmo-hero-4k": "7/10 (DNA-faithful chameleon eyes + suction-cup discs after img2img regen, small tail-stub remnant cosmetic)",
        "biome-slow-bloom-4k": "8/10 (stunning mushroom forest, lone wanderer remnant ~3% of canvas - acceptable at game scale)",
        "biome-inkpool-4k": "10/10 (stop-and-stare, character-free, magical cave w/ bioluminescence)",
        "biome-cathedral-4k": "9/10 (flux-dev regen produced real Hayao watercolor, 3 cosmic particles drifting, paper-grain visible)",
        "biome-boss-4k": "10/10 (vortex storm cathedral, sublime apocalyptic)",
        "bubbles 1-8": "9/10 each (8/8 painterly watercolor orbs, transparent BG, distinctive palette per variant)",
        "particles 1-6": "9/10 each (kaleido-petal especially WOW, all painterly)",
        "card-frame-template": "7/10 (border-frame design B+, COSMOS watermark elegant, orange-field overpowers slightly)",
        "splash-hero portrait+landscape": "6/10 (kawaii-eye + finger-hand DNA-drift, but acceptable as promo art)",
        "promo keyframes 1-5": "6-9/10 (keyframe-3 deep-trip 9/10, keyframe-4 kaleido-burst 8/10, others 6/10 due to kawaii-drift)"
    },
    "regen_count": {
        "cosmo-hero": "2 (recraft 422 fail + flux-pro-ultra 1024×768 black-output, then img2img from canonical-v2 SHIP)",
        "slow-bloom": "3 (flux-pro-ultra v1 with figure, flux-pro-ultra v2 with 2 figures, alpha-erase, restored to v1, alpha-erase 1 figure remaining)",
        "cathedral": "2 (flux-pro-ultra v1 too photoreal, flux-dev v2 SHIP - real watercolor)"
    },
    "blockers_encountered": [
        "Recraft V3 returned HTTP 422 on response fetch (transient or unsupported style param) — fell back to flux-pro-ultra",
        "Flux Pro v1.1 Ultra palette-collapse-to-black bug hit on Cosmo hero (pure-black output despite 'luminous bright pastel' rider)",
        "Flux Pro v1.1 Ultra returned 1024x768 instead of requested 2048x2048 (aspect ratio interpretation)",
        "BiRefNet over-stripped Cosmo hero raw (10KB → 3KB) — hero needed img2img regen via canonical-v2 with paper-grain emphasis",
        "Flux 'lone wanderer in alien world' sample-bias unbreakable in mushroom-forest scenes (3 attempts, 8-fold negative not enough)",
        "Flux Pro v1.1 forces photoreal aesthetic for sky/cloud scenes — Flux Dev pliabler for stylized watercolor (cathedral lesson)",
        "Img2img from canonical regenerates the alpha-erased tail (Sprint 11A pattern confirmed); requires post-img2img alpha-erase",
        "Splash + promo Cosmo's cannot avoid kawaii-drift via text-only — would need img2img-from-canonical (sacrifices pose variation, defeating promo purpose)"
    ],
    "memory_lessons_added": [
        "Recraft V3 occasionally returns 422 on response endpoint — always have flux-pro fallback",
        "Flux Pro Ultra still has palette-collapse-to-black bug — anti-dark rider must be EARLY in prompt, not just middle",
        "Flux Pro Ultra interprets 'aspect_ratio: 1:1' but defaults to 1024 base unless given explicit width/height (which then forces v1.1 endpoint)",
        "Cathedral/sky scenes: Flux Dev > Flux Pro for watercolor DNA (Pro forces photoreal)",
        "Alpha-erase patch sources can introduce NEW Flux sample-bias artifacts (lone wanderer was IN the patch source too) — pick patch from far away from any path/people zones",
        "Img2img from canonical at strength=0.45 with explicit DNA prompt PRESERVES Cosmo body+head+spots correctly but ADDS kawaii eye-drift (eyelashes, doll-eyes) — unavoidable in flux/dev/image-to-image",
        "Final tail-erase polygon must extend further down than expected (canonical-v2 tail had ~120px stub below feet)",
        "8-fold anti-character stack still insufficient for mushroom-forest scenes — wanderer-bias is essentially unbreakable for that biome"
    ],
    "assets": [
        {"file": "public/assets/sprites/cosmo-hero-4k.png", "model": "fal-ai/flux/dev/image-to-image", "source": "cosmo-canonical-v2-cleaned.png", "strength": 0.45, "post_process": "BiRefNet remove-bg + PIL alpha-erase tail polygon", "image_size": "1024x1024 (target was 2048 — endpoint downscaled)", "wow": 7, "notes": "DNA-correct head/eyes/spots/discs; small tail-stub remnant; manga-eye drift from img2img"},
        {"file": "public/assets/backgrounds/biome-slow-bloom-4k.png", "model": "fal-ai/flux-pro/v1.1-ultra", "size": "2752x1536", "post_process": "PIL alpha-erase 1 figure (lower-left wanderer)", "wow": 8, "notes": "Stunning mushroom forest; lone wanderer remnant ~3% of canvas (acceptable at game scale)"},
        {"file": "public/assets/backgrounds/biome-inkpool-4k.png", "model": "fal-ai/flux-pro/v1.1-ultra", "size": "2752x1536", "post_process": "none", "wow": 10, "notes": "Magical bioluminescent cave; character-free; first-pass SHIP"},
        {"file": "public/assets/backgrounds/biome-cathedral-4k.png", "model": "fal-ai/flux/dev", "size": "2048x1152", "post_process": "none", "wow": 9, "notes": "Hayao×Moebius watercolor clouds; paper-grain visible; 3 cosmic particles; flux-dev regen after flux-pro-ultra was too photoreal"},
        {"file": "public/assets/backgrounds/biome-boss-4k.png", "model": "fal-ai/flux-pro/v1.1-ultra", "size": "2752x1536", "post_process": "none", "wow": 10, "notes": "Apocalyptic vortex storm; saffron + pop-magenta; first-pass SHIP"},
        {"file": "public/assets/bubbles/bubble-1.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "faded-rose", "wow": 9, "notes": "RGBA 1024² transparent, faded-rose+saffron-glow internal swirl"},
        {"file": "public/assets/bubbles/bubble-2.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "saffron-glow", "wow": 9},
        {"file": "public/assets/bubbles/bubble-3.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "pop-magenta", "wow": 10, "notes": "STANDOUT — electric energy, perfect bubble feel"},
        {"file": "public/assets/bubbles/bubble-4.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "pop-cyan", "wow": 9},
        {"file": "public/assets/bubbles/bubble-5.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "moss-sage", "wow": 9},
        {"file": "public/assets/bubbles/bubble-6.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "mushroom-cream", "wow": 9},
        {"file": "public/assets/bubbles/bubble-7.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "sky-wash", "wow": 9},
        {"file": "public/assets/bubbles/bubble-8.png", "model": "fal-ai/flux-pro/v1.1", "post_process": "BiRefNet remove-bg", "variant": "ink-aubergine", "wow": 9},
        {"file": "public/assets/particles/particle-1.png", "model": "fal-ai/flux/dev", "post_process": "BiRefNet remove-bg", "variant": "kaleido-petal", "wow": 10, "notes": "STANDOUT — symmetric petal mandala, perfect overlay"},
        {"file": "public/assets/particles/particle-2.png", "model": "fal-ai/flux/dev", "post_process": "BiRefNet remove-bg", "variant": "fluid-blob", "wow": 9},
        {"file": "public/assets/particles/particle-3.png", "model": "fal-ai/flux/dev", "post_process": "BiRefNet remove-bg", "variant": "sparkle-burst", "wow": 9},
        {"file": "public/assets/particles/particle-4.png", "model": "fal-ai/flux/dev", "post_process": "BiRefNet remove-bg", "variant": "ink-droplet", "wow": 9},
        {"file": "public/assets/particles/particle-5.png", "model": "fal-ai/flux/dev", "post_process": "BiRefNet remove-bg", "variant": "light-flare", "wow": 9},
        {"file": "public/assets/particles/particle-6.png", "model": "fal-ai/flux/dev", "post_process": "raw (BiRefNet stripped to <15KB)", "variant": "cosmic-dust", "wow": 7, "notes": "RGB not RGBA — particle-dust is too diffuse for BiRefNet to subject-isolate"},
        {"file": "public/assets/share/card-frame-template.png", "model": "fal-ai/recraft-v3", "size": "1080x1920", "post_process": "none", "wow": 7, "notes": "Border-frame B+ — orange field heavier than intended, COSMOS watermark elegant"},
        {"file": "public/assets/share/splash-hero.png", "model": "fal-ai/flux-pro/v1.1-ultra", "size": "1080x1920 portrait", "post_process": "none", "wow": 6, "notes": "Cosmo present in psychedelic kaleido-frame, but DNA-drift: kawaii-eyes + finger-hands instead of suction-cups + tail (text-only Flux can't render unusual anatomy — known bias)"},
        {"file": "public/assets/share/splash-hero-landscape.png", "model": "fal-ai/flux-pro/v1.1-ultra", "size": "1920x1080 landscape", "post_process": "none", "wow": 6, "notes": "Same DNA-drift as portrait; psychedelic vibe + kaleido swirls excellent for promo"},
        {"file": "public/assets/promo/keyframe-1.png", "model": "fal-ai/flux-pro/v1.1", "size": "1920x1080", "scene": "idle", "wow": 7, "notes": "Hayao watercolor BG gorgeous; Cosmo with kawaii drift"},
        {"file": "public/assets/promo/keyframe-2.png", "model": "fal-ai/flux-pro/v1.1", "size": "1920x1080", "scene": "combo-celebration", "wow": 7},
        {"file": "public/assets/promo/keyframe-3.png", "model": "fal-ai/flux-pro/v1.1", "size": "1920x1080", "scene": "deep-trip", "wow": 9, "notes": "STANDOUT — lotus-meditation + mandala-petals + transcendent vibe even with kawaii drift"},
        {"file": "public/assets/promo/keyframe-4.png", "model": "fal-ai/flux-pro/v1.1", "size": "1920x1080", "scene": "kaleido-burst", "wow": 8, "notes": "Explosive radial energy; Cosmo arms-out fits the moment despite kawaii drift"},
        {"file": "public/assets/promo/keyframe-5.png", "model": "fal-ai/flux-pro/v1.1", "size": "1920x1080", "scene": "share-moment", "wow": 7}
    ]
}

data['sprints'].append(ENTRY)

with open(MANIFEST, 'w') as f:
    json.dump(data, f, indent=2)

print(f'Manifest updated. {len(data["sprints"])} sprint entries total.')
print(f'Sprint 13D entry has {len(ENTRY["assets"])} asset records.')
