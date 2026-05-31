"""
Wave 23 — batch image-to-video gen for the painted-frames Cosmo.

Reads clips.json, submits all requested clips to fal.ai (Kling v2 master i2v)
FROM the LoRA hero, polls them in parallel, downloads each mp4 to
scripts/wave23/_work/<name>/clip.mp4.

Usage:
  python3 scripts/wave23/gen_clips.py            # all clips
  python3 scripts/wave23/gen_clips.py --core     # only core:true (proof slice)
  python3 scripts/wave23/gen_clips.py idle walk   # named clips
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'sprint16a'))
from _lib import submit, poll_until_done, http_download, upload_to_fal_storage  # type: ignore

ROOT = Path(__file__).resolve().parent.parent.parent
HERO = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'
WORK = Path(__file__).resolve().parent / '_work'
CFG = json.loads((Path(__file__).resolve().parent / 'clips.json').read_text())
ENDPOINT = 'fal-ai/kling-video/v2/master/image-to-video'


def select(argv: list[str]) -> list[dict]:
    clips = CFG['clips']
    if '--core' in argv:
        return [c for c in clips if c.get('core')]
    names = [a for a in argv if not a.startswith('--')]
    if names:
        return [c for c in clips if c['name'] in names]
    return clips


if __name__ == '__main__':
    chosen = select(sys.argv[1:])
    if not chosen:
        print('[gen] no clips selected'); sys.exit(1)
    print(f'[gen] {len(chosen)} clips: {", ".join(c["name"] for c in chosen)}')
    print(f'[gen] uploading hero once...')
    image_url = upload_to_fal_storage(HERO)
    print(f'[gen] hero: {image_url}')

    # Submit all first → fal runs them in parallel.
    jobs = []
    for c in chosen:
        body = {
            'prompt': c['prompt'],
            'negative_prompt': CFG.get('negative', ''),
            'image_url': image_url,
            'duration': '5',
            'aspect_ratio': '1:1',
        }
        req_id, resp_url = submit(ENDPOINT, body)
        print(f'[gen] submitted {c["name"]}: {req_id}')
        jobs.append({'clip': c, 'resp_url': resp_url})

    # Poll all.
    done = 0
    for j in jobs:
        name = j['clip']['name']
        res = poll_until_done(j['resp_url'], label=name, max_polls=300, sleep_s=6.0)
        if not res:
            print(f'[gen] FAILED: {name}'); continue
        video = res.get('video') or {}
        url = video.get('url') if isinstance(video, dict) else video
        if not url:
            print(f'[gen] no video url for {name}: {res}'); continue
        out = WORK / name / 'clip.mp4'
        out.parent.mkdir(parents=True, exist_ok=True)
        sz = http_download(url, out)
        print(f'[gen] {name} -> {out} ({sz/1e6:.2f} MB)')
        done += 1
    print(f'[gen] DONE — {done}/{len(jobs)} clips generated -> {WORK}')
