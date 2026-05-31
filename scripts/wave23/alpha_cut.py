"""
Wave 23 — per-frame alpha-cut via BiRefNet (fal-ai/birefnet).

Proves the one unproven step of the painted-frames pipeline: turning the
black-background i2v frames into clean RGBA cut-outs that composite onto the
watercolor scene. Reuses the sprint16a fal helpers + the proven endpoint from
fase-b-batch.sh.

Usage:  python3 scripts/wave23/alpha_cut.py <in_dir> <out_dir> [stride]
  stride N → process every Nth frame (for cheap validation). Default 1 (all).
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'sprint16a'))
from _lib import submit, poll_until_done, http_download, upload_to_fal_storage, extract_image_url  # type: ignore

ENDPOINT = 'fal-ai/birefnet'


def cut_frame(src: Path, dst: Path) -> bool:
    image_url = upload_to_fal_storage(src)
    req_id, resp_url = submit(ENDPOINT, {'image_url': image_url})
    res = poll_until_done(resp_url, label=src.name, max_polls=120, sleep_s=2.0)
    url = extract_image_url(res)
    if not url:
        print(f'[alpha] {src.name}: no image in payload -> {res}')
        return False
    sz = http_download(url, dst)
    print(f'[alpha] {src.name} -> {dst.name} ({sz/1e3:.0f} KB)')
    return True


if __name__ == '__main__':
    in_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    stride = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    out_dir.mkdir(parents=True, exist_ok=True)

    frames = sorted(in_dir.glob('f*.png'))[::stride]
    print(f'[alpha] cutting {len(frames)} frames (stride={stride}) from {in_dir}')
    ok = 0
    for f in frames:
        if cut_frame(f, out_dir / f.name):
            ok += 1
    print(f'[alpha] DONE — {ok}/{len(frames)} cut -> {out_dir}')
