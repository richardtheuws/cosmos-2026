"""
Sprint 13D — Phase 2: 4 biome backgrounds upgrade (4K, parallax-ready).

Goal: Each background must have stop-and-stare quality. Hayao×Moebius DNA
visible (paper-grain, ink-edges, watercolor wash). Depth reads at first
glance. NO characters — 6-fold negative stack per visual_coherence.md.

Models:
  - Flux Pro v1.1 Ultra at 4K aspect (highest quality endpoint per asset_learnings.md)
  - NO BiRefNet (landscapes — proven destructive in Sprint 4.5 Fase B)
  - NO scene-magnet keywords like "psychedelic" stripped only for tiles; for
    backgrounds we WANT cosmic-mood, so keep style stem.

Outputs:
  public/assets/backgrounds/biome-slow-bloom-4k.png
  public/assets/backgrounds/biome-inkpool-4k.png
  public/assets/backgrounds/biome-cathedral-4k.png
  public/assets/backgrounds/biome-boss-4k.png
"""
from __future__ import annotations
import json, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt,
)


BG_OUT_DIR = ROOT / 'public/assets/backgrounds'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'
RAW_DIR.mkdir(parents=True, exist_ok=True)


# 6-fold anti-character stack (visual_coherence.md + asset_learnings.md)
ANTI_CHARACTERS = (
    'NO characters NO figures NO silhouettes NO travelers NO wanderers '
    'NO people NO humans NO animals NO creatures NO faces, '
    'NO digital NO 3D NO photoreal NO pixel-art NO cartoon, '
    'luminous bright pastel NOT dark NOT black NOT night '  # palette-collapse-to-black anti
)

STYLE_STEM_BG = (
    'Cosmic Adventure 2026 hand-painted watercolor with ink underdrawing, '
    'paper-grain texture across the entire scene, faded-rose mineral wash + '
    'saffron-glow underlight + ink-aubergine ragged outline accents, soft '
    'wet-edge watercolor bleeds, Studio Ghibli x Moebius x Tenniel '
    'illustration style, atmospheric depth with multiple parallax layers '
    'baked-in, far misty atmospheric perspective fades to mid-tone density '
    'to crisp near-frame ink lines, museum-quality landscape illustration'
)

PALETTE_BG = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, locked seven-tone palette'
)


# ----------------------------------------------------------------------------
# 1. Slow Bloom — alien-mushroom forest, soft pinks/saffron, deep depth
# ----------------------------------------------------------------------------
SLOW_BLOOM = (
    'an alien mushroom forest at golden dawn, dozens of giant phosphorescent '
    'mushroom-trees with caps glowing in soft saffron-orange and faded-rose '
    'pink stretching back into atmospheric mist, layered depth from huge '
    'foreground mushroom-tree silhouettes to mid-ground softly-glowing '
    'mushroom canopy to far hazy mountain ridges of more mushroom forest, '
    'cosmic spore-particles drifting through warm shafts of light, '
    'mushroom-cream pale ground with soft moss carpet, ethereal serene '
    'beautiful but slightly uncanny dream-forest, NO mushroom is in '
    'foreground center to leave parallax space'
)

# ----------------------------------------------------------------------------
# 2. Inkpool Hollow — deep aubergine cave, bioluminescent moss
# ----------------------------------------------------------------------------
INKPOOL = (
    'a deep cathedral-sized underground hollow chamber painted in deep '
    'ink-aubergine purple-black with constellations of bioluminescent moss '
    'and phosphorescent fungi glowing in saffron-amber and faded-rose pink '
    'and forest-deep emerald along the chamber walls, layered depth from '
    'huge dark stalactite silhouettes hanging from above into mid-ground '
    'softly-glowing mineral pools to far receding cave-mouth tunnels with '
    'distant glow, reflective black mirror-pool at the bottom catching the '
    'glow, faint mist suspended in the air, ethereal serene mystical '
    'cathedral cavern, watercolor washes layer over each other'
)

# ----------------------------------------------------------------------------
# 3. Cloud Cathedral — bloom-pierced clouds, sky-wash, soft pinks
# ----------------------------------------------------------------------------
CATHEDRAL = (
    'a heavenly sky-wash blue cloud realm at high altitude, vast cumulus '
    'cathedrals of pillowy clouds layered into the distance with shafts of '
    'saffron-glow golden-orange sunlight piercing through gaps between '
    'cloud columns, layered depth from foreground cloud-platform edges with '
    'crisp ink-line outlines to mid-ground cloud-towers softening into '
    'atmosphere to far hazy cloud-mountains at the horizon, faded-rose '
    'pink touches at cloud edges where dawn light catches them, occasional '
    'tiny floating crystalline pollen-motes drifting on warm updrafts, '
    'serene celestial beautiful'
)

