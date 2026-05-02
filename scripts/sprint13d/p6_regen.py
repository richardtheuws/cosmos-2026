"""
Sprint 13D — Phase 6: Targeted regenerations.

Identified failures from first pass:
  1. cosmo-hero-4k.png — palette-collapse-to-black bug (10KB all-black image,
     1024×768 not 2048², BiRefNet then stripped to 3KB).
     Fix: img2img from canonical-v2-cleaned.png at 2048² with strength 0.40
     to PRESERVE Cosmo DNA + add paint-detail/paper-grain. Memory note
     (Sprint 11A): img2img preserves pose deterministically — perfect since
     we WANT the canonical pose for the hero, just at 4K.

  2. biome-slow-bloom-4k.png — has tiny human figure foreground-left
     (lone wanderer sample-bias). Fix: 8-fold negative + explicit
     "no humans no shadowy figures no people-shaped silhouettes" + crop
     focus instruction.

  3. biome-cathedral-4k.png — too photoreal sky-photo, no Hayao×Moebius
     watercolor DNA. Fix: amplify "watercolor", "painted", "ink-line",
     "Tenniel woodcut" + add "NOT photograph NOT photoreal NOT realistic"
     6-fold.

KEEP from Phase 1-5:
  - All 8 bubbles (8/8 wow)
  - All 6 particles (6/6 wow)
  - 2 biomes: inkpool + boss (both stop-and-stare)
  - share-card (acceptable B+)
  - Splash + 5 promo keyframes (kawaii-drift Cosmo but acceptable for
    promo art — img2img-from-canonical would lock DNA but sacrifice
    pose-variation, defeating their purpose)
"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)


CANONICAL = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
BG_DIR = ROOT / 'public/assets/backgrounds'
RAW_DIR = ROOT / 'scripts/sprint13d/raw'


# ============================================================================
# 1. COSMO HERO REGEN — img2img from canonical-v2
# ============================================================================
HERO_PROMPT = (
    'highly detailed museum-quality character illustration of a small alien '
    'boy character with VISIBLE paper-grain texture across the painted body, '
    'painterly Hayao Miyazaki x Moebius x Tenniel watercolor with crisp ink '
    'underdrawing, ragged ink-aubergine outline, faded-rose pink mineral '
    'spots scattered across cheeks and shoulders, two large chameleon-style '
    'bulging spherical jet-black eyes with subtle saffron-glow catchlight '
    'crescent reflections, ONE single thin moss-sage antenna with a soft '
    'faded-rose flower-bulb tip with petal-vein details, two long suction-'
    'cup hands ending in flat round disc-pads with subtle gloss highlights, '
    'soft watercolor wash skin in moss-sage green, palette mushroom-cream '
    'moss-sage faded-rose ink-aubergine saffron-glow forest-deep, plain '
    'off-white paper card background, NOT digital NOT 3D NOT photoreal '
    'NOT pixar NOT cartoon NOT roblox NOT pixel-art NOT kawaii NOT chibi'
)


def regen_cosmo_hero() -> Path | None:
    """Img2img from canonical-v2 at 2048×2048, low strength to preserve DNA."""
    print('[REGEN] cosmo-hero via img2img from canonical-v2...')
    image_url = upload_local_image(CANONICAL)

    # Use flux-pro v1.1 image-to-image (NOT control-lora-canny which we
    # learned in Sprint 11A keeps pose; that's exactly what we want here).
    body = {
        'prompt': HERO_PROMPT,
        'image_url': image_url,
        'strength': 0.45,  # low = preserves Cosmo DNA, adds detail
        'image_size': {'width': 2048, 'height': 2048},
        'num_images': 1,
    }
    try:
        # Try Flux Pro v1.1 image-to-image endpoint
        req_id, resp_url = submit('fal-ai/flux/dev/image-to-image', body)
        model = 'fal-ai/flux/dev/image-to-image'
    except Exception as e:
        print(f'[INFO] dev img2img fail: {e}; trying flux-pro v1.1 endpoint')
        # Fallback to plain flux-pro v1.1 with image_url
        try:
            req_id, resp_url = submit('fal-ai/flux-pro/v1.1', {
                **body, 'image_size': {'width': 2048, 'height': 2048},
            })
            model = 'fal-ai/flux-pro/v1.1'
        except Exception as e2:
            print(f'[FAIL] hero regen submit: {e2}')
            return None

    payload = poll_until_done(resp_url, 'cosmo-hero-regen', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p6_regen.jsonl', {'kind': 'cosmo_hero', 'failed': True, 'request_id': req_id})
        return None

    raw_target = RAW_DIR / 'cosmo-hero-regen-raw.png'
    n = http_download(url, raw_target)
    print(f'[DOWNLOAD] cosmo-hero-regen: {n} bytes')

    # Verify size > 100KB (palette-collapse threshold) before BiRefNet
    if raw_target.stat().st_size < 100_000:
        print(f'[WARN] hero raw still suspiciously small: {raw_target.stat().st_size} bytes')
        log_attempt('p6_regen.jsonl', {
            'kind': 'cosmo_hero', 'request_id': req_id, 'small_raw': True,
            'bytes': n, 'url': url, 'model': model,
        })
        return raw_target  # don't BiRefNet a possibly-bad image

    # BiRefNet for transparent edge
    cleaned = remove_bg(raw_target, 'cosmo-hero-regen')
    if cleaned and cleaned.stat().st_size > 100_000:
        HERO_OUT.write_bytes(cleaned.read_bytes())
        print(f'[FINAL] cosmo-hero-4k: {HERO_OUT.stat().st_size} bytes (birefnet)')
    else:
        HERO_OUT.write_bytes(raw_target.read_bytes())
        print(f'[FINAL] cosmo-hero-4k: {HERO_OUT.stat().st_size} bytes (raw, birefnet stripped)')

    log_attempt('p6_regen.jsonl', {
        'kind': 'cosmo_hero_img2img', 'request_id': req_id, 'url': url,
        'raw_bytes': n, 'final_bytes': HERO_OUT.stat().st_size,
        'model': model, 'strength': 0.45,
    })
    return HERO_OUT


def remove_bg(src: Path, label: str) -> Path | None:
    try:
        image_url = upload_local_image(src)
        req_id, resp_url = submit('fal-ai/birefnet', {'image_url': image_url})
    except Exception as e:
        print(f'[birefnet submit fail] {label}: {e}')
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


# ============================================================================
# 2. BIOME REGENS — slow-bloom (no figure) + cathedral (more watercolor)
# ============================================================================
ANTI_CHARACTERS_8FOLD = (
    'NO characters NO figures NO silhouettes NO travelers NO wanderers '
    'NO people NO humans NO shadowy-figures NO person-shaped-shapes '
    'NO body-silhouettes NO standing-figures NO animals NO creatures, '
    'NO digital NO 3D NO photoreal NO photograph NO photo-realistic '
    'NO pixel-art NO cartoon, '
    'pure landscape painting only, no living things in the frame'
)

WATERCOLOR_AMPLIFIED = (
    'masterful traditional WATERCOLOR PAINTING with VISIBLE PAPER-GRAIN '
    'TEXTURE under every color wash, soft wet-edge bleeds where colors '
    'feather into each other, INK-AUBERGINE ragged outline accents along '
    'shape edges, Tenniel woodcut linework crisp and visible, paint-brush '
    'stroke marks visible across the surface, Studio Ghibli x Moebius x '
    'Tenniel illustration style, HAND-PAINTED on textured paper, museum-'
    'quality painting, NOT photograph NOT photoreal NOT realistic NOT '
    'digital-art NOT 3D-render NOT smoothed-out, painterly imperfection'
)


def submit_biome_regen(key: str, subject: str, depth_directive: str) -> dict:
    palette = (
        'palette mushroom-cream moss-sage sky-wash-blue faded-rose '
        'ink-aubergine saffron-glow forest-deep, locked seven-tone palette'
    )
    prompt = (
        f'{ANTI_CHARACTERS_8FOLD}. {subject}. {depth_directive}. '
        f'{WATERCOLOR_AMPLIFIED}. {palette}'
    )
    body = {
        'prompt': prompt,
        'aspect_ratio': '16:9',
        'num_images': 1,
        'output_format': 'png',
        'enable_safety_checker': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body)
        model = 'fal-ai/flux-pro/v1.1-ultra'
    except Exception as e:
        body2 = {'prompt': prompt, 'image_size': {'width': 2048, 'height': 1152}, 'num_images': 1}
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body2)
        model = 'fal-ai/flux-pro/v1.1'
    print(f'[SUBMIT] biome-{key}-regen -> {req_id[:12]} ({model})')
    return {
        'key': key, 'request_id': req_id, 'response_url': resp_url,
        'prompt': prompt, 'model': model,
    }


def collect_biome(state: dict) -> Path | None:
    key = state['key']
    payload = poll_until_done(state['response_url'], f'biome-{key}-regen', max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p6_regen.jsonl', {'kind': f'biome_{key}', 'failed': True, **state})
        return None
    raw_target = RAW_DIR / f'biome-{key}-regen-raw.png'
    n = http_download(url, raw_target)
    final = BG_DIR / f'biome-{key}-4k.png'
    final.write_bytes(raw_target.read_bytes())
    log_attempt('p6_regen.jsonl', {
        'kind': f'biome_{key}_regen', 'request_id': state['request_id'],
        'url': url, 'bytes': n, 'final_bytes': final.stat().st_size,
        'model': state['model'],
    })
    print(f'[FINAL] biome-{key}-4k: {final.stat().st_size} bytes')
    return final


# Slow Bloom — focus on giant near-foreground mushrooms + far hazy ridges,
# explicitly empty foreground (no negative space center where character would
# spawn).
SLOW_BLOOM_REGEN = (
    'a vast empty alien mushroom forest landscape at golden dawn with '
    'hundreds of giant phosphorescent mushroom-trees stretching back into '
    'misty atmospheric haze, foreground dominated by HUGE silhouetted '
    'mushroom-tree caps and stems filling the lower-left and lower-right '
    'corners, mid-ground filled with softly glowing mushroom canopy in '
    'saffron-glow orange and faded-rose pink, far hazy mountain ridges of '
    'more mushroom forest fading to atmospheric perspective, floating cosmic '
    'spore-particles drifting through warm shafts of light, mushroom-cream '
    'pale ground with soft moss carpet stretching empty across the center '
    'of the frame, ethereal beautiful dream-forest, ABSOLUTELY NO LIVING '
    'CREATURES anywhere in this empty landscape'
)

# Cathedral — emphasize watercolor wash + painted clouds, cosmic feel
CATHEDRAL_REGEN = (
    'a heavenly hand-painted watercolor cloud realm at high altitude, vast '
    'cumulus cathedrals of pillowy painted clouds layered into atmospheric '
    'distance, shafts of saffron-glow golden-orange sunlight piercing '
    'through gaps between cloud columns with ink-line edges, faded-rose '
    'pink touches at cloud edges where dawn light catches them, sky-wash-'
    'blue base color with watercolor bleeds, mushroom-cream highlights '
    'where light hits, OCCASIONAL TINY FLOATING COSMIC CRYSTALLINE PARTICLES '
    'drifting on warm updrafts, distant cloud-mountains at the horizon in '
    'softer tones, layered depth from foreground cloud-edges with crisp '
    'ink-line outlines to mid-ground softening clouds to far hazy '
    'cloud-mountains, serene celestial trippy beautiful'
)

DEPTH_DIRECTIVE = (
    'masterful atmospheric perspective with at least four distinct depth '
    'layers reading clearly, each layer separated by atmospheric haze and '
    'tonal shift, composition leaves negative space in the center for '
    'game-action overlay'
)


def main():
    # 1. Cosmo hero img2img regen (single)
    print('=== Phase 6.1: Cosmo hero img2img regen ===')
    regen_cosmo_hero()

    # 2. Biome regens in parallel
    print('=== Phase 6.2: Biome regens (slow-bloom + cathedral) ===')
    biome_jobs = [
        ('slow-bloom', SLOW_BLOOM_REGEN, DEPTH_DIRECTIVE),
        ('cathedral', CATHEDRAL_REGEN, DEPTH_DIRECTIVE),
    ]
    submitted = []
    with ThreadPoolExecutor(max_workers=2) as ex:
        for state in ex.map(lambda j: submit_biome_regen(*j), biome_jobs):
            submitted.append(state)
    with ThreadPoolExecutor(max_workers=2) as ex:
        for r in ex.map(collect_biome, submitted):
            pass

    print('=== Phase 6 done ===')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
