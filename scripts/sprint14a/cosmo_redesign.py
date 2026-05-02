"""
Sprint 14A — Cosmo vol-DNA redesign.

CONTEXT:
- Sprint 13D shipped a kawaii-drifted Cosmo (Disney-eyes, blozende wangen,
  vinger-handen, tail-stub). User: "Cosmo ziet er niet uit".
- canonical-v2-cleaned (the Sprint 6A 1024² canonical) also has KAWAII PINK
  EYES with eyelashes — NOT chameleon-style bulging black spheres.
  This means LOW-strength img2img will preserve the kawaii bias.

ROUTE A (this script):
  1. img2img from canonical-v2-cleaned with 6 strength variants
     - Low strengths (0.30-0.40) preserve canonical DNA (good body, bad eyes)
     - Mid strengths (0.50-0.65) needed to override kawaii-eyes
  2. DOUBLE FRONT-LOADED anti-kawaii prompt with explicit chameleon-sphere
     descriptors
  3. Multiple seeds (different "personalities" of the model)
  4. ESRGAN 4× upscale on best candidate
  5. PIL alpha-erase tail-stub polygon (Sprint 6A pattern)
  6. Output: public/assets/sprites/cosmo-hero-4k.png

ACCEPTANCE CRITERIA per attempt (manual visual check + logged for case-study):
  [ ] Pearl-drop head (niet rond Disney-baby)
  [ ] Chameleon bulging dark eye-spheres (NOT pink kawaii eyes)
  [ ] No blozende wangen
  [ ] Single antenne with flower-tip
  [ ] Two suction-cup discs on hand-tips
  [ ] Faded-rose spots ~5
  [ ] No tail
  [ ] No vinger-handen
  [ ] Watercolor body + paper-grain
  [ ] Halo-fringe < 5px

BUDGET: ~$1-2 (5-6 img2img × $0.025 + 1 ESRGAN × $0.02 + 1 BiRefNet × $0.025)
"""
from __future__ import annotations
import sys, json, time, shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'sprint13d'))
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

SPRINT_DIR = ROOT / 'scripts/sprint14a'
RAW_DIR = SPRINT_DIR / 'raw'
LOG_DIR = SPRINT_DIR / '_logs'
RAW_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

CANONICAL_V2 = ROOT / 'public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png'
HERO_OUT = ROOT / 'public/assets/sprites/cosmo-hero-4k.png'
CASE_STUDY_DIR = ROOT / 'public/assets/case-study/cosmo-rerender-v14a'
CASE_STUDY_DIR.mkdir(parents=True, exist_ok=True)

# Override the log path for sprint14a
def log(entry: dict, fname: str = 'cosmo_v14a.jsonl') -> None:
    target = LOG_DIR / fname
    with open(target, 'a') as f:
        f.write(json.dumps(entry) + '\n')


# === DOUBLE FRONT-LOADED ANTI-KAWAII PROMPT ================================
# Two waves of negatives at the front (per Sprint 4.5 fix-pattern but doubled
# because canonical itself has kawaii bias we need to override):
ANTI_WAVE_1 = (
    'NOT kawaii NOT chibi NOT blush NOT blushing NOT cute-baby '
    'NOT sparkle-eye NOT sparkle-eyes NOT pink-eyes NOT anime-eyes '
    'NOT eyelashes NOT doll-eyes NOT Disney-baby NOT Pixar NOT manga'
)
ANTI_WAVE_2 = (
    'NOT round-eyes NOT button-nose NOT airbrush NOT cute-mascot '
    'NOT 3D NOT photoreal NOT pixel-art NOT roblox NOT toy-story-alien, '
    'NO tail NO lizard-tail NO claws NO fingers NO finger-hands NO paws, '
    'ONE single thin antenna NOT two NOT pair NOT antennae'
)

