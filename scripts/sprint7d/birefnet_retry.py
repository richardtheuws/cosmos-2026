"""Re-run BiRefNet on the raw assets from Sprint 7D using the fixed polling."""
from __future__ import annotations
import json, time, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    submit_birefnet, poll_until_done, extract_image_url, http_download, FAL_KEY
)

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'scripts/sprint7d/_manifest.json'

m = json.loads(MANIFEST.read_text())


def cleanup_one(job: dict) -> dict:
    if job['kind'] == 'tile':
        # tile already cleaned via fallback
        return job
    if 'raw_url' not in job:
        job['status'] = 'no-raw-url'
        return job
    label = job['label']
    try:
        req_id, resp_url = submit_birefnet(job['raw_url'])
        print(f'[BIREF] {label} submitted')
        res = poll_until_done(resp_url, f'{label}-birefnet')
        if not res:
            job['status'] = 'birefnet-poll-failed'
            return job
        cleaned_url = extract_image_url(res)
        if not cleaned_url:
            job['status'] = 'birefnet-no-url'
            print(f'[FAIL] {label}: no URL in {res}')
            return job
        cleaned_target = Path(job['target']).with_name(Path(job['target']).stem + '-cleaned.png')
        size = http_download(cleaned_url, cleaned_target)
        if size < 5000:
            print(f'[WARN] {label} BiRefNet {size}B too small, fallback to raw')
            cleaned_target.unlink(missing_ok=True)
            job['cleaned_path'] = job['raw_path']
            job['status'] = 'cleaned-fallback-raw'
        else:
            job['cleaned_url'] = cleaned_url
            job['cleaned_path'] = str(cleaned_target)
            job['cleaned_size'] = size
            job['status'] = 'cleaned'
            print(f'[OK] {label} cleaned {size//1024}KB')
    except Exception as e:
        job['status'] = 'birefnet-failed'
        job['error'] = str(e)
        print(f'[ERR] {label}: {e}')
    return job


with ThreadPoolExecutor(max_workers=4) as ex:
    futures = [ex.submit(cleanup_one, j) for j in m['flux_jobs']]
    new_jobs = [f.result() for f in as_completed(futures)]

# Preserve order by label
order = {j['label']: i for i, j in enumerate(m['flux_jobs'])}
new_jobs.sort(key=lambda j: order[j['label']])
m['flux_jobs'] = new_jobs

MANIFEST.write_text(json.dumps(m, indent=2))
ok = sum(1 for j in m['flux_jobs'] if j.get('status') in ('cleaned', 'cleaned-fallback-raw'))
print(f'\n{ok}/{len(m["flux_jobs"])} cleaned')
