#!/usr/bin/env python3
"""
Wave 24 — promote curated picks to final asset paths.

Reads wave24-picks.json ({dir:{file,target}}) and for each pick:
  1. If the asset needs alpha and the pick lacks real transparency -> BiRefNet matte.
  2. If the target is larger than the source -> ESRGAN x4 upscale (best method, not naive resize).
  3. Cover-fit + centre-crop to the EXACT target dims (alpha preserved).
  4. Write the final PNG into public/assets/...

Usage: python3 scripts/wave24/promote.py [path/to/wave24-picks.json]
       (defaults to ~/Downloads/wave24-picks.json)
"""
from __future__ import annotations
import json
import sys
import tempfile
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'sprint16a'))
from _lib import submit, poll_until_done, http_download, upload_to_fal_storage, extract_image_url  # type: ignore

ROOT = Path(__file__).resolve().parent.parent.parent
CAND = ROOT / '.wave24-candidates'

# Exact final pixel dims per asset dir (from the per-world runbooks / BUILD-STATUS §5).
DIMS = {
    'ink-water-surface-4k': (4096, 2731), 'ink-water-abyss-4k': (4096, 2731),
    'spore-chart-void-4k': (3840, 2160), 'spore-chart-nebula-wash': (2560, 1600),
    'biome-dusk-dune-4k': (3840, 2160), 'biome-dusk-hollow-4k': (3840, 2160),
    'biome-dusk-dune__layer-1_dusk-sky-gradient': (2048, 1024),
    'biome-dusk-dune__layer-2_heat-shimmer-horizon': (2048, 512),
    'biome-dusk-dune__layer-3_far-dune-ranks': (2048, 600),
    'biome-dusk-dune__layer-4_mid-dunes': (2048, 640),
    'biome-dusk-dune__layer-5_near-crest': (2048, 720),
    'biome-dusk-dune__layer-6_foreground-sand-grain': (2048, 1024),
    'biome-dusk-hollow__layer-1_narrow-dusk-sky': (1536, 1024),
    'biome-dusk-hollow__layer-2_far-dune-wall': (1536, 700),
    'biome-dusk-hollow__layer-3_cupping-dune-walls': (1536, 900),
    'biome-dusk-hollow__layer-4_rippled-bowl-floor': (1536, 640),
    'biome-dusk-hollow__layer-5_settling-sand-shimmer': (1536, 1024),
    'sunbeam-patch': (1024, 1024), 'glow-cap-cluster': (768, 768),
    'kelp-organ': (1024, 1536), 'updraft-current': (1024, 1536),
    'jellyfish-cyan': (512, 640), 'deep-glow-lure': (512, 512),
    'light-shaft': (512, 1536), 'water-motes': (1024, 1024),
    'slide-crest': (1024, 512), 'glass-bead-bloom': (512, 384), 'wind-bowl': (1024, 512),
    'spore-bloom-core': (1024, 1024), 'spore-bloom-becoming': (1024, 1024),
}

# Assets that MUST carry true transparency (normal/soft-alpha blend in-engine).
ALPHA_ASSETS = {
    'kelp-organ', 'glass-bead-bloom', 'wind-bowl', 'spore-bloom-core',
    'spore-bloom-becoming', 'spore-chart-nebula-wash',
    'biome-dusk-dune__layer-3_far-dune-ranks', 'biome-dusk-dune__layer-4_mid-dunes',
    'biome-dusk-dune__layer-5_near-crest',
    'biome-dusk-hollow__layer-2_far-dune-wall', 'biome-dusk-hollow__layer-3_cupping-dune-walls',
    'biome-dusk-hollow__layer-4_rippled-bowl-floor',
}


def has_real_alpha(im: Image.Image) -> bool:
    if im.mode not in ('RGBA', 'LA'):
        return False
    a = im.getchannel('A')
    lo, hi = a.getextrema()
    return lo < 250  # some genuinely transparent pixels


def birefnet_matte(src: Path) -> Path:
    hosted = upload_to_fal_storage(src)
    req, resp = submit('fal-ai/birefnet', {'image_url': hosted})
    res = poll_until_done(resp, f'matte:{src.parent.name}', max_polls=120, sleep_s=2.5)
    url = extract_image_url(res)
    if not url:
        raise RuntimeError(f'birefnet failed for {src}')
    out = src.with_name(src.stem + '.matted.png')
    http_download(url, out)
    return out


