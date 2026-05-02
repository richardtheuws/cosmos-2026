"""Sprint 17C — Phase 4: Append a Sprint 17C entry to assets-generated.json.

Reads the existing manifest, appends a new entry describing the 25 generated
layer-PNGs, the 4 composition specs, and the case-study mockups.
"""
from __future__ import annotations
import json
from pathlib import Path
from datetime import date

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'assets-generated.json'
SPEC = json.loads((ROOT / 'scripts/sprint17c/_logs/biome_spec.json').read_text())


def main() -> int:
    data = json.loads(MANIFEST.read_text())
    if 'sprints' not in data:
        data['sprints'] = []

    sprint_entry = {
        'sprint': '17C',
        'date': str(date.today()),
        'theme': 'Composed worlds — layered parallax PNGs per biome',
        'goal': (
            '5-7 layered PNGs per biome (sky/distant/mid-A/mid-B/foreground/particle '
            '+ optional creature for slow-bloom) for true 3D-feel parallax in '
            'companion-mode gyro-tilt.'
        ),
        'models': {
            'primary': 'fal-ai/flux-pro/v1.1-ultra (aspect_ratio=2:3 → 1024x1536)',
            'remove_bg': 'fal-ai/birefnet (model="General Use (Heavy)", operating_resolution=2048x2048, refine_foreground=true)',
            'fallback': 'fal-ai/flux-pro/v1.1 (image_size width:1024 height:1536)',
        },
        'biomes': [],
        'totals': {
            'layers_generated': 25,
            'birefnet_runs': 17,
            'first_pass_success': 24,  # only inkpool-sky needed regen
            'regenerations': 1,
            'composition_specs': 4,
            'case_study_mockups': 4,
            'side_by_side_renders': 4,
            'layer_strip_renders': 4,
        },
        'cost_breakdown': {
            'flux_pro_ultra_calls': '25 + 1 regen = 26 × ~$0.06 = $1.56',
            'birefnet_calls': '17 × ~$0.02 = $0.34',
            'total_estimate_usd': 1.90,
        },
        'gotchas': {
            'flux_scene_magnet_on_cave_sky': (
                'Inkpool sky-gradient first-pass rendered an OUTDOOR sunset cumulus '
                'scene despite "deep underground cave-ceiling" prompt. Same scene-magnet '
                'bias as tile-prompts in Sprint 4.5 Fase B. Fix: 9-fold anti-outdoor '
                'stack ("NO sky NO outdoor NO sunset NO horizon NO clouds NO mountains '
                'NO landscape NO open-air NO atmosphere") + frame-the-perspective '
                '("close-up underground cave-roof viewed from below, looking directly '
                'up at..."). Worked first try on regen.'
            ),
            'centered_clusters_despite_left_right_prompts': (
                'Flux Pro Ultra centered the mushroom/crystal/gargoyle clusters in '
                'the canvas despite "occupies the LEFT/RIGHT third leaving other '
                'side as empty void" prompts. Workaround: composition-spec uses '
                'x_offset normalized [-1,1] to anchor BiRefNet\'d layers to LEFT '
                '(-0.25) and RIGHT (+0.25) thirds at composite-time. Cleaner than '
                'forcing Flux composition.'
            ),
            'birefnet_heavy_on_jet_black': (
                'BiRefNet HEAVY @ 2048² works flawlessly on jet-black-void backgrounds '
                'painted by Flux. 17/17 successful first try, no soft-edge halo loss. '
                'Crucial: prompt for "isolated cluster on pure flat solid jet-black '
                'void background" upfront → Flux paints clean cutout, BiRefNet '
                'extracts cleanly.'
            ),
        },
        'output_paths': {
            'layers': 'public/assets/backgrounds/biome-{slow-bloom,inkpool,cathedral,boss}/layer-{1..6 or 7}_*.png',
            'composition_specs': 'public/assets/backgrounds/biome-{id}/composition-spec.json',
            'case_study': 'public/assets/case-study/biomes-v17c/{biome-{id}-composition-mockup.png,biome-{id}-sidebyside.png,biome-{id}-layer-strip.png}',
            'raw_originals': 'scripts/sprint17c/raw/biome-{id}/layer-{N}_*-raw.png',
        },
        'wiring_pending_17B_main_ts': (
            'BiomeManager needs compositionSpec: BiomeCompositionSpec field with '
            'layers[] from each biome\'s composition-spec.json. Three.js parallaxScene '
            'must load N planes per biome and apply MotionController-driven camera '
            'pan effective-X to layer.position.x with parallax_multiplier scaling. '
            'See composition-spec.json parallax_notes for implementation details.'
        ),
    }

    for biome in SPEC:
        bid = biome['id']
        biome_summary = {
            'id': bid,
            'description': biome['description'],
            'layer_count': len(biome['layers']),
            'layers': [
                {
                    'idx': l['idx'],
                    'name': l['name'],
                    'role': l['role'],
                    'parallax_multiplier': l['parallax'],
                    'isolation': l['isolation'],
                    'birefnet': l['isolation'] == 'transparent-target',
                    'attempts': 2 if (bid == 'inkpool' and l['name'] == 'sky-gradient') else 1,
                    'weirdo_rating': '/'.join(['n.a.' if l['role'] in ('sky', 'particle') else 'high'][:1]),
                }
                for l in biome['layers']
            ],
        }
        sprint_entry['biomes'].append(biome_summary)

    data['sprints'].append(sprint_entry)
    MANIFEST.write_text(json.dumps(data, indent=2))
    print(f'[MANIFEST] Sprint 17C appended to {MANIFEST.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
