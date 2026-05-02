"""
Sprint 13D — Phase 3: 8 cosmic-bubble tap-target variants.

Goal: Glowing bubble-orbs, each unique color but same DNA. NOT flat. Soft
inner-glow, subtle internal swirl, painted-watercolor rim, no PowerPoint
smartart vibes.

Pipeline:
  - Flux Pro v1.1 (~$0.05 each) for paint-finish + texture detail
  - 1024×1024 (BiRefNet'd transparent)
  - 8 variants: faded-rose / saffron-glow / pop-magenta / pop-cyan /
    moss-sage / mushroom-cream / sky-wash / ink-aubergine

Output: public/assets/bubbles/bubble-{1..8}.png (transparent PNG)
"""
from __future__ import annotations
import json, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

OUT_DIR = ROOT / 'public/assets/bubbles'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)


# Bubble subject = single hovering orb on plain neutral grey paper card BG.
# Use rider-FRONT to prevent scene/landscape drift on square aspect.
BUBBLE_RIDER_FRONT = (
    'macro close-up isolated single floating glowing bubble-orb centered in '
    'frame, plain neutral grey paper card background, NO scene NO landscape '
    'NO horizon NO other objects, just ONE bubble filling 70 percent of '
    'frame, sharp focus crisp ink rim outlines, NOT blurry'
)

BUBBLE_STYLE = (
    'hand-painted watercolor with ink underdrawing, paper-grain texture, '
    'soft luminous inner-glow radiating outward from the core, subtle '
    'internal liquid swirl flowing inside the sphere, soft halo bloom '
    'around the rim, faint cosmic spark dots floating around the edges, '
    'translucent watercolor wash showing layers of color depth, ink-aubergine '
    'ragged outline at the silhouette edge, Studio Ghibli x Moebius x '
    'Tenniel illustration, NOT digital NOT 3D NOT photoreal NOT smartart '
    'NOT vector NOT cgi'
)

# 8 unique color stories — each pulls from locked palette + 2 pop accents.
VARIANTS = [
    {
        'key': 1, 'name': 'faded-rose',
        'desc': (
            'soft FADED-ROSE pink core glowing warmly, internal swirl in '
            'mushroom-cream pale streak, rim halo in faded-rose with '
            'saffron-glow underlight'
        ),
    },
    {
        'key': 2, 'name': 'saffron-glow',
        'desc': (
            'warm SAFFRON-GLOW orange core radiating gold light, internal '
            'swirl in mushroom-cream and faded-rose streaks, rim halo in '
            'saffron-amber with paper-grain visible'
        ),
    },
    {
        'key': 3, 'name': 'pop-magenta',
        'desc': (
            'vivid POP-MAGENTA hot-pink core pulsing with electric energy, '
            'internal swirl in faded-rose and ink-aubergine streaks, rim '
            'halo in magenta with sky-wash-blue cool underglow'
        ),
    },
    {
        'key': 4, 'name': 'pop-cyan',
        'desc': (
            'crisp POP-CYAN aqua-blue core glowing with cool electric '
            'energy, internal swirl in sky-wash-blue and mushroom-cream '
            'streaks, rim halo in cyan with faint saffron-glow accent'
        ),
    },
    {
        'key': 5, 'name': 'moss-sage',
        'desc': (
            'gentle MOSS-SAGE green core glowing with forest-deep depth, '
            'internal swirl in forest-deep emerald and mushroom-cream '
            'streaks, rim halo in moss-sage with saffron-glow warm undertone'
        ),
    },
    {
        'key': 6, 'name': 'mushroom-cream',
        'desc': (
            'soft MUSHROOM-CREAM pale-cream core glowing with milky '
            'translucence, internal swirl in faded-rose and saffron-glow '
            'streaks, rim halo in cream with ink-aubergine outline crispness'
        ),
    },
    {
        'key': 7, 'name': 'sky-wash',
        'desc': (
            'cool SKY-WASH-BLUE core glowing with watercolor-sky '
            'translucence, internal swirl in mushroom-cream and faded-rose '
            'streaks, rim halo in sky-wash-blue with saffron-glow warm '
            'crescent catch-light'
        ),
    },
    {
        'key': 8, 'name': 'ink-aubergine',
        'desc': (
            'deep INK-AUBERGINE purple-black core with bioluminescent '
            'glow, internal swirl in faded-rose and saffron-glow streaks '
            'lighting up from within, rim halo in ink-aubergine with '
            'pop-magenta crescent accent'
        ),
    },
]


def make_prompt(variant: dict) -> str:
    subject = (
        f'a single floating cosmic bubble-orb sphere with {variant["desc"]}, '
        'painterly translucent watercolor sphere ~70 percent of square frame'
    )
    return f'{BUBBLE_RIDER_FRONT}. {subject}. {BUBBLE_STYLE}'


def submit_bubble(variant: dict) -> dict:
    prompt = make_prompt(variant)
    body = {
        'prompt': prompt,
        'image_size': {'width': 1024, 'height': 1024},
        'num_images': 1,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body)
        model = 'fal-ai/flux-pro/v1.1'
    except Exception as e:
        print(f'[INFO] flux pro 1.1 fail for bubble-{variant["key"]}: {e}; using flux dev')
        req_id, resp_url = submit('fal-ai/flux/dev', body)
        model = 'fal-ai/flux/dev'
    print(f'[SUBMIT] bubble-{variant["key"]}-{variant["name"]} -> {req_id[:12]} ({model})')
    return {
        'variant': variant,
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': model,
    }


def collect_bubble(state: dict) -> Path | None:
    v = state['variant']
    payload = poll_until_done(state['response_url'], f'bubble-{v["key"]}', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p3_bubbles.jsonl', {**state, 'failed': True})
        return None

    raw_target = RAW_DIR / f'bubble-{v["key"]}-{v["name"]}-raw.png'
    n = http_download(url, raw_target)
    print(f'[DOWNLOAD] bubble-{v["key"]}: {n} bytes')

    # BiRefNet to remove paper-card BG
    cleaned = remove_bg(raw_target, f'bubble-{v["key"]}')
    final = OUT_DIR / f'bubble-{v["key"]}.png'
    if cleaned and cleaned.stat().st_size > 30_000:
        final.write_bytes(cleaned.read_bytes())
        used = 'birefnet'
    else:
        # Fallback to raw if BiRefNet stripped too much
        final.write_bytes(raw_target.read_bytes())
        used = 'raw'

    log_attempt('p3_bubbles.jsonl', {
        'key': v['key'], 'name': v['name'],
        'request_id': state['request_id'],
        'url': url, 'bytes': n,
        'model': state['model'],
        'final': str(final), 'final_bytes': final.stat().st_size,
        'used': used,
    })
    print(f'[FINAL] bubble-{v["key"]} ({used}): {final.stat().st_size} bytes')
    return final


def remove_bg(src: Path, label: str) -> Path | None:
    try:
        image_url = upload_local_image(src)
        req_id, resp_url = submit('fal-ai/birefnet', {'image_url': image_url})
    except Exception as e:
        print(f'[birefnet fail] {label}: {e}')
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


def main():
    print(f'[PHASE 3] Submitting {len(VARIANTS)} bubble jobs...')
    submitted = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for state in ex.map(submit_bubble, VARIANTS):
            submitted.append(state)

    print(f'[PHASE 3] Collecting...')
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for path in ex.map(collect_bubble, submitted):
            results.append(path)

    success = sum(1 for r in results if r is not None)
    print(f'[PHASE 3 DONE] {success}/{len(VARIANTS)} bubbles generated')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
