"""
Sprint 17A — Track A continued: select winner per pose, BiRefNet + ESRGAN.

Reads p1_results.json. For each pose, picks the FIRST successful attempt
(seed=8181 baseline — proven DNA in Sprint 16A). Operator can override by
editing WINNER_TAG below.

Pipeline per winner (mirrors Sprint 16A finalize):
1. fal-ai/birefnet model="General Use (Heavy)", op_res 2048 → RGBA (alpha)
2. fal-ai/esrgan scale=4 → upscale to 6144²
3. PIL Lanczos 6144² → 4096² (alpha preserved separately)
4. Save to public/assets/sprites/cosmo-pose-<key>.png
"""
from __future__ import annotations
import json
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    ROOT, LOG_DIR, POSES_DIR, ATTEMPTS_DIR,
    fal_submit, fal_poll, http_download, upload_to_fal,
)

POSES_DIR.mkdir(parents=True, exist_ok=True)
SPRITES_OUT = ROOT / 'public/assets/sprites'
SPRITES_OUT.mkdir(parents=True, exist_ok=True)

# Operator override map: pose_key -> attempt tag (e.g. 'idle-breath_a01').
# If pose-key absent → first successful attempt is used.
WINNER_TAG: dict[str, str] = {
    # Manual visual review (17A): pick best DNA per pose.
    # All 16 attempts show LoRA drift toward gecko/lizard archetype (tail + fingers),
    # but recognizable Cosmo DNA preserved. Picking least-drifted per pose:
    'idle-breath':  'idle-breath_a02',  # pearl head + clean curl-tail + best watercolor
    'wave-uncanny': 'wave-uncanny_a01', # arm-up unambiguous + smaller tail-curl
    'stretch':      'stretch_a01',      # arms-overhead clear + arched body
    'sit-sniff':    'sit-sniff_a01',    # squat clear + mushroom prop visible
}

POSE_KEYS = ['idle-breath', 'wave-uncanny', 'stretch', 'sit-sniff']


def pick_winners(results: list[dict]) -> dict[str, dict]:
    by_pose: dict[str, list[dict]] = {p: [] for p in POSE_KEYS}
    for r in results:
        if r.get('ok'):
            by_pose[r['pose']].append(r)
    winners: dict[str, dict] = {}
    for p in POSE_KEYS:
        atts = by_pose[p]
        if not atts:
            print(f'[WARN] no successful attempts for {p}')
            continue
        if p in WINNER_TAG:
            match = [a for a in atts if a['tag'] == WINNER_TAG[p]]
            winners[p] = match[0] if match else atts[0]
        else:
            winners[p] = atts[0]  # default first (seed=8181)
    return winners


def birefnet_remove_bg(image_url: str, label: str) -> str | None:
    body = {
        'image_url': image_url,
        'model': 'General Use (Heavy)',
        'operating_resolution': '2048x2048',
        'output_format': 'png',
        'refine_foreground': True,
    }
    rid, rurl = fal_submit('fal-ai/birefnet/v2', body)
    payload = fal_poll(rurl, f'{label}-birefnet', max_polls=120)
    if not payload:
        return None
    return payload.get('image', {}).get('url') or (payload.get('images') or [{}])[0].get('url')


def esrgan_upscale(image_url: str, label: str) -> str | None:
    body = {'image_url': image_url, 'scale': 4, 'face': False}
    rid, rurl = fal_submit('fal-ai/esrgan', body)
    payload = fal_poll(rurl, f'{label}-esrgan', max_polls=120)
    if not payload:
        return None
    return payload.get('image', {}).get('url') or (payload.get('images') or [{}])[0].get('url')


def downsample_4096(src_path: Path, dst_path: Path) -> None:
    img = Image.open(src_path).convert('RGBA')
    img.thumbnail((4096, 4096), Image.LANCZOS)
    # Pad to exact 4096² with center placement (transparent border)
    canvas = Image.new('RGBA', (4096, 4096), (0, 0, 0, 0))
    x = (4096 - img.width) // 2
    y = (4096 - img.height) // 2
    canvas.paste(img, (x, y), img)
    canvas.save(dst_path, 'PNG')


def process_pose(pose_key: str, attempt: dict) -> dict:
    print(f'\n=== {pose_key} (tag={attempt["tag"]}) ===')
    raw_path = Path(attempt['file'])

    # Step 1: BiRefNet remove-bg
    raw_url = attempt['image_url']
    print(f'  raw URL ok')
    rgba_url = birefnet_remove_bg(raw_url, pose_key)
    if not rgba_url:
        return {'pose': pose_key, 'ok': False, 'error': 'birefnet failed'}
    rgba_path = POSES_DIR / f'{pose_key}_birefnet.png'
    http_download(rgba_url, rgba_path)
    print(f'  birefnet → {rgba_path.name}')

    # Step 2: ESRGAN 4x
    up_url = esrgan_upscale(rgba_url, pose_key)
    if not up_url:
        # Fallback: skip upscale, use birefnet directly downsampled
        print('  esrgan failed; using birefnet raw at 1536²')
        downsample_4096(rgba_path, SPRITES_OUT / f'cosmo-pose-{pose_key}.png')
        return {'pose': pose_key, 'ok': True, 'esrgan': False, 'final': str(SPRITES_OUT / f'cosmo-pose-{pose_key}.png')}
    up_path = POSES_DIR / f'{pose_key}_4x.png'
    http_download(up_url, up_path)
    print(f'  esrgan 4x → {up_path.name}')

    # Step 3: Lanczos to 4096²
    final_path = SPRITES_OUT / f'cosmo-pose-{pose_key}.png'
    downsample_4096(up_path, final_path)
    sz = final_path.stat().st_size
    print(f'  final → {final_path.name} ({sz//1024} KB)')
    return {'pose': pose_key, 'ok': True, 'final': str(final_path), 'tag': attempt['tag']}


def main():
    results_path = LOG_DIR / 'p1_results.json'
    if not results_path.exists():
        print('Run p1_generate_poses.py first')
        sys.exit(1)
    results = json.loads(results_path.read_text())
    winners = pick_winners(results)
    print(f'Winners: {[(p, w["tag"]) for p, w in winners.items()]}')

    out = []
    for pose_key, attempt in winners.items():
        try:
            out.append(process_pose(pose_key, attempt))
        except Exception as e:
            out.append({'pose': pose_key, 'ok': False, 'error': str(e)})

    (LOG_DIR / 'p2_results.json').write_text(json.dumps(out, indent=2))
    ok = sum(1 for r in out if r.get('ok'))
    print(f'\nDONE — {ok}/{len(out)} poses cleaned')


if __name__ == '__main__':
    main()
