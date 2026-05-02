"""Sprint 16B p3 — poll both Meshy tasks and download GLBs + thumbnails."""
from __future__ import annotations
import json
import time
from pathlib import Path
from _lib import poll_task, http_download, ROOT, LOG_DIR

CASE_STUDY = ROOT / 'public/assets/case-study/cosmo-3d-v16b/attempts'
CASE_STUDY.mkdir(parents=True, exist_ok=True)

if __name__ == '__main__':
    sub = json.loads((LOG_DIR / 'p2_submitted.json').read_text())
    results = []

    for entry in sub['submissions']:
        label = entry['label']
        task_id = entry['task_id']
        print(f'\n[p3] polling {label} ({task_id})...')
        res = poll_task(task_id, label=label, max_polls=200, sleep_s=10.0)
        if not res or res.get('status') != 'SUCCEEDED':
            print(f'[p3] FAILED: {label} -> {res}')
            results.append({**entry, 'status': res.get('status') if res else 'TIMEOUT',
                            'error': res})
            continue

        glb_url = res.get('model_urls', {}).get('glb')
        thumb_url = res.get('thumbnail_url')
        credits = res.get('consumed_credits')
        # extract per-axis stats if available
        stats_meta = {
            'video_url': res.get('video_url'),
            'art_style': res.get('art_style'),
            'consumed_credits': credits,
            'poly_count': res.get('poly_count'),  # may be None
        }
        glb_path = CASE_STUDY / f'cosmo-{label}.glb'
        thumb_path = CASE_STUDY / f'cosmo-{label}-thumb.png'

        if glb_url:
            sz = http_download(glb_url, glb_path)
            print(f'[p3] {label} GLB -> {glb_path.name} ({sz/1e6:.2f} MB)')
        if thumb_url:
            try:
                sz_t = http_download(thumb_url, thumb_path)
                print(f'[p3] {label} thumb -> {thumb_path.name} ({sz_t/1e3:.1f} KB)')
            except Exception as e:
                print(f'[p3] thumb dl failed: {e}')

        results.append({
            **entry,
            'status': 'SUCCEEDED',
            'glb_path': str(glb_path),
            'thumb_path': str(thumb_path) if thumb_url else None,
            'glb_url': glb_url,
            'thumb_url': thumb_url,
            **stats_meta,
        })

    out = LOG_DIR / 'p3_results.json'
    out.write_text(json.dumps(results, indent=2))
    print(f'\n[p3] saved -> {out}')
