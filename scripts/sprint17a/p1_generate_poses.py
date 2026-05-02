"""
Sprint 17A — Track A: generate 4 LoRA-rendered poses for "moments".

Per pose: 4 attempts in parallel, save raw PNGs to attempts/<pose>_aNN.png.
Selection (best DNA + recognizable in 120px) is done in p2_select_poses.py.

Poses (Sprint 17A spec):
- idle-breath  (canonical pose, breath-pulse compatible)
- wave-uncanny (one disc-arm raised, eyes locked toward camera)
- stretch      (arms-up, looking up, body slightly arched)
- sit-sniff    (squatting, leaning forward toward small mushroom)
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    LOG_DIR, ATTEMPTS_DIR, LORA_URL, TRIGGER, DNA_TAIL,
    fal_submit, fal_poll, http_download,
)

ATTEMPTS_DIR.mkdir(parents=True, exist_ok=True)

POSES = {
    'idle-breath': (
        'standing front-facing canonical pose, arms relaxed at sides, '
        'eyes calmly looking forward, body upright neutral, slight breath pulse, '
        'three-quarter view slightly toward camera'
    ),
    'wave-uncanny': (
        'one disc-arm raised waving toward camera, the other arm relaxed at side, '
        'eyes locked directly toward viewer with intense uncanny stare, '
        'body upright facing viewer slightly tilted'
    ),
    'stretch': (
        'both arms raised up overhead arching back and stretching, '
        'looking up at sky with open eye-spheres, body slightly arched backward, '
        'antenna trailing back, full upright stretching pose'
    ),
    'sit-sniff': (
        'squatting low to ground leaning forward sniffing a small mushroom in front, '
        'one disc-hand reaching down toward the tiny mushroom, '
        'eyes focused down on the mushroom, antenna leaning forward, '
        'low crouch posture knees bent'
    ),
}

ATTEMPTS_PER_POSE = 4
SEEDS = [8181, 8888, 4242, 1313]  # diversity but reproducible


def submit_attempt(pose_key: str, pose_desc: str, seed: int):
    prompt = f'{TRIGGER}, {pose_desc}, {DNA_TAIL}'
    body = {
        'prompt': prompt,
        'image_size': {'width': 1536, 'height': 1536},
        'num_inference_steps': 32,
        'guidance_scale': 4.0,
        'loras': [{'path': LORA_URL, 'scale': 1.0}],
        'seed': seed,
        'enable_safety_checker': False,
    }
    rid, rurl = fal_submit('fal-ai/flux-lora', body)
    return {'pose': pose_key, 'seed': seed, 'request_id': rid, 'response_url': rurl, 'prompt': prompt}


def main():
    print('Sprint 17A — Track A — submitting all pose-attempts in parallel')
    pending = []
    for pose_key, desc in POSES.items():
        for i, seed in enumerate(SEEDS):
            tag = f'{pose_key}_a{i+1:02d}'
            print(f'  submit {tag} seed={seed}')
            try:
                meta = submit_attempt(pose_key, desc, seed)
                meta['tag'] = tag
                pending.append(meta)
            except Exception as e:
                print(f'  FAIL submit {tag}: {e}')
            time.sleep(0.4)  # gentle rate-limit

    (LOG_DIR / 'p1_pending.json').write_text(json.dumps(pending, indent=2))
    print(f'\n{len(pending)} jobs submitted, polling...\n')

    results = []
    for meta in pending:
        tag = meta['tag']
        payload = fal_poll(meta['response_url'], tag, max_polls=120, sleep_s=3.0)
        if not payload:
            results.append({**meta, 'ok': False})
            continue
        url = None
        if 'images' in payload and payload['images']:
            url = payload['images'][0].get('url')
        if not url:
            results.append({**meta, 'ok': False, 'error': 'no image url'})
            continue
        target = ATTEMPTS_DIR / f'{tag}.png'
        size = http_download(url, target)
        print(f'  saved {target.name} ({size//1024} KB)')
        results.append({**meta, 'ok': True, 'image_url': url, 'file': str(target)})

    (LOG_DIR / 'p1_results.json').write_text(json.dumps(results, indent=2))
    ok = sum(1 for r in results if r.get('ok'))
    print(f'\nDONE — {ok}/{len(results)} attempts succeeded')


if __name__ == '__main__':
    main()
