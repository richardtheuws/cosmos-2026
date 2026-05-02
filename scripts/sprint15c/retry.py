"""
Sprint 15C — Retry pass.

Five objects need a regen with refined prompts after first-pass review:

  - organic-flesh-trampoline (3/10 → photoreal ceramic mushroom, no body-horror)
       FIX: switch to Flux Dev (Sprint 11C learning: Pro forces photo-aesthetic
            on stylized illustrations, Dev is pliabler for watercolor-painting).
            Add stronger 'breathing membrane PULSING' + 'visible pulsing veins'.
  - melting-clock-bubble (3/10 → photoreal pocket-watch, no bubble)
       FIX: switch to Flux Dev. Lead with 'WATERCOLOR PAINTING illustration'.
            Move 'bubble sphere' to subject FRONT not after watch. Remove
            'pocket-watch' (loaded photoreal token) → 'antique clock-face'.
  - upside-down-tree (4/10 → two stacked trees, not inverted)
       FIX: 'growing DOWNWARD from the top of the frame', 'ceiling-rooted',
            no 'upside-down' phrase (model parses as 'two trees mirrored').
            Use Flux Dev for organic illustration.
  - floating-star (3/10 → clipart cartoon star)
       FIX: switch to Flux Dev with explicit 'WATERCOLOR PAINTING' prefix +
            'NOT clipart NOT vector NOT cartoon NOT emoji' anti-stack.
            Drop '5-pointed star' phrasing — say 'painted star-shape with
            soft watercolor bleeds'.
  - mouth-pillar (5/10 → all 4 panels show wide-open mouth — symmetry-bias)
       FIX: stronger per-panel per-state prose with explicit 'left to right'
            order; mention 'sequential animation frames' instead of just
            'sprite-sheet'. Try Flux Dev (Pro flat-rendered the variation).
"""
from __future__ import annotations
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

OUT_DIR = ROOT / 'public/assets/objects'
RAW_DIR = ROOT / 'scripts/sprint15c/raw'
CASE_DIR = ROOT / 'public/assets/case-study/objects-v15c'

# Re-use anti-pattern stacks from generate.py
ANTI_KAWAII = (
    'NOT kawaii NOT chibi NOT cute-mascot NOT pixar NOT disney NOT smiling '
    'NOT friendly-cartoon NOT children-book-cute NOT toy-aesthetic'
)
ANTI_PHOTOREAL = (
    'NOT photograph NOT photoreal NOT realistic NOT 3D NOT cgi NOT render '
    'NOT digital-art NOT vector NOT clipart NOT emoji NOT pixel-art'
)
ANTI_DARK = 'luminous bright pastel paper-grain NOT dark NOT black NOT night NOT muddy'
WATERCOLOR_LEAD = (
    'WATERCOLOR PAINTING ILLUSTRATION on textured paper, soft wet-edge bleeds, '
    'visible ink underdrawing lines, paper-grain texture across the entire image, '
    'translucent pigment layers'
)
STYLE_STEM = (
    'Studio Ghibli x Moebius x Tenniel hand-painted watercolor illustration, '
    'oneiric dreamlike unsettling-fascinating mood, faded-rose mineral wash + '
    'saffron-glow underlight + ink-aubergine ragged outline'
)
PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, pop-magenta and pop-cyan accents max 5 percent'
)
ISOLATION_RIDER = (
    'macro close-up isolated single object centered in frame, plain neutral '
    'grey paper card background, NO scene NO landscape NO horizon NO ground, '
    'just ONE thing filling 65 percent of frame, sharp focus crisp ink rim '
    'outlines, NOT blurry'
)


