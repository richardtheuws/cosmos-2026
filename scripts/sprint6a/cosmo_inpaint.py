"""
Sprint 6A — Cosmo canonical inpaint fix
==========================================
Two-pass inpainting on cosmo-canonical-cleaned.png:
  1. Remove tail (replace with empty area = transparent or body extension)
  2. Replace tiny stick-hand-tips with two flat black disc suction-cup pads

Endpoints used:
  - fal-ai/flux-lora-fill (Flux Fill — inpainting)
  - fal-ai/birefnet (background removal post-process for v2)
  - fal-ai/storage/upload (host inputs)

Mask convention (Flux Fill / fal.ai standard):
  WHITE pixels (255) = INPAINT (regenerate this region)
  BLACK pixels (0)   = PRESERVE original

Strength: Flux Fill is mask-aware; we don't pass a strength param. Mask is the
control. For aggressive replacement we make sure mask covers a buffer zone
around the target so soft edges don't echo old anatomy.

Outputs:
  public/assets/case-study/cosmo-inpaint-process/
    01-source.png            (original canonical with checker bg flatten)
    02-mask-tail.png         (white = tail removal area)
    03-result-tail.png       (Flux Fill output)
    04-mask-hands.png        (white = hand-tip areas, two discs)
    05-result-hands.png      (final composite)
    06-birefnet-cleaned.png  (final BiRefNet'd PNG with transparent BG)

Final wired asset:
  public/assets/cosmo/_LOCKED-REFERENCE-v2.png
  public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png   (drop-in for L1Scene)
"""
from __future__ import annotations
import os, sys, time, json, base64, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SRC_CANONICAL = ROOT / 'public/assets/sprites/v3/cosmo-canonical-cleaned.png'
PROC = ROOT / 'public/assets/case-study/cosmo-inpaint-process'
COSMO_DIR = ROOT / 'public/assets/cosmo'
PROC.mkdir(parents=True, exist_ok=True)
COSMO_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# fal.ai key
# -----------------------------------------------------------------------------
def load_env():
    env = {}
    with open(Path.home() / 'Documents/games/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            v = v.strip().strip("'").strip('"')
            env[k.strip()] = v
    return env

ENV = load_env()
FAL_KEY = ENV['FAL_AI_KEY']
HEADERS = {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'}

# -----------------------------------------------------------------------------
# fal.ai HTTP helpers
# -----------------------------------------------------------------------------
def http_post(url: str, payload: dict, headers=None) -> dict:
    headers = headers or HEADERS
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:400]}")
        raise

def http_get(url: str, headers=None) -> dict:
    headers = headers or HEADERS
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())

def upload_file(path: Path) -> str:
    """Upload a file to fal.ai storage; returns public URL."""
    init_url = 'https://rest.alpha.fal.ai/storage/upload/initiate'
    init_payload = {'content_type': 'image/png', 'file_name': path.name}
    init = http_post(init_url, init_payload, headers={
        'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'
    })
    upload_url = init['upload_url']
    file_url = init['file_url']
    with open(path, 'rb') as f:
        data = f.read()
    req = urllib.request.Request(upload_url, data=data,
                                 headers={'Content-Type': 'image/png'},
                                 method='PUT')
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp.read()
    print(f"  uploaded {path.name} -> {file_url}")
    return file_url

def fal_submit_and_wait(endpoint: str, payload: dict, timeout=300) -> dict:
    """Submit to fal.ai queue, poll until done."""
    submit = http_post(f'https://queue.fal.run/{endpoint}', payload)
    rid = submit['request_id']
    status_url = submit['status_url']
    response_url = submit['response_url']
    print(f"  submitted {endpoint} rid={rid[:16]}…")
    t0 = time.time()
    while time.time() - t0 < timeout:
        status = http_get(status_url)
        st = status.get('status', '')
        if st == 'COMPLETED':
            return http_get(response_url)
        if st in ('FAILED', 'ERROR', 'CANCELLED'):
            raise RuntimeError(f"job {st}: {status}")
        time.sleep(3)
    raise TimeoutError(f"job {rid} timed out after {timeout}s")

