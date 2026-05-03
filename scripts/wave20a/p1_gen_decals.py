"""
Wave 20a — Cosmo v2 face decals + body skin + suction-cup disc.

Generates 6 of 7 assets from the architect's spec (skipping optional #7
antenna-bulb to stay under budget; sphere material is acceptable).

Output: public/assets/3d/v2/
- cosmo-face-neutral.png   (512²) — Flux Dev + LoRA + BiRefNet
- cosmo-face-coo.png       (512²) — Flux Dev + LoRA + BiRefNet
- cosmo-face-blink.png     (512²) — Flux Dev + LoRA + BiRefNet
- cosmo-face-wave.png      (512²) — Flux Dev + LoRA + BiRefNet
- cosmo-body-skin.png      (512² tile) — Pillow crop from cosmo-hero-lora.png
- cosmo-disc-suction.png   (256²) — Recraft V3 + BiRefNet

DNA acceptance for face decals (see briefing):
- Pearl-drop head silhouette implied (oval-soft-square)
- BLACK irises with saffron crescent catchlight upper-left
- Slightly bulging chameleon style
- Overbite hint on neutral mouth
- Watercolor wet-edge bleed (no hard edge)

Up to 3 retries per face. Better to ship 3-of-4 than 4 broken.
Budget cap: $1.00.
"""
from __future__ import annotations

import json
import sys
import time
from io import BytesIO
from pathlib import Path

# Reuse Sprint 16A helper (env loading, fal.ai submit/poll)
sys.path.insert(0, '/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/scripts/sprint16a')
from _lib import submit, poll_until_done, http_download, log_attempt  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
OUT = ROOT / 'public/assets/3d/v2'
OUT.mkdir(parents=True, exist_ok=True)

LOG_DIR = ROOT / 'scripts/wave20a/_logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

# LoRA from Sprint 16A — DNA in model weights, trigger word `rtcosmo`
LORA_URL = 'https://v3b.fal.media/files/b/0a98931e/10m_xs8iJYAfgyWc7fVbr_pytorch_lora_weights.safetensors'

# Cost ledger (per-call estimates; actual cost varies, this is the budget gate)
COSTS = {'flux-lora': 0.05, 'recraft-v3': 0.04, 'birefnet': 0.005}
total_cost = 0.0
BUDGET_CAP = 1.00


def cost_check(label: str, c: float) -> None:
    global total_cost
    total_cost += c
    print(f'[BUDGET] +${c:.3f} → total ${total_cost:.3f} (cap ${BUDGET_CAP:.2f}) {label}')
    if total_cost > BUDGET_CAP:
        print(f'[BUDGET CAP HIT] aborting at ${total_cost:.3f}')
        raise SystemExit(2)


def shared_face_prompt(eye_mouth_descriptor: str) -> str:
    """Build a face-decal prompt sharing all DNA constraints."""
    return (
        f'rtcosmo painted alien face, head-on view, '
        f'{eye_mouth_descriptor}, '
        f'large round chameleon-style alien eye spheres bulging slightly forward, '
        f'faded green moss-sage skin around eyes, '
        f'watercolor wet-edge bleed on outer face perimeter, '
        f'Hayao Miyazaki x Moebius style hand-painted, painterly ink underdrawing, '
        f'paper grain texture, isolated subject on plain white background, '
        f'no body, no antenna, no hands, just the painted face, '
        f'NOT kawaii NOT chibi NOT Disney, slightly uncute proportions'
    )


def shared_negative() -> str:
    return (
        'multiple faces, body, antenna, hands, suction discs, text, watermark, '
        'scary horror, realistic photo, vector art, anime cel-shading, '
        'plastic shiny, kawaii, chibi, Disney, blue iris, red iris, '
        'cute blushing cheeks'
    )


def gen_flux_lora(prompt: str, negative: str, seed: int, label: str,
                  width: int = 1024, height: int = 1024) -> str | None:
    """Run Flux Dev with rtcosmo LoRA. Returns image_url or None.

    Note: We generate at 1024² then downsample to 512² post-BiRefNet for
    sharper decal rendering.
    """
    body = {
        'prompt': prompt,
        'negative_prompt': negative,
        'image_size': {'width': width, 'height': height},
        'num_inference_steps': 32,
        'guidance_scale': 4.0,
        'loras': [{'path': LORA_URL, 'scale': 1.0}],
        'seed': seed,
        'enable_safety_checker': False,
    }
    print(f'[GEN] {label} seed={seed} {width}x{height}')
    rid, resp_url = submit('fal-ai/flux-lora', body)
    cost_check(label, COSTS['flux-lora'])
    result = poll_until_done(resp_url, label, max_polls=60, sleep_s=3.0)
    if not result:
        return None
    imgs = result.get('images') or []
    if not imgs:
        print(f'[FAIL] {label}: no images in result')
        return None
    url = imgs[0].get('url') if isinstance(imgs[0], dict) else imgs[0]
    log_attempt('wave20a_attempts.jsonl', {'label': label, 'seed': seed,
                'prompt': prompt[:200], 'url': url})
    return url


