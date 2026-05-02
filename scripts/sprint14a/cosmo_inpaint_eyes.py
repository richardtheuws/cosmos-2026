"""
Sprint 14A — Route B: Flux Fill inpaint EYES on canonical-v2.

Route A (img2img strength 0.30-0.55) failed all 5 attempts on the chameleon-eye
criterion — kawaii pink/sparkle eyes baked into canonical-v2 are preserved.

Route B strategy:
  1. Mask the eye-zones on canonical-v2 (two oval regions)
  2. Flux Fill `fal-ai/flux-lora-fill` with chameleon-sphere prompt
  3. Mask only the eyes — preserve all other DNA (pearl-drop, antennae, suction
     discs, spots, body)
  4. PIL alpha-erase tail-stub area (Sprint 6A pattern)
  5. ESRGAN 4× upscale
  6. Output: public/assets/sprites/cosmo-hero-4k.png

Sprint 6A learning: Flux Fill `guidance_scale` cap = 30 (38 → HTTP 422).
Sprint 6A learning: Two-pass works MIT intermediate result re-uploaded.
Sprint 6A FAILURE: refinement-passes risk regression — keep it single-pass.

Variants: 3 different mask-shape × prompt combinations. Pick best visually.
"""
from __future__ import annotations
import sys, os, json, time, shutil, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent / 'sprint13d'))
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image, FAL_KEY,
)

SPRINT_DIR = ROOT / 'scripts/sprint14a'
RAW_DIR = SPRINT_DIR / 'raw'
LOG_DIR = SPRINT_DIR / '_logs'
RAW_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

CANONICAL_V2 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
CASE_STUDY_DIR = ROOT / 'public/assets/case-study/cosmo-rerender-v14a'


def log(entry: dict, fname: str = 'cosmo_v14a_routeB.jsonl') -> None:
    target = LOG_DIR / fname
    with open(target, 'a') as f:
        f.write(json.dumps(entry) + '\n')


# === Mask building ==========================================================
# Canonical-v2 is 1024×1024. Eyes visually located around:
#   y_center ≈ 410-450 (top-third of body)
#   left eye  x_center ≈ 405, ~85px wide, ~75 tall
#   right eye x_center ≈ 595, ~85px wide, ~75 tall
# Mask must include the eye-WHITES + eyelashes + slight surround so Flux can
# rebuild full chameleon-sphere geometry. Generous oval, soft feather.

def make_eye_mask(size, dst, generous=False):
    """Create a mask that covers BOTH eye sockets only.

    `generous=True` adds extra padding to give Flux room for chameleon-bulge.
    """
    W, H = size
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    # Left eye oval
    cy = 425
    if generous:
        d.ellipse((350, cy - 60, 470, cy + 60), fill=255)
        d.ellipse((545, cy - 60, 665, cy + 60), fill=255)
    else:
        d.ellipse((365, cy - 50, 460, cy + 50), fill=255)
        d.ellipse((555, cy - 50, 650, cy + 50), fill=255)
    # Strong feather to bleed transition
    mask = mask.filter(ImageFilter.GaussianBlur(radius=10))
    mask.save(dst, 'PNG')
    return dst


def flatten_to_paper_bg(src: Path, dst: Path):
    """Flatten transparent canonical-v2 onto off-white paper background.
    Flux Fill needs an opaque RGB image, not RGBA."""
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGB', im.size, (245, 240, 230))
    bg.paste(im, (0, 0), im)
    bg.save(dst, 'PNG')
    return dst


