"""
Sprint 14A — Route B+ HYBRID: PIL-paint chameleon eye-spheres deterministically,
then optional small Flux Fill blend-pass to integrate the painted eyes into
watercolor texture.

Rationale:
  - Route A img2img (5 strengths) → all kawaii eyes preserved
  - Route B Flux Fill inpaint (3 prompts) → all kawaii eyes regenerated
  - Flux's training data is too biased toward "small alien + cute big eyes"
    to override via prompts alone

This route paints the eyes DIRECTLY:
  1. Erase the kawaii eye pixels (paint moss-sage skin over them)
  2. Draw two glossy black bulging spheres at correct anatomical position
  3. Add subtle saffron-glow catchlight crescents
  4. Add tiny ink-aubergine outline for stylistic match

Then optional small Flux Fill pass with VERY narrow mask only at the eye-edges
to blend the painted spheres into surrounding watercolor (mask just the outline,
not the iris). Keeps the painted black sphere intact.

This is the LAST Route-B attempt before falling back to canonical-v2-cleaned
for 1024 use only (Route C).
"""
from __future__ import annotations
import sys, os, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent / 'sprint13d'))
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

SPRINT_DIR = ROOT / 'scripts/sprint14a'
RAW_DIR = SPRINT_DIR / 'raw'
LOG_DIR = SPRINT_DIR / '_logs'

CANONICAL_V2 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
CASE_STUDY_DIR = ROOT / 'public/assets/case-study/cosmo-rerender-v14a'


def log(entry: dict, fname: str = 'cosmo_v14a_routeBplus.jsonl'):
    target = LOG_DIR / fname
    with open(target, 'a') as f:
        f.write(json.dumps(entry) + '\n')


# === Eye anatomy (canonical-v2 1024² coordinates) ==========================
# From visual inspection + mask-overlay confirmation:
#   left eye: x≈410 cy≈425, slightly oval ~95w × 95h
#   right eye: x≈603 cy≈425, slightly oval ~95w × 95h
# The chameleon-style eye protrudes OUTWARD from the head, so the spheres are
# slightly larger than the kawaii eyes they replace.

LEFT_EYE = {'cx': 410, 'cy': 422, 'rx': 70, 'ry': 75}
RIGHT_EYE = {'cx': 605, 'cy': 422, 'rx': 70, 'ry': 75}

# Skin moss-sage tone sampled from forehead / cheek of canonical-v2:
SKIN_BASE = (155, 187, 134)  # moss-sage approximate
SKIN_LIGHT = (175, 205, 152)  # for highlights
SKIN_SHADOW = (115, 148, 100)  # for shadow under eye-bulge

# Eye palette
EYE_BLACK = (12, 14, 18)  # near-black with hint of cool tone
EYE_BLACK_RIM = (28, 22, 30)  # ink-aubergine rim around sphere
SAFFRON_HIGHLIGHT = (250, 220, 130)  # saffron catchlight


def sample_skin_color(img: Image.Image, x: int, y: int, radius: int = 5) -> tuple:
    """Sample average skin color in a small disc around (x, y)."""
    arr = np.array(img.convert('RGB'))
    sub = arr[max(0, y-radius):y+radius, max(0, x-radius):x+radius]
    if sub.size == 0:
        return SKIN_BASE
    return tuple(int(c) for c in sub.reshape(-1, 3).mean(axis=0))