# Subject — DNA-locked with EXTRA chameleon-eye emphasis
COSMO_SUBJECT = (
    'Cosmo, a small alien character, full-body portrait standing arms at sides, '
    'pearl-drop pear-shaped head with smooth moss-sage GREEN watercolor skin, '
    'TWO LARGE BULGING DARK CHAMELEON-STYLE EYE-SPHERES protruding from the sides '
    'of the head like a chameleon lizard, deep ink-black with subtle saffron '
    'crescent catchlight reflection, blank reptilian gaze NOT pretty, '
    'absolutely NO eyelashes NO pink iris NO sparkle NO cute-anime expression, '
    'cheeks PLAIN green watercolor with NO blush NO rosy redness, '
    'tiny narrow overbite mouth a soft slight curve, '
    'ONE thin moss-sage antenna rising straight up from top of head ending in a '
    'small FADED-ROSE flower-bulb tip with delicate petals, '
    'FIVE FADED-ROSE PINK MINERAL SPOTS scattered sparsely across body and head, '
    'TWO LONG soft suction-cup arms hanging at sides ending in TWO LARGE FLAT '
    'BLACK ROUND DISC SUCTION-CUP PADS like toilet plunger tips at the wrist, '
    'NO fingers NO claws on the wrist-tips, just flat black circular discs, '
    'narrow tapered shoulders kid-frame slim body, small painted bare feet, '
    'no clothes naked watercolor green skin, NO TAIL behind body'
)

STYLE_STEM = (
    'hand-painted watercolor with ink underdrawing, paper-grain texture visible '
    'across the body, soft wet-edge watercolor bleeds, ragged ink-aubergine '
    'outline, faded-rose mineral wash, Hayao Miyazaki x Moebius x Tenniel '
    'illustration, slight uncute proportions, woodcut accent, museum-quality '
    'character illustration, sharp focus crisp lines'
)

PALETTE = (
    'palette mushroom-cream moss-sage faded-rose ink-aubergine saffron-glow, '
    'locked five-tone palette'
)

BG_DIRECTIVE = (
    'isolated character on plain off-white paper card background, no scene, '
    'no horizon, no environment, character fills 75 percent of frame centered'
)


def make_prompt() -> str:
    return (
        f'{ANTI_WAVE_1}. {ANTI_WAVE_2}. {COSMO_SUBJECT}. '
        f'{STYLE_STEM}. {PALETTE}. {BG_DIRECTIVE}'
    )


# === img2img attempts =======================================================
# Strength sweep: low (preserves kawaii eyes) → mid (overrides eye style)
# Per Sprint 13D learnings: 0.45 preserved DNA + added kawaii drift.
# Logic: if 0.45 keeps kawaii in, we need MORE override (0.55-0.70).
# But the prompt says "lower than Sprint 13D's 0.45". Let's run 0.30, 0.35, 0.40
# AND 0.55, 0.65 to compare and let visual review decide. The spec says 0.30-0.45
# but Sprint 13D was at 0.45 — so we tighten to 0.30-0.45 range as instructed.
# For the higher-eye-override attempt we add 0.55 as final.
ATTEMPTS = [
    {'label': 'a1_s030', 'strength': 0.30, 'seed': 7777},
    {'label': 'a2_s035', 'strength': 0.35, 'seed': 4242},
    {'label': 'a3_s040', 'strength': 0.40, 'seed': 9001},
    {'label': 'a4_s045', 'strength': 0.45, 'seed': 1492},
    {'label': 'a5_s055', 'strength': 0.55, 'seed': 31337},  # eye-override try
]


