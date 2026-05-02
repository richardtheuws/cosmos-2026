"""Sprint 17A p8 — make a 4-up collage of the cleaned poses for the case-study."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SPRITES = ROOT / 'public/assets/sprites'
OUT = ROOT / 'public/assets/case-study/cosmo-rig-v17a/poses-4up.png'

POSES = ['idle-breath', 'wave-uncanny', 'stretch', 'sit-sniff']


def main():
    tile = 1024
    pad = 24
    W = tile * 2 + pad * 3
    H = tile * 2 + pad * 3 + 60
    canvas = Image.new('RGB', (W, H), (244, 240, 230))  # mushroom-cream backdrop

    for i, name in enumerate(POSES):
        path = SPRITES / f'cosmo-pose-{name}.png'
        if not path.exists():
            print(f'[skip] {path}')
            continue
        img = Image.open(path).convert('RGBA')
        img.thumbnail((tile, tile), Image.LANCZOS)
        # composite onto cream
        bg = Image.new('RGBA', (tile, tile), (244, 240, 230, 255))
        x = (tile - img.width) // 2
        y = (tile - img.height) // 2
        bg.paste(img, (x, y), img)
        col = i % 2
        row = i // 2
        ox = pad + col * (tile + pad)
        oy = pad + row * (tile + pad)
        canvas.paste(bg.convert('RGB'), (ox, oy))
        # label
        draw = ImageDraw.Draw(canvas)
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 28)
        except Exception:
            font = ImageFont.load_default()
        draw.text((ox + 12, oy + tile - 40), name, fill=(60, 50, 40), font=font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, 'PNG')
    print(f'Wrote {OUT} ({OUT.stat().st_size//1024} KB)')


if __name__ == '__main__':
    main()
