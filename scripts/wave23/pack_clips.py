"""
Wave 23 — pack generated clips into shippable frame atlases.

For each clip: ffmpeg-extract frames from the mp4 → per-frame BiRefNet alpha-cut
(parallel) → ffmpeg-tile into one RGBA atlas PNG → accumulate manifest.json.

Outputs (committed, served by the game):
  public/assets/cosmo-frames/<clip>.png
  public/assets/cosmo-frames/manifest.json

Usage:  python3 scripts/wave23/pack_clips.py --core | <names...>
"""
from __future__ import annotations
import json
import math
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from alpha_cut import cut_frame  # type: ignore

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WORK = HERE / '_work'
OUT = ROOT / 'public/assets/cosmo-frames'
CFG = json.loads((HERE / 'clips.json').read_text())
CELL = 256  # atlas cell size (px). Cosmo renders small; 256 is perf-safe.


def select(argv):
    clips = CFG['clips']
    if '--core' in argv:
        return [c for c in clips if c.get('core')]
    names = [a for a in argv if not a.startswith('--')]
    return [c for c in clips if c['name'] in names] if names else clips


def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)


def pack_clip(c: dict) -> dict | None:
    name, fps = c['name'], c.get('fps', 12)
    mp4 = WORK / name / 'clip.mp4'
    if not mp4.exists():
        print(f'[pack] SKIP {name}: no clip.mp4'); return None
    frames_dir = WORK / name / 'frames'
    cut_dir = WORK / name / 'cut'
    frames_dir.mkdir(parents=True, exist_ok=True)
    cut_dir.mkdir(parents=True, exist_ok=True)

    # 1. extract frames
    for p in frames_dir.glob('f*.png'):
        p.unlink()
    ff('-i', str(mp4), '-vf', f'fps={fps}', str(frames_dir / 'f%03d.png'))
    frames = sorted(frames_dir.glob('f*.png'))
    print(f'[pack] {name}: {len(frames)} frames @ {fps}fps')

    # 2. alpha-cut each frame (parallel)
    def cut(p): return cut_frame(p, cut_dir / p.name)
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(cut, frames))
    cuts = sorted(cut_dir.glob('f*.png'))
    print(f'[pack] {name}: {sum(bool(r) for r in results)}/{len(frames)} cut')
    if not cuts:
        return None

    # 3. tile into one atlas (square-ish grid). Missing cells = transparent.
    n = len(cuts)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    OUT.mkdir(parents=True, exist_ok=True)
    ff('-i', str(cut_dir / 'f%03d.png'),
       '-vf', f'scale={CELL}:{CELL},tile={cols}x{rows}:padding=0:color=black@0.0',
       '-frames:v', '1', str(OUT / f'{name}.png'))
    print(f'[pack] {name}: atlas {cols}x{rows} ({n} frames) -> {name}.png')

    return {'file': f'{name}.png', 'cols': cols, 'rows': rows, 'count': n,
            'cell': CELL, 'fps': fps, 'loop': bool(c.get('loop'))}


if __name__ == '__main__':
    chosen = select(sys.argv[1:])
    manifest_path = OUT / 'manifest.json'
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text()).get('clips', {})
    for c in chosen:
        entry = pack_clip(c)
        if entry:
            manifest[c['name']] = entry
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps({'clips': manifest}, indent=2))
    print(f'[pack] manifest -> {manifest_path} ({len(manifest)} clips)')
