"""
Sprint 13D — Phase 7c: FINAL slow-bloom figure erase.

Inspection of crop at /tmp/slowbloom-figs.png revealed:
  - Two human figures: man (right, blue jacket) at ~x=1530-1620, woman
    (left, brown) at ~x=1480-1545. Both y=1140-1310.
  - Plus a leftover "smudge" from p7b at x=1330-1480 visible as a gray
    vertical streak.

Strategy: clone-stamp from a clean grass-and-dawn-light area to the
RIGHT of the figures (around x=1750-2000 looks like clean grass + light)
and feather across.
"""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SRC = ROOT / 'public/assets/backgrounds/biome-slow-bloom-4k.png'

im = Image.open(SRC).convert('RGB')
arr = np.array(im).astype(np.float32)
h, w, _ = arr.shape
print(f'image: {w}×{h}')

# Final erase region: covers BOTH the smudge AND the figures
x1, y1 = 1300, 1080
x2, y2 = 1660, 1340  # extends past the rightmost figure boundary
target_w = x2 - x1
target_h = y2 - y1

# Patch source: a clean band of dawn-lit grass to the right (x=1700-2050)
# Same y range to match the perspective height of the path
patch_x_start = 1700
patch_x_end = patch_x_start + target_w
patch = arr[y1:y2, patch_x_start:patch_x_end].copy()
print(f'patch: ({target_h},{target_w}), source x={patch_x_start}-{patch_x_end}')

# Soft 50px feather to blend seamlessly with the surrounding grass texture
feather = 50
mask = np.ones((target_h, target_w), dtype=np.float32)
for i in range(feather):
    f = (i + 1) / feather
    if i < target_h:
        mask[i, :] *= f
        mask[-1 - i, :] *= f
    if i < target_w:
        mask[:, i] *= f
        mask[:, -1 - i] *= f

orig = arr[y1:y2, x1:x2].copy()
mask3 = mask[..., None]
blended = mask3 * patch + (1 - mask3) * orig
arr[y1:y2, x1:x2] = blended

out = Image.fromarray(arr.astype(np.uint8))
out.save(SRC, optimize=True)
print(f'[OK] slow-bloom final erase: bbox ({x1},{y1})-({x2},{y2})')
print(f'final size: {SRC.stat().st_size} bytes')