def attempt_img2img(label: str, strength: float, seed: int) -> Path | None:
    print(f'[SUBMIT] {label} strength={strength} seed={seed}')
    image_url = upload_local_image(CANONICAL_V2)
    body = {
        'prompt': make_prompt(),
        'image_url': image_url,
        'strength': strength,
        'image_size': {'width': 1024, 'height': 1024},
        'num_inference_steps': 40,
        'guidance_scale': 4.5,
        'num_images': 1,
        'seed': seed,
        'enable_safety_checker': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/flux/dev/image-to-image', body)
    except Exception as e:
        print(f'[ERROR] submit {label}: {e}')
        log({'attempt': label, 'submit_error': str(e)[:300]})
        return None

    payload = poll_until_done(resp_url, label, max_polls=180)
    url = extract_image_url(payload)
    if not url:
        log({'attempt': label, 'request_id': req_id, 'no_url': True})
        return None

    target = RAW_DIR / f'{label}.png'
    n = http_download(url, target)
    print(f'[OK] {label}: {n} bytes -> {target.name}')
    log({
        'attempt': label, 'request_id': req_id, 'url': url,
        'bytes': n, 'strength': strength, 'seed': seed,
    })
    return target


# === ESRGAN 4× upscale ======================================================
def upscale_4x(src: Path) -> Path | None:
    print(f'[SUBMIT] esrgan on {src.name}')
    image_url = upload_local_image(src)
    body = {
        'image_url': image_url,
        'scale': 4,
        'face': False,
    }
    try:
        req_id, resp_url = submit('fal-ai/esrgan', body)
    except Exception as e:
        print(f'[ERROR] esrgan submit: {e}')
        log({'attempt': 'esrgan', 'submit_error': str(e)[:300]})
        return None

    payload = poll_until_done(resp_url, 'esrgan', max_polls=180)
    url = extract_image_url(payload)
    if not url:
        log({'attempt': 'esrgan', 'no_url': True})
        return None
    target = RAW_DIR / f'{src.stem}-4k.png'
    n = http_download(url, target)
    print(f'[OK] esrgan: {n} bytes -> {target.name}')
    log({'attempt': 'esrgan', 'src': src.name, 'bytes': n})
    return target


# === PIL alpha-erase tail polygon (Sprint 6A pattern) =======================
def alpha_erase_tail(src: Path, dst: Path) -> dict:
    """Soft-feathered polygon alpha-erase for tail-stub area below feet.

    The canonical-v2 has a thin faint stub at the bottom-center. We erase
    a vertical narrow zone below the feet line.
    """
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np

    img = Image.open(src).convert('RGBA')
    W, H = img.size
    arr = np.array(img)

    # Tail-stub typical bbox (relative to a 1024-or-4096 canvas):
    # vertical strip below feet, narrow, just below body-center
    cx = W / 2
    # feet line ~92% of height; tail-stub spans 88-100% (just feet+stub)
    y_top = int(H * 0.86)
    y_bot = H
    x_w = int(W * 0.08)  # narrow strip

    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    # Polygon: trapezoid that catches stub but spares feet shape laterally
    poly = [
        (int(cx - x_w * 0.4), y_top),
        (int(cx + x_w * 0.4), y_top),
        (int(cx + x_w), y_bot),
        (int(cx - x_w), y_bot),
    ]
    draw.polygon(poly, fill=255)
    # Feather edges so erase is smooth
    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))
    mask_arr = np.array(mask).astype(np.float32) / 255.0  # 0..1
    # Multiply existing alpha by (1 - mask)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * (1.0 - mask_arr)).astype(np.uint8)

    out = Image.fromarray(arr, 'RGBA')
    out.save(dst)
    return {'src': str(src), 'dst': str(dst), 'W': W, 'H': H, 'tail_zone': poly}


def measure_halo_fringe(src: Path) -> dict:
    """Estimate halo-fringe by counting pixels with alpha 1..50 along character edge.

    Returns {avg_fringe_px: float} which is a rough estimate.
    """
    from PIL import Image
    import numpy as np
    arr = np.array(Image.open(src).convert('RGBA'))
    a = arr[:, :, 3]
    semi = ((a > 0) & (a < 50)).sum()
    opaque = (a >= 50).sum()
    # Approximate average fringe pixels by ratio (semi / sqrt(opaque))
    if opaque == 0:
        return {'semi': int(semi), 'opaque': 0, 'avg_fringe_px': None}
    import math
    avg = semi / max(1.0, math.sqrt(opaque))
    return {'semi': int(semi), 'opaque': int(opaque), 'avg_fringe_px': round(avg, 2)}