def esrgan_image(im: Image.Image, label: str) -> Image.Image:
    """ESRGAN x4 an RGB image (drops alpha — callers handle alpha separately)."""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
        tmp = Path(tf.name)
    im.convert('RGB').save(tmp, 'PNG')
    hosted = upload_to_fal_storage(tmp)
    req, resp = submit('fal-ai/esrgan', {'image_url': hosted, 'scale': 4})
    res = poll_until_done(resp, f'esrgan:{label}', max_polls=120, sleep_s=2.5)
    url = extract_image_url(res)
    tmp.unlink(missing_ok=True)
    if not url:
        raise RuntimeError(f'esrgan failed for {label}')
    out = tmp.with_name(tmp.stem + '.up.png')
    http_download(url, out)
    up = Image.open(out).convert('RGB')
    up.load()
    out.unlink(missing_ok=True)
    return up


def upscale_preserving_alpha(im: Image.Image, label: str) -> Image.Image:
    """ESRGAN the colour, Lanczos the alpha, recombine — alpha survives upscale."""
    if im.mode == 'RGBA':
        alpha = im.getchannel('A')
        up = esrgan_image(im, label)
        up = up.convert('RGBA')
        up.putalpha(alpha.resize(up.size, Image.LANCZOS))
        return up
    return esrgan_image(im, label)


def cover_crop(im: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - tw) // 2, (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def promote(dirname: str, file: str, target_rel: str) -> dict:
    src = CAND / dirname / file
    if not src.exists():
        return {'asset': dirname, 'ok': False, 'note': f'source missing: {src}'}
    if dirname not in DIMS:
        return {'asset': dirname, 'ok': False, 'note': 'no DIMS entry'}
    tw, th = DIMS[dirname]
    steps = []

    work = src
    need_alpha = dirname in ALPHA_ASSETS

    # 1. Matte FIRST if alpha required but missing (cheap at native res, and the
    #    alpha must survive any later upscale).
    if need_alpha:
        im = Image.open(work)
        missing = not has_real_alpha(im)
        im.close()
        if missing:
            work = birefnet_matte(work)
            steps.append('birefnet-matte')

    im = Image.open(work)
    im = im.convert('RGBA') if (need_alpha or im.mode == 'RGBA') else im.convert('RGB')
    sw, sh = im.size

    # 2. ESRGAN upscale if the source is smaller than target — alpha-preserving
    #    (ESRGAN drops alpha, so we ESRGAN the colour and Lanczos the matte).
    if sw < tw or sh < th:
        im = upscale_preserving_alpha(im, dirname)
        steps.append(f'esrgan-x4 ({sw}x{sh}->{im.size[0]}x{im.size[1]})')

    # 3. Cover-fit + centre-crop to exact dims (alpha preserved).
    im = cover_crop(im, tw, th)
    steps.append(f'fit {tw}x{th}')

    target = ROOT / target_rel
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target, 'PNG')
    im.close()
    return {'asset': dirname, 'ok': True, 'target': target_rel,
            'dims': f'{tw}x{th}', 'alpha': need_alpha, 'steps': steps,
            'bytes': target.stat().st_size}


def main() -> int:
    picks_path = Path(sys.argv[1]) if len(sys.argv) > 1 else (Path.home() / 'Downloads/wave24-picks.json')
    picks = json.loads(picks_path.read_text())
    print(f'[promote] {len(picks)} picks from {picks_path}\n')

    ok, fail = [], []
    for dirname, info in sorted(picks.items()):
        try:
            r = promote(dirname, info['file'], info['target'])
        except Exception as e:  # keep going; report at end
            r = {'asset': dirname, 'ok': False, 'note': f'{type(e).__name__}: {e}'}
        (ok if r['ok'] else fail).append(r)
        mark = 'OK ' if r['ok'] else 'XX '
        detail = ' | '.join(r.get('steps', [])) if r['ok'] else r.get('note', '')
        print(f'  {mark}{dirname:48} {detail}')

    print(f'\n[promote] {len(ok)} placed, {len(fail)} failed.')
    if fail:
        print('  FAILED:', ', '.join(f["asset"] for f in fail))
    return 0 if not fail else 1


if __name__ == '__main__':
    raise SystemExit(main())
