"""
Sprint 16A — Phase 4b: Refine background removal.

Initial p4 BiRefNet kept the peach moon halo as part of subject. Need
character-only mask. Strategies in order:

1. BiRefNet HEAVY model at 2048² resolution (most accurate).
2. If still keeps halo → chroma-key fallback (mask peach pixels outside body
   silhouette by color distance + connected-component largest-blob = body).
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
RAW_DIR = ROOT / 'scripts/sprint16a/raw'
WINNER_SRC = ATTEMPTS_DIR / f'{WINNER_LABEL}.png'


def birefnet_heavy(src: Path, dst: Path) -> Path | None:
    print(f'[birefnet-heavy] uploading {src.name}')
    image_url = upload_to_fal_storage(src)
    body = {
        'image_url': image_url,
        'model': 'General Use (Heavy)',
        'operating_resolution': '2048x2048',
        'refine_foreground': True,
    }
    req_id, resp_url = submit('fal-ai/birefnet', body)
    payload = poll_until_done(resp_url, 'birefnet-heavy', max_polls=240, sleep_s=2.0)
    url = extract_image_url(payload)
    if not url and payload:
        for k in ('image', 'output', 'result'):
            if k in payload:
                v = payload[k]
                if isinstance(v, dict):
                    url = v.get('url')
                elif isinstance(v, str):
                    url = v
                if url:
                    break
    if not url:
        print(f'[FAIL] birefnet-heavy payload: {payload}')
        return None
    n = http_download(url, dst)
    print(f'[birefnet-heavy] {n//1024}KB → {dst.name}')
    return dst


def chroma_remove_peach(src: Path, dst: Path) -> Path:
    """Chroma-key removal of peach moon halo while preserving green body
    + black eyes/discs/antenna-bulb.

    Approach:
      1. Convert to RGB
      2. Compute "is_peach" mask: R > G+15, G > B-10, R > 180
      3. Compute "is_body" mask via flood-fill / connected-components from
         center using "is_green-or-black": dilated.
      4. Erase pixels where is_peach AND NOT is_body.
    """
    img = Image.open(src).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int32)
    a = arr[..., 3]

    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    # Peach detector: warm pinkish — high R, mid G, lower B, avoid pure white
    is_peach = (
        (R > 195) & (R < 252) &
        (G > 165) & (G < 230) &
        (B > 165) & (B < 220) &
        (R > G - 5) & (R > B - 5) &
        (G > B - 30) & (G < R + 30) &
        ~((R > 240) & (G > 240) & (B > 240))  # not white
    )

    # Body detector: green watercolor (high G relative to R and B)
    is_green = (G > R + 5) & (G > B + 5) & (G > 90)
    # Black-ish (eyes, antenna-tip darker, discs): low everything
    is_dark = (R < 90) & (G < 90) & (B < 90) & (a > 100)
    # Faded-rose spots ON BODY: pinkish but smaller, surrounded by green
    # (handled by spatial intersection w/ body silhouette)

    is_body_seed = is_green | is_dark

    # Connected-components: keep only the LARGEST body blob to filter floating
    # discs/antenna into a single tight body+features mask.
    # We use scipy if available, else fall back to flood-fill from center.
    try:
        from scipy import ndimage
        labeled, n_lbl = ndimage.label(is_body_seed)
        if n_lbl == 0:
            body_mask = np.zeros_like(is_body_seed)
        else:
            sizes = ndimage.sum(is_body_seed, labeled, index=range(1, n_lbl + 1))
            # Keep all blobs > 0.5% of image area (catches body + discs + antenna)
            min_size = int(0.005 * h * w)
            keep_lbls = [i + 1 for i, s in enumerate(sizes) if s >= min_size]
            body_mask = np.isin(labeled, keep_lbls)
    except ImportError:
        body_mask = is_body_seed

    # Dilate body_mask slightly to cover anti-aliased body edges
    try:
        from scipy import ndimage
        body_mask = ndimage.binary_dilation(body_mask, iterations=8)
    except Exception:
        pass

    # Build final alpha: keep where (originally opaque) AND (not (peach AND not body))
    # i.e. erase only peach-outside-body
    erase_mask = is_peach & ~body_mask
    new_a = a.copy()
    new_a[erase_mask] = 0

    # Smooth halo edge: feather the erase boundary
    erase_img = Image.fromarray((erase_mask * 255).astype(np.uint8), 'L')
    erase_blur = erase_img.filter(ImageFilter.GaussianBlur(radius=2.5))
    erase_arr = np.array(erase_blur).astype(np.float32) / 255.0
    new_a = (new_a.astype(np.float32) * (1.0 - erase_arr)).astype(np.uint8)

    out = arr.copy()
    out[..., 3] = new_a
    Image.fromarray(out).save(dst, 'PNG')

    # Stats
    eraser_count = int(erase_mask.sum())
    body_count = int(body_mask.sum())
    print(f'[chroma] erase_pixels={eraser_count} body_pixels={body_count} → {dst.name}')
    return dst


def alpha_erase_tail_a03(src: Path, dst: Path) -> Path:
    """Tail erase polygon for a03 — tail-CURL ONLY, calibrated from alpha
    inspection on a03-heavy-bg.png.

    Empirical tail bounds (1536² coords):
      - tail body starts at x≈420 (visible from y=1180)
      - extends down-left to x≈176 at y=1260
      - returns to x≈440 at y=1300 (foot starts)
    Polygon must ONLY cover the curl, not body, not left foot.
    """
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    arr = np.array(img)

    erase = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(erase)
    sx = W / 1536.0
    sy = H / 1536.0
    # Tight polygon around curl + stub. body-edge is at x=475+ at y=1080,
    # so we stop x at 470 to be safe.
    poly = [
        (int(160 * sx), int(1145 * sy)),
        (int(470 * sx), int(1145 * sy)),
        (int(470 * sx), int(1295 * sy)),
        (int(380 * sx), int(1315 * sy)),
        (int(170 * sx), int(1290 * sy)),
    ]
    d.polygon(poly, fill=255)
    feather = max(3, int(6 * sx))
    erase = erase.filter(ImageFilter.GaussianBlur(radius=feather))
    erase_arr = np.array(erase).astype(np.float32) / 255.0
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * (1.0 - erase_arr)).astype(np.uint8)
    Image.fromarray(arr).save(dst, 'PNG')
    print(f'[tail-erase-LEFT] poly={poly} → {dst.name}')
    return dst


def main() -> int:
    # Step 1: BiRefNet HEAVY
    heavy = RAW_DIR / f'{WINNER_LABEL}-heavy-bg.png'
    if not heavy.exists() or heavy.stat().st_size < 50_000:
        result = birefnet_heavy(WINNER_SRC, heavy)
        if result is None:
            print('[FAIL] birefnet-heavy failed')
            return 2

    # Step 2: chroma-key cleanup pass on top of BiRefNet output
    chroma = RAW_DIR / f'{WINNER_LABEL}-chroma.png'
    chroma_remove_peach(heavy, chroma)

    # Step 3: tail-erase with corrected LEFT polygon
    erased = RAW_DIR / f'{WINNER_LABEL}-tail-erased-v2.png'
    alpha_erase_tail_a03(chroma, erased)

    print(f'[DONE] erased: {erased}')
    print(f'  next: ESRGAN 4x → final')
    return 0


if __name__ == '__main__':
    sys.exit(main())
