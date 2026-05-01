"""Retry failed assets from initial pass.

- enemy-spark: re-prompt as a tiny electric ball, NOT a creature
- tile-wall-cracked-painted: tile-trap fix using square+anti-landscape pattern
"""
from __future__ import annotations
import json, time
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    submit_flux_dev, submit_birefnet, poll_until_done, extract_image_url,
    http_download, STEM, PALETTE_TAIL,
)

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SPRITES = ROOT / 'public/assets/sprites/v4'
TILES = ROOT / 'public/assets/tiles'

# enemy-spark v2 — emphasize "tiny floating ball, NOT a creature, NOT a body"
SPARK_PROMPT = (
    f'{STEM}. close-up centered macro view of ONE tiny electric energy '
    'spark-ball game hazard, NOT a creature NOT a body NOT fur NOT eyes NOT a '
    'face NOT a character, just a small phosphorescent ball of electricity, '
    'pop-magenta hot core, pop-lime electric outer halo crackling around it, '
    'lightning arc lines radiating outward, NOT in a forest NOT in a scene, '
    'isolated single energy-orb on flat neutral grey card background, faint '
    'micro-halo, painted illustration not icon, sharp focus crisp ink lines '
    f'NOT blurry. {PALETTE_TAIL}'
)

# tile-wall-cracked-painted v2 — tile-trap fix from memory:
# square + ZERO scene words + repeat anti-landscape stack
CRACKED_PROMPT = (
    'no horizon no sky no scene no painting no landscape no perspective no '
    'depth no trees no mountains no rocks no path, just a flat square stone '
    'block with three large branching cracks splitting through it, ink-aubergine '
    'deep dark crack lines forking across the surface, mushroom-cream and '
    'faded-rose painted stone-tile base, saffron-glow tip-spark at one '
    'crack-end where bomb impacted, ragged ink-line crack edges, square '
    'seamless wall-block texture for 2D platformer game, organic painted '
    'edges, woodcut illustration HEAVY INK LINEWORK ragged outline paper-grain, '
    'sharp focus crisp ink lines NOT blurry, isolated game tile asset on flat '
    'neutral grey card background, NOT a painting NOT a scene NOT artwork'
)


def gen_one(label: str, prompt_str: str, target: Path, run_birefnet: bool) -> dict:
    print(f'\n=== {label} ===')
    req_id, resp_url = submit_flux_dev(prompt_str, {'width': 1024, 'height': 1024})
    print(f'[FLUX] submitted {req_id}')
    res = poll_until_done(resp_url, label)
    if not res:
        return {'label': label, 'status': 'flux-poll-failed'}
    raw_url = extract_image_url(res)
    if not raw_url:
        return {'label': label, 'status': 'no-raw-url', 'res': res}
    raw_size = http_download(raw_url, target)
    print(f'[FLUX] raw {raw_size//1024}KB → {target}')
    out = {'label': label, 'raw_url': raw_url, 'raw_path': str(target), 'raw_size': raw_size}
    if not run_birefnet:
        out['status'] = 'cleaned'
        out['cleaned_path'] = str(target)
        return out
    # BiRefNet
    req_id, resp_url = submit_birefnet(raw_url)
    res = poll_until_done(resp_url, f'{label}-birefnet')
    if not res:
        out['status'] = 'birefnet-poll-failed'
        return out
    cleaned_url = extract_image_url(res)
    if not cleaned_url:
        out['status'] = 'birefnet-no-url'
        return out
    cleaned_target = target.with_name(target.stem + '-cleaned.png')
    csize = http_download(cleaned_url, cleaned_target)
    if csize < 5000:
        cleaned_target.unlink(missing_ok=True)
        out['cleaned_path'] = str(target)
        out['status'] = 'cleaned-fallback-raw'
    else:
        out['cleaned_url'] = cleaned_url
        out['cleaned_path'] = str(cleaned_target)
        out['cleaned_size'] = csize
        out['status'] = 'cleaned'
    print(f"[OK] {label}: {out['status']}")
    return out


results = []
results.append(gen_one('enemy-spark-v2', SPARK_PROMPT, SPRITES / 'enemy-spark.png', run_birefnet=True))
results.append(gen_one('tile-wall-cracked-painted-v2', CRACKED_PROMPT, TILES / 'tile-wall-cracked-painted.png', run_birefnet=False))

(ROOT / 'scripts/sprint7d/_retry.json').write_text(json.dumps(results, indent=2))
print('\nDone.')
