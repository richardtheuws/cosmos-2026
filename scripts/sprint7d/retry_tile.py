"""Retry tile-wall-cracked — apply tile-trap fix from memory:
- NO STEM (scene-magnet keywords)
- Square seamless macro photo of a damaged stone block, ZERO landscape vocab.
"""
from __future__ import annotations
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    submit_flux_dev, poll_until_done, extract_image_url, http_download
)

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
TILES = ROOT / 'public/assets/tiles'

# Strip-style: macro close-up texture, no scene words at all, no STEM.
PROMPT = (
    'macro close-up texture of a single stone-block tile with three large '
    'branching cracks splitting through it, viewed flat from directly above '
    'filling the entire square frame edge to edge with no border, '
    'mushroom-cream and faded-rose painted stone surface, ink-aubergine deep '
    'dark crack lines forking across the surface, saffron-glow orange spark '
    'glow at one crack tip, ragged ink-line crack edges, paper-grain '
    'watercolor texture, woodcut illustration style with HEAVY INK LINEWORK '
    'and ragged outline, NO landscape NO scene NO sky NO horizon NO mountains '
    'NO trees NO sun NO sunset NO ground NO floor NO perspective NO depth, '
    'just a flat damaged wall texture asset for 2D platformer videogame, '
    'sharp focus crisp ink lines NOT blurry NOT painting'
)


def main():
    target = TILES / 'tile-wall-cracked-painted.png'
    print('=== tile-wall-cracked-painted v3 ===')
    req_id, resp_url = submit_flux_dev(PROMPT, {'width': 1024, 'height': 1024})
    print(f'submitted {req_id}')
    res = poll_until_done(resp_url, 'tile-wall-cracked-v3')
    if not res:
        print('FAIL')
        return
    url = extract_image_url(res)
    if not url:
        print(f'no url: {res}')
        return
    size = http_download(url, target)
    print(f'OK {size//1024}KB → {target}')


if __name__ == '__main__':
    main()
