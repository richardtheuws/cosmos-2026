"""
Sprint 13D — Phase 1: Cosmo 4K hero render.

Goal: 2048×2048 (or higher) Cosmo with EXTRA detail — chameleon eyes with iris
texture, suction-cup pads with gloss-highlight, antenna-bloem with petal-vein,
visible watercolor paper-grain. NOT a blur-upscale; a fresh PREMIUM render
that anchors v1.0.0 launch.

Strategy:
  1. Use Recraft V3 (best paint-quality + transparent BG) for the hero
  2. Fallback: Flux Pro v1.1 Ultra at 2048² if Recraft drifts off-DNA
  3. BiRefNet remove-bg afterward for transparent edge cleanup
  4. ESRGAN 4× if final output < 4K and engine wants more pixel density

Anti-kawaii / DNA-locked stem from cosmo_dna.md, anti-pattern stack at FRONT.
"""
from __future__ import annotations
import json, time
from pathlib import Path
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)


HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'
RAW_DIR.mkdir(parents=True, exist_ok=True)


# === DNA-LOCKED PROMPT (from memory: cosmo_dna.md + asset_learnings.md) =====
# Anti-pattern stack FRONT (highest leverage per Sprint 4.5 Fase B + 5B finds):
#   - NOT kawaii/chibi/sparkle-eye/blush — anti-cute (memory: kawaii drift)
#   - NOT lizard-tail / NOT pair-of-antennae — single antenna + no tail
#   - NOT mushroom-cap-head — palette word "mushroom-cream" only in palette tail
ANTI_FRONT = (
    'NOT kawaii NOT chibi NOT blush NOT sparkle-eye NOT airbrush '
    'NOT cute-mascot NOT roblox NOT 3D NOT pixar NOT photoreal NOT pixel-art, '
    'NO tail NO lizard-tail NO claws NO fingers NO paws, '
    'ONE single thin antenna NOT two NOT pair NOT antennae, '
    'slightly uncute proportions Tenniel woodcut grit'
)

# Subject (canonical Cosmo description per cosmo_dna.md "H3 Hayao×chameleon" winner)
COSMO_SUBJECT = (
    'Cosmo, a small alien boy character, full-body portrait facing slightly '
    'left, standing calm with both arms hanging at sides showing TWO LONG '
    'soft suction-cup hands like wet rubber gloves with FLAT ROUND CIRCULAR '
    'DISC PADS at the wrist-tips with subtle gloss-highlight reflections, '
    'pearl-drop pear-shaped head with smooth moss-sage green skin painted in '
    'soft watercolor with VISIBLE paper-grain texture wash and ink-aubergine '
    'ragged underdrawing outlines, FADED-ROSE pink mineral spots scattered '
    'sparsely across cheeks and shoulders, ONE single thin moss-sage antenna '
    'rising straight from top of head ending in a small FADED-ROSE flower-bulb '
    'tip with delicate petal-vein details, two large CHAMELEON-STYLE bulging '
    'spherical jet-black eyes with subtle saffron-glow catchlight crescents '
    'and faintly visible iris texture suggesting depth, tiny overbite mouth '
    'a soft slight curve, narrow tapered shoulders kid-frame slim body, small '
    'painted bare feet, no clothes naked watercolor skin'
)

# Style stem (Hayao×Moebius watercolor + paper-grain — per visual_coherence.md)
STYLE_STEM = (
    'hand-painted watercolor with ink underdrawing, paper-grain texture '
    'visible across the body, soft wet-edge watercolor bleeds, ragged '
    'ink-aubergine outline, Studio Ghibli x Moebius x Tenniel illustration, '
    'extremely high detail, painterly brush strokes visible, fine line ink '
    'work, museum-quality character illustration, sharp focus crisp lines'
)

PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, locked seven-tone palette, no random hues'
)

BG_DIRECTIVE = (
    'isolated character on plain off-white paper card background, no scene, '
    'no horizon, no environment, no other characters, character fills 75 '
    'percent of frame centered'
)


def make_prompt() -> str:
    return f'{ANTI_FRONT}. {COSMO_SUBJECT}. {STYLE_STEM}. {PALETTE}. {BG_DIRECTIVE}'


