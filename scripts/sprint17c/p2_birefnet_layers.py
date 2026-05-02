"""Sprint 17C — Phase 2: BiRefNet HEAVY remove-bg on transparent-target layers.

For each biome, layers 2-5 (and layer 7 for slow-bloom creature) need their
jet-black void background stripped to alpha so they can be composited as
parallax planes.

Per asset_learnings.md Sprint 16A: BiRefNet HEAVY @ 2048² is more accurate
than standard light @ 1024² — recommended for any layer with watercolor
soft-edges that the light model trims aggressively.

Outputs:
  public/assets/backgrounds/biome-{id}/layer-{N}_{name}.png  (RGBA, transparent)
  scripts/sprint17c/raw/biome-{id}/layer-{N}_{name}-mask.png  (debug)

Sky-gradients (layer 1) and particle-overlays (layer 6) skip BiRefNet:
they are full-bleed and stay opaque jet-black for additive blend.
"""
from __future__ import annotations
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, RAW_DIR, submit, poll_until_done, extract_image_url,
    http_download, log_attempt, upload_to_fal_storage,
)


PUB_BG_DIR = ROOT / 'public/assets/backgrounds'
SPEC_FILE = ROOT / 'scripts/sprint17c/_logs/biome_spec.json'


def load_biome_spec() -> list[dict]:
    return json.loads(SPEC_FILE.read_text())


def needs_birefnet(layer: dict) -> bool:
    return layer['isolation'] == 'transparent-target'


def submit_birefnet(biome_id: str, layer: dict) -> dict | None:
    raw = RAW_DIR / f'biome-{biome_id}' / f'layer-{layer["idx"]}_{layer["name"]}-raw.png'
    if not raw.exists():
        print(f'[SKIP] missing raw {raw}')
        return None
    # Upload raw to fal storage (file too big for data URI reliability)
    try:
        hosted = upload_to_fal_storage(raw)
    except Exception as e:
        print(f'[FAIL upload] {biome_id}/{layer["name"]}: {e}')
        return None

    body = {
        'image_url': hosted,
        'model': 'General Use (Heavy)',
        'operating_resolution': '2048x2048',
        'refine_foreground': True,
        'output_format': 'png',
        'output_mask': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/birefnet', body)
    except Exception as e:
        print(f'[FAIL submit] {biome_id}/{layer["name"]}: {e}')
        return None

    print(f'[SUBMIT BiRefNet] {biome_id}/{layer["name"]} -> {req_id[:12]}...')
    return {
        'biome_id': biome_id,
        'layer_idx': layer['idx'],
        'layer_name': layer['name'],
        'request_id': req_id,
        'response_url': resp_url,
        'raw_path': str(raw),
    }


def collect_birefnet(state: dict) -> dict | None:
    if state is None:
        return None
    label = f'{state["biome_id"]}/{state["layer_name"]} (birefnet)'
    payload = poll_until_done(state['response_url'], label, max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p2_birefnet.jsonl', {**state, 'failed': True})
        return None

    out_dir = PUB_BG_DIR / f'biome-{state["biome_id"]}'
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f'layer-{state["layer_idx"]}_{state["layer_name"]}.png'
    bytes_n = http_download(url, target)
    print(f'[DOWNLOAD BiRefNet] {label}: {bytes_n} bytes -> {target}')
    log_attempt('p2_birefnet.jsonl', {**state, 'url': url, 'bytes': bytes_n, 'final': str(target)})
    return {**state, 'final': str(target), 'bytes': bytes_n}


def main() -> int:
    biomes = load_biome_spec()
    jobs = []
    for biome in biomes:
        for layer in biome['layers']:
            if needs_birefnet(layer):
                jobs.append((biome['id'], layer))
    print(f'[PHASE 2] Submitting BiRefNet for {len(jobs)} transparent-target layers...')

    submitted = []
    with ThreadPoolExecutor(max_workers=4) as ex:  # fewer workers — uploads are heavy
        for s in ex.map(lambda args: submit_birefnet(*args), jobs):
            submitted.append(s)

    print(f'[PHASE 2] Polling BiRefNet jobs...')
    collected = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(collect_birefnet, submitted):
            collected.append(r)

    success = sum(1 for r in collected if r is not None)
    print(f'[PHASE 2 DONE] {success}/{len(jobs)} layers BiRefNet-cleaned')
    return 0 if success == len(jobs) else 1


if __name__ == '__main__':
    raise SystemExit(main())