def upload_file_to_fal(path: Path) -> str:
    """Upload via fal storage.  Sprint 6A pattern (works for inpaint endpoints
    that don't accept data URIs)."""
    headers = {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'}
    init_body = json.dumps({
        'content_type': 'image/png', 'file_name': path.name,
    }).encode()
    req = urllib.request.Request(
        'https://rest.alpha.fal.ai/storage/upload/initiate',
        data=init_body, headers=headers, method='POST',
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        init = json.loads(r.read())
    upload_req = urllib.request.Request(
        init['upload_url'], data=path.read_bytes(),
        headers={'Content-Type': 'image/png'}, method='PUT',
    )
    with urllib.request.urlopen(upload_req, timeout=120) as r:
        r.read()
    return init['file_url']


# === Flux Fill prompt variants ==============================================
PROMPT_VARIANT_A = (
    'two large bulging dark CHAMELEON-style eye-spheres on a small green '
    'alien face, deep ink-black glossy obsidian eyeballs protruding outward '
    'like a chameleon lizard, subtle saffron crescent catchlight reflection, '
    'blank reptilian gaze, soft Studio Ghibli watercolor with ink-aubergine '
    'outline and paper-grain texture, '
    'NOT pink-iris NOT pretty-eyes NOT eyelashes NOT kawaii NOT chibi '
    'NOT sparkle NOT anime NOT doll-eyes NOT cute NOT blush'
)
PROMPT_VARIANT_B = (
    'two protruding obsidian-black spherical reptile eyes on green watercolor '
    'alien skin, glossy dark eye-balls bulging from sockets like chameleon, '
    'tiny white catchlight pinpoint, ink-line ragged outline, hand-painted '
    'paper-grain Hayao Miyazaki x Moebius style, '
    'NOT eyelashes NOT pink NOT iris NOT kawaii NOT cute NOT mascot'
)
PROMPT_VARIANT_C = (
    'replace eyes with two big black bulging chameleon-orbs, '
    'glossy jet-black opaque spheres protruding outward from green skin, '
    'no whites no iris no pupil-detail just shiny dark spheres, '
    'soft watercolor finish ink-aubergine outline paper-grain, '
    'NOT human-eyes NOT kawaii NOT eyelashes NOT pretty NOT cartoon-cute'
)

VARIANTS = [
    {'label': 'b1_va_normal', 'prompt': PROMPT_VARIANT_A, 'mask_generous': False, 'seed': 7777, 'guidance': 28.0, 'steps': 40},
    {'label': 'b2_vb_generous', 'prompt': PROMPT_VARIANT_B, 'mask_generous': True, 'seed': 4242, 'guidance': 30.0, 'steps': 40},
    {'label': 'b3_vc_max', 'prompt': PROMPT_VARIANT_C, 'mask_generous': True, 'seed': 9001, 'guidance': 30.0, 'steps': 45},
]


def attempt_inpaint(label, prompt, mask_generous, seed, guidance, steps, src_url, mask_url):
    print(f'[SUBMIT] {label} seed={seed} guidance={guidance} steps={steps} generous={mask_generous}')
    body = {
        'image_url': src_url,
        'mask_url': mask_url,
        'prompt': prompt,
        'num_inference_steps': steps,
        'guidance_scale': guidance,
        'num_images': 1,
        'seed': seed,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-lora-fill', body)
    except Exception as e:
        print(f'[ERROR] submit {label}: {e}')
        log({'attempt': label, 'submit_error': str(e)[:300]})
        return None

    payload = poll_until_done(resp_url, label, max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log({'attempt': label, 'no_url': True})
        return None

    target = RAW_DIR / f'{label}.png'
    n = http_download(url, target)
    print(f'[OK] {label}: {n} bytes -> {target.name}')
    log({'attempt': label, 'url': url, 'bytes': n,
         'prompt_len': len(prompt), 'seed': seed,
         'guidance': guidance, 'steps': steps,
         'mask_generous': mask_generous})
    return target


def alpha_erase_tail(src: Path, dst: Path) -> dict:
    """Sprint 6A v2 polygon — adapted for any image size proportionally."""
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    arr = np.array(img)
    erase = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(erase)
    # Tail-stub at relative coords ~(0.18, 0.78) -> (0.43, 0.95)
    sx = W / 1024.0
    sy = H / 1024.0
    poly = [
        (int(180 * sx), int(780 * sy)),
        (int(440 * sx), int(780 * sy)),
        (int(440 * sx), int(870 * sy)),
        (int(430 * sx), int(970 * sy)),
        (int(220 * sx), int(1000 * sy)),
        (int(140 * sx), int(920 * sy)),
    ]
    d.polygon(poly, fill=255)
    erase = erase.filter(ImageFilter.GaussianBlur(radius=int(8 * sx)))
    erase_arr = np.array(erase).astype(np.float32) / 255.0
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * (1.0 - erase_arr)).astype(np.uint8)
    Image.fromarray(arr).save(dst, 'PNG')
    return {'src': str(src), 'dst': str(dst), 'W': W, 'H': H, 'poly': poly}


def measure_halo_fringe(src: Path) -> dict:
    arr = np.array(Image.open(src).convert('RGBA'))
    a = arr[:, :, 3]
    semi = ((a > 0) & (a < 50)).sum()
    opaque = (a >= 50).sum()
    if opaque == 0:
        return {'semi': int(semi), 'opaque': 0, 'avg_fringe_px': None}
    import math
    avg = semi / max(1.0, math.sqrt(opaque))
    return {'semi': int(semi), 'opaque': int(opaque), 'avg_fringe_px': round(avg, 2)}


def birefnet_remove_bg(src: Path, label: str) -> Path | None:
    print(f'[SUBMIT] birefnet {label}')
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


def upscale_4x(src: Path) -> Path | None:
    print(f'[SUBMIT] esrgan {src.name}')
    image_url = upload_local_image(src)
    body = {'image_url': image_url, 'scale': 4, 'face': False}
    try:
        req_id, resp_url = submit('fal-ai/esrgan', body)
    except Exception as e:
        print(f'[ERROR] esrgan: {e}')
        return None
    payload = poll_until_done(resp_url, 'esrgan', max_polls=180)
    url = extract_image_url(payload)
    if not url:
        return None
    target = RAW_DIR / f'{src.stem}-4k.png'
    n = http_download(url, target)
    print(f'[OK] esrgan: {n} bytes -> {target.name}')
    return target


def main(do_inpaint: bool = True, do_finalize: bool = True, final_label: str | None = None):
    # Phase 0: prep — flatten + masks
    print('=== Phase 0: Prep flat-bg + masks ===')
    flat_src = RAW_DIR / 'canonical-v2-flat.png'
    flatten_to_paper_bg(CANONICAL_V2, flat_src)
    mask_normal = RAW_DIR / 'eye-mask-normal.png'
    mask_generous_path = RAW_DIR / 'eye-mask-generous.png'
    make_eye_mask((1024, 1024), mask_normal, generous=False)
    make_eye_mask((1024, 1024), mask_generous_path, generous=True)
    print(f'[OK] flat={flat_src.name} masks={mask_normal.name},{mask_generous_path.name}')

    if not do_inpaint:
        print('[STOP] only prepped. Pass do_inpaint=True')
        return 0

    # Phase 1: upload to fal storage
    print('=== Phase 1: Upload src + masks ===')
    src_url = upload_file_to_fal(flat_src)
    mask_url_normal = upload_file_to_fal(mask_normal)
    mask_url_generous = upload_file_to_fal(mask_generous_path)
    print('[OK] uploaded')

    # Phase 2: 3 variants
    print('=== Phase 2: 3 inpaint variants ===')
    results = []
    for v in VARIANTS:
        mask_url = mask_url_generous if v['mask_generous'] else mask_url_normal
        path = attempt_inpaint(
            v['label'], v['prompt'], v['mask_generous'],
            v['seed'], v['guidance'], v['steps'], src_url, mask_url,
        )
        if path:
            results.append({**v, 'path': path})

    if not results:
        print('[FATAL] All inpaint attempts failed')
        return 1

    # Phase 3: copy to case-study
    print('=== Phase 3: case-study copies ===')
    for r in results:
        dst = CASE_STUDY_DIR / f'routeB-{r["label"]}.png'
        shutil.copy(r['path'], dst)
        print(f'[CASE-STUDY] {dst.name}')
    # Also save the mask for ref
    shutil.copy(mask_normal, CASE_STUDY_DIR / 'routeB-eye-mask-normal.png')
    shutil.copy(mask_generous_path, CASE_STUDY_DIR / 'routeB-eye-mask-generous.png')

    if not do_finalize:
        print('[STOP] inpaint variants saved. Visually pick winner, then re-run with final_label.')
        return 0

    # Phase 4: pick final
    pick_label = final_label or os.environ.get('SPRINT14A_FINAL', None)
    if pick_label:
        final_pick = next((r for r in results if r['label'] == pick_label), None)
    else:
        final_pick = None
    if final_pick is None:
        # default: pick variant C (max guidance + generous mask)
        final_pick = next((r for r in results if r['label'] == 'b3_vc_max'), results[-1])
    print(f'=== Phase 4: finalize {final_pick["label"]} ===')

    # 4a: BiRefNet remove-bg first (we flattened to paper for inpaint, now we
    # need transparent again)
    cleaned = birefnet_remove_bg(final_pick['path'], final_pick['label'])
    if cleaned is None or cleaned.stat().st_size < 50_000:
        print('[WARN] BiRefNet failed/stripped — using inpaint result directly')
        cleaned = final_pick['path']

    # 4b: alpha-erase tail
    erased = RAW_DIR / f'{final_pick["label"]}-erased.png'
    erase_meta = alpha_erase_tail(cleaned, erased)
    log({'attempt': 'alpha_erase', **erase_meta})

    # 4c: ESRGAN 4×
    upscaled = upscale_4x(erased)
    if upscaled is None:
        print('[WARN] ESRGAN failed — using 1024 erased as final')
        upscaled = erased

    # 4d: halo measurement
    halo = measure_halo_fringe(upscaled)
    log({'attempt': 'halo', **halo})
    print(f'[HALO] {halo}')

    # 4e: write to HERO_OUT
    HERO_OUT.write_bytes(upscaled.read_bytes())
    shutil.copy(upscaled, CASE_STUDY_DIR / 'after-sprint14a-final.png')
    print(f'[FINAL] {HERO_OUT} = {HERO_OUT.stat().st_size} bytes')
    log({'attempt': 'final', 'src': str(upscaled), 'dst': str(HERO_OUT),
         'final_label': final_pick['label'], 'halo': halo})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