# === Recraft V3 attempt (best for character clarity + line work) ============
def attempt_recraft() -> Path | None:
    label = 'cosmo-hero-recraft-v3'
    prompt = make_prompt()
    print(f'[SUBMIT] {label}')
    print(f'[PROMPT-LEN] {len(prompt)} chars')

    body = {
        'prompt': prompt,
        'image_size': {'width': 2048, 'height': 2048},
        'style': 'digital_illustration/hand_drawn',  # Recraft style param
    }
    try:
        req_id, resp_url = submit('fal-ai/recraft-v3', body)
    except Exception as e:
        log_attempt('p1_cosmo.jsonl', {
            'attempt': 'recraft', 'submit_error': str(e)[:300],
        })
        print(f'[ERROR] recraft submit: {e}')
        return None

    payload = poll_until_done(resp_url, label, max_polls=180)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p1_cosmo.jsonl', {
            'attempt': 'recraft', 'request_id': req_id, 'no_url': True,
        })
        return None

    raw_target = RAW_DIR / 'cosmo-hero-recraft-raw.png'
    bytes_n = http_download(url, raw_target)
    print(f'[OK] {label}: {bytes_n} bytes -> {raw_target}')
    log_attempt('p1_cosmo.jsonl', {
        'attempt': 'recraft', 'request_id': req_id, 'url': url,
        'bytes': bytes_n, 'path': str(raw_target),
    })
    return raw_target


# === Flux Pro v1.1 Ultra fallback (highest detail when on-spec) =============
def attempt_flux_pro_ultra() -> Path | None:
    label = 'cosmo-hero-flux-pro-ultra'
    prompt = make_prompt()
    print(f'[SUBMIT] {label}')

    body = {
        'prompt': prompt,
        'aspect_ratio': '1:1',
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
        'raw': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body)
    except Exception as e:
        # Some accounts may not have ultra access; degrade to v1.1
        print(f'[INFO] ultra unavailable, falling back to flux-pro v1.1: {e}')
        body2 = {
            'prompt': prompt,
            'image_size': {'width': 2048, 'height': 2048},
            'num_images': 1,
        }
        try:
            req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body2)
        except Exception as e2:
            log_attempt('p1_cosmo.jsonl', {
                'attempt': 'flux_pro_v1.1', 'submit_error': str(e2)[:300],
            })
            return None

    payload = poll_until_done(resp_url, label, max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p1_cosmo.jsonl', {
            'attempt': 'flux_pro_ultra', 'request_id': req_id, 'no_url': True,
        })
        return None

    raw_target = RAW_DIR / 'cosmo-hero-flux-pro-raw.png'
    bytes_n = http_download(url, raw_target)
    print(f'[OK] {label}: {bytes_n} bytes')
    log_attempt('p1_cosmo.jsonl', {
        'attempt': 'flux_pro_ultra', 'request_id': req_id, 'url': url,
        'bytes': bytes_n,
    })
    return raw_target


# === BiRefNet remove-bg ====================================================
def remove_bg(src: Path, label: str) -> Path | None:
    print(f'[SUBMIT] birefnet on {src.name}')
    image_url = upload_local_image(src)
    body = {'image_url': image_url}
    try:
        req_id, resp_url = submit('fal-ai/birefnet', body)
    except Exception as e:
        print(f'[ERROR] birefnet submit: {e}')
        return None

    payload = poll_until_done(resp_url, f'birefnet-{label}', max_polls=180)
    if not payload:
        return None

    # birefnet returns image dict with url
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
    n = http_download(out_url, target)
    print(f'[OK] birefnet {label}: {n} bytes')
    return target


def main():
    # Phase 1a: Recraft V3 attempt
    raw = attempt_recraft()

    # Phase 1b (only if Recraft yielded nothing): Flux Pro Ultra fallback
    if raw is None:
        print('[INFO] recraft missed; trying flux-pro-ultra')
        raw = attempt_flux_pro_ultra()

    if raw is None:
        print('[FATAL] No hero render produced')
        return 1

    # Phase 1c: BiRefNet for transparent BG
    cleaned = remove_bg(raw, 'cosmo-hero')
    if cleaned and cleaned.stat().st_size > 50_000:
        # Copy cleaned to final output
        HERO_OUT.write_bytes(cleaned.read_bytes())
        print(f'[FINAL] {HERO_OUT} = {HERO_OUT.stat().st_size} bytes (BiRefNet OK)')
    else:
        # BiRefNet stripped too much — use raw with paper-card BG kept
        HERO_OUT.write_bytes(raw.read_bytes())
        print(f'[FINAL] {HERO_OUT} = {HERO_OUT.stat().st_size} bytes (raw fallback, BiRefNet stripped)')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