def download(url: str, dest: Path) -> Path:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=120) as resp:
        dest.write_bytes(resp.read())
    print(f"  downloaded {dest.name} ({dest.stat().st_size//1024}KB)")
    return dest

# -----------------------------------------------------------------------------
# Image preparation
# -----------------------------------------------------------------------------
def flatten_to_neutral_bg(src: Path, dest: Path):
    """Flux Fill expects an opaque RGB image. Composite RGBA canonical onto a
    neutral painterly off-white paper background so the inpainter has consistent
    surrounding context outside the body."""
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGB', im.size, (245, 240, 230))  # warm paper off-white
    bg.paste(im, (0, 0), im)
    bg.save(dest, 'PNG')
    return dest

def make_tail_mask(size, dest: Path):
    """White ellipse covering tail region (curly tail extending bottom-left).
    Tail bbox observed: x=244-450, y=820-960. We extend slightly for buffer."""
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # Generous polygon over tail area, EXCLUDING central foot zone (x>440)
    # so feet stay intact.
    poly = [
        (220, 800),
        (470, 800),
        (470, 870),
        (440, 970),
        (250, 990),
        (200, 920),
    ]
    d.polygon(poly, fill=255)
    # Soft feather
    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))
    # Re-threshold soft edges back toward binary but with feathered margin
    mask.save(dest, 'PNG')
    return dest

def make_hands_mask(size, dest: Path):
    """White discs over the two hand-tip locations.
    Left hand-tip: ~(415, 525). Right hand-tip: ~(620, 525).
    Disc radius 70px gives a generous canvas for the suction-cup pads."""
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # Left hand
    d.ellipse((345, 460, 485, 600), fill=255)
    # Right hand
    d.ellipse((550, 460, 690, 600), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=6))
    mask.save(dest, 'PNG')
    return dest

# -----------------------------------------------------------------------------
# Pipeline
# -----------------------------------------------------------------------------
STYLE_STEM = (
    "Studio Ghibli x Moebius hand-painted watercolor with ink underdrawing, "
    "paper-grain texture, faded-rose mineral wash with saffron-glow underlight, "
    "ink-aubergine ragged outline, soft moss-sage green skin tones"
)

PROMPT_TAIL = (
    "soft moss-sage green alien skin with tiny faded-rose freckle spots and "
    "ink-aubergine ragged outline, smooth backside body skin no tail no lizard-tail "
    "no curly appendage, plain off-white paper background around the figure, "
    f"{STYLE_STEM}, NOT lizard NOT tail NOT curl NOT serpent"
)

PROMPT_HANDS = (
    "two large flat round black disc suction-cup pads like glossy black rubber "
    "toilet plunger heads facing forward, smooth obsidian-black rubbery sheen, "
    "circular concave pads attached at the end of thin green alien arms, "
    f"{STYLE_STEM}, NOT fingers NOT human-hand NOT lizard-claw NOT pointed-claw "
    "NOT mitten, just two flat black circles like coins on the wrist"
)

