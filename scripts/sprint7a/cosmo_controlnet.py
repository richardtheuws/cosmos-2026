"""
Sprint 7A — Multi-frame Cosmo via Flux Control LoRA Canny

Pipeline per frame:
  1. Upload skeleton-{pose}.png as control_lora_image_url (HARD pose constraint via Canny)
  2. Upload cosmo-canonical-v2-cleaned.png as image_url (low-strength style ref)
  3. Call fal-ai/flux-control-lora-canny with character DNA prompt
  4. Save raw result to case-study/cosmo-multi-frame/raw-{pose}.png
  5. Run BiRefNet (fal-ai/birefnet/v2) for transparent PNG
  6. Save final to public/assets/sprites/v3/cosmo-{pose}.png

Strategy: TEST WITH walk-1 FIRST. Only batch other 5 if walk-1 succeeds visually.

Usage:
  python3 scripts/sprint7a/cosmo_controlnet.py test         # only walk-1
  python3 scripts/sprint7a/cosmo_controlnet.py batch        # remaining 5 (after test approved)
  python3 scripts/sprint7a/cosmo_controlnet.py all          # all 6 in one go
"""
from __future__ import annotations
import os, sys, time, json, urllib.request, urllib.error
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SKEL_DIR = ROOT / 'public/assets/case-study/cosmo-multi-frame/skeletons'
PROC_DIR = ROOT / 'public/assets/case-study/cosmo-multi-frame'
SPRITE_DIR = ROOT / 'public/assets/sprites/v3'
CANONICAL = SPRITE_DIR / 'cosmo-canonical-v2-cleaned.png'

# Cost-tracking record
LEDGER = PROC_DIR / '_cost-ledger.json'


def load_env():
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
FAL_KEY = ENV['FAL_AI_KEY']
HEADERS = {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'}


def http_post(url, payload, headers=None):
    headers = headers or HEADERS
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f'  HTTP {e.code}: {e.read().decode()[:600]}')
        raise


