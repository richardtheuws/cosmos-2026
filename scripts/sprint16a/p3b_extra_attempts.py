"""
Sprint 16A — Phase 3b: Extra LoRA hero attempts.

a01-a06 evaluation:
  - a03 has THE money-shot: two clear black floating suction discs + chameleon
    eyes. Has tail (alpha-erase fixable).
  - a01/a04 have pearl head + bulging eyes but claws+tail.
  - a02/a05 drift towards kawaii (lashes/eyebrows).
  - a06 lost the discs.

Goal: get a candidate that matches a03's disc-rendering quality but has
NO TAIL in source (cheaper than alpha-erase). Try harder anti-tail prompt
plus higher LoRA scale variations.

Also: try with `cling pose` and `walking pose` to validate LoRA pose-flexibility
(Sprint 11A architectural-blocker resolution test).
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
TRAIN_RESULT = LOG_DIR / 'training_result.json'

# Hardened anti-tail prompt + duplicate disc-emphasis (a03 had it organically;
# we want to lock it in).
HARDENED_PROMPT = (
    'rtcosmo, {pose}, hayao moebius watercolor, '
    'NOT kawaii NOT chibi NOT Disney NOT pixar NOT cute NOT lashes NOT eyebrows, '
    'absolutely no tail no lizard tail no curly tail back is smooth no rear appendage, '
    'chameleon bulging eye spheres glossy black with saffron catchlight, '
    'single antenna with faded rose flower bulb tip on top of pearl-drop head, '
    'two black flat suction cup discs at hand tips like wet rubber gloves, '
    'circular disc pads at wrists not fingers not claws, '
    'faded rose spots on green moss-sage watercolor body with paper grain, '
    'slim slightly elongated kid-frame proportions, '
    'small painted feet, slight overbite mouth, '
    'painterly ink underdrawing with ragged outline, '
    'Studio Ghibli x Moebius x Tenniel illustration style, '
    'soft peach-pink moon halo backdrop'
)

EXTRAS = [
    ('a07', 'standing pose facing camera', 8181, 1.0),
    ('a08', 'standing pose facing camera', 3030, 1.05),
    ('a09', 'standing pose with arms slightly out showing both circular suction cup discs', 8888, 1.0),
    ('a10', 'standing pose three-quarter view full body', 6666, 0.95),
]


def main() -> int:
    train = json.loads(TRAIN_RESULT.read_text())
    lora_url = train['lora_url']
    print(f'[Sprint 16A/p3b] LoRA: {lora_url}')

    manifest_entries = []
    for label, pose, seed, scale in EXTRAS:
        prompt = HARDENED_PROMPT.format(pose=pose)
        body = {
            'prompt': prompt,
            'image_size': {'width': 2048, 'height': 2048},
            'num_inference_steps': 36,
            'guidance_scale': 4.5,
            'num_images': 1,
            'enable_safety_checker': False,
            'output_format': 'png',
            'seed': seed,
            'loras': [{'path': lora_url, 'scale': scale}],
        }
        log_attempt('hero_attempts.jsonl', {
            'label': label, 'seed': seed, 'scale': scale, 'pose': pose,
        })
        print(f'[{label}] submitting (seed={seed}, scale={scale})...')
        try:
            req_id, response_url = submit('fal-ai/flux-lora', body)
        except Exception as e:
            print(f'  [FAIL] submit {label}: {e}')
            continue
        payload = poll_until_done(response_url, label=f'hero-{label}', max_polls=240, sleep_s=2.0)
        url = extract_image_url(payload)
        if not url:
            print(f'  [FAIL] no url for {label}')
            continue
        target = ATTEMPTS_DIR / f'{label}.png'
        n = http_download(url, target)
        print(f'  [OK] {label}: {n//1024}KB')
        manifest_entries.append({
            'label': label, 'seed': seed, 'scale': scale, 'pose': pose,
            'request_id': req_id, 'src_url': url, 'file': str(target.relative_to(ROOT)),
        })

    # Append to existing manifest
    manifest_path = ROOT / 'public/assets/case-study/cosmo-lora-v16a/hero_attempts_manifest.json'
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        manifest.setdefault('extras_p3b', []).extend(manifest_entries)
        manifest['extras_prompt'] = HARDENED_PROMPT
    else:
        manifest = {'extras_p3b': manifest_entries, 'extras_prompt': HARDENED_PROMPT}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'[manifest] {manifest_path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
