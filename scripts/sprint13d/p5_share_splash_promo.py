"""
Sprint 13D — Phase 5: Share-card frame, splash hero, promo keyframes.

5a. Share-card frame template (1080×1920 portrait, Recraft V3 for crisp text)
5b. Splash hero portrait (1080×1920) — TikTok-bait first impression
5c. Splash hero landscape (1920×1080)
5d. 5 promo keyframes (1920×1080) — Cosmo trip-states for promo trailer

ALL submitted in parallel for speed.
"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt,
)

SHARE_DIR = ROOT / 'public/assets/share'
PROMO_DIR = ROOT / 'public/assets/promo'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'
SHARE_DIR.mkdir(parents=True, exist_ok=True)
PROMO_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 5a. Share-card frame template (Recraft V3)
# ============================================================================
SHARE_PROMPT = (
    'a vertical portrait illustration frame template for a social media '
    'share card in 9:16 aspect ratio, Hayao Miyazaki x Moebius x Tenniel '
    'hand-painted watercolor border-frame design with cosmic elements, '
    'the border features painted floating bubble-orbs in faded-rose and '
    'saffron-glow, ink-aubergine flecks scattered around the edges, soft '
    'mushroom-cream paper-grain background texture, the CENTER of the '
    'frame is left as plain off-white empty negative space for screenshot '
    'placeholder content, ornate but elegant edges only with thin '
    'organic painted details, small "cosmos" watermark text in lower right '
    'corner in elegant serif typography, NO characters NO photos in the '
    'center area, just an empty paper card waiting for content, illustrated '
    'border frame ONLY, museum-quality print design'
)


# ============================================================================
# 5b/5c. Splash hero — Cosmo in deep-trip state, kaleido-overlay
# ============================================================================
SPLASH_PROMPT = (
    'a hero illustration of Cosmo a small moss-sage green alien boy in deep '
    'psychedelic-trip state, ONE single thin antenna with faded-rose flower '
    'tip rising from head, two long suction-cup hands with flat round disc '
    'pads at the wrists, large chameleon-style bulging spherical jet-black '
    'eyes with saffron-glow catchlight reflecting cosmic kaleidoscope '
    'patterns, NO tail NO claws NO fingers, painterly watercolor body with '
    'visible paper-grain, faded-rose pink mineral spots scattered across '
    'cheeks and shoulders, surrounded by a SWIRLING psychedelic kaleidoscope '
    'overlay of faded-rose and saffron-glow and pop-magenta and sky-wash-blue '
    'fractals radiating outward in symmetric petals, soft cosmic spore '
    'particles drifting through the scene, warm dawn-glow underlighting, '
    'Studio Ghibli x Moebius x Tenniel illustration style, hand-painted '
    'watercolor with ink underdrawing, ragged ink-aubergine outline, '
    'museum-quality character poster, '
    'NOT kawaii NOT chibi NOT cute mascot NOT 3D NOT photoreal NOT pixel-art, '
    'sublime overwhelming beautiful psychedelic poster art'
)


# ============================================================================
# 5d. Promo keyframes — 5 still-frames of Cosmo in trip states
# ============================================================================
PROMO_BASE = (
    'Cosmo a small moss-sage green alien boy with ONE thin antenna with '
    'faded-rose flower tip, two suction-cup hands with flat disc pads, '
    'large chameleon bulging black eyes with saffron-glow catchlight, '
    'NO tail NO claws, painterly watercolor body with paper-grain, '
    'faded-rose mineral spots, '
    'Studio Ghibli x Moebius x Tenniel illustration, hand-painted '
    'watercolor with ink underdrawing, ragged ink-aubergine outline, '
    'NOT kawaii NOT chibi NOT 3D NOT photoreal'
)

PROMO_KEYFRAMES = [
    {
        'key': 1, 'name': 'idle',
        'scene': (
            'standing calmly on a soft moss-sage carpet of alien grass, '
            'gentle wind blowing his antenna sideways, soft mushroom-cream '
            'dawn light from the right, peaceful contemplative mood'
        ),
    },
    {
        'key': 2, 'name': 'combo-celebration',
        'scene': (
            'mid-air with both arms raised high in joyful celebration, '
            'small painted feet kicking up, surrounded by floating '
            'saffron-glow and faded-rose bubble-orbs erupting outward, '
            'big celebratory smile, pop-magenta sparkle trails'
        ),
    },
    {
        'key': 3, 'name': 'deep-trip',
        'scene': (
            'sitting cross-legged in lotus position with eyes closed in '
            'deep meditation, surrounded by intense kaleidoscopic '
            'fractal-mandala patterns radiating outward in faded-rose '
            'saffron-glow pop-magenta sky-wash-blue, his body partially '
            'merging with the patterns, transcendent ego-death psychedelic '
            'state'
        ),
    },
    {
        'key': 4, 'name': 'kaleido-burst',
        'scene': (
            'arms outstretched wide releasing an explosive kaleidoscope-burst '
            'of cosmic energy that radiates symmetric mandala-petals across '
            'the entire frame, in saffron-glow pop-magenta faded-rose '
            'sky-wash-blue patterns, his silhouette glowing as the energy '
            'source, ecstatic open-mouth expression'
        ),
    },
    {
        'key': 5, 'name': 'share-moment',
        'scene': (
            'looking directly at camera with one hand raised waving, eyes '
            'reflecting the viewer with playful warm catchlights, '
            'background of soft mushroom-cream and faded-rose watercolor '
            'wash with cosmic spark dots, friendly inviting mood, '
            'illustration ready for sharing on social media'
        ),
    },
]


# ============================================================================
# Job submitters
# ============================================================================
def submit_share_card() -> dict:
    body = {
        'prompt': SHARE_PROMPT,
        'image_size': {'width': 1080, 'height': 1920},
        'style': 'digital_illustration/hand_drawn',
    }
    try:
        req_id, resp_url = submit('fal-ai/recraft-v3', body)
        model = 'fal-ai/recraft-v3'
    except Exception as e:
        print(f'[INFO] share-card recraft fail; using flux-pro v1.1: {e}')
        body2 = {
            'prompt': SHARE_PROMPT,
            'image_size': {'width': 1080, 'height': 1920},
            'num_images': 1,
        }
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body2)
        model = 'fal-ai/flux-pro/v1.1'
    print(f'[SUBMIT] share-card -> {req_id[:12]} ({model})')
    return {
        'kind': 'share_card', 'name': 'card-frame-template',
        'request_id': req_id, 'response_url': resp_url, 'model': model,
        'final_path': SHARE_DIR / 'card-frame-template.png',
    }


def submit_splash(orient: str) -> dict:
    aspect = '9:16' if orient == 'portrait' else '16:9'
    size = {'width': 1080, 'height': 1920} if orient == 'portrait' else {'width': 1920, 'height': 1080}
    body = {
        'prompt': SPLASH_PROMPT,
        'aspect_ratio': aspect,
        'num_images': 1,
        'output_format': 'png',
        'enable_safety_checker': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body)
        model = 'fal-ai/flux-pro/v1.1-ultra'
    except Exception as e:
        body2 = {
            'prompt': SPLASH_PROMPT,
            'image_size': size,
            'num_images': 1,
        }
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body2)
        model = 'fal-ai/flux-pro/v1.1'
    name = f'splash-hero{"" if orient == "portrait" else "-landscape"}'
    print(f'[SUBMIT] {name} -> {req_id[:12]} ({model})')
    return {
        'kind': 'splash', 'name': name,
        'request_id': req_id, 'response_url': resp_url, 'model': model,
        'final_path': SHARE_DIR / f'{name}.png',
    }


def submit_promo(kf: dict) -> dict:
    full_prompt = (
        f'{PROMO_BASE}. {kf["scene"]}. dramatic cinematic composition, '
        'museum-quality character illustration, hand-painted watercolor '
        'with ink underdrawing, paper-grain texture, atmospheric depth'
    )
    body = {
        'prompt': full_prompt,
        'image_size': {'width': 1920, 'height': 1080},
        'num_images': 1,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body)
        model = 'fal-ai/flux-pro/v1.1'
    except Exception as e:
        print(f'[INFO] promo-{kf["key"]} flux pro fail: {e}; flux dev')
        req_id, resp_url = submit('fal-ai/flux/dev', body)
        model = 'fal-ai/flux/dev'
    print(f'[SUBMIT] promo-{kf["key"]}-{kf["name"]} -> {req_id[:12]} ({model})')
    return {
        'kind': 'promo', 'name': f'keyframe-{kf["key"]}-{kf["name"]}',
        'request_id': req_id, 'response_url': resp_url, 'model': model,
        'kf': kf, 'prompt': full_prompt,
        'final_path': PROMO_DIR / f'keyframe-{kf["key"]}.png',
    }


def collect(state: dict) -> Path | None:
    payload = poll_until_done(state['response_url'], state['name'], max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p5_share_splash_promo.jsonl', {**{
            k: v for k, v in state.items() if k != 'kf' and k != 'final_path'
        }, 'failed': True})
        return None

    raw_target = RAW_DIR / f'{state["name"]}-raw.png'
    n = http_download(url, raw_target)

    final: Path = state['final_path']
    final.parent.mkdir(parents=True, exist_ok=True)
    final.write_bytes(raw_target.read_bytes())

    log_attempt('p5_share_splash_promo.jsonl', {
        'kind': state['kind'], 'name': state['name'],
        'request_id': state['request_id'], 'url': url,
        'bytes': n, 'final': str(final),
        'model': state['model'],
    })
    print(f'[FINAL] {state["name"]}: {final.stat().st_size} bytes')
    return final


def main():
    submitted = []

    print('[PHASE 5] Submitting share-card + splash + 5 promo (8 jobs)...')

    # share card
    submitted.append(submit_share_card())
    # splash portrait + landscape
    submitted.append(submit_splash('portrait'))
    submitted.append(submit_splash('landscape'))
    # 5 promo keyframes
    for kf in PROMO_KEYFRAMES:
        submitted.append(submit_promo(kf))

    print(f'[PHASE 5] Collecting {len(submitted)} jobs in parallel...')
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for r in ex.map(collect, submitted):
            results.append(r)

    success = sum(1 for r in results if r is not None)
    print(f'[PHASE 5 DONE] {success}/{len(submitted)} share/splash/promo')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
