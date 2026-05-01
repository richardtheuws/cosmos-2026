"""
Sprint 6A v4 — refine v3 hand-tips: collapse claws into the disc.

v3 produced extended arms with black-bowling-ball objects HELD by lizard-claw
fingers. We want the disc to BE the hand-tip. Solution: a 2nd inpaint pass on
v3's result, masking ONLY the claw-finger zone around each ball, prompting
'flat disc fused to wrist NO fingers NO claws'.
"""
from __future__ import annotations
import os, sys, time, json, urllib.request, urllib.error, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
PROC = ROOT / 'public/assets/case-study/cosmo-inpaint-process'
COSMO_DIR = ROOT / 'public/assets/cosmo'
SRC_V3_RESULT = PROC / '09-result-extended-arms.png'  # pre-birefnet flat png

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
    return init['file_url']

def fal_run(endpoint, payload, timeout=300):
    sub = http_post(f'https://queue.fal.run/{endpoint}', payload)
    print(f"  rid={sub['request_id'][:16]}…")
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
    return dest

def make_clawmerge_mask(size, dest):
    """Mask the claw-finger zones around each black ball in v3 result.
    From v3-result the balls are at approx:
      LEFT  ball center  ~(155, 770) — claws at (135-200, 700-740)
      RIGHT ball center  ~(710, 770) — claws at (700-780, 700-740)
    We mask wrist-and-finger zone of each arm, keeping the ball intact.
    """
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # Left wrist+fingers area (above the left ball)
    d.ellipse((90, 660, 290, 800), fill=255)
    # Right wrist+fingers area (above the right ball)
    d.ellipse((640, 660, 840, 800), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))
    mask.save(dest, 'PNG')

PROMPT_FUSE = (
    "smooth thin green alien arm ending in a single flat round black disc "
    "suction-cup pad fused directly to the wrist with no separation, "
    "the black disc IS the hand, no fingers no claws no digits, just a thin "
    "arm meeting a flat circular black rubber pad like a toilet plunger head, "
    "soft Studio Ghibli watercolor with ink-aubergine outline, paper-grain "
    "texture, off-white painterly background, "
    "NOT fingers NOT claws NOT digits NOT lizard-hand NOT holding NOT grasping "
    "NOT separate-object NOT detached NOT thumb"
)

def alpha_erase_tail_v2(input_png, output_png):
    im = Image.open(input_png).convert('RGBA')
    arr = np.array(im)
    h, w = arr.shape[:2]
    erase = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(erase)
    poly = [
        (180, 780),(440, 780),(440, 870),(430, 970),(220, 1000),(140, 920),
    ]
    d.polygon(poly, fill=255)
    erase = erase.filter(ImageFilter.GaussianBlur(radius=8))
    erase_arr = np.array(erase)
    factor = 1.0 - (erase_arr.astype(np.float32) / 255.0)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * factor).astype(np.uint8)
    Image.fromarray(arr).save(output_png, 'PNG')

def main():
    print("== Sprint 6A v4 — fuse claws into disc ==")
    if not SRC_V3_RESULT.exists():
        print(f"  ERROR: need v3 result first: {SRC_V3_RESULT}")
        sys.exit(1)

    mask = PROC / '12-mask-fuse-claws.png'
    make_clawmerge_mask((1024, 1024), mask)
    print(f"  mask -> {mask.name}")

    print("\n-- inpaint fuse claws --")
    src_url = upload_file(SRC_V3_RESULT)
    mask_url = upload_file(mask)
    print(f"  uploaded inputs")
    payload = {
        'image_url': src_url,
        'mask_url': mask_url,
        'prompt': PROMPT_FUSE,
        'num_inference_steps': 40,
        'guidance_scale': 30.0,
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    result = fal_run('fal-ai/flux-lora-fill', payload)
    out_url = result['images'][0]['url']
    out_local = download(out_url, PROC / '13-result-fused.png')
    print(f"  downloaded -> {out_local.name} ({out_local.stat().st_size//1024}KB)")

    print("\n-- birefnet --")
    result = fal_run('fal-ai/birefnet', {'image_url': out_url})
    img = result.get('image') or (result.get('images') or [{}])[0]
    bg_url = img.get('url') if isinstance(img, dict) else img
    birefnet_local = download(bg_url, PROC / '14-birefnet-cleaned-v4.png')
    print(f"  downloaded -> {birefnet_local.name}")

    final_local = PROC / '15-final-v4.png'
    alpha_erase_tail_v2(birefnet_local, final_local)
    print(f"  tail-erased -> {final_local.name}")

    target_v3 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
    target_cosmo = COSMO_DIR / '_LOCKED-REFERENCE-v2.png'
    shutil.copy(final_local, target_v3)
    shutil.copy(final_local, target_cosmo)
    print(f"\n  wired -> v3/cosmo-canonical-v2-cleaned.png and cosmo/_LOCKED-REFERENCE-v2.png")

    # Update manifest
    manifest_path = PROC / '_manifest.json'
    if manifest_path.exists():
        m = json.loads(manifest_path.read_text())
    else:
        m = {}
    m['sprint'] = '6A-v4'
    m['date'] = time.strftime('%Y-%m-%d')
    m['v4_refinement'] = {
        'goal': 'fuse claws into disc — second-pass inpaint on v3 result',
        'pipeline': 'Flux Fill on v3 result + BiRefNet + alpha-erase tail',
        'mask': '12-mask-fuse-claws.png — two ellipses over wrist/finger zones',
        'prompt': PROMPT_FUSE,
        'params': {'num_inference_steps': 40, 'guidance_scale': 38.0},
    }
    m['final_assets'] = [
        str(target_v3.relative_to(ROOT)),
        str(target_cosmo.relative_to(ROOT)),
    ]
    manifest_path.write_text(json.dumps(m, indent=2))
    print(f"  manifest updated")

if __name__ == '__main__':
    main()
