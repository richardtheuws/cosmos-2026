"""Build a 4×2 reference grid of the 8 final weirdo objects for case-study."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
OBJ_DIR = ROOT / 'public/assets/objects'
CASE_DIR = ROOT / 'public/assets/case-study/objects-v15c'

# 8 objects with display names
ITEMS = [
    ('organic-flesh-trampoline.png', 'organic-flesh-trampoline'),
    ('eyeball-sentry.png', 'eyeball-sentry'),
    ('mouth-pillar-sheet.png', 'mouth-pillar (sheet)'),
    ('melting-clock-bubble.png', 'melting-clock-bubble'),
    ('secret-crystal.png', 'secret-crystal'),
    ('floating-star.png', 'floating-star'),
    ('upside-down-tree.png', 'upside-down-tree'),
    ('breathing-portal.png', 'breathing-portal'),
]

CELL = 320
PAD = 16
LABEL_H = 36
COLS = 4
ROWS = 2

W = COLS * (CELL + PAD) + PAD
H = ROWS * (CELL + PAD + LABEL_H) + PAD

grid = Image.new('RGB', (W, H), (28, 24, 32))
draw = ImageDraw.Draw(grid)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Helvetica.ttc', 14)
except Exception:
    font = ImageFont.load_default()

for i, (filename, label) in enumerate(ITEMS):
    src = OBJ_DIR / filename
    if not src.exists():
        continue
    img = Image.open(src).convert('RGBA')
    # Fit to CELL preserving aspect
    img.thumbnail((CELL, CELL), Image.LANCZOS)
    cw, ch = img.size
    col = i % COLS
    row = i // COLS
    cell_x = PAD + col * (CELL + PAD)
    cell_y = PAD + row * (CELL + PAD + LABEL_H)
    # Center the thumb in cell
    paste_x = cell_x + (CELL - cw) // 2
    paste_y = cell_y + (CELL - ch) // 2
    grid.paste(img, (paste_x, paste_y), img if img.mode == 'RGBA' else None)
    # Label below
    draw.text((cell_x + 4, cell_y + CELL + 8), label, fill=(220, 200, 180), font=font)

out = CASE_DIR / 'reference-grid-v15c.png'
grid.save(out, 'PNG', optimize=True)
print(f'[GRID] {out} {out.stat().st_size} bytes')