def http_get(url, headers=None):
    headers = headers or HEADERS
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload_file(path: Path) -> str:
    init = http_post(
        'https://rest.alpha.fal.ai/storage/upload/initiate',
        {'content_type': 'image/png', 'file_name': path.name},
    )
    with open(path, 'rb') as f:
        data = f.read()
    req = urllib.request.Request(
        init['upload_url'],
        data=data,
        headers={'Content-Type': 'image/png'},
        method='PUT',
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        r.read()
    print(f'  uploaded {path.name} -> {init["file_url"][:60]}...')
    return init['file_url']


def download(url: str, out: Path):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    out.write_bytes(data)
    print(f'  saved {out.name} ({len(data)//1024}KB)')


def submit_and_poll(endpoint: str, payload: dict, label: str, max_wait_s: int = 600) -> dict:
    print(f'  submit {label}...')
    sub = http_post(f'https://queue.fal.run/{endpoint}', payload)
    response_url = sub['response_url']
    status_url = sub['status_url']
    deadline = time.time() + max_wait_s
    i = 0
    while time.time() < deadline:
        time.sleep(5)
        i += 1
        st = http_get(status_url)
        if st.get('status') == 'COMPLETED':
            return http_get(response_url)
        if st.get('status') in ('FAILED', 'ERROR'):
            raise RuntimeError(f'fal failed: {st}')
        if i % 4 == 0:
            print(f'    polling... ({i*5}s, status={st.get("status")})')
    raise TimeoutError(f'{label} timed out after {max_wait_s}s')


# Character-DNA prompt — NO pose info (skeleton handles that), only character + style
# Style-first ordering: when control_lora_strength is 1.2+, the canny dominates
# composition. To prevent style-collapse to flat-line-art we front-load style cues.
COSMO_DNA = (
    'Studio Ghibli watercolor painting hand-drawn illustration, Moebius and Tenniel '
    'aesthetic, RICH PAINTERLY watercolor wash with ink-aubergine ragged outline, '
    'paper-grain texture, soft brushstrokes, layered watercolor pigment, '
    'small green pear-shaped alien kid character with moss-sage soft green skin, '
    'faded-rose freckle spots scattered on skin, '
    'single big solemn black ink eye with tiny saffron catchlight, slight overbite mouth, '
    'single thin antenna on top of head ending in a faded-rose flower-bulb tip, '
    'TWO LONG SUCTION-CUP HANDS dangling from arms, each hand ends in a LARGE FLAT '
    'PURE OBSIDIAN-BLACK ROUND DISC PAD like a glossy black rubber toilet plunger head, '
    'discs are jet-black smooth shiny circles bigger than a thumb, '
    'small painted feet, naked alien-kid body without clothes, '
    'off-white textured watercolor paper card background, '
    'NOT digital NOT 3D NOT photoreal NOT flat-line-art NOT outline-drawing NOT vector '
    'NOT kawaii NOT chibi NOT sparkle-eye NOT eyelashes NOT roswell-grey-alien '
    'NOT two antennae NOT pair-of-antennae NOT tail NOT lizard-tail '
    'NOT fingers NOT claws NOT human-hands NOT mittens NOT gray-discs '
    'NOT mushroom-cap-head NOT outfit NOT clothes NOT signature NOT watermark'
)


def gen_frame(pose_name: str, skeleton_url: str, canonical_url: str | None,
              control_strength: float = 1.2, suffix: str = '') -> dict:
    """Run flux-control-lora-canny + birefnet for one pose. Returns paths + cost."""
    raw_out = PROC_DIR / f'raw-{pose_name}{suffix}.png'
    final_out = SPRITE_DIR / f'cosmo-{pose_name}.png'

    print(f'\n=== {pose_name}{suffix} (strength={control_strength}) ===')
    payload = {
        'prompt': COSMO_DNA,
        'control_lora_image_url': skeleton_url,
        'control_lora_strength': control_strength,
        'image_size': 'square_hd',
        'num_inference_steps': 35,
        'guidance_scale': 4.5,
        'num_images': 1,
        'output_format': 'png',
        'preprocess_depth': True,
    }
    # NOTE Sprint 5B/7A learning: passing canonical as image_url drags pose BACK
    # to canonical neutral-standing. Skeleton-only is the correct approach —
    # canny gives pose, prompt gives character.
    if canonical_url:
        payload['image_url'] = canonical_url

    out = submit_and_poll('fal-ai/flux-control-lora-canny', payload, f'control-canny-{pose_name}{suffix}')
    if 'images' not in out or not out['images']:
        raise RuntimeError(f'no images returned: {out}')
    raw_url = out['images'][0]['url']
    download(raw_url, raw_out)

    # BiRefNet for transparency
    print(f'  birefnet {pose_name}...')
    bref = submit_and_poll(
        'fal-ai/birefnet/v2',
        {'image_url': raw_url, 'model': 'General Use (Heavy)', 'output_format': 'png'},
        f'birefnet-{pose_name}',
    )
    if 'image' in bref:
        clean_url = bref['image']['url']
    elif 'images' in bref and bref['images']:
        clean_url = bref['images'][0]['url']
    else:
        raise RuntimeError(f'birefnet returned no image: {bref}')
    download(clean_url, final_out)

    return {
        'pose': pose_name,
        'raw_path': str(raw_out.relative_to(ROOT)),
        'final_path': str(final_out.relative_to(ROOT)),
        'control_lora_strength': 0.85,
        'cost_estimate_usd': 0.085,  # Flux Canny ~$0.04/MP * 1MP + BiRefNet ~$0.02 + tip
    }


def upload_inputs() -> tuple[dict, str]:
    """Upload all 6 skeletons + canonical once, return urls dict."""
    print('Uploading skeletons + canonical...')
    skeleton_urls: dict[str, str] = {}
    for skel in sorted(SKEL_DIR.glob('skeleton-*.png')):
        name = skel.stem.replace('skeleton-', '')
        skeleton_urls[name] = upload_file(skel)
    canonical_url = upload_file(CANONICAL)
    return skeleton_urls, canonical_url


def write_ledger(records: list[dict]):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if LEDGER.exists():
        try:
            existing = json.loads(LEDGER.read_text())
        except Exception:
            existing = []
    existing.extend(records)
    LEDGER.write_text(json.dumps(existing, indent=2))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'test'
    skel_urls, canonical_url = upload_inputs()

    # Mode interpretation:
    #   test           : walk-1 only, skeleton-only (no canonical image_url),
    #                    strength 1.2 — proves pose-fidelity isolated from canonical bias
    #   test2          : walk-1 only, skeleton-only, strength 1.5 (max push)
    #   batch          : remaining 5 with the strategy that worked in test
    #   all            : all 6 in one go
    #   redo-walk2     : redo just walk-2 (single-frame retry)
    use_canonical = True
    strength = 1.2
    if mode == 'redo-walk2':
        targets = ['walk-2']
        use_canonical = False
        strength = 1.2
    elif mode == 'test':
        targets = ['walk-1']
        use_canonical = False
        strength = 1.2
    elif mode == 'test2':
        targets = ['walk-1']
        use_canonical = False
        strength = 1.2  # back to 1.2, but with style-first prompt
    elif mode == 'batch':
        targets = ['walk-2', 'jump-up', 'jump-fall', 'cling-right', 'hurt']
        use_canonical = False
        strength = 1.2
    elif mode == 'all':
        targets = ['walk-1', 'walk-2', 'jump-up', 'jump-fall', 'cling-right', 'hurt']
        use_canonical = False
        strength = 1.2
    else:
        raise SystemExit(f'unknown mode: {mode}')

    canonical_arg = canonical_url if use_canonical else None
    suffix = '-v2' if mode == 'test' else ('-v3' if mode == 'test2' else '')
    records = []
    for pose in targets:
        try:
            rec = gen_frame(pose, skel_urls[pose], canonical_arg, strength, suffix)
            records.append(rec)
        except Exception as e:
            print(f'!! {pose} failed: {e}')
            records.append({'pose': pose, 'error': str(e)})

    write_ledger(records)
    print('\n=== SUMMARY ===')
    for r in records:
        ok = 'OK ' if 'error' not in r else 'ERR'
        print(f'  {ok} {r.get("pose")}: {r.get("final_path", r.get("error"))}')
    total_cost = sum(r.get('cost_estimate_usd', 0) for r in records)
    print(f'\n  estimated total cost: ${total_cost:.2f}')


if __name__ == '__main__':
    main()
