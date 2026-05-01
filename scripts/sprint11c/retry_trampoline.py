"""Sprint 11C — One more shot at the trampoline tile.

The first try gave a ring on watercolor BG. The second try gave a kaleidoscope
sun-burst (ribbed cap viewed from below). What we need is a SOFT MUSHROOM-CAP
DOME viewed from a 3/4 ANGLE, ink-line + watercolor, taking up most of the
square frame, with a saffron-glow rim suggesting bounce energy. Switch to
Flux Dev (more flexibility / less photorealistic bias) and explicitly describe
'illustration of a mushroom-cap dome from a slight angle'.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    submit_flux, poll_until_done, extract_image_url, http_download,
    TILE_STYLE, PALETTE, TILES_DIR
)

PROMPT = (
    'a hand-painted illustration of a soft pink-peach mushroom cap dome viewed '
    'from a slight 3/4 angle, the dome is plump and rounded like a small '
    'inflated cushion taking up the bottom 80 percent of the square frame, '
    'faded-rose pink-peach gradient on the dome with mushroom-cream paler top '
    'highlight, saffron-glow orange warm rim catching the bottom edge of the '
    'cap suggesting bounce-energy springing upward, faint sky-wash-blue cosmic '
    'spark dots floating just above the cap surface, ink-aubergine ragged '
    'outline around the cap, soft watercolor wash on the cap surface, NOT a '
    'ring NOT a flat ribbon NOT a sun-burst NOT a kaleidoscope, just one '
    'plump mushroom-cap dome filling the square. '
    f'{TILE_STYLE}, {PALETTE}, '
    'NO landscape NO sky NO horizon NO scene, isolated game asset on flat '
    'neutral cream paper card background, sharp focus crisp ink lines'
)


def main():
    target = TILES_DIR / 'tile-trampoline-painted-v3.png'
    print('=== Sprint 11C — trampoline retry (Flux Dev) ===')
    req_id, resp_url = submit_flux('fal-ai/flux/dev', PROMPT, {'width': 1024, 'height': 1024})
    print(f'submitted {req_id}')
    res = poll_until_done(resp_url, 'tile-trampoline-v3c')
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
