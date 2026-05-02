"""
Sprint 16A — Phase 4c: Smart tail-erase via connected-components.

The previous polygon-based erase left a tail-base nub at y=1080-1130 because
the polygon stopped at y=1145. Extending up clips body — body curve at
y=1090-1130 reaches as far left as x=474.

Smarter approach:
  1. Take a03-heavy-bg.png (BiRefNet HEAVY output, halo removed)
  2. Build a mask of "anything to the LEFT of the body's center-of-mass at
     a given y, beneath y=1000, that is part of a thin curl protrusion".
  3. Use connected components: the curly tail at y=1160-1290 is x=176-460,
     while body torso left-edge is x=460-490 — they connect via the tail-base.
  4. Detect the tail by: from y=1290 upward, find leftmost-pixel and trace
     the tail polygon along that contour up to the body junction (~y=1080)
     where the tail-WIDTH narrows to body-flank-thickness.
  5. Erase that traced region.

Simpler practical pipeline:
  - Mask = polygon(LEFT-side-of-body x < body_main_center_minus_radius, y > torso-low)
  - Body main center: ~x=775 (1536²), y=950
  - Body radius below torso: ~280
  - So anything to the left of x=775-280=495 BELOW y=1080 is tail or leg.
  - But left-leg sits at x=560-650 mostly. We need y > 1320 for foot-zone (keep!).
  - Therefore: erase anything left of x=470, y in [1050, 1300] (NOT in [1300+], that's foot).

Let me directly erase based on alpha-blob analysis: any opaque pixels in
zone (x < 470 AND y in [1050, 1300]) — but with smooth feather and a
body-edge-aware trim that respects the body's left flank.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from _lib import ROOT

RAW_DIR = ROOT / 'scripts/sprint16a/raw'
SOURCE = RAW_DIR / 'a03-heavy-bg.png'
OUTPUT = RAW_DIR / 'a03-tail-erased-v3.png'


def smart_tail_erase() -> Path:
    img = Image.open(SOURCE).convert('RGBA')
    W, H = img.size
    arr = np.array(img)
    a = arr[:, :, 3]

    # === Pass 1: erase the curl + stub — anything LEFT of body-flank ====
    # Body left-flank curves from x=490@y=1080 to x=439@y=1190 then back to
    # x=441@y=1310 (foot). We define the erase boundary as:
    #   y < 1080: NO ERASE (head/torso)
    #   y in [1080, 1290]: erase x < (body_left_flank - 5px guard)
    #   y > 1290: NO ERASE (left foot starts)
    sx = W / 1536.0
    sy = H / 1536.0

    # === Two-region erase ===
    # Region A: y=1050..1180 — UPPER tail-base — erase up to body-flank-curve
    #           (bounded by body-left-edge so we don't clip torso).
    # Region B: y=1180..1305 — LOWER tail-curl — erase a wider polygon
    #           (the curl extends beyond body x-range).
    flank_pts = [
        (1050, 510), (1080, 495), (1100, 485), (1120, 475),
        (1140, 470), (1160, 460), (1180, 450),
    ]
    flank_y = np.array([int(p[0] * sy) for p in flank_pts])
    flank_x = np.array([int(p[1] * sx) for p in flank_pts])
    erase = np.zeros_like(a, dtype=np.float32)

    # Region A: trim by interpolated flank curve
    for y in range(flank_y.min(), flank_y.max() + 1):
        x_cut = int(np.interp(y, flank_y, flank_x))
        erase[y, :x_cut] = 1.0

    # Region B: rectangle covering lower curl up to x=470 — body left foot
    # only starts at x=441 at y=1310, so x=470 cap is OK for y=1180..1300
    # (the foot starts further down at y=1310+).
    yB_start = int(1180 * sy)
    yB_end = int(1300 * sy)
    xB_end = int(470 * sx)
    erase[yB_start:yB_end, :xB_end] = 1.0

    # Region C: tighter for y=1300-1310 — only erase x < 410 to preserve foot
    yC_start = int(1300 * sy)
    yC_end = int(1320 * sy)
    xC_end = int(410 * sx)
    erase[yC_start:yC_end, :xC_end] = 1.0

    # Soft feather edges
    erase_img = Image.fromarray((erase * 255).astype(np.uint8), mode='L')
    erase_blur = erase_img.filter(ImageFilter.GaussianBlur(radius=int(6 * sx)))
    erase_arr = np.array(erase_blur).astype(np.float32) / 255.0

    new_a = (a.astype(np.float32) * (1.0 - erase_arr)).astype(np.uint8)
    out = arr.copy()
    out[:, :, 3] = new_a
    Image.fromarray(out).save(OUTPUT, 'PNG')
    erased_count = int((erase_arr > 0.5).sum())
    print(f'[smart-tail-erase] erased {erased_count} pixels; flank pts={len(flank_pts)}')
    print(f'                  → {OUTPUT}')
    return OUTPUT


if __name__ == '__main__':
    smart_tail_erase()
