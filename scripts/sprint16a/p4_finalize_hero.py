"""
Sprint 16A — Phase 4: Finalize the Cosmo hero from a03 (LoRA winner).

Pipeline:
  1. Pick a03 (best disc + chameleon eyes + DNA) → 1536²
  2. BiRefNet remove background (peach moon halo + paper bg) → RGBA 1536²
  3. PIL alpha-erase tail polygon (Sprint 6A pattern, deterministic)
  4. ESRGAN 4× upscale preserving alpha (Sprint 14A pattern) → 6144²
  5. Downsample to 4096² for spec target → cosmo-hero-lora.png
  6. Save before/after, side-by-side compare grid

Output: public/assets/sprites/cosmo-hero-lora.png  (4096² RGBA)
"""
from __future__ import annotations
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    ROOT, LOG_DIR,
    submit, poll_until_done, extract_image_url,
    http_download, upload_to_fal_storage, log_attempt,
)

WINNER_LABEL = 'a03'
ATTEMPTS_DIR = ROOT / 'public/assets/case-study/cosmo-lora-v16a/attempts'
CASE_DIR = ROOT / 'public/assets/case-study/cosmo-lora-v16a'
RAW_DIR = ROOT / 'scripts/sprint16a/raw'
RAW_DIR.mkdir(parents=True, exist_ok=True)

WINNER_SRC = ATTEMPTS_DIR / f'{WINNER_LABEL}.png'
HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'


def remove_background(src: Path, dst: Path) -> Path | None:
    """BiRefNet background removal. Returns RGBA path or None."""
    print(f'[birefnet] uploading {src.name}...')
    image_url = upload_to_fal_storage(src)
    print(f'[birefnet] hosted: {image_url}')
    body = {'image_url': image_url}
    req_id, resp_url = submit('fal-ai/birefnet', body)
    payload = poll_until_done(resp_url, 'birefnet', max_polls=180, sleep_s=2.0)
    url = extract_image_url(payload)
    if not url:
        # Some BiRefNet versions return under different key
        if payload:
            for k in ('image', 'output', 'result'):
                if k in payload:
                    val = payload[k]
                    if isinstance(val, dict) and 'url' in val:
                        url = val['url']
                        break
                    if isinstance(val, str):
                        url = val
                        break
    if not url:
        print(f'[FAIL] birefnet payload: {payload}')
        return None
    n = http_download(url, dst)
    print(f'[birefnet] saved: {n//1024}KB → {dst.name}')
    return dst


def alpha_erase_tail(src: Path, dst: Path) -> Path:
    """PIL alpha-erase tail polygon (Sprint 6A pattern, scale-aware).

    a03 has a curly tail extending from lower-right of body. Polygon covers
    the curl + drop-shadow region. Scaled to actual image dimensions.
    """
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    arr = np.array(img)

    erase = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(erase)
    # a03 tail extends right of body around y=950-1300, x=900-1300 (1536² coords)
    # Polygon points proportional to W,H (W/H == 1 since square)
    sx = W / 1536.0
    sy = H / 1536.0
    poly = [
        (int(880 * sx), int(900 * sy)),
        (int(1300 * sx), int(900 * sy)),
        (int(1450 * sx), int(1100 * sy)),
        (int(1450 * sx), int(1280 * sy)),
        (int(1100 * sx), int(1380 * sy)),
        (int(880 * sx), int(1300 * sy)),
    ]
    d.polygon(poly, fill=255)
    feather = int(12 * sx)
    erase = erase.filter(ImageFilter.GaussianBlur(radius=max(4, feather)))
    erase_arr = np.array(erase).astype(np.float32) / 255.0
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * (1.0 - erase_arr)).astype(np.uint8)
    Image.fromarray(arr).save(dst, 'PNG')
    print(f'[tail-erase] poly={poly} → {dst.name}')
    return dst


def esrgan_4x_preserving_alpha(src_rgba: Path, dst: Path) -> Path | None:
    """Sprint 14A pattern:
    1. Flatten RGBA → white-bg RGB
    2. ESRGAN 4× on RGB
    3. PIL Lanczos 4× on alpha + threshold-tighten (avoid 100px halo)
    4. Merge → RGBA
    """
    img = Image.open(src_rgba).convert('RGBA')
    W, H = img.size
    flat = Image.new('RGB', (W, H), (255, 255, 255))
    flat.paste(img, (0, 0), img)
    flat_path = RAW_DIR / f'{src_rgba.stem}-flat-white.png'
    flat.save(flat_path, 'PNG')

    print(f'[esrgan] uploading flattened ({flat_path.stat().st_size//1024}KB)...')
    image_url = upload_to_fal_storage(flat_path)
    body = {'image_url': image_url, 'scale': 4, 'face': False}
    req_id, resp_url = submit('fal-ai/esrgan', body)
    payload = poll_until_done(resp_url, 'esrgan', max_polls=240, sleep_s=2.0)
    url = extract_image_url(payload)
    if not url:
        print(f'[FAIL] esrgan payload: {payload}')
        return None
    rgb_path = RAW_DIR / f'{src_rgba.stem}-rgb-4x.png'
    http_download(url, rgb_path)
    rgb_4x = Image.open(rgb_path).convert('RGB')
    print(f'[esrgan] rgb-4x: {rgb_4x.size}')

    # Alpha: PIL Lanczos to match RGB output size, threshold-tighten
    alpha_in = img.split()[-1]
    alpha_up = alpha_in.resize(rgb_4x.size, Image.LANCZOS)
    arr = np.array(alpha_up).astype(np.float32)
    # Tighten halo: clip(<30 → 0, >60 → 255)
    norm = np.clip((arr - 30) / 30.0, 0, 1)
    tight = (norm * 255).astype(np.uint8)
    alpha_tight = Image.fromarray(tight, 'L').filter(ImageFilter.GaussianBlur(radius=1.0))

    rgba = Image.merge('RGBA', (*rgb_4x.split(), alpha_tight))
    rgba.save(dst, 'PNG')
    print(f'[esrgan] merged RGBA: {rgba.size} → {dst.name} ({dst.stat().st_size//1024}KB)')
    return dst


