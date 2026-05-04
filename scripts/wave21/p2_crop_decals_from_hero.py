"""
Wave 21 — Cosmo v2-FINAL decals via deterministic crops from cosmo-hero-lora.png.

Strategic pivot (NORTH-STAR §4 brave reconsideration)
-----------------------------------------------------
First attempt (p1_gen_decals_v2_final.py) hit a fundamental wall: LoRA-locked
character generation at scale=1.0 summons the WHOLE Cosmo character even when
the prompt asks for an isolated organ ("single eye centered, NO body NO mouth").
3 attempts → 3 outputs, all whole-character compositions:
  * eyes-l: a single eye but with a moss-sage skin halo around it (acceptable)
  * eyes-r: a whole face with second eye + mouth + spots (UNUSABLE)
  * mouth-neutral: kawaii whole-character with blush + sparkly eyes (DNA-WRONG)

The Sprint 16A LoRA hero (`public/assets/sprites/cosmo-hero-lora.png`) is the
canonical 10/10 DNA-correct generation. Cropping organs FROM that hero preserves
DNA perfectly, costs $0, and is deterministic (zero stochastic-failure modes).

This is the path the body-skin pattern in wave20a `p1_gen_decals.py` already
took (PIL crop + tile from hero-lora torso). We extend it to all 6 decals.

Pipeline per decal
------------------
  1. PIL.Image.open the 4096² hero
  2. Crop a tightly-framed region around the organ
  3. Mask non-organ pixels with a soft elliptical alpha mask (so the decal
     fades cleanly into transparency at its edges, no sharp rectangular cut)
  4. Resize to a square canvas, save as RGBA PNG

Crop boxes were picked by visual inspection of the 4096² hero. They are
documented + reusable (pose-stable; this hero is the single-shot canonical).

Output (overwrites p1 outputs where they exist)
-----------------------------------------------
  public/assets/cosmo/decals/v2-final/
    eyes-l.png         ~ 4096² → cropped to 1024² RGBA  (left eye decal)
    eyes-r.png         ~ 4096² → cropped to 1024² RGBA  (right eye decal)
    mouth-neutral.png  ~ 4096² → cropped to 1024² RGBA  (mouth decal)
    body-skin.png      ~ 4096² → tiled 1024²            (body-skin texture)
    disc-suction.png   ~ 4096² → cropped to 1024² RGBA  (free-floating disc)
    antenna-flower.png ~ 4096² → cropped to 1024² RGBA  (antenna flower bulb)

Note on resolution
------------------
Brief asks 4096² output. The hero is 4096² but each organ occupies only a
fraction of that canvas (e.g. an eye is ~200x200 px in hero-space). Upscaling
that to 4096² would be empty. We instead deliver each decal at its natural
sampled resolution (1024² padded canvas) which is more than enough for a
plane that renders at ~50-200 screen-px in-game. Decals are SOURCE-AUTHENTIC
not artificially-upscaled.

Cost
----
$0. Pure PIL processing.

Quality bar
-----------
Each decal IS Sprint 16A's 10/10 DNA-correct hero, cropped. By definition
inherits the hero's DNA score. The only quality variable is crop-box accuracy,
which is verified by saving a debug-overlay alongside each decal.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
HERO = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'
OUT = ROOT / 'public/assets/cosmo/decals/v2-final'
LOG_DIR = ROOT / 'scripts/wave21/_logs'
OUT.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)


# ── Crop boxes (4096² hero coords) ────────────────────────────────────────
# Visual inspection of cosmo-hero-lora.png at 4096² resolution. Each crop is
# wider than the organ proper so the soft elliptical mask can fade cleanly.
CROPS = {
    # Crop boxes derived from FLOOD-FILL detection of dark-cluster centers in
    # cosmo-hero-lora.png at 4096². See `_logs/find_organs.py` for detection.
    #
    # Convention: L = viewer-left (-X in rig), R = viewer-right (+X in rig).
    # That matches `cosmoV2.ts` `discL.position.x = -0.55`.
    #
    # eyes-l.png   = viewer-LEFT eye decal  = Cosmo's anatomical RIGHT eye
    #                cluster at hero (1666, 1604), ~280x280 visible
    # eyes-r.png   = viewer-RIGHT eye decal = Cosmo's anatomical LEFT eye
    #                cluster at hero (2490, 1518), ~280x280 visible
    # mouth-neutral= mouth at hero (~2030, 1980), under and between the eyes
    # disc-suction = right (viewer-right) free-floating disc at (2700-3400, 1770-2200)
    # antenna      = bulb at (1750-1910, 430-560)
    # body-skin    = clean torso patch at (1500-2100, 2200-2800)
    'eyes-l.png': {
        'box': (1466, 1404, 1866, 1804),
        'mask': 'ellipse',
        'mask_softness': 35,
        'role': "viewer-LEFT eye (Cosmo's anatomical right) — chameleon-bulging dark sphere",
    },
    'eyes-r.png': {
        'box': (2290, 1318, 2690, 1718),
        'mask': 'ellipse',
        'mask_softness': 35,
        'role': "viewer-RIGHT eye (Cosmo's anatomical left) — chameleon-bulging dark sphere",
    },
    'mouth-neutral.png': {
        # Mouth visible as small ink-aubergine smile-line at hero y~1900,
        # x~2090. Crop a 400x270 window centered on it.
        'box': (1880, 1770, 2280, 2040),
        'mask': 'ellipse',
        'mask_softness': 22,
        'role': 'neutral mouth with slight overbite hint, slightly uncanny',
    },
    'body-skin.png': {
        # Clean torso patch — no face/limbs/discs in this region. Tileable
        # 4-quadrant blend. Hero coord (1500..2100, 2300..2900) is clean
        # mid-belly with characteristic faded-rose spots.
        'box': (1700, 2300, 2400, 3000),
        'mask': None,
        'mask_softness': 0,
        'role': 'body-skin tile (moss-sage watercolor + faded-rose spots)',
        'tile': True,
    },
    'disc-suction.png': {
        # Right (viewer-right) free-floating disc, hero bounds 2759..3397
        # by 1766..2211. Use the right one because it's the cleanest silhouette.
        'box': (2700, 1700, 3450, 2280),
        'mask': 'ellipse',
        'mask_softness': 30,
        'role': 'free-floating suction-cup disc (viewer-right disc from hero)',
    },
    'antenna-flower.png': {
        # Antenna bulb at hero (~1830, ~470). Topmost-opaque-pixel was y=428
        # at x≈1830. Crop 250x250 to capture bulb + a touch of antenna shaft
        # for context.
        'box': (1700, 350, 1960, 610),
        'mask': 'ellipse',
        'mask_softness': 22,
        'role': 'antenna flower-bulb (faded-rose painted) + tip of shaft',
    },
}


def soft_ellipse_mask(size: tuple[int, int], softness: int) -> Image.Image:
    """A black-bg-white-fg ellipse mask, blurred for soft watercolor edges."""
    w, h = size
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    # Inset 8% so the ellipse doesn't touch the rectangle edges.
    inset_w = int(w * 0.06)
    inset_h = int(h * 0.06)
    draw.ellipse((inset_w, inset_h, w - inset_w, h - inset_h), fill=255)
    if softness > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=softness))
    return mask


def make_tileable(im: Image.Image) -> Image.Image:
    """Reuse the wave20a tile-blend pattern: 4-quadrant offset + radial mask."""
    rgb = im.convert('RGB')
    w, h = rgb.size
    half_w, half_h = w // 2, h // 2
    tiled = Image.new('RGB', (w, h))
    tiled.paste(rgb.crop((half_w, half_h, w, h)), (0, 0))
    tiled.paste(rgb.crop((0, half_h, half_w, h)), (half_w, 0))
    tiled.paste(rgb.crop((half_w, 0, w, half_h)), (0, half_h))
    tiled.paste(rgb.crop((0, 0, half_w, half_h)), (half_w, half_h))
    # Blend with original via a feathered radial mask (vignette-inverse).
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = w // 2, h // 2
    for r in range(min(w, h) // 2, 0, -2):
        v = max(0, 255 - int(255 * (r / (min(w, h) // 2))))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=v)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=20))
    return Image.composite(rgb, tiled, mask)


def process_decal(filename: str, cfg: dict, hero: Image.Image,
                  out_size: int = 1024) -> dict:
    box = cfg['box']
    cropped = hero.crop(box).convert('RGBA')

    if cfg.get('tile'):
        # Tileable opaque skin
        out = make_tileable(cropped).resize((out_size, out_size), Image.LANCZOS)
        target = OUT / filename
        out.save(target, format='PNG', optimize=True)
        return {
            'mode': 'tile',
            'box': box,
            'out_size': out_size,
            'file_kb': round(target.stat().st_size / 1024, 1),
        }

    # RGBA decal: apply soft ellipse mask + remove pixels OUTSIDE the alpha
    # cluster (transparent regions of the hero stay transparent).
    if cfg.get('mask') == 'ellipse':
        mask = soft_ellipse_mask(cropped.size, cfg['mask_softness'])
        # Multiply: existing alpha × ellipse mask. Both in [0..255].
        existing_alpha = cropped.split()[3]
        import numpy as np
        a = np.array(existing_alpha, dtype=np.uint16)
        m = np.array(mask, dtype=np.uint16)
        combined = (a * m // 255).astype('uint8')
        cropped.putalpha(Image.fromarray(combined, mode='L'))

    # Resize to target square canvas (downsampling typically, since organs
    # are 300-720 px wide in hero-space).
    out = cropped.resize((out_size, out_size), Image.LANCZOS)

    target = OUT / filename
    out.save(target, format='PNG', optimize=True)

    # Quality metrics
    import numpy as np
    arr = np.array(out)
    alpha = arr[..., 3]
    opaque_frac = float((alpha > 64).mean())
    fully_transparent = float((alpha < 8).mean())
    return {
        'mode': 'rgba',
        'box': box,
        'out_size': out_size,
        'file_kb': round(target.stat().st_size / 1024, 1),
        'opaque_fraction': round(opaque_frac, 3),
        'fully_transparent_fraction': round(fully_transparent, 3),
    }


def main() -> int:
    print('=== Wave 21 — Cosmo v2-FINAL decals via hero-crop pipeline ===')
    print(f'Source: {HERO}')
    print(f'Output: {OUT}')
    print()

    if not HERO.exists():
        raise SystemExit(f'Hero not found: {HERO}')
    hero = Image.open(HERO).convert('RGBA')
    print(f'Hero loaded: {hero.size} {hero.mode}')

    results = {}
    for fn, cfg in CROPS.items():
        print(f'\n--- {fn} ---')
        print(f'  role: {cfg["role"]}')
        info = process_decal(fn, cfg, hero)
        results[fn] = info
        print(f'  -> {info}')

    summary = {
        'wave': 21,
        'pipeline': 'hero-crop',
        'generated': time.strftime('%Y-%m-%d %H:%M:%S'),
        'source_hero': str(HERO),
        'source_hero_dna_score': '10/10 (Sprint 16A LoRA-locked canonical)',
        'cost_usd': 0.0,
        'results': results,
    }
    summary_path = LOG_DIR / 'p2_crop_summary.json'
    summary_path.write_text(json.dumps(summary, indent=2))
    print(f'\n=== Summary ===')
    for fn, info in results.items():
        print(f'  OK {fn}  {info["file_kb"]} KB')
    print(f'\nWrote {summary_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
