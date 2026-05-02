"""
Sprint 16A — Phase 3: Generate Cosmo hero with the trained LoRA.

Uses fal-ai/flux-lora endpoint with our trained LoRA weights URL.

Strategy:
- Generate 6 attempts at 2048×2048 (more candidates → higher chance of
  9/10 DNA criteria pass)
- Vary seed and minor prompt-rider for diversity
- All use trigger_word `rtcosmo` + double anti-kawaii anti-Disney stack
- Save all attempts + manifest for case study
- Final pick is selected in p4 after manual / heuristic review
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    ROOT, LOG_DIR,
    submit, poll_until_done, log_attempt, http_download, extract_image_url,
)

ATTEMPTS_DIR = ROOT / 'public/assets/case-study/cosmo-lora-v16a/attempts'
ATTEMPTS_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_RESULT = LOG_DIR / 'training_result.json'

# Base prompt — every attempt shares the trigger + anti-kawaii double-stack +
# DNA descriptors. Per-attempt rider varies the pose subtly so we have
# selection options.
BASE_PROMPT = (
    'rtcosmo, standing pose facing camera, hayao moebius watercolor, '
    'NOT kawaii NOT chibi NOT Disney NOT pixar NOT cute, '
    'chameleon bulging eye spheres glossy black with saffron catchlight, '
    'single antenna with faded rose flower bulb tip on top of pearl-drop head, '
    'two black flat suction cup discs at hand tips, '
    'faded rose spots on green moss-sage watercolor body with paper grain, '
    'NO TAIL, slim slightly elongated kid-frame proportions, '
    'small painted feet, slight overbite mouth, slightly uncute proportions, '
    'painterly ink underdrawing with ragged outline, '
    'Studio Ghibli x Moebius x Tenniel illustration style, '
    'soft peach-pink moon halo backdrop'
)

ATTEMPT_RIDERS = [
    ('a01', 'standing front-facing pose centered', 7777),
    ('a02', 'three-quarter view standing pose', 4242),
    ('a03', 'standing pose with arms slightly out showing suction discs', 8181),
    ('a04', 'side profile standing pose suction cups visible', 1234),
    ('a05', 'standing pose camera-facing portrait full body', 5555),
    ('a06', 'three-quarter view standing pose with subtle motion blur', 9999),
]

ENDPOINT = 'fal-ai/flux-lora'


def main() -> int:
    if not TRAIN_RESULT.exists():
        print(f'[FAIL] missing training result: {TRAIN_RESULT}')
        return 2
    train = json.loads(TRAIN_RESULT.read_text())
    lora_url = train.get('lora_url')
    if not lora_url:
        print('[FAIL] no lora_url in training_result.json')
        return 3

    print(f'[Sprint 16A/p3] LoRA: {lora_url}')
    print(f'[p3] generating {len(ATTEMPT_RIDERS)} hero attempts at 2048²')

    manifest_entries = []
    for label, rider, seed in ATTEMPT_RIDERS:
        prompt = BASE_PROMPT.replace('standing pose facing camera', rider)
        body = {
            'prompt': prompt,
            'image_size': {'width': 2048, 'height': 2048},
            'num_inference_steps': 32,
            'guidance_scale': 4.0,
            'num_images': 1,
            'enable_safety_checker': False,
            'output_format': 'png',
            'seed': seed,
            'loras': [
                {'path': lora_url, 'scale': 1.0},
            ],
        }
        log_attempt('hero_attempts.jsonl', {'label': label, 'body_summary': {
            'seed': seed, 'rider': rider, 'image_size': '2048x2048',
        }})
        print(f'[{label}] submitting (seed={seed})...')
        try:
            req_id, response_url = submit(ENDPOINT, body)
        except Exception as e:
            print(f'  [FAIL] submit {label}: {e}')
            continue
        payload = poll_until_done(response_url, label=f'hero-{label}', max_polls=240, sleep_s=2.0)
        url = extract_image_url(payload)
        if not url:
            print(f'  [FAIL] no image url for {label}')
            continue
        target = ATTEMPTS_DIR / f'{label}.png'
        n_bytes = http_download(url, target)
        size_kb = n_bytes // 1024
        print(f'  [OK] {label}: {size_kb}KB → {target.name}')
        manifest_entries.append({
            'label': label, 'seed': seed, 'rider': rider,
            'request_id': req_id, 'src_url': url, 'file': str(target.relative_to(ROOT)),
            'bytes': n_bytes,
        })

    manifest = {
        'sprint': '16A',
        'phase': 'p3_generate_hero',
        'lora_url': lora_url,
        'endpoint': ENDPOINT,
        'image_size': '2048x2048',
        'base_prompt': BASE_PROMPT,
        'attempts': manifest_entries,
    }
    manifest_path = ROOT / 'public/assets/case-study/cosmo-lora-v16a/hero_attempts_manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'[manifest] {manifest_path}')
    print(f'[DONE] {len(manifest_entries)}/{len(ATTEMPT_RIDERS)} attempts saved to {ATTEMPTS_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
