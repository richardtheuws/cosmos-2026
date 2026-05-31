#!/usr/bin/env python3
"""
Wave 24 — best-method asset generator (CLI).

Quality is the constraint, not speed or cost (memory: best-method-not-cheapest).
This wraps the proven sprint16a fal helpers with the TOP tiers:

  • flux-pro/v1.1-ultra   — premium painterly text-to-image (aspect_ratio based;
                            ignores exact px — we crop/resize after curation).
  • recraft-v3            — illustration powerhouse, honors exact dims, has a
                            real "watercolor" style (Hayao×Moebius friendly).
  • birefnet (--alpha)    — proper neural matte to a TRUE transparent PNG
                            (never ffmpeg colorkey, never an opaque JPEG).

Output is ALWAYS a real .png (transparent when --alpha). One candidate per call;
the caller loops cN. Prints a one-line JSON result.

Usage:
  genbest.py --engine ultra   --prompt "<P>" --aspect 16:9       --out PATH.png
  genbest.py --engine recraft --prompt "<P>" --size 1024x1536    --out PATH.png [--style digital_illustration/watercolor]
  genbest.py --engine flux-pro --prompt "<P>" --size 2048x512    --out PATH.png   # exact-dim fallback
  add --alpha to matte the result to transparent PNG (birefnet).
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'sprint16a'))
from _lib import (  # type: ignore
    submit,
    poll_until_done,
    http_download,
    upload_to_fal_storage,
    extract_image_url,
)

ULTRA = 'fal-ai/flux-pro/v1.1-ultra'
FLUX_PRO = 'fal-ai/flux-pro/v1.1'
RECRAFT = 'fal-ai/recraft-v3'
BIREFNET = 'fal-ai/birefnet'

# aspect_ratio values flux-pro/v1.1-ultra accepts.
ULTRA_ASPECTS = {
    '21:9': 21 / 9, '16:9': 16 / 9, '4:3': 4 / 3, '3:2': 3 / 2, '1:1': 1.0,
    '2:3': 2 / 3, '3:4': 3 / 4, '9:16': 9 / 16, '9:21': 9 / 21,
}


def nearest_aspect(w: int, h: int) -> str:
    target = w / h
    return min(ULTRA_ASPECTS, key=lambda k: abs(ULTRA_ASPECTS[k] - target))


def gen(engine: str, prompt: str, out_raw: Path, *, aspect: str | None,
        size: tuple[int, int] | None, style: str, label: str) -> bool:
    if engine == 'ultra':
        ar = aspect or (nearest_aspect(*size) if size else '1:1')
        body = {'prompt': prompt, 'aspect_ratio': ar, 'num_images': 1, 'output_format': 'png'}
        endpoint = ULTRA
    elif engine == 'recraft':
        w, h = size or (1024, 1024)
        body = {'prompt': prompt, 'image_size': {'width': w, 'height': h}, 'style': style}
        endpoint = RECRAFT
    elif engine == 'flux-pro':
        w, h = size or (1024, 1024)
        body = {'prompt': prompt, 'image_size': {'width': w, 'height': h}, 'num_images': 1}
        endpoint = FLUX_PRO
    else:
        raise SystemExit(f'unknown engine: {engine}')

    req_id, resp_url = submit(endpoint, body)
    res = poll_until_done(resp_url, label, max_polls=120, sleep_s=2.5)
    url = extract_image_url(res)
    if not url:
        print(json.dumps({'ok': False, 'stage': 'gen', 'engine': endpoint, 'label': label}))
        return False
    http_download(url, out_raw)
    return True


def matte(src: Path, out: Path, label: str) -> bool:
    """BiRefNet neural matte → transparent PNG."""
    hosted = upload_to_fal_storage(src)
    req_id, resp_url = submit(BIREFNET, {'image_url': hosted})
    res = poll_until_done(resp_url, f'{label}:matte', max_polls=120, sleep_s=2.5)
    url = extract_image_url(res)
    if not url:
        print(json.dumps({'ok': False, 'stage': 'matte', 'label': label}))
        return False
    http_download(url, out)
    return True


def parse_size(s: str | None) -> tuple[int, int] | None:
    if not s:
        return None
    w, h = s.lower().split('x')
    return int(w), int(h)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', required=True, choices=['ultra', 'recraft', 'flux-pro'])
    ap.add_argument('--prompt', required=True)
    ap.add_argument('--out', required=True, help='final .png path')
    ap.add_argument('--aspect', help='ultra aspect_ratio (e.g. 16:9); else derived from --size')
    ap.add_argument('--size', help='WxH for recraft/flux-pro (and ultra aspect derivation)')
    ap.add_argument('--style', default='digital_illustration/watercolor', help='recraft style')
    ap.add_argument('--alpha', action='store_true', help='matte to transparent PNG via birefnet')
    args = ap.parse_args()

    out = Path(args.out)
    if out.suffix.lower() != '.png':
        out = out.with_suffix('.png')
    size = parse_size(args.size)
    label = out.parent.name + '/' + out.stem

    raw = out.with_name(out.stem + '.raw.png')
    if not gen(args.engine, args.prompt, raw, aspect=args.aspect, size=size,
               style=args.style, label=label):
        return 1

    if args.alpha:
        ok = matte(raw, out, label)
        raw.unlink(missing_ok=True)
        if not ok:
            return 1
    else:
        raw.replace(out)

    print(json.dumps({'ok': True, 'out': str(out), 'engine': args.engine,
                      'alpha': args.alpha, 'bytes': out.stat().st_size}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