def paint_eyes(src: Path, dst: Path) -> dict:
    """v4 strategy: BIGGER chameleon spheres that fully cover the kawaii eyes
    INCLUDING all eyelash tips. No skin-patch needed. The sphere itself with
    a soft outer rim eats the lashes naturally.
    """
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    work = img.copy()

    # === STEP 2: Draw chameleon-style bulging eye-spheres ==============
    # v4: paint a SOFT outer dark gradient ring (extends past sphere) to eat
    # any kawaii eyelash tips without needing a skin-patch. Then layer hard
    # sphere on top.
    for eye, ec in [('LEFT', LEFT_EYE), ('RIGHT', RIGHT_EYE)]:
        cx, cy, rx, ry = ec['cx'], ec['cy'], ec['rx'], ec['ry']

        # NO outer dark rim — we found that the rim creates raccoon-zones.
        # Instead: tight inner-eye-line shadow only, ON the sphere edge itself
        # (handled by the EYE_BLACK_RIM ellipse layered below the main sphere).

        # Hard solid sphere on top
        draw = ImageDraw.Draw(work)
        # Slightly larger ink-rim ellipse
        draw.ellipse((cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4),
                     fill=EYE_BLACK_RIM)
        # Main black sphere
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=EYE_BLACK)

    # Render-to-array for sphere shading + catchlights
    arr = np.array(work)
    h, w, _ = arr.shape

    for eye, ec in [('LEFT', LEFT_EYE), ('RIGHT', RIGHT_EYE)]:
        cx, cy, rx, ry = ec['cx'], ec['cy'], ec['rx'], ec['ry']

        # Add radial gradient inside sphere for "bulge" feel (fake 3D)
        # The sphere is darker at edges, slightly lighter near center-top
        yy, xx = np.ogrid[max(0, cy-ry):min(h, cy+ry), max(0, cx-rx):min(w, cx+rx)]
        dy = (yy - cy) / ry
        dx = (xx - cx) / rx
        d = np.sqrt(dy**2 + dx**2)
        in_sphere = d <= 1.0
        # subtle highlight at top-right (light source from upper-left or center)
        # Build a soft falloff on top portion
        # Sphere shading: blend between EYE_BLACK and slight cool gray at the
        # top-half center
        sub_y = yy.size if hasattr(yy, 'size') else 1
        # Skip complex shading on first pass — just add pinpoint catchlight

    # === STEP 3: Saffron catchlight pinpoint =============================
    # Tiny crescent of saffron at top-left of each sphere
    draw = ImageDraw.Draw(work)
    for eye, ec in [('LEFT', LEFT_EYE), ('RIGHT', RIGHT_EYE)]:
        cx, cy, rx, ry = ec['cx'], ec['cy'], ec['rx'], ec['ry']
        # Saffron crescent: small ellipse at upper-left quadrant
        hl_x = cx - int(rx * 0.35)
        hl_y = cy - int(ry * 0.45)
        hl_r = max(4, int(min(rx, ry) * 0.18))
        draw.ellipse((hl_x - hl_r, hl_y - hl_r, hl_x + hl_r, hl_y + hl_r),
                     fill=SAFFRON_HIGHLIGHT)
        # Smaller true-white pinpoint inside the saffron for true-glass shine
        wp = max(2, int(hl_r * 0.5))
        draw.ellipse((hl_x - wp, hl_y - wp, hl_x + wp, hl_y + wp), fill=(255, 250, 230))

    # Save
    work.save(dst, 'PNG')
    log({'attempt': 'paint_eyes_v2',
         'left': LEFT_EYE, 'right': RIGHT_EYE})
    return {'dst': str(dst)}


# === Optional Flux Fill blend-pass on eye-rim only =========================
def make_eye_rim_mask(size, dst):
    """Mask only the OUTLINE of the eye-spheres so Flux can re-paint the
    transition between sphere-edge and watercolor skin without changing the
    painted black sphere itself."""
    W, H = size
    mask = Image.new('L', size, 0)
    d = ImageDraw.Draw(mask)
    for ec in [LEFT_EYE, RIGHT_EYE]:
        cx, cy, rx, ry = ec['cx'], ec['cy'], ec['rx'], ec['ry']
        # Outer ring (annulus): outer ellipse minus inner ellipse
        # Paint outer white, then inner black to remove
        d.ellipse((cx - rx - 12, cy - ry - 12, cx + rx + 12, cy + ry + 12), fill=255)
        d.ellipse((cx - rx + 6, cy - ry + 6, cx + rx - 6, cy + ry - 6), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=4))
    mask.save(dst, 'PNG')
    return dst


# === Tail erase (Sprint 6A pattern, scale-aware) ==========================
def alpha_erase_tail(src: Path, dst: Path) -> dict:
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    arr = np.array(img)
    erase = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(erase)
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
    return {'src': str(src), 'dst': str(dst), 'poly': poly}


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