def gen_recraft(prompt: str, label: str, width: int = 1024, height: int = 1024) -> str | None:
    """Recraft V3 for the suction disc (cleaner geometric forms)."""
    body = {
        'prompt': prompt,
        'image_size': {'width': width, 'height': height},
        'style': 'digital_illustration',
    }
    print(f'[GEN] {label} via recraft-v3 {width}x{height}')
    rid, resp_url = submit('fal-ai/recraft-v3', body)
    cost_check(label, COSTS['recraft-v3'])
    result = poll_until_done(resp_url, label, max_polls=60, sleep_s=3.0)
    if not result:
        return None
    imgs = result.get('images') or []
    if not imgs:
        return None
    url = imgs[0].get('url') if isinstance(imgs[0], dict) else imgs[0]
    log_attempt('wave20a_attempts.jsonl', {'label': label, 'prompt': prompt[:200], 'url': url})
    return url


def remove_bg(image_url: str, label: str) -> str | None:
    """BiRefNet (heavy) remove-bg. Returns processed url."""
    body = {
        'image_url': image_url,
        'model': 'General Use (Heavy)',
        'operating_resolution': '1024x1024',
    }
    print(f'[BIREFNET] {label}')
    rid, resp_url = submit('fal-ai/birefnet', body)
    cost_check(f'{label}-rmbg', COSTS['birefnet'])
    result = poll_until_done(resp_url, f'{label}-rmbg', max_polls=60, sleep_s=2.0)
    if not result:
        return None
    img = result.get('image')
    if isinstance(img, dict):
        return img.get('url')
    return img


def download_and_resize(url: str, target: Path, target_size: int) -> int:
    """Download image, resize to (target_size, target_size) RGBA, save."""
    raw = ROOT / 'scripts/wave20a/_logs' / f'_raw_{target.stem}.png'
    n = http_download(url, raw)
    im = Image.open(raw).convert('RGBA')
    if im.size != (target_size, target_size):
        im = im.resize((target_size, target_size), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target, format='PNG', optimize=True)
    return n


# ---------------------------------------------------------------- FACES

FACES = [
    ('cosmo-face-neutral.png',
     'soft-closed neutral mouth with hint of overbite, '
     'eyes with deep glossy black irises, saffron crescent catchlight in upper-left of each iris',
     20260503, 'face-neutral'),
    ('cosmo-face-coo.png',
     'mouth small round coo-O shape slightly puckered, '
     'eyes with deep glossy black irises, saffron crescent catchlight in upper-left of each iris',
     20260504, 'face-coo'),
    ('cosmo-face-blink.png',
     'eyes thin horizontal slits 5 percent open with small lashes visible, '
     'mouth in soft neutral closed shape',
     20260505, 'face-blink'),
    ('cosmo-face-wave.png',
     'eyes locked forward at camera intensely with deep black irises and saffron crescent catchlights, '
     'slight uncanny smirk on mouth, no blink',
     20260506, 'face-wave'),
]


def generate_face(filename: str, eye_mouth: str, seed: int, label: str) -> bool:
    """Generate one face decal with up to 3 retries."""
    prompt = shared_face_prompt(eye_mouth)
    neg = shared_negative()
    target = OUT / filename

    for attempt in range(3):
        attempt_seed = seed + attempt * 17
        gen_url = gen_flux_lora(prompt, neg, attempt_seed,
                                f'{label}_a{attempt+1}',
                                width=1024, height=1024)
        if not gen_url:
            print(f'[RETRY] {label} attempt {attempt+1}: gen failed')
            continue

        bg_url = remove_bg(gen_url, label)
        if not bg_url:
            print(f'[RETRY] {label} attempt {attempt+1}: birefnet failed')
            continue

        try:
            size = download_and_resize(bg_url, target, 512)
            print(f'[OK] {filename} ({size} bytes raw, resized to 512)')
            return True
        except Exception as e:  # noqa: BLE001
            print(f'[RETRY] {label} attempt {attempt+1}: dl/resize {e}')
            continue

        if total_cost > BUDGET_CAP:
            return False

    print(f'[FAIL-FINAL] {label}: 3 attempts failed, no asset shipped')
    return False


# ---------------------------------------------------------------- BODY SKIN