def measure_halo(src: Path) -> dict:
    arr = np.array(Image.open(src).convert('RGBA'))
    a = arr[:, :, 3]
    semi = ((a > 0) & (a < 50)).sum()
    opaque = (a >= 50).sum()
    if opaque == 0:
        return {'semi': int(semi), 'opaque': 0, 'avg_fringe_px': None}
    import math
    avg = semi / max(1.0, math.sqrt(opaque))
    return {'semi': int(semi), 'opaque': int(opaque), 'avg_fringe_px': round(avg, 2)}


def downsample_to_4096(src: Path, dst: Path) -> Path:
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    if W == 4096 and H == 4096:
        shutil.copy2(src, dst)
        return dst
    target = (4096, 4096)
    out = img.resize(target, Image.LANCZOS)
    out.save(dst, 'PNG')
    print(f'[downsample] ({W},{H}) -> {target} -> {dst.name}')
    return dst


def make_compare_grid(out_path: Path) -> Path:
    """3-up grid: canonical-v2 | sprint14a-painted | sprint16a-LoRA."""
    canonical = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
    sprint14a = ROOT / 'public/assets/case-study/cosmo-rerender-v14a/after-sprint14a-final.png'
    sprint16a = HERO_OUT

    panel_size = 1024
    panels = []
    for label, path in [
        ('canonical-v2 (Sprint 6A)', canonical),
        ('Sprint 14A (PIL paint)', sprint14a),
        ('Sprint 16A (LoRA)', sprint16a),
    ]:
        if not path.exists():
            continue
        img = Image.open(path).convert('RGBA')
        # Composite onto soft cream bg for visual clarity
        bg = Image.new('RGBA', img.size, (245, 240, 225, 255))
        bg.paste(img, (0, 0), img)
        bg_thumb = bg.resize((panel_size, panel_size), Image.LANCZOS)
        panels.append((label, bg_thumb))

    if not panels:
        return out_path
    grid_w = panel_size * len(panels)
    grid_h = panel_size + 60
    grid = Image.new('RGBA', (grid_w, grid_h), (245, 240, 225, 255))
    draw = ImageDraw.Draw(grid)
    for i, (label, panel) in enumerate(panels):
        grid.paste(panel, (i * panel_size, 60))
        draw.text((i * panel_size + 20, 20), label, fill=(40, 40, 40))
    grid.save(out_path, 'PNG')
    print(f'[compare-grid] {out_path}')
    return out_path


def main() -> int:
    if not WINNER_SRC.exists():
        print(f'[FAIL] winner missing: {WINNER_SRC}')
        return 2

    # Stage 1+2 are now produced by p4b/p4c (BiRefNet HEAVY + smart tail-erase)
    # Use v3 (two-region erase) for the cleanest tail removal:
    erased = RAW_DIR / f'{WINNER_LABEL}-tail-erased-v3.png'
    if not erased.exists():
        print(f'[FAIL] missing {erased}. Run p4c_smart_tail_erase.py first')
        return 3
    print(f'=== Using {erased.name} (BiRefNet HEAVY + smart 2-region tail-erase) ===')

    # Stage 3: ESRGAN 4× preserving alpha
    print('=== Stage 3: ESRGAN 4× preserving alpha ===')
    esrgan_out = RAW_DIR / f'{WINNER_LABEL}-esrgan-4x.png'
    upscaled = esrgan_4x_preserving_alpha(erased, esrgan_out)
    if upscaled is None:
        print('[FAIL] ESRGAN — falling back to PIL Lanczos 4x')
        img = Image.open(erased).convert('RGBA')
        img = img.resize((img.size[0] * 4, img.size[1] * 4), Image.LANCZOS)
        img.save(esrgan_out, 'PNG')
        upscaled = esrgan_out

    # Stage 4: downsample to 4096²
    print('=== Stage 4: downsample to 4096² ===')
    downsample_to_4096(upscaled, HERO_OUT)

    # Stage 5: halo measure + compare grid
    halo = measure_halo(HERO_OUT)
    print(f'[halo] {halo}')
    log_attempt('finalize.jsonl', {'phase': 'final', 'halo': halo})

    compare = CASE_DIR / 'compare-canonical-v14a-v16a.png'
    make_compare_grid(compare)

    # Copy a03 1536 source + tail-erased + final into case-study trail
    shutil.copy2(WINNER_SRC, CASE_DIR / f'winner-{WINNER_LABEL}-1536.png')
    heavy_bg = RAW_DIR / f'{WINNER_LABEL}-heavy-bg.png'
    if heavy_bg.exists():
        shutil.copy2(heavy_bg, CASE_DIR / f'winner-{WINNER_LABEL}-bg-removed-heavy.png')
    shutil.copy2(erased, CASE_DIR / f'winner-{WINNER_LABEL}-tail-erased.png')
    shutil.copy2(HERO_OUT, CASE_DIR / 'cosmo-hero-lora-4096.png')

    print('=' * 70)
    print(f'[DONE] cosmo-hero-lora.png = {HERO_OUT.stat().st_size//1024}KB')
    print(f'        case-study: {CASE_DIR}')
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
