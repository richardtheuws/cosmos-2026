"""
Sprint 15C — Final retry for upside-down-tree.

V3 was a flame-burning-bush with hanging roots — closer but inverted-tree
sample-bias still wins. Final approach: instruct the model with a BLENDER-style
3D vocabulary describing the SHAPE explicitly without the word 'tree' anywhere.
'A floating leafy ball at the bottom from which a thin trunk rises upward into
a wild fan of exposed roots at the top'.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

OUT_DIR = ROOT / 'public/assets/objects'
RAW_DIR = ROOT / 'scripts/sprint15c/raw'
CASE_DIR = ROOT / 'public/assets/case-study/objects-v15c'

PROMPT = (
    'WATERCOLOR PAINTING ILLUSTRATION on textured paper, soft wet-edge bleeds, '
    'visible ink underdrawing, paper-grain texture. luminous bright pastel '
    'NOT dark NOT photoreal NOT 3D NOT cgi. macro close-up isolated single '
    'object centered in frame, plain neutral grey paper card background, '
    'NO scene NO landscape NO horizon, sharp focus crisp ink rim outlines. '
    # SHAPE-FIRST description without the word 'tree'
    'a strange floating organic plant-form suspended in mid-air, the SHAPE is '
    'composed of THREE distinct vertical zones from top to bottom: '
    'TOP THIRD shows a wild fan of EXPOSED GNARLED ROOT-TENDRILS spreading '
    'outward and upward like skeletal fingers reaching for the sky, twisted '
    'wooden veins covered in saffron-glow tips and faded-rose mineral wash; '
    'MIDDLE THIRD shows a single straight thin brown wooden TRUNK running '
    'vertically connecting the top to the bottom; '
    'BOTTOM THIRD shows a ROUND BUSHY BALL OF MOSS-SAGE LEAVES dangling like '
    'a hanging-basket — round leafy chandelier of dense green foliage with '
    'small fruit-lights peeking through. '
    'The plant has no ground beneath it floating in air. The leaves are '
    'ONLY at the BOTTOM. The roots are ONLY at the TOP. NO leaves at the '
    'top. NO roots at the bottom. This is a single inverted-orientation '
    'plant-form NOT two plants stacked NOT mirrored NOT a topiary NOT a '
    'normal tree, fills 80 percent of vertical frame, ink-aubergine ragged '
    'outline, paper-grain visible. dreamlike Lewis-Carroll oneiric weirdness, '
    'Studio Ghibli x Moebius x Tenniel illustration, palette mushroom-cream '
    'moss-sage sky-wash-blue faded-rose ink-aubergine saffron-glow forest-deep'
)


def main():
    body = {
        'prompt': PROMPT,
        'image_size': 'portrait_4_3',
        'num_images': 1,
    }
    req_id, resp_url = submit('fal-ai/flux/dev', body)
    print(f'[TREE-V4-SUBMIT] -> {req_id[:12]} (flux dev)')

    payload = poll_until_done(resp_url, 'tree-v4', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        print('[FAIL]')
        return 1

    raw = RAW_DIR / 'upside-down-tree-v4-raw.png'
    n = http_download(url, raw)
    case_raw = CASE_DIR / 'upside-down-tree-v4-raw.png'
    case_raw.write_bytes(raw.read_bytes())
    print(f'[TREE-V4-RAW] {n} bytes')

    # birefnet
    image_url = upload_local_image(raw)
    bn_id, bn_url = submit('fal-ai/birefnet', {'image_url': image_url})
    bn_payload = poll_until_done(bn_url, 'birefnet-tree-v4', max_polls=120)
    out_url = None
    if bn_payload:
        if 'image' in bn_payload:
            img = bn_payload['image']
            out_url = img.get('url') if isinstance(img, dict) else img
        elif 'images' in bn_payload and bn_payload['images']:
            f = bn_payload['images'][0]
            out_url = f.get('url') if isinstance(f, dict) else f

    cleaned = None
    if out_url:
        cleaned = RAW_DIR / 'upside-down-tree-v4-birefnet.png'
        http_download(out_url, cleaned)
        if cleaned.stat().st_size > 30_000:
            (CASE_DIR / 'upside-down-tree-v4-birefnet.png').write_bytes(cleaned.read_bytes())

    src = cleaned if (cleaned and cleaned.stat().st_size > 30_000) else raw
    img = Image.open(src)
    if img.size != (512, 768):
        img = img.resize((512, 768), Image.LANCZOS)
    final = OUT_DIR / 'upside-down-tree.png'
    img.save(final, 'PNG', optimize=True)
    (CASE_DIR / 'upside-down-tree-v4-final.png').write_bytes(final.read_bytes())
    print(f'[TREE-V4-FINAL] {final.stat().st_size} bytes')
    log_attempt('retry3_tree.jsonl', {
        'key': 'upside-down-tree',
        'attempt': 'v4',
        'model': 'fal-ai/flux/dev',
        'final_bytes': final.stat().st_size,
        'url': url,
    })
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
