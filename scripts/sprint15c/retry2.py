"""
Sprint 15C — Retry pass 2 (final).

Two stubborn objects that failed retry-1:

  - mouth-pillar v2 still showed all 4 panels wide-open (symmetry-bias unbreakable
    on Flux when asked for a sequential animation in a single image).
    NEW STRATEGY: generate 4 SEPARATE single-pillar images each with one mouth
    state, then PIL-composite into a 1024×512 sprite-sheet. 100% deterministic
    per-frame state.

  - upside-down-tree v2 still rendered as two-tree-topology (lollipop shape with
    a lush crown ABOVE roots in middle). Flux's "tree" sample is too dominant.
    NEW STRATEGY: describe the result not the orientation. Try Flux Pro v1.1
    (different sample-dist than dev) with prompt "tree-shape with the LEAVES
    at the bottom dangling DOWNWARD and the ROOTS at the top spreading UPWARD
    like a wild crown of tendrils, the leaf-canopy is at the BOTTOM of the
    image and the root-system is at the TOP of the image". No 'tree' prefix
    leading.
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

ANTI_KAWAII = (
    'NOT kawaii NOT chibi NOT cute-mascot NOT pixar NOT disney NOT smiling '
    'NOT friendly-cartoon NOT children-book-cute'
)
ANTI_PHOTOREAL = (
    'NOT photograph NOT photoreal NOT realistic NOT 3D NOT cgi NOT vector '
    'NOT clipart NOT pixel-art'
)
ANTI_DARK = 'luminous bright pastel paper-grain NOT dark NOT black NOT night'
WATERCOLOR_LEAD = (
    'WATERCOLOR PAINTING ILLUSTRATION on textured paper, soft wet-edge bleeds, '
    'visible ink underdrawing, paper-grain texture'
)
STYLE_STEM = (
    'Studio Ghibli x Moebius x Tenniel illustration, oneiric dreamlike, '
    'faded-rose mineral wash + saffron-glow underlight + ink-aubergine '
    'ragged outline'
)
PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, pop-magenta and pop-cyan accents max 5 percent'
)
ISOLATION_RIDER = (
    'macro close-up isolated single object centered in frame, plain neutral '
    'grey paper card background, NO scene NO landscape NO horizon, sharp '
    'focus crisp ink rim outlines, NOT blurry'
)


# -------------------- mouth-pillar: 4 separate frames + composite -----------

MOUTH_FRAMES = [
    {
        'state': 'closed',
        'panel_subject': (
            'a single vertical stone-flesh pillar shown ALONE, the central '
            'mouth-area is a tightly SEALED faded-rose lip-seam pressed shut, '
            'just two horizontal lip-lines no teeth visible at all, the lips '
            'kiss together in a thin closed line, NO MOUTH OPEN NO TEETH '
            'VISIBLE NO GAP, mushroom-cream stone body of the pillar, paper-'
            'grain texture, fills 90 percent of vertical frame, charcoal grey '
            'background behind the pillar'
        ),
    },
    {
        'state': 'quarter',
        'panel_subject': (
            'a single vertical stone-flesh pillar shown ALONE, the central '
            'mouth is JUST CRACKING OPEN — a narrow horizontal slit between '
            'the lips reveals only the very tips of the top row of jagged '
            'ink-aubergine teeth, just a hint of teeth peeking through a thin '
            'horizontal gap, faded-rose lips slightly parted, NO bottom teeth '
            'visible, NOT wide open just a small slit, mushroom-cream stone '
            'body of the pillar, paper-grain texture, fills 90 percent of '
            'vertical frame, charcoal grey background'
        ),
    },
    {
        'state': 'half',
        'panel_subject': (
            'a single vertical stone-flesh pillar shown ALONE, the central '
            'mouth is HALF OPEN in a small oval gape, BOTH the top row AND '
            'the bottom row of jagged ink-aubergine fangs are clearly visible '
            'separated by a black throat-gap, faded-rose lips form a small '
            'ellipse, the mouth-opening is medium-sized NOT fully wide, '
            'mushroom-cream stone body of the pillar, paper-grain texture, '
            'fills 90 percent of vertical frame, charcoal grey background'
        ),
    },
    {
        'state': 'open',
        'panel_subject': (
            'a single vertical stone-flesh pillar shown ALONE, the central '
            'mouth is WIDE OPEN GAPING in a large screaming oval, the deep '
            'dark-aubergine throat-tunnel is visible inside, saffron-glow '
            'saliva strings stretch between the top and bottom rows of '
            'ink-aubergine fangs, faded-rose lips stretched into a big oval, '
            'mushroom-cream stone body of the pillar, paper-grain texture, '
            'fills 90 percent of vertical frame, charcoal grey background'
        ),
    },
]


def make_mouth_prompt(frame: dict) -> str:
    return (
        f'{WATERCOLOR_LEAD}. {ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. '
        f'{frame["panel_subject"]}. {STYLE_STEM}. {PALETTE}'
    )


def submit_mouth_frame(frame: dict) -> dict:
    body = {
        'prompt': make_mouth_prompt(frame),
        'image_size': {'width': 256, 'height': 512},  # portrait panel
        'num_images': 1,
    }
    req_id, resp_url = submit('fal-ai/flux/dev', body)
    print(f'[MOUTH-FRAME-SUBMIT] {frame["state"]} -> {req_id[:12]}')
    return {'frame': frame, 'request_id': req_id, 'response_url': resp_url,
            'prompt': body['prompt']}


def collect_mouth_frame(state: dict) -> Path | None:
    frame = state['frame']
    payload = poll_until_done(state['response_url'], f'mouth-{frame["state"]}', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        return None
    target = RAW_DIR / f'mouth-frame-{frame["state"]}.png'
    http_download(url, target)
    case_target = CASE_DIR / f'mouth-pillar-frame-{frame["state"]}-v3.png'
    case_target.write_bytes(target.read_bytes())
    print(f'[MOUTH-FRAME] {frame["state"]}: {target.stat().st_size} bytes')
    return target


def composite_mouth_sheet(frames: list[Path]) -> Path:
    """Composite 4 portrait frames (256×512) horizontally into a 1024×512 sheet."""
    sheet = Image.new('RGB', (1024, 512), (24, 18, 28))  # ink-aubergine charcoal
    states = ['closed', 'quarter', 'half', 'open']
    for i, state in enumerate(states):
        src_path = RAW_DIR / f'mouth-frame-{state}.png'
        if not src_path.exists():
            print(f'[MOUTH-COMPOSITE] missing {state}, skipping')
            continue
        img = Image.open(src_path).convert('RGB')
        if img.size != (256, 512):
            img = img.resize((256, 512), Image.LANCZOS)
        sheet.paste(img, (i * 256, 0))
    out = OUT_DIR / 'mouth-pillar-sheet.png'
    sheet.save(out, 'PNG', optimize=True)
    case_out = CASE_DIR / 'mouth-pillar-v3-final.png'
    case_out.write_bytes(out.read_bytes())
    print(f'[MOUTH-SHEET] composited 4 frames -> {out.stat().st_size} bytes')
    return out


# -------------------- upside-down-tree: shape-not-orientation prompt --------


def submit_tree_v3() -> dict:
    subject = (
        'a single suspended cosmic plant-form floating in mid-air, the SHAPE '
        'has GNARLED ROOTS at the TOP of the image — exposed twisted root-'
        'tendrils spreading UPWARD like a wild fanned-out crown of veiny '
        'fingers reaching toward the sky with saffron-glow tips, a single '
        'thick brown-bark TRUNK then descends straight downward through the '
        'middle of the image, and at the BOTTOM of the image is a bushy lush '
        'CANOPY OF MOSS-SAGE LEAVES hanging like an inverted chandelier or a '
        'topsy-turvy hanging-basket, this plant is suspended in mid-air with '
        'no ground beneath it, faint cosmic spark dots drift around the '
        'exposed root-crown at top, faded-rose mineral wash on the bark, '
        'ink-aubergine ragged outline, paper-grain texture, fills 80 percent '
        'of vertical frame on plain neutral grey paper card background, NOT '
        'a normal tree NOT mirrored NOT two trees NOT a topiary — this is '
        'ONE upside-down plant with the leaves at the BOTTOM and the roots '
        'at the TOP, dreamlike Lewis-Carroll-meets-Moebius gravity-defying '
        'oneiric weirdness'
    )
    prompt = (
        f'{WATERCOLOR_LEAD}. {ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. '
        f'{ISOLATION_RIDER}. {subject}. {STYLE_STEM}. {PALETTE}'
    )
    body = {
        'prompt': prompt,
        'image_size': 'portrait_4_3',  # 768×1024
        'num_images': 1,
    }
    req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body)
    print(f'[TREE-V3-SUBMIT] -> {req_id[:12]} (flux-pro v1.1)')
    return {
        'key': 'upside-down-tree',
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': 'fal-ai/flux-pro/v1.1',
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
    target = RAW_DIR / f'{label}-v3-birefnet.png'
    http_download(out_url, target)
    return target


def collect_tree(state: dict) -> Path | None:
    payload = poll_until_done(state['response_url'], 'upside-down-tree', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        return None

    raw_target = RAW_DIR / 'upside-down-tree-v3-raw.png'
    n = http_download(url, raw_target)
    case_raw = CASE_DIR / 'upside-down-tree-v3-raw.png'
    case_raw.write_bytes(raw_target.read_bytes())
    print(f'[TREE-V3-DOWNLOAD] {n} bytes')

    cleaned = remove_bg(raw_target, 'upside-down-tree')
    src_path = cleaned if (cleaned and cleaned.stat().st_size > 30_000) else raw_target
    used_src = 'birefnet' if (cleaned and cleaned.stat().st_size > 30_000) else 'raw'
    if used_src == 'birefnet':
        case_clean = CASE_DIR / 'upside-down-tree-v3-birefnet.png'
        case_clean.write_bytes(cleaned.read_bytes())

    final = OUT_DIR / 'upside-down-tree.png'
    img = Image.open(src_path)
    if img.size != (512, 768):
        img = img.resize((512, 768), Image.LANCZOS)
    img.save(final, 'PNG', optimize=True)
    case_final = CASE_DIR / 'upside-down-tree-v3-final.png'
    case_final.write_bytes(final.read_bytes())

    log_attempt('retry2.jsonl', {
        'key': 'upside-down-tree',
        'request_id': state['request_id'],
        'url': url,
        'model': state['model'],
        'birefnet_used': used_src == 'birefnet',
        'final_bytes': final.stat().st_size,
    })
    print(f'[TREE-V3-FINAL] ({used_src}): {final.stat().st_size} bytes')
    return final


def main():
    print('[RETRY-2] mouth-pillar: 4 separate frames + PIL composite')
    print('[RETRY-2] upside-down-tree: shape-not-orientation prompt on Flux Pro')

    # Submit all jobs in parallel
    print('[RETRY-2] Submitting...')
    mouth_states = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for state in ex.map(submit_mouth_frame, MOUTH_FRAMES):
            mouth_states.append(state)
    tree_state = submit_tree_v3()

    print('[RETRY-2] Collecting mouth frames...')
    mouth_paths = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for path in ex.map(collect_mouth_frame, mouth_states):
            mouth_paths.append(path)

    print('[RETRY-2] Compositing mouth-sheet...')
    mouth_sheet = composite_mouth_sheet(mouth_paths)

    print('[RETRY-2] Collecting tree...')
    tree_path = collect_tree(tree_state)

    print('[RETRY-2 DONE]')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
