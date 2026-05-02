"""
Sprint 13D — Phase 4: 6 hallucination-overlay particle textures.

Goal: Abstract particle textures for TrippyEventDirector overlays.
Flux Dev (fast, particle-quality OK).

6 types: kaleido-petal, fluid-blob, sparkle-burst, ink-droplet,
light-flare, cosmic-dust.

512×512 — small textures, BiRefNet'd transparent (subject-isolation use case).

Output: public/assets/particles/particle-{1..6}.png
"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

OUT_DIR = ROOT / 'public/assets/particles'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'
OUT_DIR.mkdir(parents=True, exist_ok=True)


PARTICLE_RIDER = (
    'macro close-up isolated single particle texture centered on plain '
    'neutral white card background, NO scene NO landscape, just one '
    'particle filling 60 percent of frame, sharp focus, NOT blurry'
)

PARTICLE_STYLE = (
    'hand-painted watercolor with ink linework, paper-grain, soft '
    'translucent layered washes, ink-aubergine ragged accent outline, '
    'Studio Ghibli x Moebius x Tenniel illustration, NOT digital NOT 3D '
    'NOT vector NOT smartart NOT cgi'
)

PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep with optional pop-magenta or pop-cyan accent'
)

VARIANTS = [
    {
        'key': 1, 'name': 'kaleido-petal',
        'desc': (
            'a single curved kaleidoscopic flower petal shape with '
            'symmetric watercolor patterning in faded-rose pink and '
            'saffron-glow gold, soft inner glow, organic curved silhouette'
        ),
    },
    {
        'key': 2, 'name': 'fluid-blob',
        'desc': (
            'a single fluid amorphous blob shape liquid-like flowing form '
            'in moss-sage green with sky-wash-blue underglow, internal '
            'swirl visible, soft watercolor edges, organic biological feel'
        ),
    },
    {
        'key': 3, 'name': 'sparkle-burst',
        'desc': (
            'a single radiating sparkle-burst star-shape with eight '
            'asymmetric watercolor rays in saffron-glow gold and pop-magenta '
            'tips, ink-aubergine outline, soft halo bloom around the core'
        ),
    },
    {
        'key': 4, 'name': 'ink-droplet',
        'desc': (
            'a single dripping ink droplet shape in deep ink-aubergine '
            'purple-black with faded-rose pink translucent core showing '
            'through, painterly bleed at the edges, soft Tenniel woodcut '
            'feel'
        ),
    },
    {
        'key': 5, 'name': 'light-flare',
        'desc': (
            'a single soft lens-flare light-bloom shape radiating warm '
            'saffron-glow gold and faded-rose pink rays, soft watercolor '
            'halo, hexagonal soft bokeh hint, painterly NOT photograph'
        ),
    },
    {
        'key': 6, 'name': 'cosmic-dust',
        'desc': (
            'a single cluster of fine cosmic-dust particles scattered '
            'organically in a soft cloud, mushroom-cream pale grains with '
            'sky-wash-blue sparkles and faded-rose pink hints, soft '
            'watercolor stippling, ethereal'
        ),
    },
]


def make_prompt(v: dict) -> str:
    return (
        f'{PARTICLE_RIDER}. a single hand-painted particle texture: '
        f'{v["desc"]}. {PARTICLE_STYLE}, {PALETTE}'
    )


def submit_particle(v: dict) -> dict:
    prompt = make_prompt(v)
    body = {
        'prompt': prompt,
        'image_size': {'width': 1024, 'height': 1024},  # generate 1024 to feed BiRefNet, downsample at use site
        'num_images': 1,
    }
    req_id, resp_url = submit('fal-ai/flux/dev', body)
    print(f'[SUBMIT] particle-{v["key"]}-{v["name"]} -> {req_id[:12]}')
    return {
        'variant': v,
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
    }


def remove_bg(src: Path, label: str) -> Path | None:
    try:
        image_url = upload_local_image(src)
        req_id, resp_url = submit('fal-ai/birefnet', {'image_url': image_url})
    except Exception as e:
        print(f'[birefnet submit fail] {label}: {e}')
        return None
    payload = poll_until_done(resp_url, f'birefnet-{label}', max_polls=120)
    if not payload:
        return None
    out_url = None
    if 'image' in payload:
        img = payload['image']
        out_url = img.get('url') if isinstance(img, dict) else img
    elif 'images' in payload and payload['images']:
        first = payload['images'][0]
        out_url = first.get('url') if isinstance(first, dict) else first
    if not out_url:
        return None
    target = RAW_DIR / f'{label}-birefnet.png'
    http_download(out_url, target)
    return target


def collect_particle(state: dict) -> Path | None:
    v = state['variant']
    payload = poll_until_done(state['response_url'], f'particle-{v["key"]}', max_polls=180)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p4_particles.jsonl', {**state, 'failed': True})
        return None

    raw_target = RAW_DIR / f'particle-{v["key"]}-{v["name"]}-raw.png'
    n = http_download(url, raw_target)

    cleaned = remove_bg(raw_target, f'particle-{v["key"]}')
    final = OUT_DIR / f'particle-{v["key"]}.png'
    if cleaned and cleaned.stat().st_size > 15_000:
        final.write_bytes(cleaned.read_bytes())
        used = 'birefnet'
    else:
        final.write_bytes(raw_target.read_bytes())
        used = 'raw'

    log_attempt('p4_particles.jsonl', {
        'key': v['key'], 'name': v['name'],
        'request_id': state['request_id'], 'url': url,
        'final_bytes': final.stat().st_size, 'used': used,
    })
    print(f'[FINAL] particle-{v["key"]} ({used}): {final.stat().st_size} bytes')
    return final


def main():
    print(f'[PHASE 4] Submitting {len(VARIANTS)} particle jobs...')
    submitted = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for state in ex.map(submit_particle, VARIANTS):
            submitted.append(state)

    results = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for path in ex.map(collect_particle, submitted):
            results.append(path)

    success = sum(1 for r in results if r is not None)
    print(f'[PHASE 4 DONE] {success}/{len(VARIANTS)} particles generated')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
