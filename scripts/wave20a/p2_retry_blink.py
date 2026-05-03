"""
Wave 20a — retry cosmo-face-blink.png.

First attempt produced fully-open eyes despite "thin horizontal slits" prompt.
Flux LoRA `rtcosmo` is heavily biased toward the bulging open-eye DNA. We
need to push much harder against that bias.

Strategy: stronger negative prompts, explicit closed-eye phrasing, multiple
seed retries. Up to 3 attempts.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, '/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/scripts/sprint16a')
from _lib import submit, poll_until_done, http_download, log_attempt  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
OUT = ROOT / 'public/assets/3d/v2'
LOG_DIR = ROOT / 'scripts/wave20a/_logs'

LORA_URL = 'https://v3b.fal.media/files/b/0a98931e/10m_xs8iJYAfgyWc7fVbr_pytorch_lora_weights.safetensors'

PROMPT = (
    'rtcosmo painted alien face with EYES CLOSED, head-on view, '
    'eyes are nearly fully shut, just thin horizontal lines of eyelids meeting, '
    'tiny slit visible only 5 percent open showing nothing of the iris, '
    'small upper-lash hairs visible curling upward, '
    'mouth in soft neutral closed shape with hint of overbite, '
    'faded green moss-sage skin, watercolor wet-edge bleed, '
    'Hayao Miyazaki x Moebius style hand-painted, painterly ink underdrawing, '
    'paper grain texture, isolated subject on plain white background, '
    'no body, no antenna, no hands, just the painted face mid-blink, '
    'NOT kawaii NOT chibi NOT Disney'
)

NEGATIVE = (
    'open eyes, big round eyes, visible iris, visible pupil, '
    'glossy black eyeballs, bulging eyes, awake eyes, eye spheres, '
    'multiple faces, body, antenna, hands, suction discs, text, watermark, '
    'scary horror, realistic photo, vector art, anime cel-shading, '
    'plastic shiny, kawaii, chibi, Disney, blue iris, red iris, '
    'cute blushing cheeks'
)


def gen_flux_lora(seed: int, label: str):
    body = {
        'prompt': PROMPT,
        'negative_prompt': NEGATIVE,
        'image_size': {'width': 1024, 'height': 1024},
        'num_inference_steps': 36,
        'guidance_scale': 5.0,
        'loras': [{'path': LORA_URL, 'scale': 0.85}],  # slight scale-down to allow eyes-closed
        'seed': seed,
        'enable_safety_checker': False,
    }
    print(f'[GEN] {label} seed={seed} guidance=5.0 lora_scale=0.85')
    rid, resp_url = submit('fal-ai/flux-lora', body)
    result = poll_until_done(resp_url, label, max_polls=60, sleep_s=3.0)
    if not result:
        return None
    imgs = result.get('images') or []
    if not imgs:
        return None
    url = imgs[0].get('url') if isinstance(imgs[0], dict) else imgs[0]
    log_attempt('wave20a_attempts.jsonl', {'label': label, 'seed': seed, 'url': url})
    return url


def remove_bg(image_url: str, label: str):
    body = {
        'image_url': image_url,
        'model': 'General Use (Heavy)',
        'operating_resolution': '1024x1024',
    }
    rid, resp_url = submit('fal-ai/birefnet', body)
    result = poll_until_done(resp_url, f'{label}-rmbg', max_polls=60, sleep_s=2.0)
    if not result:
        return None
    img = result.get('image')
    if isinstance(img, dict):
        return img.get('url')
    return img


def save_attempt(url: str, target: Path, attempt_num: int) -> int:
    raw = LOG_DIR / f'_blink_attempt_{attempt_num}.png'
    n = http_download(url, raw)
    im = Image.open(raw).convert('RGBA')
    if im.size != (512, 512):
        im = im.resize((512, 512), Image.LANCZOS)
    im.save(target, format='PNG', optimize=True)
    return n


def main() -> int:
    target = OUT / 'cosmo-face-blink.png'
    seeds = [99001, 33027, 71044]
    for i, seed in enumerate(seeds):
        label = f'blink_retry_{i+1}'
        gen_url = gen_flux_lora(seed, label)
        if not gen_url:
            print(f'[FAIL] {label}: gen failed')
            continue
        bg_url = remove_bg(gen_url, label)
        if not bg_url:
            print(f'[FAIL] {label}: birefnet failed')
            continue

        # Save each attempt to logs for visual review
        attempt_target = LOG_DIR / f'blink_v{i+1}.png'
        size = save_attempt(bg_url, attempt_target, i + 1)
        print(f'[SAVED] attempt {i+1}: {attempt_target} ({size} bytes)')

    print('All retries done. Pick best in p3_pick_blink.py.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
