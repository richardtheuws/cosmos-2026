"""Sprint 17C — Phase 1B: Regenerate weak first-pass layers.

After visual review of p1 outputs, regenerate any layer that fell to the
"scene-magnet" Flux bias or otherwise missed the mark. Each entry below
is a manual override prompt + which raw file to replace.

Targets identified after visual review:
  - inkpool/sky-gradient: Flux rendered an OUTDOOR sunset cumulus scene
    despite "deep underground cave-roof" prompt. Scene-magnet bias.
"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, RAW_DIR, submit, poll_until_done, extract_image_url,
    http_download, log_attempt,
)


# Stronger anti-outdoor stack for cave-roof
INKPOOL_SKY_V2 = (
    'NO sky NO outdoor NO sunset NO sunrise NO horizon NO clouds NO mountains '
    'NO landscape NO open-air NO atmosphere, NO characters NO figures, '
    'NO digital NO 3D-render NO photoreal NO pixel-art NO cartoon. '
    'A close-up underground cave-roof texture viewed from below, looking '
    'directly up at a deep ink-aubergine cave-ceiling with hanging mineral '
    'crystal-clusters glowing in soft cyan-teal and faded-rose pink, the '
    'cave-roof is solid stone with rough textured surface, NO sky visible '
    'just stone-ceiling filling the entire frame top to bottom, scattered '
    'tiny stalactite-tips with bioluminescent crystal points dotting the '
    'rough rock surface, dramatic upward-looking perspective showing only '
    'the cave-ceiling and nothing else, hand-painted watercolor on dark '
    'ink-aubergine purple-black stone, paper-grain texture, Studio Ghibli '
    'x Moebius cave-interior style, oneiric weirdo NOT generic, '
    'palette mushroom-cream moss-sage faded-rose ink-aubergine '
    'saffron-glow forest-deep with cyan-teal accents, locked palette'
)


JOBS_V2 = [
    {
        'biome_id': 'inkpool',
        'layer_idx': 1,
        'layer_name': 'sky-gradient',
        'role': 'sky',
        'parallax': 0.05,
        'scale': 1.10,
        'isolation': 'fullbleed',
        'prompt': INKPOOL_SKY_V2,
    },
]


def submit_layer_v2(state: dict) -> dict:
    body_ultra = {
        'prompt': state['prompt'],
        'aspect_ratio': '2:3',
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body_ultra)
        model = 'fal-ai/flux-pro/v1.1-ultra'
    except Exception as e:
        body_v11 = {
            'prompt': state['prompt'],
            'image_size': {'width': 1024, 'height': 1536},
            'num_images': 1,
        }
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body_v11)
        model = 'fal-ai/flux-pro/v1.1'
    print(f'[SUBMIT-V2] {state["biome_id"]}/{state["layer_name"]} -> {req_id[:12]}... ({model})')
    return {**state, 'request_id': req_id, 'response_url': resp_url, 'model': model, 'attempt': 2}


def collect_layer_v2(state: dict) -> dict | None:
    label = f'{state["biome_id"]}/{state["layer_name"]} v2'
    payload = poll_until_done(state['response_url'], label, max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p1b_regen.jsonl', {**state, 'failed': True})
        return None
    out_dir = RAW_DIR / f'biome-{state["biome_id"]}'
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f'layer-{state["layer_idx"]}_{state["layer_name"]}-raw.png'
    bytes_n = http_download(url, target)
    print(f'[DOWNLOAD-V2] {label}: {bytes_n} bytes -> {target.name}')
    log_attempt('p1b_regen.jsonl', {**state, 'url': url, 'bytes': bytes_n, 'final': str(target)})
    return {**state, 'raw_path': str(target), 'bytes': bytes_n}


def main() -> int:
    print(f'[PHASE 1B] Regenerating {len(JOBS_V2)} weak layer(s)...')
    submitted = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for s in ex.map(submit_layer_v2, JOBS_V2):
            submitted.append(s)
    collected = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for r in ex.map(collect_layer_v2, submitted):
            collected.append(r)
    success = sum(1 for r in collected if r is not None)
    print(f'[PHASE 1B DONE] {success}/{len(JOBS_V2)} regen successful')
    return 0 if success == len(JOBS_V2) else 1


if __name__ == '__main__':
    raise SystemExit(main())
