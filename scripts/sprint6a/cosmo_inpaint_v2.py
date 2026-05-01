"""
Sprint 6A v2 — Cosmo canonical inpaint fix (revised)
========================================================
v1 learnings:
  - Flux Fill regenerated a lizard-tail despite "no tail" prompt -> sample-bias
    same as Sprint 5B img-to-img and Fase C text-only. Flux SAMPLE bias for
    "alien bipedal lower body" = lizard-tail. Inpainting alone cannot break it.
  - Hands inpaint placed black discs but at face/cheek level (mask centered
    y=460-600 overlapped the head bottom).

v2 strategy:
  - HANDS: tighter mask centered on actual arm-tips (y=500-540), at the body
    silhouette outer edge. Don't overlap head zone.
  - TAIL: SKIP inpaint entirely — use deterministic alpha-erase after BiRefNet.
    The tail is a separate alpha cluster (x=244-410, y=820-960) so we can
    flood-erase that region from the alpha channel reliably.
  - Single inpaint pass for hands only -> half the cost of v1.
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
PROC.mkdir(parents=True, exist_ok=True)
COSMO_DIR.mkdir(parents=True, exist_ok=True)

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

def flatten_to_neutral_bg(src, dest):
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGB', im.size, (245, 240, 230))
    bg.paste(im, (0, 0), im)
    bg.save(dest, 'PNG')

def make_hands_mask_v2(size, dest):
    """Tight discs at the actual hand-tip positions: outer body silhouette
    at y=500-540. From alpha trace: y=500 cols 392-641 (widest body row).
    Hand-tips approx at (405, 520) and (628, 520). Disc radius 55px keeps the
    mask away from the head (head bottom at y=400-440)."""
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # left hand: center (405, 520), r=55
    d.ellipse((350, 465, 460, 575), fill=255)
    # right hand: center (628, 520), r=55
    d.ellipse((573, 465, 683, 575), fill=255)
    # Soft feather only at edge, narrow radius
    mask = mask.filter(ImageFilter.GaussianBlur(radius=4))
    mask.save(dest, 'PNG')

# Stronger anti-anatomy stack
PROMPT_HANDS = (
    "two large flat round black disc suction-cup pads like glossy black rubber "
    "toilet plunger heads, pure obsidian-black smooth circles, concave rubber "
    "pad, painted in soft Studio Ghibli watercolor with ink-aubergine outline "
    "and paper-grain texture, attached at the very tips of thin green alien arms, "
    "NOT fingers NOT human-hand NOT lizard-claw NOT pointed-claw NOT mitten "
    "NOT headphones NOT ear NOT cheek NOT face, just two flat round black coins"
)

def alpha_erase_tail(input_png, output_png):
    """Deterministic tail removal: zero alpha in the tail bbox after BiRefNet.
    Tail occupies x=200-415, y=800-970 (outside the central body axis x=420-580).
    We use a soft polygon mask so the cut is feathered."""
    im = Image.open(input_png).convert('RGBA')
    arr = np.array(im)
    h, w = arr.shape[:2]
    # Build erase mask matching tail polygon — same shape as v1 mask
    erase = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(erase)
    # Polygon over tail region (LEFT side of body axis x=480 only — keep feet)
    poly = [
        (200, 790),
        (430, 790),
        (430, 870),
        (415, 950),
        (260, 985),
        (180, 920),
    ]
    d.polygon(poly, fill=255)
    erase = erase.filter(ImageFilter.GaussianBlur(radius=6))
    erase_arr = np.array(erase)
    # Where erase mask is white, multiply alpha toward 0
    factor = 1.0 - (erase_arr.astype(np.float32) / 255.0)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * factor).astype(np.uint8)
    Image.fromarray(arr, 'RGBA').save(output_png, 'PNG')
    print(f"  tail-erased -> {output_png.name}")
    return output_png

def main():
    print("== Sprint 6A v2 — Cosmo inpaint canonical fix (hands inpaint + alpha-erase tail) ==")

    # Step 1: flatten source on neutral bg (re-use 01-source.png if exists)
    src_flat = PROC / '01-source.png'
    if not src_flat.exists():
        flatten_to_neutral_bg(SRC_CANONICAL, src_flat)
        print(f"  flat source -> {src_flat.name}")

    # Step 2: hands mask v2
    mask_hands = PROC / '04-mask-hands-v2.png'
    make_hands_mask_v2((1024, 1024), mask_hands)
    print(f"  hands mask v2 -> {mask_hands.name}")

    # Step 3: upload + inpaint hands only
    print("\n-- pass: suction-cup hands (v2 mask) --")
    src_url = upload_file(src_flat)
    mask_url = upload_file(mask_hands)
    payload = {
        'image_url': src_url,
        'mask_url': mask_url,
        'prompt': PROMPT_HANDS,
        'num_inference_steps': 40,
        'guidance_scale': 35.0,  # higher = stronger prompt adherence
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    result = fal_run('fal-ai/flux-lora-fill', payload)
    hands_url = result['images'][0]['url']
    hands_local = download(hands_url, PROC / '05-result-hands-v2.png')

    # Step 4: BiRefNet on hands-result
    print("\n-- birefnet --")
    result = fal_run('fal-ai/birefnet', {'image_url': hands_url})
    img = result.get('image') or (result.get('images') or [{}])[0]
    bg_url = img.get('url') if isinstance(img, dict) else img
    birefnet_local = download(bg_url, PROC / '06-birefnet-cleaned-v2.png')

    # Step 5: alpha-erase tail post-BiRefNet (deterministic)
    final_local = PROC / '07-final-tail-erased.png'
    alpha_erase_tail(birefnet_local, final_local)

    # Step 6: wire
    target_v3 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
    target_cosmo = COSMO_DIR / '_LOCKED-REFERENCE-v2.png'
    shutil.copy(final_local, target_v3)
    shutil.copy(final_local, target_cosmo)
    print(f"\n  wired -> {target_v3}")
    print(f"  wired -> {target_cosmo}")

    # Step 7: manifest
    manifest = {
        'sprint': '6A-v2',
        'date': time.strftime('%Y-%m-%d'),
        'goal': 'Cosmo canonical fix: suction-cup hands via Flux Fill inpainting, tail removed via deterministic alpha-erase post-BiRefNet',
        'pipeline': 'Flux Fill (fal-ai/flux-lora-fill) hands-only + BiRefNet + PIL alpha-erase',
        'why_no_tail_inpaint': 'Sprint 6A v1 proved Flux Fill regenerates lizard-tail despite anti-tail prompt. Sample-bias same as text-only and img-to-img. Switched to deterministic alpha-erase post-BiRefNet (zero generation cost, zero failure mode).',
        'src': str(SRC_CANONICAL.relative_to(ROOT)),
        'process_dir': str(PROC.relative_to(ROOT)),
        'final_assets': [
            str(target_v3.relative_to(ROOT)),
            str(target_cosmo.relative_to(ROOT)),
        ],
        'prompts': {
            'suction_cup_hands': PROMPT_HANDS,
        },
        'masks': {
            'hands_v2': '04-mask-hands-v2.png — two ellipses centered (405,520) and (628,520), r=55, feather=4px (smaller than v1 to avoid head overlap)',
            'tail_alpha_erase': 'polygon (200,790)-(430,790)-(430,870)-(415,950)-(260,985)-(180,920) feather=6',
        },
        'params': {
            'num_inference_steps': 40,
            'guidance_scale': 35.0,
        },
    }
    (PROC / '_manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f"  manifest -> {(PROC/'_manifest.json').name}")
    print("\n== DONE ==")

if __name__ == '__main__':
    main()