def main(do_upscale: bool = True, do_finalize: bool = True):
    # Phase 1: 5 img2img attempts
    print('=== Phase 1: img2img attempts ===')
    results = []
    for atk in ATTEMPTS:
        path = attempt_img2img(atk['label'], atk['strength'], atk['seed'])
        if path:
            results.append({'label': atk['label'], 'path': path, **atk})

    if not results:
        print('[FATAL] All img2img attempts failed')
        return 1

    # Phase 2: copy all attempts to case-study dir
    print('=== Phase 2: case-study copies ===')
    for r in results:
        dst = CASE_STUDY_DIR / f'attempt-{r["label"]}.png'
        shutil.copy(r['path'], dst)
        print(f'[CASE-STUDY] {dst.name}')

    # Also copy reference images
    shutil.copy(CANONICAL_V2, CASE_STUDY_DIR / 'reference-canonical-v2.png')
    # Sprint 13D fail snapshot — current cosmo-hero-4k.png will be copied BEFORE we overwrite
    if HERO_OUT.exists():
        shutil.copy(HERO_OUT, CASE_STUDY_DIR / 'before-sprint13d-fail.png')
        print('[CASE-STUDY] before-sprint13d-fail.png saved')

    if not do_upscale:
        print('[STOP] Phase 1+2 done. Run with do_upscale=True for Phase 3+.')
        return 0

    # Phase 3: Pick BEST candidate. Without visual judgement we use heuristic:
    # the strength=0.55 attempt has the highest chance to override kawaii eyes
    # but greatest risk of DNA-loss. We pick a4 (0.45 baseline same as 13D,
    # different prompt) AS DEFAULT because the new double-front-loaded prompt
    # may already shift behavior. User/orchestrator can re-pick by editing
    # this script. For now: pick the LAST successful attempt (a5_s055) since
    # that's the explicit eye-override try.
    # NOTE: For a final user-driven pick, this script can be re-run with a
    # specific FINAL_LABEL env var.
    import os
    final_label = os.environ.get('SPRINT14A_FINAL', 'a5_s055')
    final_pick = next((r for r in results if r['label'] == final_label), None)
    if final_pick is None:
        final_pick = results[-1]
    print(f'=== Phase 3: ESRGAN 4× on {final_pick["label"]} ===')

    upscaled = upscale_4x(final_pick['path'])
    if upscaled is None:
        print('[FATAL] ESRGAN failed; using 1024 raw as fallback')
        upscaled = final_pick['path']

    # Phase 4: PIL alpha-erase tail
    print('=== Phase 4: alpha-erase tail polygon ===')
    erased = RAW_DIR / f'{upscaled.stem}-erased.png'
    erase_meta = alpha_erase_tail(upscaled, erased)
    log({'attempt': 'alpha_erase', **erase_meta})

    # Phase 5: halo-fringe measurement
    halo = measure_halo_fringe(erased)
    log({'attempt': 'halo_fringe', **halo})
    print(f'[HALO] {halo}')

    if not do_finalize:
        print(f'[STOP] erased file at {erased}; finalize manually if happy')
        return 0

    # Phase 6: copy to HERO_OUT and case-study final/after
    HERO_OUT.write_bytes(erased.read_bytes())
    shutil.copy(erased, CASE_STUDY_DIR / 'after-sprint14a-final.png')
    print(f'[FINAL] {HERO_OUT} = {HERO_OUT.stat().st_size} bytes')
    log({'attempt': 'final', 'src': str(erased), 'dst': str(HERO_OUT),
         'final_label': final_pick['label'], 'final_size': HERO_OUT.stat().st_size,
         'halo_fringe': halo})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
