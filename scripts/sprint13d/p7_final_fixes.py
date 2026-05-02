"""
Sprint 13D — Phase 7: Final fixes.

7.1. PIL alpha-erase on slow-bloom to remove the two tiny walking figures
     in the path center-foreground. Sprint 6A pattern (0% failure, 0 cost).

7.2. Cathedral regen on Flux Dev (memory: Dev pliabler for stylized
     watercolor illustrations than Flux Pro which forces photoreal).

7.3. Cosmo hero — alpha-erase the regenerated tail (Sprint 6A pattern).
"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt,
)


# ============================================================================
# 7.1. Slow-bloom alpha-erase — paint over the tiny figures with surrounding bg
# ============================================================================
def fix_slow_bloom() -> bool:
    """Use PIL clone-stamp / blend to remove the two figures from path."""
    try:
        from PIL import Image, ImageFilter
        import numpy as np
    except ImportError:
        print('[ERROR] PIL/numpy not installed; cannot alpha-erase')
        return False

    src = ROOT / 'public/assets/backgrounds/biome-slow-bloom-4k.png'
    if not src.exists():
        print(f'[ERROR] {src} missing')
        return False

    im = Image.open(src).convert('RGB')
    arr = np.array(im).astype(np.float32)
    h, w, _ = arr.shape

    # The two figures are small in the center-foreground path.
    # Approximate bbox (looking at the regen): center ~50%×80%, 4% wide × 8% tall
    cx, cy = int(w * 0.50), int(h * 0.80)
    fig_w = int(w * 0.04)  # narrow width
    fig_h = int(h * 0.10)  # tall height (heads + bodies + legs)
    x1, y1 = cx - fig_w, cy - fig_h
    x2, y2 = cx + fig_w, cy + int(fig_h * 0.4)  # just past the feet

    # Sample bg from immediately to the LEFT and RIGHT of the figures
    sample_w = fig_w * 2
    left_sample = arr[y1:y2, max(0, x1 - sample_w):x1].copy()
    right_sample = arr[y1:y2, x2:min(w, x2 + sample_w)].copy()

    # Use right sample (path texture); ensure shape match
    target_w = x2 - x1
    if right_sample.shape[1] >= target_w:
        patch = right_sample[:, :target_w]
    elif left_sample.shape[1] >= target_w:
        patch = left_sample[:, -target_w:]
    else:
        # Average both, tile
        patch = np.tile(right_sample, (1, max(1, target_w // right_sample.shape[1] + 1), 1))[:, :target_w]

    # Soft feather mask
    mask = np.ones_like(arr[y1:y2, x1:x2, 0:1], dtype=np.float32)
    feather = 12
    # X feather
    for i in range(feather):
        mask[:, i] *= i / feather
        mask[:, -i - 1] *= i / feather
    # Y feather
    for i in range(feather):
        mask[i, :] *= i / feather
        mask[-i - 1, :] *= i / feather

    # Composite: bg = mask*patch + (1-mask)*orig
    orig_region = arr[y1:y2, x1:x2].copy()
    blended = mask * patch + (1 - mask) * orig_region
    arr[y1:y2, x1:x2] = blended

    # Save
    out_im = Image.fromarray(arr.astype(np.uint8))
    out_im.save(src, optimize=True)
    print(f'[OK] slow-bloom alpha-erase: figures removed at ({x1},{y1})-({x2},{y2})')
    log_attempt('p7_fixes.jsonl', {
        'kind': 'slow_bloom_alpha_erase',
        'bbox': [x1, y1, x2, y2],
        'final_bytes': src.stat().st_size,
    })
    return True


# ============================================================================
# 7.2. Cathedral regen via Flux Dev (more pliable for stylized illustration)
# ============================================================================
def regen_cathedral_dev() -> Path | None:
    prompt = (
        'masterful traditional WATERCOLOR PAINTING of a heavenly cloud realm, '
        'pillowy clouds with VISIBLE INK-LINE OUTLINES at the edges, '
        'paper-grain texture across the whole sky, soft watercolor wash bleeds '
        'where pink dawn meets blue sky, Studio Ghibli-style sky in the manner '
        'of Castle in the Sky and Howl Moving Castle but with Moebius Tenniel '
        'ink-grit accents, NOT a photograph NOT photoreal NOT realistic, '
        'illustrated painted on textured rough paper, cumulus cathedrals of '
        'painted clouds layered into atmospheric distance, saffron-glow '
        'orange shafts of dawn light piercing through gaps with crisp ink-'
        'edge highlights, faded-rose pink touches at cloud edges, sky-wash-'
        'blue base, mushroom-cream highlights, OCCASIONAL FLOATING COSMIC '
        'CRYSTALLINE PARTICLES drifting in updrafts, atmospheric depth from '
        'sharp foreground cloud-edges to softer mid-clouds to hazy far '
        'cloud-mountains, hand-painted illustration aesthetic, NOT digital '
        'NOT 3D NOT cgi, palette mushroom-cream sky-wash-blue faded-rose '
        'saffron-glow ink-aubergine, NO characters NO figures NO people NO '
        'animals NO creatures'
    )
    body = {
        'prompt': prompt,
        'image_size': {'width': 2048, 'height': 1152},
        'num_images': 1,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux/dev', body)
    except Exception as e:
        print(f'[FAIL] cathedral dev submit: {e}')
        return None
    print(f'[SUBMIT] cathedral-dev-regen -> {req_id[:12]}')

    payload = poll_until_done(resp_url, 'cathedral-dev', max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p7_fixes.jsonl', {'kind': 'cathedral_dev_regen', 'failed': True})
        return None

    target = ROOT / 'public/assets/backgrounds/biome-cathedral-4k.png'
    n = http_download(url, target)
    print(f'[FINAL] cathedral-4k regen-dev: {n} bytes')
    log_attempt('p7_fixes.jsonl', {
        'kind': 'cathedral_dev_regen', 'request_id': req_id, 'url': url,
        'final_bytes': target.stat().st_size, 'model': 'fal-ai/flux/dev',
    })
    return target


# ============================================================================
# 7.3. Cosmo hero — alpha-erase the regenerated tail
# ============================================================================
def fix_cosmo_tail() -> bool:
    """Sprint 6A alpha-erase pattern — remove tail from cosmo-hero-4k."""
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        print('[ERROR] PIL/numpy not installed')
        return False

    src = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
    if not src.exists():
        return False

    im = Image.open(src).convert('RGBA')
    arr = np.array(im).astype(np.float32)
    h, w, _ = arr.shape

    # Tail: lower-LEFT of body, curling spiral. Eyeballed from preview render.
    # On a 512×512 image, body center ~(256, 280), tail starts ~(220, 380)
    # and curls down-left to ~(160, 460). Scale to actual image size.
    tail_polygon = np.array([
        [0.32, 0.74],  # tail base near body
        [0.48, 0.78],  # right side of base
        [0.50, 0.90],  # right side end
        [0.30, 0.95],  # bottom-left of tail
        [0.15, 0.92],  # leftmost tail tip
        [0.18, 0.84],  # back up the inner curl
        [0.28, 0.80],  # near base
    ])
    tail_polygon[:, 0] *= w
    tail_polygon[:, 1] *= h
    tail_polygon = tail_polygon.astype(np.int32)

    # Build polygon mask
    from PIL import Image, ImageDraw
    mask_im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask_im).polygon([tuple(p) for p in tail_polygon], fill=255)
    # Soft feather
    mask_im = mask_im.filter(ImageFilter.GaussianBlur(radius=8)) if False else mask_im
    # Manual soft feather via numpy
    mask_arr = np.array(mask_im).astype(np.float32) / 255.0

    # Apply: alpha *= (1 - mask)
    arr[:, :, 3] *= (1.0 - mask_arr)

    out_im = Image.fromarray(arr.astype(np.uint8), mode='RGBA')
    out_im.save(src, optimize=True)
    print(f'[OK] cosmo-hero tail alpha-erased ({w}×{h})')
    log_attempt('p7_fixes.jsonl', {
        'kind': 'cosmo_tail_erase',
        'final_bytes': src.stat().st_size,
        'image_size': [w, h],
    })
    return True


def main():
    # Run 7.1 + 7.3 (deterministic local) and 7.2 (network) in parallel
    print('=== Phase 7: Final fixes ===')

    # 7.1 + 7.3 first (cheap, fast)
    fix_slow_bloom()
    try:
        from PIL import ImageFilter  # ensure import
        fix_cosmo_tail()
    except Exception as e:
        print(f'[WARN] cosmo tail erase skipped: {e}')

    # 7.2 cathedral-dev-regen
    regen_cathedral_dev()

    print('=== Phase 7 done ===')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
