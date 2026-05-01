"""
Sprint 11C — Retry pass for tiles that came back with composition issues:

  - tile-ground v3:  came back as 'macro photo of moss-frame around empty center'
                     → need SEAMLESS edge-to-edge moss carpet
  - tile-dirt v3:    came back as 'border veins around empty pink center'
                     → need SEAMLESS pink earth with veins THROUGHOUT
  - tile-trampoline v3: came back as a 'pool inflatable ring' on watercolor BG
                     → need a flat mushroom-cap viewed from ABOVE filling frame
  - tile-spike v3 (per-tile fallback): came back as ONE huge 1024-tall thorn-tower
                     → need cluster of 3-4 SHORT spikes baseline at bottom

Pattern: aggressively forbid 'border' / 'frame' / 'around the edges' / 'empty
center' / 'centered subject' compositions. Lead the prompt with 'seamless
texture filling 100% of the square edge to edge with no border'.

Memory note added: Flux Pro v1.1 has a strong sample bias toward 'macro photo
of subject AT THE EDGES with empty center' when prompted with 'macro close-up'.
That's why the ground/dirt/trampoline tiles came back as borders. Fix is to
explicitly forbid the edge-only composition and demand uniform seamless coverage.
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    submit_flux, poll_until_done, extract_image_url, http_download,
    TILE_STYLE, PALETTE, ROOT, TILES_DIR
)

# ============================================================================
# Stronger anti-border rider
# ============================================================================
SEAMLESS_RIDER = (
    'SEAMLESS UNIFORM TEXTURE filling 100 percent of the square frame edge to '
    'edge with the SAME density and detail in the CENTER as at the EDGES, '
    'tileable repeating texture, NO empty center NO border-only composition '
    'NO subject-at-edges NO frame-around-empty-middle NO vignette, the '
    'texture extends uniformly across the entire square, viewed from directly '
    'above flat, NO landscape NO scene NO sky NO horizon NO perspective NO '
    'depth NO border NO frame, just a 2D platformer game tile texture asset '
    'sharp focus crisp ink lines NOT blurry'
)

# ============================================================================
# 1. tile-ground retry — uniform moss carpet edge-to-edge
# ============================================================================
GROUND_V3B = (
    f'{SEAMLESS_RIDER}. '
    'a uniform carpet of saturated moss-sage green forest moss covering the '
    'ENTIRE square frame from corner to corner with the same density throughout, '
    'tiny dewdrops sparkling scattered evenly, micro cosmic sparkles, soft '
    'sky-wash-blue tints in dewdrops, NO leaves at edges, NO border of foliage, '
    'NO empty middle, just SEAMLESS continuous moss texture covering 100 '
    'percent of the surface uniformly, organic irregular variation but no '
    'empty regions. '
    f'{TILE_STYLE}, {PALETTE}'
)

# ============================================================================
# 2. tile-dirt retry — uniform pink-earth with veining throughout
# ============================================================================
DIRT_V3B = (
    f'{SEAMLESS_RIDER}. '
    'a uniform layer of soft pink earth and damp dusty soil covering the '
    'ENTIRE square frame from corner to corner with the same density throughout, '
    'warm faded-rose pink dirt tone, ink-aubergine deep dark mineral hairline '
    'cracks veining ACROSS THE WHOLE SURFACE not just at edges, granular '
    'grainy dirt texture with tiny pebbles scattered evenly across the entire '
    'frame, organic irregular but covering 100 percent of the surface, NO '
    'empty center, NO border-only veins, hand-painted Hayao Miyazaki '
    'watercolor earth. '
    f'{TILE_STYLE}, {PALETTE}'
)

# ============================================================================
# 3. tile-trampoline retry — flat mushroom-cap surface viewed from above
# ============================================================================
TRAMPOLINE_V3B = (
    f'{SEAMLESS_RIDER}. '
    'a flat soft pink-peach mushroom cap surface viewed from directly above '
    'filling the entire square frame edge to edge, the cap-skin is stretched '
    'tight like a drum or trampoline, faded-rose pink-peach mushroom-cream '
    'cap surface with subtle radial striations from center to edge suggesting '
    'taut spring-tension, mushroom-cream paler center, saffron-glow orange '
    'warm rim catching the edge of the cap, soft watercolor sheen, NO ring NO '
    'pool NO inflatable, JUST a flat mushroom-cap surface filling the frame, '
    'NOT a circle on background, the mushroom cap IS the entire frame. '
    f'{TILE_STYLE}, {PALETTE}'
)

# ============================================================================
# 4. tile-spike retry (per-tile fallback) — cluster of small spikes
# ============================================================================
SPIKE_TILE_V3B = (
    f'{SEAMLESS_RIDER}. '
    'a cluster of THREE TO FOUR SHORT POINTY HAZARDOUS SPIKES standing upward '
    'on a horizontal ground-line at the bottom of the frame, each spike is a '
    'short curved organic thorn shape painted in faded-rose pink gradient '
    'transitioning to pop-magenta at the tips with saffron-glow orange '
    'highlights at the very point, soft watercolor halos around each spike, '
    'ink-aubergine ragged outlines, the spikes stand together at the bottom '
    'half of the tile sharing a common ground-line, the upper half of the tile '
    'is mostly empty space above the spikes, NOT one tall tower NOT a '
    'cathedral, just a small CLUSTER of short thorns at the bottom of a tile. '
    f'{TILE_STYLE}, {PALETTE}'
)


JOBS = [
    {
        'label': 'tile-ground-painted-v3b',
        'endpoint': 'fal-ai/flux-pro/v1.1',
        'prompt': GROUND_V3B,
        'size': {'width': 1024, 'height': 1024},
        'target': TILES_DIR / 'tile-ground-painted-v3.png',  # OVERWRITE
    },
    {
        'label': 'tile-dirt-painted-v3b',
        'endpoint': 'fal-ai/flux-pro/v1.1',
        'prompt': DIRT_V3B,
        'size': {'width': 1024, 'height': 1024},
        'target': TILES_DIR / 'tile-dirt-painted-v3.png',  # OVERWRITE
    },
    {
        'label': 'tile-trampoline-painted-v3b',
        'endpoint': 'fal-ai/flux-pro/v1.1',
        'prompt': TRAMPOLINE_V3B,
        'size': {'width': 1024, 'height': 1024},
        'target': TILES_DIR / 'tile-trampoline-painted-v3.png',  # OVERWRITE
    },
    {
        'label': 'tile-spike-painted-v3b',
        'endpoint': 'fal-ai/flux/dev',
        'prompt': SPIKE_TILE_V3B,
        'size': {'width': 1024, 'height': 1024},
        'target': TILES_DIR / 'tile-spike-painted-v3.png',  # OVERWRITE
    },
]


def main():
    print('=== Sprint 11C — RETRY pass (4 tiles) ===')

    print('\n[1/2] Submitting...')
    submitted_jobs = []
    for j in JOBS:
        try:
            req_id, resp_url = submit_flux(j['endpoint'], j['prompt'], j['size'])
            sj = {**j, 'request_id': req_id, 'response_url': resp_url, 'status': 'submitted'}
            sj['target'] = str(j['target'])
            submitted_jobs.append(sj)
            print(f"[SUBMIT] {j['label']} → {req_id}")
        except Exception as e:
            sj = {**j, 'status': 'submit-failed', 'error': str(e), 'target': str(j['target'])}
            submitted_jobs.append(sj)
            print(f"[SUBMIT-FAIL] {j['label']}: {e}")

    print('\n[2/2] Polling + downloading...')
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def collect(job):
        if job.get('status') != 'submitted':
            return job
        label = job['label']
        print(f'[POLL] {label}...')
        result = poll_until_done(job['response_url'], label)
        if not result:
            job['status'] = 'poll-failed'
            return job
        url = extract_image_url(result)
        if not url:
            job['status'] = 'no-image-url'
            return job
        try:
            target = Path(job['target'])
            size = http_download(url, target)
            job['raw_url'] = url
            job['raw_size'] = size
            job['status'] = 'raw-downloaded'
            print(f'[OK] {label} {size//1024}KB → {target.name}')
        except Exception as e:
            job['status'] = 'download-failed'
            job['error'] = str(e)
        return job

    out = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(collect, j) for j in submitted_jobs]
        for f in as_completed(futures):
            out.append(f.result())

    import json, time
    manifest = {
        'sprint': 'Sprint 11C — RETRY pass',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'flux_jobs': out,
    }
    (ROOT / 'scripts/sprint11c/_retry-manifest.json').write_text(json.dumps(manifest, indent=2))

    for j in out:
        st = j.get('status', '?')
        sz = j.get('raw_size', 0)
        print(f"  {j['label']:36s}  {st:20s}  {sz//1024 if sz else 0} KB")


if __name__ == '__main__':
    main()
