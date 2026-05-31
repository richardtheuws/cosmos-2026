"""
Spike (2026-05-31) — painted-frames candidate for Cosmo locomotion.

Generates a short loopable motion clip FROM the LoRA-locked hero PNG via
fal.ai image-to-video, then we extract a frame atlas from it. Reuses the
sprint16a fal helpers (submit/poll/download/upload).

This is a SCRATCH spike — not wired into the game. See NORTH-STAR §6
(2026-05-31 entry). Output: spike/assets/cosmo-walk-clip.mp4
"""
from __future__ import annotations
import sys
from pathlib import Path

# Reuse the existing fal helpers.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts' / 'sprint16a'))
from _lib import submit, poll_until_done, http_download, upload_to_fal_storage  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
HERO = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'
OUT_DIR = Path(__file__).resolve().parent / 'assets'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Endpoint can be overridden as argv[1] if this one is unavailable.
ENDPOINT = sys.argv[1] if len(sys.argv) > 1 else 'fal-ai/kling-video/v2/master/image-to-video'

PROMPT = (
    "The small watercolor alien character comes alive and takes gentle, bouncy "
    "steps in place, shifting weight side to side like a happy walk cycle, then "
    "a light joyful hop and settle. Soft Hayao-Miyazaki x Moebius watercolor, "
    "calm and organic motion, character stays centered and fully in frame, "
    "static locked camera, no camera movement, no zoom, plain background."
)
NEGATIVE = "camera pan, camera zoom, fast motion, distortion, extra limbs, morphing, text, watermark"

if __name__ == '__main__':
    print(f'[spike] hero = {HERO} ({HERO.stat().st_size/1e6:.1f} MB)')
    print(f'[spike] endpoint = {ENDPOINT}')
    print('[spike] uploading hero to fal storage...')
    image_url = upload_to_fal_storage(HERO)
    print(f'[spike] hosted: {image_url}')

    body = {
        'prompt': PROMPT,
        'negative_prompt': NEGATIVE,
        'image_url': image_url,
        'duration': '5',
        'aspect_ratio': '1:1',
    }
    print('[spike] submitting image-to-video job...')
    req_id, resp_url = submit(ENDPOINT, body)
    print(f'[spike] request_id = {req_id}')

    # i2v jobs run a few minutes — generous polling.
    res = poll_until_done(resp_url, label='cosmo-walk', max_polls=200, sleep_s=6.0)
    if not res:
        print('[spike] FAILED or timed out. Inspect endpoint/body above.')
        sys.exit(1)

    video = res.get('video') or {}
    video_url = video.get('url') if isinstance(video, dict) else video
    if not video_url:
        print(f'[spike] no video url in payload: {res}')
        sys.exit(2)

    target = OUT_DIR / 'cosmo-walk-clip.mp4'
    sz = http_download(video_url, target)
    print(f'[spike] DONE -> {target} ({sz/1e6:.2f} MB)')
    print(f'[spike] video_url = {video_url}')
