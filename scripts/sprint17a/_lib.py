"""
Sprint 17A — shared helpers (Cosmo 4 LoRA poses + Blender rig + procedural-tilt-bones).

Reuses patterns from Sprint 16A (LoRA inference) and 16B (Meshy image-to-3D).
"""
from __future__ import annotations
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
LOG_DIR = ROOT / 'scripts/sprint17a/_logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

CASE_STUDY = ROOT / 'public/assets/case-study/cosmo-rig-v17a'
POSES_DIR = CASE_STUDY / 'poses'
GLB_DIR = CASE_STUDY / 'glb'
BLENDER_DIR = CASE_STUDY / 'blender'
ATTEMPTS_DIR = CASE_STUDY / 'attempts'

LORA_URL = 'https://v3b.fal.media/files/b/0a98931e/10m_xs8iJYAfgyWc7fVbr_pytorch_lora_weights.safetensors'
TRIGGER = 'rtcosmo'

# DNA boilerplate — same as cosmo_lora_v16a memo.
DNA_TAIL = (
    'hayao moebius watercolor, NOT kawaii NOT chibi NOT Disney, '
    'chameleon bulging eye spheres glossy black with saffron catchlight, '
    'single antenna with faded rose flower bulb tip, '
    'two black flat suction cup discs at hand tips, no tail, '
    'faded rose spots on green moss-sage body, slim kid-frame'
)


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
MESHY_KEY = ENV.get('MESHY_STUDIO_API_KEY')
assert FAL_KEY, 'FAL_AI_KEY missing'
assert MESHY_KEY, 'MESHY_STUDIO_API_KEY missing'

MESHY_BASE = 'https://api.meshy.ai/openapi'


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


# ─── fal.ai LoRA inference ──────────────────────────────────────────────────

def fal_submit(endpoint: str, body: dict) -> tuple[str, str]:
    res = http_post_json(
        f'https://queue.fal.run/{endpoint}',
        {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'},
        body,
    )
    return res['request_id'], res['response_url']


def fal_poll(response_url: str, label: str, max_polls: int = 120, sleep_s: float = 3.0) -> dict | None:
    headers = {'Authorization': f'Key {FAL_KEY}'}
    status_url = response_url + '/status' if not response_url.endswith('/status') else response_url
    last = ''
    for i in range(max_polls):
        try:
            s = http_get_json(status_url, headers)
            st = s.get('status', '')
            if st != last:
                print(f'[{label}] status={st} (poll {i})')
                last = st
            if st == 'COMPLETED':
                return http_get_json(response_url, headers)
            if st in ('FAILED', 'ERROR'):
                print(f'[FAIL] {label}: {s}')
                return None
        except urllib.error.HTTPError as e:
            if e.code in (404, 425, 400):
                time.sleep(sleep_s)
                continue
            raise
        time.sleep(sleep_s)
    print(f'[TIMEOUT] {label}')
    return None


def upload_to_fal(path: Path) -> str:
    """Upload local file to fal.ai storage (for Meshy image_url)."""
    headers = {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'}
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


# ─── Meshy Studio image-to-3D ──────────────────────────────────────────────

def meshy_headers() -> dict:
    return {
        'Authorization': f'Bearer {MESHY_KEY}',
        'Content-Type': 'application/json',
    }


def meshy_submit_image_to_3d(image_url: str, art_style: str = 'realistic',
                             target_polycount: int = 22000,
                             texture_resolution: int = 2048,
                             symmetry_mode: str = 'auto') -> str:
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
    res = http_post_json(
        f'{MESHY_BASE}/v1/image-to-3d',
        meshy_headers(),
        body,
    )
    return res['result']


def meshy_poll(task_id: str, label: str, max_polls: int = 240, sleep_s: float = 5.0) -> dict | None:
    last = ''
    for i in range(max_polls):
        s = http_get_json(f'{MESHY_BASE}/v1/image-to-3d/{task_id}', meshy_headers())
        st = s.get('status', '')
        if st != last:
            prog = s.get('progress', '?')
            print(f'[{label}] status={st} progress={prog} (poll {i})')
            last = st
        if st in ('SUCCEEDED', 'COMPLETED'):
            return s
        if st in ('FAILED', 'CANCELED', 'EXPIRED'):
            print(f'[FAIL] {label}: {s.get("task_error")}')
            return None
        time.sleep(sleep_s)
    print(f'[TIMEOUT] {label}')
    return None
