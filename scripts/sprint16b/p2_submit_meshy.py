"""Sprint 16B p2 — submit two Meshy image-to-3D tasks in parallel.

Test both art_style values to compare mesh cleanliness:
- realistic (Sprint 15A used this — proven baseline)
- cartoon (alternative, may yield cleaner stylized mesh)

Polygon target raised to ~22k (15A used 22.5k, mobile 60fps still feasible).
"""
from __future__ import annotations
import json
import time
from pathlib import Path
from _lib import submit_image_to_3d, LOG_DIR

UPLOAD_LOG = LOG_DIR / 'p1_uploaded.json'

if __name__ == '__main__':
    upload = json.loads(UPLOAD_LOG.read_text())
    hero_url = upload['hero_url']
    print(f'[p2] using hero {hero_url}')

    submissions = []

    # Attempt A — realistic (15A baseline)
    print('[p2] submitting attempt A (realistic, polycount=22000)...')
    task_a = submit_image_to_3d(
        image_url=hero_url,
        art_style='realistic',
        target_polycount=22000,
        texture_resolution=2048,
        symmetry_mode='auto',
    )
    print(f'[p2] task A = {task_a}')
    submissions.append({'label': 'A_realistic', 'task_id': task_a, 'art_style': 'realistic',
                        'target_polycount': 22000, 'texture_resolution': 2048})
    time.sleep(2)

    # Attempt B — sculpture (Meshy now allows sculpture for higher fidelity)
    # Try cartoon/sculpture; if sculpture rejected, fall back to realistic w/
    # higher polycount.
    art_b = 'sculpture'
    polycount_b = 25000
    try:
        print(f'[p2] submitting attempt B ({art_b}, polycount={polycount_b})...')
        task_b = submit_image_to_3d(
            image_url=hero_url,
            art_style=art_b,
            target_polycount=polycount_b,
            texture_resolution=2048,
            symmetry_mode='auto',
        )
    except RuntimeError as e:
        print(f'[p2] sculpture rejected ({e}); falling back to realistic@25k')
        art_b = 'realistic_high'
        task_b = submit_image_to_3d(
            image_url=hero_url,
            art_style='realistic',
            target_polycount=25000,
            texture_resolution=2048,
            symmetry_mode='auto',
        )
    print(f'[p2] task B = {task_b}')
    submissions.append({'label': 'B_'+art_b, 'task_id': task_b, 'art_style': art_b,
                        'target_polycount': polycount_b, 'texture_resolution': 2048})

    out = LOG_DIR / 'p2_submitted.json'
    out.write_text(json.dumps({'hero_url': hero_url, 'submissions': submissions}, indent=2))
    print(f'[p2] saved -> {out}')