# ----------------------------------------------------------------------------
# 4. Boss Stinger climax — saffron-storm, pop-magenta lightning, ominous
# ----------------------------------------------------------------------------
BOSS = (
    'a climactic alien storm cathedral filling the sky with churning '
    'saffron-orange and pop-magenta clouds spiraling around a central '
    'cosmic eye-of-the-storm, ominous beautiful ink-aubergine deep-purple '
    'storm clouds layered with crisp ink-line cumulus outlines, branching '
    'pop-magenta lightning forks streaking through the upper layers, '
    'layered depth from foreground silhouetted ink-aubergine cliff edges '
    'rising into the storm to mid-ground saffron-glow rain shafts to far '
    'hazy storm-vortex pulling everything into the center, dramatic '
    'apocalyptic-beautiful cinematic, trippy psychedelic storm energy '
    'NOT scary NOT horror just sublime overwhelming cosmic'
)


def make_prompt(subject: str, depth_directive: str) -> str:
    """[ANTI-CHARACTERS] [SUBJECT] [DEPTH-DIRECTIVE] [STYLE] [PALETTE]."""
    return (
        f'{ANTI_CHARACTERS}. {subject}. {depth_directive}. '
        f'{STYLE_STEM_BG}. {PALETTE_BG}'
    )


DEPTH_DIRECTIVE = (
    'masterful atmospheric perspective with at least four distinct depth '
    'layers reading clearly: distant haze layer, mid-distance softened '
    'layer, mid-foreground crisp layer, near-frame extra-crisp ink-detailed '
    'layer; each layer separated by atmospheric haze and tonal shift; the '
    'composition leaves negative space in the center for game-action'
)


JOBS = [
    {
        'key': 'slow-bloom',
        'subject': SLOW_BLOOM,
        'orientation': 'landscape',
    },
    {
        'key': 'inkpool',
        'subject': INKPOOL,
        'orientation': 'landscape',
    },
    {
        'key': 'cathedral',
        'subject': CATHEDRAL,
        'orientation': 'landscape',
    },
    {
        'key': 'boss',
        'subject': BOSS,
        'orientation': 'landscape',
    },
]


def submit_job(job: dict) -> dict:
    """Returns {key, request_id, response_url, prompt, model}."""
    prompt = make_prompt(job['subject'], DEPTH_DIRECTIVE)
    aspect = '16:9' if job['orientation'] == 'landscape' else '9:16'
    body = {
        'prompt': prompt,
        'aspect_ratio': aspect,
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    # Try Flux Pro v1.1 Ultra first
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body)
        model = 'fal-ai/flux-pro/v1.1-ultra'
    except Exception as e:
        print(f'[INFO] {job["key"]}: ultra unavailable -> v1.1 ({e})')
        # Fallback to v1.1 with explicit width/height
        body2 = {
            'prompt': prompt,
            'image_size': {'width': 2048, 'height': 1152} if aspect == '16:9' else {'width': 1152, 'height': 2048},
            'num_images': 1,
        }
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body2)
        model = 'fal-ai/flux-pro/v1.1'

    print(f'[SUBMIT] biome-{job["key"]} -> {req_id[:12]}... ({model})')
    return {
        'key': job['key'],
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': model,
    }


def collect_job(job_state: dict) -> Path | None:
    key = job_state['key']
    payload = poll_until_done(job_state['response_url'], f'biome-{key}', max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p2_biomes.jsonl', {**job_state, 'failed': True})
        print(f'[FAIL] biome-{key}: no url')
        return None

    raw_target = RAW_DIR / f'biome-{key}-raw.png'
    bytes_n = http_download(url, raw_target)
    print(f'[DOWNLOAD] biome-{key}: {bytes_n} bytes')

    final = BG_OUT_DIR / f'biome-{key}-4k.png'
    final.write_bytes(raw_target.read_bytes())

    log_attempt('p2_biomes.jsonl', {
        'key': key, 'request_id': job_state['request_id'],
        'url': url, 'bytes': bytes_n,
        'model': job_state['model'],
        'prompt_len': len(job_state['prompt']),
        'final': str(final),
    })
    print(f'[FINAL] {final} = {final.stat().st_size} bytes')
    return final


def main():
    print(f'[PHASE 2] Submitting {len(JOBS)} biome backgrounds in parallel...')

    # Parallel submit
    submitted = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for state in ex.map(submit_job, JOBS):
            submitted.append(state)

    # Parallel collect
    print(f'[PHASE 2] Polling {len(submitted)} jobs...')
    results = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for path in ex.map(collect_job, submitted):
            results.append(path)

    success = sum(1 for r in results if r is not None)
    print(f'[PHASE 2 DONE] {success}/{len(JOBS)} biomes generated')
    return 0 if success == len(JOBS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
