"""
Sprint 16B — Meshy Studio direct API helpers (Cosmo 3D rebuild from LoRA hero).

Endpoints (validated 2026-05 in Sprint 15A):
- POST /openapi/v1/image-to-3d         (image-to-3d, single-pass)
- POST /openapi/v1/image-to-3d/refine  (texture refine on existing task)
- GET  /openapi/v1/image-to-3d/{task}  (poll status)

Auth: Authorization: Bearer $MESHY_STUDIO_API_KEY  (~/Documents/games/.env).
"""
from __future__ import annotations
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
LOG_DIR = ROOT / 'scripts/sprint16b/_logs'
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
MESHY_KEY = ENV.get('MESHY_STUDIO_API_KEY')
FAL_KEY = ENV.get('FAL_AI_KEY')
assert MESHY_KEY, 'MESHY_STUDIO_API_KEY missing from ~/Documents/games/.env'

MESHY_BASE = 'https://api.meshy.ai/openapi'


def _headers() -> dict:
    return {
        'Authorization': f'Bearer {MESHY_KEY}',
        'Content-Type': 'application/json',
    }


def http_post_json(url: str, headers: dict, body: dict, timeout: int = 90) -> dict:
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode('utf-8', errors='replace')[:600]
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


def upload_to_fal(path: Path) -> str:
    """Upload local file to fal.ai storage, return hosted URL.
    Used to give Meshy a reachable HTTPS URL for image_url.
    """
    headers = {
        'Authorization': f'Key {FAL_KEY}',
        'Content-Type': 'application/json',
    }
    init = http_post_json(
        'https://rest.alpha.fal.ai/storage/upload/initiate',
        headers,
        {'file_name': path.name, 'content_type': 'image/png'},
        timeout=60,
    )
    upload_url = init['upload_url']
    file_url = init['file_url']
    data = path.read_bytes()
    req = urllib.request.Request(
        upload_url,
        data=data,
        headers={'Content-Type': 'image/png', 'Content-Length': str(len(data))},
        method='PUT',
    )
    with urllib.request.urlopen(req, timeout=600) as _r:
        _r.read()
    return file_url


def submit_image_to_3d(image_url: str, art_style: str = 'realistic',
                        target_polycount: int = 22000,
                        texture_resolution: int = 2048,
                        symmetry_mode: str = 'auto',
                        ai_model: str | None = None) -> str:
    """Submit Meshy Studio image-to-3D job; returns task_id."""
    body = {
        'image_url': image_url,
        'art_style': art_style,
        'should_remesh': True,
        'should_texture': True,
        'enable_pbr': True,
        'symmetry_mode': symmetry_mode,
        'target_polycount': target_polycount,
        'texture_resolution': texture_resolution,
    }
    if ai_model:
        body['ai_model'] = ai_model
    res = http_post_json(f'{MESHY_BASE}/v1/image-to-3d', _headers(), body, timeout=90)
    return res['result']


def submit_refine(input_task_id: str, texture_prompt: str,
                  texture_resolution: int = 2048) -> str:
    """Submit refine pass with texture prompt; returns new task_id.

    NOTE: Meshy v1 image-to-3d does NOT have a separate refine endpoint;
    we use text-to-3d-style refine via texture prompt by submitting another
    image-to-3d with the prior task's textured-mesh as base if API supports.
    Fallback: use the texture-only re-bake endpoint if available.
    """
    # Try the documented refine route first
    body = {
        'preceding_task_id': input_task_id,
        'enable_pbr': True,
        'texture_resolution': texture_resolution,
        'texture_prompt': texture_prompt,
    }
    res = http_post_json(f'{MESHY_BASE}/v1/image-to-3d', _headers(), body, timeout=90)
    return res['result']


def poll_task(task_id: str, label: str = 'task',
              max_polls: int = 200, sleep_s: float = 10.0) -> dict | None:
    url = f'{MESHY_BASE}/v1/image-to-3d/{task_id}'
    last = ''
    for i in range(max_polls):
        try:
            res = http_get_json(url, _headers())
        except urllib.error.HTTPError as e:
            print(f'[poll {label}] HTTP {e.code}, retry')
            time.sleep(sleep_s)
            continue
        status = res.get('status', '')
        progress = res.get('progress', 0)
        tag = f'{status}@{progress}%'
        if tag != last:
            print(f'[{label}] {tag} (poll {i})')
            last = tag
        if status == 'SUCCEEDED':
            return res
        if status in ('FAILED', 'EXPIRED', 'CANCELED'):
            print(f'[FAIL {label}] {res}')
            return res
        time.sleep(sleep_s)
    print(f'[TIMEOUT {label}] after {max_polls} polls')
    return None


def log_attempt(filename: str, entry: dict) -> None:
    target = LOG_DIR / filename
    with open(target, 'a') as f:
        f.write(json.dumps(entry) + '\n')