def generate_body_skin() -> bool:
    """Crop torso swatch from cosmo-hero-lora.png, tile-friendly resize to 512²."""
    src = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'
    target = OUT / 'cosmo-body-skin.png'

    im = Image.open(src).convert('RGBA')
    # Torso swatch identified by visual inspection: clean green-with-rose-spot
    # area between belly-button and upper torso, avoiding limbs/face/antenna.
    # Hero is 4096x4096; torso clean region: x=1850..2400, y=2200..2600
    crop_box = (1850, 2200, 2400, 2600)  # 550 x 400 region
    swatch = im.crop(crop_box)

    # Make tile-friendly: take inner clean part (avoid the rose spot edge),
    # then mirror-pad horizontally + vertically to soften seams, then resize.
    # Simpler approach: take the 400x400 cleanest sub-region, resize to 512.
    inner = swatch.crop((75, 0, 475, 400))  # 400x400
    inner = inner.convert('RGB')  # body skin is wrap texture, no transparency

    # Tile-blend: average the edges via mirror-blend for seamless wrap
    # Standard offset-trick for tileable textures.
    w, h = inner.size
    # Make tileable via 4-quadrant offset blend
    tiled = Image.new('RGB', (w, h))
    half_w, half_h = w // 2, h // 2
    # Offset by half: top-left quadrant of result = bottom-right of source, etc.
    tiled.paste(inner.crop((half_w, half_h, w, h)), (0, 0))
    tiled.paste(inner.crop((0, half_h, half_w, h)), (half_w, 0))
    tiled.paste(inner.crop((half_w, 0, w, half_h)), (0, half_h))
    tiled.paste(inner.crop((0, 0, half_w, half_h)), (half_w, half_h))

    # Now blend a feathered mask of the original to hide the seam-cross
    # in the middle. We use a radial gradient mask.
    from PIL import ImageDraw, ImageFilter
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    # Inverted vignette (brighter toward edges to bring back original)
    cx, cy = w // 2, h // 2
    for r in range(min(w, h) // 2, 0, -2):
        v = max(0, 255 - int(255 * (r / (min(w, h) // 2))))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=v)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=20))
    composed = Image.composite(inner, tiled, mask)

    # Final resize to 512²
    out = composed.resize((512, 512), Image.LANCZOS)
    out.save(target, format='PNG', optimize=True)
    print(f'[OK] cosmo-body-skin.png (tile from hero-lora torso, 512x512)')
    return True


# ---------------------------------------------------------------- DISC

def generate_disc() -> bool:
    """Suction-cup disc via Recraft V3 + BiRefNet, downsized to 256²."""
    prompt = (
        'top-down view of a single matte black rubber suction cup pad, '
        'plunger-style, concentric subtle rings on top, slight watercolor '
        'texture with soft halo around edge, isolated on plain white background, '
        'Hayao Miyazaki x Moebius painted illustration style, '
        'no body, no hand, no arm, just the disc'
    )
    target = OUT / 'cosmo-disc-suction.png'

    for attempt in range(2):
        gen_url = gen_recraft(prompt, f'disc_a{attempt+1}',
                              width=1024, height=1024)
        if not gen_url:
            continue
        bg_url = remove_bg(gen_url, f'disc_a{attempt+1}')
        if not bg_url:
            continue
        try:
            size = download_and_resize(bg_url, target, 256)
            print(f'[OK] cosmo-disc-suction.png ({size} bytes raw, resized to 256)')
            return True
        except Exception as e:  # noqa: BLE001
            print(f'[RETRY] disc attempt {attempt+1}: {e}')
            continue
    print('[FAIL-FINAL] disc: shipping no disc, runtime fallback to flat color')
    return False


# ---------------------------------------------------------------- MAIN

def main() -> int:
    print('=== Wave 20a — Cosmo v2 decal generation ===')
    print(f'Output: {OUT}')
    print(f'Budget cap: ${BUDGET_CAP:.2f}')
    print()

    results = {}

    # 1. Body skin (free, fastest, lets us bail fast if Pillow broken)
    print('--- 5/6: body skin (Pillow crop+tile) ---')
    results['cosmo-body-skin.png'] = generate_body_skin()

    # 2-5. Face decals
    for filename, eye_mouth, seed, label in FACES:
        if total_cost > BUDGET_CAP:
            print('[BUDGET] cap hit, skipping remaining faces')
            results[filename] = False
            continue
        print(f'\n--- {filename} ---')
        results[filename] = generate_face(filename, eye_mouth, seed, label)

    # 6. Disc
    if total_cost <= BUDGET_CAP:
        print('\n--- 6/6: disc (Recraft V3) ---')
        results['cosmo-disc-suction.png'] = generate_disc()
    else:
        results['cosmo-disc-suction.png'] = False

    # Summary
    print('\n=== Summary ===')
    for fn, ok in results.items():
        print(f'  {"OK " if ok else "FAIL"} {fn}')
    print(f'\nTotal cost: ${total_cost:.3f}')

    summary = {
        'total_cost_usd': round(total_cost, 4),
        'results': results,
        'budget_cap': BUDGET_CAP,
    }
    (LOG_DIR / 'summary.json').write_text(json.dumps(summary, indent=2))

    n_pass = sum(1 for v in results.values() if v)
    return 0 if n_pass >= 4 else 1  # at least 4 of 6 must ship


if __name__ == '__main__':
    sys.exit(main())
