"""
Sprint 16A — fal.ai shared helpers (Cosmo-LoRA fine-tune).

Reused submission/polling pattern from sprint13d/_lib.py with longer
timeout for training jobs (LoRA fast-training takes ~5-10 min).
"""
from __future__ import annotations
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
LOG_DIR = ROOT / 'scripts/sprint16a/_logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)


def load_env() -> dict:
    env = {}
    with open(Path.home() / 'Documents/games/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip("'").strip('"')
    return env


ENV = load_env()
FAL_KEY = ENV.get('FAL_AI_KEY')
assert FAL_KEY, 'FAL_AI_KEY missing from ~/Documents/games/.env'


def http_post_json(url: str, headers: dict, body: dict, timeout: int = 90) -> dict:
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode('utf-8', errors='replace')[:500]
        raise RuntimeError(f'HTTP {e.code} on POST {url}: {body_txt}') from None


def http_post_raw(url: str, headers: dict, body_bytes: bytes, timeout: int = 240) -> dict:
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode('utf-8', errors='replace')[:500]
        raise RuntimeError(f'HTTP {e.code} on POST {url}: {body_txt}') from None


def http_get_json(url: str, headers: dict, timeout: int = 90) -> dict:
    req = urllib.request.Request(url, headers=headers, method='GET')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def http_download(url: str, target: Path, timeout: int = 600) -> int:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return len(data)


def submit(endpoint: str, body: dict) -> tuple[str, str]:
    """Submit a fal.ai job; returns (request_id, response_url)."""
    res = http_post_json(
        f'https://queue.fal.run/{endpoint}',
        {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'},
        body,
    )
    return res['request_id'], res['response_url']


def poll_until_done(response_url: str, label: str, max_polls: int = 600, sleep_s: float = 3.0) -> dict | None:
    """Poll status_url until COMPLETED, then GET response_url for result.

    Defaults: 600 polls × 3s = 30 min, suited for LoRA training (~5-15 min).
    """
    headers = {'Authorization': f'Key {FAL_KEY}'}
    status_url = response_url + '/status' if not response_url.endswith('/status') else response_url
    last_status = ''
    for i in range(max_polls):
        try:
            status_res = http_get_json(status_url, headers)
            status = status_res.get('status', '')
            if status != last_status:
                print(f'[{label}] status={status} (poll {i})')
                last_status = status
            if status == 'COMPLETED':
                try:
                    return http_get_json(response_url, headers)
                except urllib.error.HTTPError as e:
                    print(f'[FAIL] {label}: response fetch HTTP {e.code}')
                    return None
            if status in ('FAILED', 'ERROR'):
                print(f'[FAIL] {label}: status={status} {status_res}')
                return None
        except urllib.error.HTTPError as e:
            if e.code in (404, 425, 400):
                time.sleep(sleep_s)
                continue
            raise
        time.sleep(sleep_s)
    print(f'[TIMEOUT] {label} after {max_polls} polls')
    return None


def extract_image_url(payload: dict | None) -> str | None:
    if not payload:
        return None
    if 'images' in payload and payload['images']:
        first = payload['images'][0]
        if isinstance(first, dict):
            return first.get('url')
        return first
    if 'image' in payload:
        img = payload['image']
        if isinstance(img, dict):
            return img.get('url')
        return img
    return None


def log_attempt(filename: str, entry: dict) -> None:
    target = LOG_DIR / filename
    with open(target, 'a') as f:
        f.write(json.dumps(entry) + '\n')


def upload_to_fal_storage(path: Path) -> str:
    """Upload a local file to fal.ai storage; returns hosted URL.

    Uses the fal.ai REST upload endpoint (initiate -> PUT to upload_url -> get URL).
    """
    # Step 1: initiate upload — POST file metadata
    headers = {
        'Authorization': f'Key {FAL_KEY}',
        'Content-Type': 'application/json',
    }
    suffix = path.suffix.lower().lstrip('.')
    mime_map = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'webp': 'image/webp', 'zip': 'application/zip', 'txt': 'text/plain',
    }
    content_type = mime_map.get(suffix, 'application/octet-stream')
    init_body = {'file_name': path.name, 'content_type': content_type}
    init = http_post_json('https://rest.alpha.fal.ai/storage/upload/initiate',
                          headers, init_body, timeout=60)
    upload_url = init['upload_url']
    file_url = init['file_url']

    # Step 2: PUT raw bytes to upload_url
    data = path.read_bytes()
    req = urllib.request.Request(
        upload_url,
        data=data,
        headers={'Content-Type': content_type, 'Content-Length': str(len(data))},
        method='PUT',
    )
    with urllib.request.urlopen(req, timeout=600) as r:
        _ = r.read()
    return file_url
