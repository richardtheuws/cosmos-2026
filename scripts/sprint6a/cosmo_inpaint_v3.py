"""
Sprint 6A v3 — Cosmo canonical inpaint fix (extended-arm geometry)
======================================================================
v2 learnings:
  - Hand-tip discs at y=520 (where I masked) ended up looking like over-ear
    headphones because that y-coord is at HEAD/NECK height for this canonical,
    not at arm-tip height.
  - The v053 canonical character has arms drawn WITHIN the body silhouette
    (no separate alpha clusters until y=780). Hand-tips at painted level are
    around y=730-780, but those rows are also the lower-torso, so any disc
    there overlaps the body.

v3 strategy:
  - Reframe: Cosmo's signature pose is "wet rubber gloves dangling at sides".
    The v053 canonical does NOT show that pose. To add suction-cups coherently
    we need NEW arm geometry that extends laterally OUTWARD from the torso.
  - Mask: paint two LARGE off-body regions on the left and right of the torso
    at mid-body height (y=550-820, x=200-360 left and x=665-820 right). This
    forces Flux Fill to invent NEW arm + suction-cup-pad geometry in empty bg
    space.
  - Tail: still alpha-erase post-BiRefNet (proven deterministic).
  - Stronger prompt with explicit "long thin alien arm extending sideways
    ending in a flat round black disc pad".
"""
from __future__ import annotations
import os, sys, time, json, urllib.request, urllib.error, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SRC_CANONICAL = ROOT / 'public/assets/sprites/v3/cosmo-canonical-cleaned.png'
PROC = ROOT / 'public/assets/case-study/cosmo-inpaint-process'
COSMO_DIR = ROOT / 'public/assets/cosmo'

def load_env():
    env = {}
    with open(Path.home() / 'Documents/games/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip("'").strip('"')
    return env

ENV = load_env()
FAL_KEY = ENV['FAL_AI_KEY']
HEADERS = {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'}

def http_post(url, payload, headers=None):
    headers = headers or HEADERS
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:400]}")
        raise

def http_get(url, headers=None):
    headers = headers or HEADERS
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def upload_file(path):
    init = http_post('https://rest.alpha.fal.ai/storage/upload/initiate',
                     {'content_type': 'image/png', 'file_name': path.name})
    with open(path, 'rb') as f:
        data = f.read()
    req = urllib.request.Request(init['upload_url'], data=data,
                                 headers={'Content-Type': 'image/png'},
                                 method='PUT')
    with urllib.request.urlopen(req, timeout=120) as r:
        r.read()
    print(f"  uploaded {path.name}")
    return init['file_url']

def fal_run(endpoint, payload, timeout=300):
    sub = http_post(f'https://queue.fal.run/{endpoint}', payload)
    rid = sub['request_id']
    print(f"  submitted {endpoint} rid={rid[:16]}…")
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = http_get(sub['status_url'])
        s = st.get('status', '')
        if s == 'COMPLETED':
            return http_get(sub['response_url'])
        if s in ('FAILED', 'ERROR', 'CANCELLED'):
            raise RuntimeError(f"job {s}: {st}")
        time.sleep(3)
    raise TimeoutError()

def download(url, dest):
    with urllib.request.urlopen(urllib.request.Request(url), timeout=120) as r:
        dest.write_bytes(r.read())
    print(f"  downloaded {dest.name} ({dest.stat().st_size//1024}KB)")
    return dest

def make_extended_arms_mask(size, dest):
    """Mask LARGE rectangular zones on left and right of the torso, extending
    OUTWARD into background space. This forces Flux Fill to invent new arm
    geometry in empty paper-bg pixels rather than overwrite face/torso.

    Torso outer edges (from alpha trace):
      y=500-540: torso narrows from x=392-641 down to x=463-576
      y=600-780: torso roughly x=440-590

    Mask zones:
      LEFT  arm: rectangle (180, 540) -> (430, 820)  outside the torso
      RIGHT arm: rectangle (615, 540) -> (860, 820)  outside the torso
    Soft feathering blends new arms into existing torso edge.
    """
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # Left arm zone
    d.rectangle((180, 540, 430, 820), fill=255)
    # Right arm zone
    d.rectangle((615, 540, 860, 820), fill=255)
    # Big disc emphasis at the would-be hand position
    d.ellipse((200, 740, 380, 870), fill=255)  # left hand
    d.ellipse((660, 740, 840, 870), fill=255)  # right hand
    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))
    mask.save(dest, 'PNG')