def upscale_4x_preserving_alpha(src_rgba: Path) -> Path | None:
    """ESRGAN strips alpha (returns RGB). To keep transparency:

    1. Flatten src onto white-bg → upload → ESRGAN 4× RGB
    2. Upscale src's alpha channel separately via PIL bicubic 4×
    3. Combine: 4K RGB + 4K alpha → RGBA 4K output
    """
    # Step 1: flatten to white BG
    img = Image.open(src_rgba).convert('RGBA')
    W, H = img.size
    flat_white = Image.new('RGB', (W, H), (255, 255, 255))
    flat_white.paste(img, (0, 0), img)
    flat_path = RAW_DIR / f'{src_rgba.stem}-flat-white.png'
    flat_white.save(flat_path, 'PNG')

    print(f'[SUBMIT] esrgan {flat_path.name}')
    image_url = upload_local_image(flat_path)
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
    rgb_4k_path = RAW_DIR / f'{src_rgba.stem}-rgb-4k.png'
    n = http_download(url, rgb_4k_path)
    print(f'[OK] esrgan rgb-4k: {n} bytes')

    # Step 2: upscale alpha via PIL Lanczos 4×
    alpha_1024 = img.split()[-1]  # alpha channel
    alpha_4k = alpha_1024.resize((W * 4, H * 4), Image.LANCZOS)

    # Step 3: combine
    rgb_4k = Image.open(rgb_4k_path).convert('RGB')
    # Make sure rgb_4k size matches expected
    if rgb_4k.size != (W * 4, H * 4):
        print(f'[WARN] esrgan size {rgb_4k.size} != expected {(W*4, H*4)} — resizing alpha to match')
        alpha_4k = alpha_1024.resize(rgb_4k.size, Image.LANCZOS)

    # Tighten alpha: threshold + slight feather to keep < 5px halo
    # Lanczos creates wide soft edges; we hard-threshold then add 1-2px feather
    # for anti-alias.
    alpha_arr = np.array(alpha_4k).astype(np.float32)
    # Stretch contrast: anything > 60 becomes 255, anything < 30 becomes 0,
    # smooth ramp between. This narrows the halo to ~2-3px.
    a_norm = np.clip((alpha_arr - 30) / (60 - 30), 0, 1)
    alpha_tight = (a_norm * 255).astype(np.uint8)
    # Tiny gaussian to avoid harsh stair-stepping
    alpha_4k = Image.fromarray(alpha_tight, 'L').filter(ImageFilter.GaussianBlur(radius=1.0))

    rgba_4k = Image.merge('RGBA', (*rgb_4k.split(), alpha_4k))
    target = RAW_DIR / f'{src_rgba.stem}-4k.png'
    rgba_4k.save(target, 'PNG')
    print(f'[OK] rgba-4k: {target.stat().st_size} bytes -> {target.name}')
    return target


def upscale_4x(src: Path) -> Path | None:
    """Compatibility wrapper."""
    return upscale_4x_preserving_alpha(src)


def main():
    # Phase 1: paint eyes
    print('=== Phase 1: Paint chameleon eyes deterministically ===')
    painted = RAW_DIR / 'cosmo-painted-eyes.png'
    paint_eyes(CANONICAL_V2, painted)
    shutil.copy(painted, CASE_STUDY_DIR / 'routeBplus-painted-eyes-1024.png')
    print(f'[OK] {painted}')

    # Phase 2: alpha-erase tail
    print('=== Phase 2: alpha-erase tail ===')
    erased_1024 = RAW_DIR / 'cosmo-painted-erased-1024.png'
    alpha_erase_tail(painted, erased_1024)
    print(f'[OK] {erased_1024}')

    # Phase 3: ESRGAN 4× upscale
    print('=== Phase 3: ESRGAN 4× ===')
    upscaled = upscale_4x(erased_1024)
    if upscaled is None:
        print('[WARN] ESRGAN failed — using 1024 erased')
        upscaled = erased_1024

    # Phase 4: halo measurement
    halo = measure_halo_fringe(upscaled)
    log({'attempt': 'halo', **halo})
    print(f'[HALO] {halo}')

    # Phase 5: write final + case-study
    HERO_OUT.write_bytes(upscaled.read_bytes())
    shutil.copy(upscaled, CASE_STUDY_DIR / 'after-sprint14a-final.png')
    print(f'[FINAL] {HERO_OUT} = {HERO_OUT.stat().st_size} bytes')
    log({'attempt': 'final', 'src': str(upscaled), 'dst': str(HERO_OUT),
         'route': 'B+ paint+erase+esrgan', 'halo': halo})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
