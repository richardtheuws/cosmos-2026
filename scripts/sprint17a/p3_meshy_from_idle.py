"""
Sprint 17A — Track B step 1: image-to-3D from cleaned idle-breath pose.

Input: public/assets/sprites/cosmo-pose-idle-breath.png
Output: 2 attempts (A=realistic, B=sculpture) → glb/cosmo_<label>.glb

This GLB is the un-rigged base mesh. Track B step 2 (Blender) adds bones.
If idle-breath generation/cleanup failed, this falls back to Sprint 16B's
existing cosmo.glb as the base for re-rigging.
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    ROOT, LOG_DIR, GLB_DIR,
    upload_to_fal, meshy_submit_image_to_3d, meshy_poll, http_download,
)

GLB_DIR.mkdir(parents=True, exist_ok=True)

IDLE_HERO = ROOT / 'public/assets/sprites/cosmo-pose-idle-breath.png'
EXISTING_GLB = ROOT / 'public/assets/3d/cosmo.glb'

ATTEMPTS = [
    {'label': 'A_realistic', 'art_style': 'realistic', 'target_polycount': 22000},
    {'label': 'B_sculpture', 'art_style': 'sculpture', 'target_polycount': 25000},
]


def main():
    if not IDLE_HERO.exists():
        print(f'[WARN] {IDLE_HERO} missing — Track B will reuse existing GLB ({EXISTING_GLB.name}).')
        print('       Skipping Meshy submit; Blender rig step will use Sprint 16B GLB.')
        decision = {'mode': 'reuse_16b_glb', 'glb': str(EXISTING_GLB)}
        (LOG_DIR / 'p3_decision.json').write_text(json.dumps(decision, indent=2))
        return

    print(f'Uploading {IDLE_HERO.name} to fal.ai...')
    image_url = upload_to_fal(IDLE_HERO)
    print(f'  → {image_url}')

    submitted = []
    for att in ATTEMPTS:
        try:
            tid = meshy_submit_image_to_3d(
                image_url,
                art_style=att['art_style'],
                target_polycount=att['target_polycount'],
                texture_resolution=2048,
                symmetry_mode='auto',
            )
            print(f'  submitted {att["label"]} task_id={tid}')
            submitted.append({**att, 'task_id': tid})
        except Exception as e:
            print(f'  FAIL submit {att["label"]}: {e}')
        time.sleep(1.0)

    (LOG_DIR / 'p3_submitted.json').write_text(json.dumps(submitted, indent=2))

    # Poll all to completion
    results = []
    for s in submitted:
        payload = meshy_poll(s['task_id'], s['label'], max_polls=240, sleep_s=5.0)
        if not payload:
            results.append({**s, 'ok': False})
            continue
        glb_url = payload.get('model_urls', {}).get('glb')
        thumb_url = payload.get('thumbnail_url')
        if not glb_url:
            results.append({**s, 'ok': False, 'error': 'no glb url'})
            continue
        glb_path = GLB_DIR / f'cosmo_{s["label"]}.glb'
        thumb_path = GLB_DIR / f'cosmo_{s["label"]}_thumb.png'
        http_download(glb_url, glb_path)
        if thumb_url:
            try:
                http_download(thumb_url, thumb_path)
            except Exception:
                pass
        results.append({**s, 'ok': True, 'glb': str(glb_path), 'thumb': str(thumb_path)})
        print(f'  {s["label"]} downloaded ({glb_path.stat().st_size // 1024} KB)')

    (LOG_DIR / 'p3_results.json').write_text(json.dumps(results, indent=2))
    ok_count = sum(1 for r in results if r.get('ok'))
    print(f'\nDONE — {ok_count}/{len(results)} GLBs')

    # Default decision: prefer realistic if both available
    decision = {'mode': 'meshy_new'}
    pick = next((r for r in results if r.get('ok') and r['label'] == 'A_realistic'), None)
    if not pick:
        pick = next((r for r in results if r.get('ok')), None)
    if pick:
        decision['glb'] = pick['glb']
        decision['picked'] = pick['label']
    else:
        print('All Meshy attempts failed; falling back to existing 16B GLB')
        decision = {'mode': 'reuse_16b_glb', 'glb': str(EXISTING_GLB)}
    (LOG_DIR / 'p3_decision.json').write_text(json.dumps(decision, indent=2))


if __name__ == '__main__':
    main()