def run_inpaint(image_url: str, mask_url: str, prompt: str, label: str,
                num_inference_steps=35, guidance_scale=30.0) -> str:
    """Run Flux Fill inpainting. Flux Fill convention: WHITE = inpaint.
    Returns image_url of the result."""
    payload = {
        'image_url': image_url,
        'mask_url': mask_url,
        'prompt': prompt,
        'num_inference_steps': num_inference_steps,
        'guidance_scale': guidance_scale,
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    print(f"[{label}] inpainting…")
    result = fal_submit_and_wait('fal-ai/flux-lora-fill', payload, timeout=300)
    images = result.get('images') or []
    if not images:
        raise RuntimeError(f"no images in result: {json.dumps(result)[:400]}")
    return images[0]['url']

def birefnet_remove_bg(image_url: str, label: str) -> str:
    payload = {'image_url': image_url}
    print(f"[{label}] birefnet…")
    result = fal_submit_and_wait('fal-ai/birefnet', payload, timeout=180)
    img = result.get('image') or (result.get('images') or [{}])[0]
    url = img.get('url') if isinstance(img, dict) else img
    if not url:
        raise RuntimeError(f"no image in birefnet result: {json.dumps(result)[:400]}")
    return url

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    print("== Sprint 6A — Cosmo inpaint canonical fix ==")
    print(f"Source: {SRC_CANONICAL}")

    # Step 1: prepare flattened source on neutral bg
    src_flat = PROC / '01-source.png'
    flatten_to_neutral_bg(SRC_CANONICAL, src_flat)
    print(f"  flat source -> {src_flat}")

    # Step 2: build masks
    mask_tail = make_tail_mask((1024, 1024), PROC / '02-mask-tail.png')
    mask_hands = make_hands_mask((1024, 1024), PROC / '04-mask-hands.png')
    print(f"  masks -> {mask_tail.name}, {mask_hands.name}")

    # Step 3: upload inputs
    print("\n-- uploading inputs --")
    src_url = upload_file(src_flat)
    mask_tail_url = upload_file(mask_tail)

    # Step 4: pass 1 — remove tail
    print("\n-- pass 1: tail removal --")
    tail_result_url = run_inpaint(src_url, mask_tail_url, PROMPT_TAIL, 'tail')
    tail_local = download(tail_result_url, PROC / '03-result-tail.png')

    # Step 5: pass 2 — suction-cup hands on tail-fixed image
    print("\n-- pass 2: suction-cup hands --")
    pass1_url = upload_file(tail_local)
    mask_hands_url = upload_file(mask_hands)
    hands_result_url = run_inpaint(pass1_url, mask_hands_url, PROMPT_HANDS, 'hands')
    hands_local = download(hands_result_url, PROC / '05-result-hands.png')

    # Step 6: BiRefNet for transparent BG
    print("\n-- birefnet --")
    final_url = birefnet_remove_bg(hands_result_url, 'final')
    final_local = download(final_url, PROC / '06-birefnet-cleaned.png')

    # Step 7: wire into the engine — drop into v3 folder + cosmo folder
    target_v3 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
    target_cosmo = COSMO_DIR / '_LOCKED-REFERENCE-v2.png'
    import shutil
    shutil.copy(final_local, target_v3)
    shutil.copy(final_local, target_cosmo)
    print(f"\n  wired -> {target_v3}")
    print(f"  wired -> {target_cosmo}")

    # Step 8: write manifest
    manifest = {
        'sprint': '6A',
        'date': time.strftime('%Y-%m-%d'),
        'goal': 'Cosmo canonical: remove tail + add suction-cup hands via Flux Fill inpainting',
        'pipeline': 'Flux Fill (fal-ai/flux-lora-fill) two-pass + BiRefNet',
        'src': str(SRC_CANONICAL.relative_to(ROOT)),
        'process_dir': str(PROC.relative_to(ROOT)),
        'final_assets': [
            str(target_v3.relative_to(ROOT)),
            str(target_cosmo.relative_to(ROOT)),
        ],
        'prompts': {
            'tail_removal': PROMPT_TAIL,
            'suction_cup_hands': PROMPT_HANDS,
        },
        'masks': {
            'tail': '02-mask-tail.png — polygon over tail region (x=200-470, y=800-990)',
            'hands': '04-mask-hands.png — two ellipses centered ~(415,530) and (620,530), r=70',
        },
        'params': {
            'num_inference_steps': 35,
            'guidance_scale': 30.0,
        },
    }
    (PROC / '_manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f"\n  manifest -> {PROC/'_manifest.json'}")

    print("\n== DONE ==")
    print(f"Process series: {PROC}")
    print(f"In-engine asset: {target_v3}")

if __name__ == '__main__':
    main()
