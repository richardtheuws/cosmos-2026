"""
Sprint 13D — Phase 7b: Precise figure-removal on slow-bloom-4k.

The earlier alpha-erase missed because the bbox was wrong (centered at y=80%
but figures are at y=70-85%). Dark-pixel scan confirmed figures at:
  absx range 1365-1450 (relx 0.50 +/- 4%)
  absy range estimated 1075-1290 (relx 0.70-0.84)

Strategy:
  - Take patch from x=600-800 (similar grass/path area, no figures, clean)
  - Stretch/tile it across the figure bbox
  - Soft 30px feather to avoid hard edges
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SRC = ROOT / 'public/assets/backgrounds/biome-slow-bloom-4k.png'

im = Image.open(SRC).convert('RGB')
arr = np.array(im).astype(np.float32)
h, w, _ = arr.shape
print(f'image: {w}×{h}')

# Figure bbox (precise from dark-pixel scan)
x1, y1 = 1330, 1050
x2, y2 = 1480, 1290

# Take patch from a clean path/grass area to the LEFT (where there's just empty grass)
# The path stretches from ~y=1100 to y=1500, and is empty from ~x=900-1300
patch_x = 850
patch_y_start = y1
patch_y_end = y2
patch_w = (x2 - x1)
patch = arr[patch_y_start:patch_y_end, patch_x:patch_x + patch_w].copy()
print(f'patch shape: {patch.shape}, target shape: ({y2-y1}, {x2-x1})')

# Build feathered mask (30px feather)
feather = 30
mask = np.ones((y2 - y1, x2 - x1), dtype=np.float32)
for i in range(feather):
    f = (i + 1) / feather
    mask[i, :] *= f
    mask[-1 - i, :] *= f
    mask[:, i] *= f
    mask[:, -1 - i] *= f

# Apply with feathered blend
orig = arr[y1:y2, x1:x2].copy()
mask3 = mask[..., None]
blended = mask3 * patch + (1 - mask3) * orig
arr[y1:y2, x1:x2] = blended

out = Image.fromarray(arr.astype(np.uint8))
out.save(SRC, optimize=True)
print(f'[OK] slow-bloom precise erase: bbox ({x1},{y1})-({x2},{y2}) patch from x={patch_x}')
print(f'final size: {SRC.stat().st_size} bytes')
