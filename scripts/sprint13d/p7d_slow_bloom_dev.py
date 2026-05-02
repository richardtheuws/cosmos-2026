"""
Sprint 13D — Phase 7d: Final slow-bloom regen via Flux Dev with extreme
anti-character emphasis.

Cathedral was successful on Flux Dev (paint-style emerged). Apply same
principle here. Plus: prompt structured so the foreground is filled with
giant FOREGROUND mushrooms (occupies path-center where wanderer sample
keeps appearing).
"""
from __future__ import annotations
from pathlib import Path
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt,
)


SLOW_BLOOM_DEV = (
    'masterful traditional WATERCOLOR PAINTING of an alien mushroom forest '
    'EMPTY landscape at golden dawn, A SINGLE GIANT MUSHROOM TREE FILLS '
    'THE FOREGROUND CENTER OF THE FRAME completely blocking the path, '
    'around it dozens of medium phosphorescent mushroom-trees stretching '
    'into atmospheric haze, foreground filled with HUGE silhouetted '
    'mushroom-tree caps and stems, mid-ground softly glowing mushroom '
    'canopy in saffron-orange and faded-rose pink, far hazy mountain '
    'ridges of more mushroom forest fading to atmospheric perspective, '
    'floating cosmic spore-particles drifting through warm shafts of '
    'light, mushroom-cream pale ground BLOCKED by foreground mushroom '
    'occupying the central composition, '
    'paper-grain texture across the whole sky, ink-line outlines on '
    'foreground mushroom edges, soft watercolor wash bleeds, Studio '
    'Ghibli x Moebius x Tenniel illustration style, hand-painted on '
    'textured rough paper, NOT photograph NOT photoreal NOT realistic, '
    'NOT digital NOT 3D NOT cgi, '
    'palette mushroom-cream moss-sage faded-rose ink-aubergine saffron-glow '
    'forest-deep, NO LIVING CREATURES anywhere in this empty landscape, '
    'NO characters NO figures NO silhouettes NO travelers NO wanderers '
    'NO people NO humans NO shadowy-figures NO person-shaped-shapes '
    'NO body-silhouettes NO standing-figures NO animals NO creatures'
)


def main():
    body = {
        'prompt': SLOW_BLOOM_DEV,
        'image_size': {'width': 2048, 'height': 1152},
        'num_images': 1,
    }
    print('[SUBMIT] slow-bloom-dev-final')
    req_id, resp_url = submit('fal-ai/flux/dev', body)
    print(f'  request_id: {req_id}')

    payload = poll_until_done(resp_url, 'slow-bloom-dev-final', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        print('[FAIL] no url')
        return 1

    target = ROOT / 'public/assets/backgrounds/biome-slow-bloom-4k.png'
    n = http_download(url, target)
    print(f'[FINAL] biome-slow-bloom-4k: {n} bytes')
    log_attempt('p7_fixes.jsonl', {
        'kind': 'slow_bloom_dev_final', 'request_id': req_id,
        'url': url, 'final_bytes': target.stat().st_size,
        'model': 'fal-ai/flux/dev',
    })
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