PROMPT_EXTENDED = (
    "small green pear-shaped alien creature with two long thin arms extending "
    "outward sideways from the torso, each arm ending in a LARGE FLAT ROUND "
    "BLACK DISC suction-cup pad like a glossy black rubber toilet plunger head, "
    "the suction-cup pads are pure obsidian-black smooth circles bigger than "
    "the head of a thumb, soft Studio Ghibli watercolor with ink-aubergine "
    "outline and paper-grain texture, faded-rose freckle spots on green skin, "
    "off-white painterly paper background, "
    "NOT fingers NOT human-hand NOT lizard-claw NOT pointed-claw NOT mitten "
    "NOT ear NOT cheek NOT face NOT headphones NOT folded-arms NOT tucked-arms"
)

def alpha_erase_tail_v2(input_png, output_png):
    """Wider tail polygon to also catch the small remnant tail-tip near
    x=320, y=950 that v2 missed."""
    im = Image.open(input_png).convert('RGBA')
    arr = np.array(im)
    h, w = arr.shape[:2]
    erase = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(erase)
    poly = [
        (180, 780),
        (440, 780),
        (440, 870),
        (430, 970),
        (220, 1000),
        (140, 920),
    ]
    d.polygon(poly, fill=255)
    erase = erase.filter(ImageFilter.GaussianBlur(radius=8))
    erase_arr = np.array(erase)
    factor = 1.0 - (erase_arr.astype(np.float32) / 255.0)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * factor).astype(np.uint8)
    Image.fromarray(arr).save(output_png, 'PNG')
    print(f"  tail-erased -> {output_png.name}")
    return output_png

def flatten_to_neutral_bg(src, dest):
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGB', im.size, (245, 240, 230))
    bg.paste(im, (0, 0), im)
    bg.save(dest, 'PNG')

def main():
    print("== Sprint 6A v3 — Cosmo extended-arm inpaint ==")

    src_flat = PROC / '01-source.png'
    if not src_flat.exists():
        flatten_to_neutral_bg(SRC_CANONICAL, src_flat)

    mask = PROC / '08-mask-extended-arms.png'
    make_extended_arms_mask((1024, 1024), mask)
    print(f"  mask -> {mask.name}")

    print("\n-- inpaint extended-arms --")
    src_url = upload_file(src_flat)
    mask_url = upload_file(mask)
    payload = {
        'image_url': src_url,
        'mask_url': mask_url,
        'prompt': PROMPT_EXTENDED,
        'num_inference_steps': 40,
        'guidance_scale': 35.0,
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    result = fal_run('fal-ai/flux-lora-fill', payload)
    out_url = result['images'][0]['url']
    inpaint_local = download(out_url, PROC / '09-result-extended-arms.png')

    print("\n-- birefnet --")
    result = fal_run('fal-ai/birefnet', {'image_url': out_url})
    img = result.get('image') or (result.get('images') or [{}])[0]
    bg_url = img.get('url') if isinstance(img, dict) else img
    birefnet_local = download(bg_url, PROC / '10-birefnet-cleaned-v3.png')

    final_local = PROC / '11-final-v3.png'
    alpha_erase_tail_v2(birefnet_local, final_local)

    target_v3 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
    target_cosmo = COSMO_DIR / '_LOCKED-REFERENCE-v2.png'
    shutil.copy(final_local, target_v3)
    shutil.copy(final_local, target_cosmo)
    print(f"\n  wired -> {target_v3.name} and {target_cosmo.name}")

    manifest = {
        'sprint': '6A-v3',
        'date': time.strftime('%Y-%m-%d'),
        'goal': 'Cosmo canonical: extended-arm geometry via Flux Fill mask in empty bg, plus deterministic tail alpha-erase',
        'pipeline': 'Flux Fill extended-arm mask + BiRefNet + PIL alpha-erase tail',
        'src': str(SRC_CANONICAL.relative_to(ROOT)),
        'process_dir': str(PROC.relative_to(ROOT)),
        'final_assets': [
            str(target_v3.relative_to(ROOT)),
            str(target_cosmo.relative_to(ROOT)),
        ],
        'prompt': PROMPT_EXTENDED,
        'mask_zones': {
            'left_arm_rect': '(180,540)-(430,820)',
            'right_arm_rect': '(615,540)-(860,820)',
            'left_hand_disc': 'center (290, 805) r=90',
            'right_hand_disc': 'center (750, 805) r=90',
        },
        'params': {'num_inference_steps': 40, 'guidance_scale': 35.0},
    }
    (PROC / '_manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f"  manifest updated")

if __name__ == '__main__':
    main()