RETRY_OBJECTS = [
    {
        'key': 'organic-flesh-trampoline',
        'aspect': 'square',
        'target_size': (512, 512),
        'subject': (
            'a TOP-DOWN birds-eye watercolor PAINTING of a circular fleshy '
            'membrane drum-skin stretched across a ring of pulpy mushroom-gill '
            'tissue, the membrane is SLIGHTLY SWOLLEN and translucent like a '
            'thin lung-tissue, you can SEE through the skin to a network of '
            'faded-rose pulsing blood-veins branching beneath the surface like '
            'capillaries, a small puckered breathing-hole at the dead center '
            'of the membrane that looks like a sphincter, ink-aubergine gill-'
            'pleats radiate outward beneath the rim, the whole disc is '
            'unsettlingly ORGANIC and biological — somewhere between mushroom '
            'and lung-tissue and drumhead, the membrane has a wet pearlescent '
            'saffron-glow sheen on top, viewed from directly above, fills 70 '
            'percent of square frame, NOT a normal mushroom-cap NOT cute '
            'NOT cartoon NOT photoreal — painterly watercolor body-horror '
            'fungal disc'
        ),
        'endpoint': 'fal-ai/flux/dev',
        'birefnet': True,
        'birefnet_min_bytes': 30_000,
    },
    {
        'key': 'melting-clock-bubble',
        'aspect': 'square',
        'target_size': (384, 384),
        'subject': (
            'a TRANSLUCENT IRIDESCENT SOAP-BUBBLE SPHERE floating in mid-air '
            'with an ANTIQUE clock-face DRIPPING and MELTING inside it like a '
            'Salvador Dali surrealist painting — the clock-face hangs limp '
            'and wax-soft inside the bubble, the Roman numerals are warping '
            'and SLIDING off the rim of the dial, the hour-hand has '
            'liquefied into a thin saffron-glow rivulet pooling at the bottom '
            'of the bubble interior, the hour-hand drips downward like hot '
            'taffy, the bubble itself shimmers with faded-rose and pop-cyan '
            'rainbow-iridescence around its rim, faint cosmic spark dots '
            'drift around the bubble exterior, the entire object is centered '
            'and fills 70 percent of square frame, NOT a normal pocket-watch '
            'NOT a steampunk timepiece NOT photoreal — hand-painted watercolor '
            'illustration of a melting time-anomaly trapped inside a bubble'
        ),
        'endpoint': 'fal-ai/flux/dev',
        'birefnet': True,
        'birefnet_min_bytes': 30_000,
    },
    {
        'key': 'upside-down-tree',
        'aspect': 'portrait',
        'target_size': (512, 768),
        'subject': (
            'a SINGLE inverted cosmic tree GROWING DOWNWARD from the top of '
            'the frame as if rooted in an invisible ceiling, the EXPOSED '
            'GNARLED ROOT-SYSTEM is at the TOP of the image fanning outward '
            'like a tangle of writhing tendrils with saffron-glow tips, a '
            'single thick trunk descends straight downward from the roots, '
            'and at the BOTTOM of the image a bushy crown of moss-sage '
            'leaves hangs like an inverted chandelier or hanging-basket, the '
            'tree is FLOATING LEVITATING in mid-air with absolutely no ground '
            'beneath it, faint cosmic spark dots drift around the exposed '
            'roots at top, faded-rose mineral wash on the bark, ink-aubergine '
            'ragged outline, paper-grain visible across the bark, fills 80 '
            'percent of vertical frame, this is ONE single tree oriented '
            'root-end-up NOT two trees NOT mirrored NOT a topiary, dreamlike '
            'oneiric Lewis-Carroll-meets-Moebius gravity-defying weirdness'
        ),
        'endpoint': 'fal-ai/flux/dev',
        'birefnet': True,
        'birefnet_min_bytes': 30_000,
    },
    {
        'key': 'floating-star',
        'aspect': 'square',
        'target_size': (128, 128),
        'subject': (
            'a single hand-painted WATERCOLOR star-shape on textured paper, '
            'irregular hand-painted edges with visible brush-stroke wet-edge '
            'bleeds, body of the star filled with translucent pop-cyan aqua-'
            'blue watercolor with a saffron-glow inner-burst at the core, '
            'ink-aubergine ragged ink-pen outline traced around the star '
            'silhouette, paper-grain texture clearly visible across the '
            'star body, faint internal swirl of mushroom-cream and faded-'
            'rose pigment layers, soft halo of saffron sparks around the '
            'perimeter, fills 65 percent of square frame floating centered, '
            'NOT clipart NOT vector NOT emoji NOT cartoon NOT 3D NOT shiny '
            'NOT polished — explicitly a hand-painted watercolor illustration '
            'with paper-grain visible'
        ),
        'endpoint': 'fal-ai/flux/dev',
        'birefnet': True,
        'birefnet_min_bytes': 8_000,  # tiny target — relax threshold
    },
    {
        'key': 'mouth-pillar',
        'aspect': 'sheet',
        'target_size': (1024, 512),
        'subject': (
            'a 4-frame horizontal sequential animation sprite-sheet, the image '
            'is divided into FOUR equal vertical panels arranged left-to-right '
            'in a 4-cell horizontal grid, each panel shows the same vertical '
            'stone-and-flesh pillar with a fanged mouth carved into its center '
            'BUT each panel shows a DIFFERENT KEYFRAME of a mouth opening '
            'animation — IMPORTANT the four mouth states MUST be visibly '
            'DIFFERENT from each other not identical: '
            'PANEL ONE leftmost shows the mouth FULLY CLOSED the faded-rose '
            'lips pressed firmly together a horizontal seam zero teeth visible '
            'at all just sealed lips like a thin scar; '
            'PANEL TWO second from left shows the mouth slightly cracked open '
            'a NARROW horizontal slit revealing only the tips of the top row '
            'of ink-aubergine teeth and a thin black gap; '
            'PANEL THREE third panel shows the mouth half-open in an oval gape '
            'now BOTH top and bottom rows of ink-aubergine fangs are clearly '
            'visible separated by a black throat-gap; '
            'PANEL FOUR rightmost shows the mouth WIDE OPEN gaping in a '
            'screaming oval the deep dark-aubergine throat-tunnel visible '
            'inside saffron-glow saliva strings stretching between top and '
            'bottom teeth. '
            'Each pillar is identical in shape and position with the same '
            'mushroom-cream stone body and faded-rose lip-tissue around the '
            'mouth-area, ONLY the mouth-state changes from panel to panel, '
            'dark neutral charcoal-grey background behind each panel'
        ),
        'endpoint': 'fal-ai/flux/dev',
        'image_size': {'width': 1024, 'height': 512},
        'birefnet': False,
        'birefnet_min_bytes': 0,
    },
]


