#!/usr/bin/env python3
"""
Wave 26 — WebP optimizer for the shipped 4K painterly heroes.

Why: dist/ is ~431MB, backgrounds alone 206MB. A single 17MB dune PNG over
mobile breaks the first-arrival before it begins. WebP at high quality is
visually lossless on painterly art and 8-12x smaller. This is the one hard
blocker between the substrate daydream and a stranger's phone in a waiting room.

Quality discipline (NORTH-STAR best-method rule):
  - Opaque RGB/palette backgrounds -> lossy q86, method 6, sharp_yuv.
  - Anything with an alpha channel (soft glow veils, sprites) -> q92 with
    alpha_q 100 so soft gradients don't band.

Masters are git-tracked (no LFS) -> recoverable from history after `git rm`,
and regenerable via the fal pipeline. We do NOT delete here; we only emit .webp
next to each source and report. Deletion + ref-rewrite is a deliberate follow-up.

Usage:
  python3 scripts/wave26/webp_optimize.py <file-or-dir> [<file-or-dir> ...]
  python3 scripts/wave26/webp_optimize.py --dir public/assets/backgrounds
"""
import subprocess
import sys
from pathlib import Path


def png_has_alpha(path: Path) -> bool:
    """Read the PNG IHDR colour-type byte (offset 25). 4=gray+alpha, 6=RGBA.
    Palette images (3) may carry a tRNS chunk -> treat as alpha to be safe."""
    with path.open("rb") as fh:
        head = fh.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return True  # unknown -> conservative
    colour_type = head[25]
    if colour_type in (4, 6):
        return True
    if colour_type == 3:  # palette: check for a tRNS chunk anywhere
        return b"tRNS" in path.read_bytes()
    return False


def convert(png: Path, lossless: bool = False) -> tuple[int, int]:
    webp = png.with_suffix(".webp")
    alpha = png_has_alpha(png)
    if lossless:
        # Sprite-sheet atlases: sub-cell sampling means lossy macroblocks bleed
        # across frame cells. Lossless removes that risk entirely. `-exact`
        # keeps RGB in fully-transparent pixels so cell edges don't halo.
        args = ["cwebp", "-lossless", "-exact", "-m", "6",
                str(png), "-o", str(webp)]
    elif alpha:
        # `-exact` preserves transparent-area RGB -> no edge halos on cut-outs.
        args = ["cwebp", "-q", "92", "-alpha_q", "100", "-m", "6",
                "-exact", "-sharp_yuv", str(png), "-o", str(webp)]
    else:
        args = ["cwebp", "-q", "86", "-m", "6", "-sharp_yuv",
                str(png), "-o", str(webp)]
    subprocess.run(args, check=True, capture_output=True)
    return png.stat().st_size, webp.stat().st_size


def collect(targets: list[str]) -> list[Path]:
    out: list[Path] = []
    for t in targets:
        p = Path(t)
        if p.is_dir():
            out.extend(sorted(p.rglob("*.png")))
        elif p.suffix == ".png" and p.exists():
            out.append(p)
        else:
            print(f"  ! skip (not a png/dir): {t}")
    return out


def human(n: int) -> str:
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.0f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def main() -> int:
    args = sys.argv[1:]
    lossless = False
    if "--lossless" in args:
        lossless = True
        args = [a for a in args if a != "--lossless"]
    if args and args[0] == "--dir":
        args = args[1:]
    if not args:
        print(__doc__)
        return 1
    files = collect(args)
    if not files:
        print("No PNGs found.")
        return 1
    total_in = total_out = 0
    for png in files:
        a = ("LL  " if lossless else
             "RGBA" if png_has_alpha(png) else "RGB ")
        before, after = convert(png, lossless=lossless)
        total_in += before
        total_out += after
        ratio = before / after if after else 0
        print(f"  {a}  {human(before):>8} -> {human(after):>8}  "
              f"({ratio:4.1f}x)  {png.name}")
    print(f"\nTotal: {human(total_in)} -> {human(total_out)} "
          f"({total_in / total_out:.1f}x smaller, "
          f"saved {human(total_in - total_out)}) across {len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