def make_prompt(obj: dict) -> str:
    if obj['key'] == 'mouth-pillar':
        sheet_rider = (
            'a 4-frame horizontal sequential sprite-sheet image with FOUR equally-'
            'sized vertical panels in a row showing 4 keyframes of an animation, '
            'sharp focus crisp ink linework, NOT blurry, NO scene NO landscape '
            'NO horizon, just the 4-cell animation sheet with PROGRESSIVE '
            'mouth-opening states left to right'
        )
        return (
            f'{ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. {WATERCOLOR_LEAD}. '
            f'{sheet_rider}. {obj["subject"]}. {STYLE_STEM}. {PALETTE}'
        )
    return (
        f'{WATERCOLOR_LEAD}. {ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. '
        f'{ISOLATION_RIDER}. {obj["subject"]}. {STYLE_STEM}. {PALETTE}'
    )


def submit_object(obj: dict) -> dict:
    prompt = make_prompt(obj)
    if obj['key'] == 'mouth-pillar':
        body = {
            'prompt': prompt,
            'image_size': obj['image_size'],
            'num_images': 1,
        }
    elif obj['aspect'] == 'portrait':
        body = {
            'prompt': prompt,
            'image_size': 'portrait_4_3',  # 768×1024
            'num_images': 1,
        }
    else:
        body = {
            'prompt': prompt,
            'image_size': 'square_hd',  # 1024×1024
            'num_images': 1,
        }
    req_id, resp_url = submit(obj['endpoint'], body)
    print(f'[RETRY-SUBMIT] {obj["key"]} -> {req_id[:12]} ({obj["endpoint"]})')
    return {
        'object': obj,
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': obj['endpoint'],
    }


def remove_bg(src: Path, label: str) -> Path | None:
    try:
        image_url = upload_local_image(src)
        req_id, resp_url = submit('fal-ai/birefnet', {'image_url': image_url})
    except Exception as e:
        print(f'[birefnet fail] {label}: {e}')
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
    target = RAW_DIR / f'{label}-v2-birefnet.png'
    http_download(out_url, target)
    return target


def collect(state: dict) -> Path | None:
    obj = state['object']
    key = obj['key']
    payload = poll_until_done(state['response_url'], key, max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('retry.jsonl', {'key': key, 'failed': True,
                                    'request_id': state['request_id']})
        print(f'[FAIL] {key}')
        return None

    raw_target = RAW_DIR / f'{key}-v2-raw.png'
    n = http_download(url, raw_target)
    case_raw = CASE_DIR / f'{key}-v2-raw.png'
    case_raw.write_bytes(raw_target.read_bytes())
    print(f'[DOWNLOAD-V2] {key}: {n} bytes')

    cleaned = None
    if obj['birefnet']:
        cleaned = remove_bg(raw_target, key)
        if cleaned and cleaned.stat().st_size > obj['birefnet_min_bytes']:
            case_clean = CASE_DIR / f'{key}-v2-birefnet.png'
            case_clean.write_bytes(cleaned.read_bytes())

    src_path = cleaned if (cleaned and cleaned.stat().st_size > obj['birefnet_min_bytes']) else raw_target
    used_src = 'birefnet' if (cleaned and cleaned.stat().st_size > obj['birefnet_min_bytes']) else 'raw'

    if key == 'mouth-pillar':
        final_name = 'mouth-pillar-sheet.png'
    else:
        final_name = f'{key}.png'
    final_path = OUT_DIR / final_name

    img = Image.open(src_path)
    target_w, target_h = obj['target_size']
    if img.size != (target_w, target_h):
        img_resized = img.resize((target_w, target_h), Image.LANCZOS)
    else:
        img_resized = img
    img_resized.save(final_path, 'PNG', optimize=True)

    case_final = CASE_DIR / f'{key}-v2-final.png'
    case_final.write_bytes(final_path.read_bytes())

    log_attempt('retry.jsonl', {
        'key': key,
        'request_id': state['request_id'],
        'url': url,
        'raw_bytes': n,
        'model': state['model'],
        'birefnet_used': used_src == 'birefnet',
        'final': str(final_path),
        'final_bytes': final_path.stat().st_size,
    })
    print(f'[FINAL-V2] {key} ({used_src}): {final_path.stat().st_size} bytes')
    return final_path


def main():
    print(f'[RETRY] Submitting {len(RETRY_OBJECTS)} regen jobs...')
    submitted = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for state in ex.map(submit_object, RETRY_OBJECTS):
            submitted.append(state)

    print(f'[RETRY] Collecting...')
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for path in ex.map(collect, submitted):
            results.append(path)

    success = sum(1 for r in results if r is not None)
    print(f'[RETRY DONE] {success}/{len(RETRY_OBJECTS)} regenerated')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
