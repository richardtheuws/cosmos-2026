"""Sprint 17C — Phase 1: Generate raw layers for 4 biomes via Flux Pro Ultra.

Per biome: 6 layers (5 standard + 1 optional creature for slow-bloom):
  1. sky-gradient        — 1024x1536 portrait, NO BiRefNet (full-bleed)
  2. distant-mountain    — silhouette layer, BiRefNet target
  3. mid-cluster-A       — biome-specific, BiRefNet target
  4. mid-cluster-B       — biome-specific variation, BiRefNet target
  5. foreground-cluster  — large-scale, BiRefNet target
  6. particle-overlay    — sparkles/dust on black bg, additive blend

Output:
  scripts/sprint17c/raw/biome-{id}/layer-{N}_{name}-raw.png
  Logged in _logs/p1_layers.jsonl

WEIRDO-ENERGY RULES (per spec):
  - Oneirisch, niet generic fantasy
  - Locked palette + max 5% pop-accents
  - Anti-character 6-fold negative stack
  - Min 4-attempts per layer als eerste poging te generic
  - Body-horror angels in cathedral, eyes/mouths in boss = expliciet
"""
from __future__ import annotations
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from _lib import (
    ROOT, RAW_DIR, submit, poll_until_done, extract_image_url,
    http_download, log_attempt,
)


# ---------------------------------------------------------------------------
# Anti-character + style stack (proven from Sprint 13D)
# ---------------------------------------------------------------------------
ANTI_CHARACTERS = (
    'NO characters NO figures NO silhouettes of people NO travelers NO wanderers '
    'NO humans NO normal animals NO recognizable creatures NO faces, '
    'NO digital NO 3D-render NO photoreal NO pixel-art NO cartoon, '
    'luminous bright pastel NOT dark NOT black NOT pure-night, '
)

STYLE_STEM = (
    'Cosmic Adventure 2026 hand-painted watercolor with ink underdrawing, '
    'paper-grain texture, faded-rose mineral wash + saffron-glow underlight + '
    'ink-aubergine ragged outline accents, soft wet-edge watercolor bleeds, '
    'Studio Ghibli x Moebius x Tenniel illustration style, oneiric dreamlike '
    'weirdo-art-not-generic-fantasy, museum quality painted illustration'
)

PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, locked seven-tone palette with at most 5-percent '
    'pop-magenta or lime accents only as small bioluminescent details'
)


# ---------------------------------------------------------------------------
# BIOME DEFINITIONS — 4 biomes × 6 layers
# ---------------------------------------------------------------------------
# Each biome dict has: id, layers[]
# Each layer dict: name, idx, role, prompt, style, isolation, parallax, scale
# - role: 'sky' | 'distant' | 'mid-a' | 'mid-b' | 'foreground' | 'particle' | 'creature'
# - isolation: 'fullbleed' | 'side-cluster' | 'transparent-target'
# - parallax + scale stored for the composition-spec.json output

BG_BLACK_FOR_BIREFNET = (
    'isolated cluster floating alone on a pure flat solid jet-black void '
    'background with absolutely no surrounding scene no horizon no ground '
    'no sky no environment no extra props, the cluster fills only one side '
    'of the frame leaving the other side as pure jet-black empty void, '
    'composition like a museum specimen photograph against black backdrop, '
)

BG_BLACK_FOR_PARTICLE = (
    'a sparse composition of small bright glowing particles scattered across '
    'a flat solid jet-black void background, NO scene NO landscape NO horizon '
    'NO objects, ONLY the particles themselves on jet-black void, '
    'composition like a long-exposure photograph of fireflies against night sky, '
)


SLOW_BLOOM = {
    'id': 'slow-bloom',
    'description': 'alien-mushroom forest at twilight',
    'layers': [
        {
            'name': 'sky-gradient',
            'idx': 1,
            'role': 'sky',
            'parallax': 0.05,
            'scale': 1.10,
            'isolation': 'fullbleed',
            'subject': (
                'a soft hand-painted twilight sky gradient transitioning from '
                'pale peach-orange at the bottom to deep faded-rose mauve in '
                'the middle to a deep ink-aubergine purple at the top, with '
                'gauzy faded-rose vein-like cloud streaks drifting horizontally, '
                'NO objects in front, just sky filling the whole canvas top to bottom, '
                'wet watercolor wash with paper-grain texture'
            ),
        },
        {
            'name': 'distant-mountains',
            'idx': 2,
            'role': 'distant',
            'parallax': 0.20,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'a band of distant mountain-ridges painted as flat blue-purple '
                'silhouettes layered into atmospheric haze, with TINY pinkish-saffron '
                'glowing mushroom-cap shapes dotting the ridge tops like distant '
                'lanterns, the mountains span horizontally across the lower-middle '
                'portion of the frame, soft watercolor edges, hazy distant atmosphere, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-cluster-a',
            'idx': 3,
            'role': 'mid-a',
            'parallax': 0.45,
            'scale': 0.85,
            'isolation': 'transparent-target',
            'subject': (
                'a clustered grove of small to medium plump alien mushroom-trees '
                'with luminous saffron-orange and faded-rose pink glowing caps, '
                'stems painted in ink-aubergine with ragged ink outlines, oneiric '
                'WEIRDO atmosphere not generic fantasy — the mushrooms have '
                'subtly-distorted asymmetric caps with weeping wet-edge bleeds, '
                'cluster occupies the LEFT third of the frame leaving right side '
                'as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-cluster-b',
            'idx': 4,
            'role': 'mid-b',
            'parallax': 0.45,
            'scale': 0.90,
            'isolation': 'transparent-target',
            'subject': (
                'a tall sparse cluster of taller pink phosphorescent mushroom-trees '
                'with elongated stems and small bell-cap heads glowing faded-rose '
                'and saffron, painted in watercolor with ink underdrawing, the '
                'cluster has slight oneiric distortion — stems lean impossibly, '
                'caps tilt at uncanny angles, cluster occupies the RIGHT third '
                'of the frame leaving the left side as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'foreground-cluster',
            'idx': 5,
            'role': 'foreground',
            'parallax': 0.85,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'an immense single GIANT alien mushroom-cap arching across the '
                'frame with its pink-orange luminous underside facing the viewer, '
                'thick stalk emerging from the bottom edge, very large scale '
                'filling much of the frame, ink-aubergine ragged outline, dripping '
                'wet-edge watercolor wash, weirdo-organic asymmetric cap shape '
                'NOT a perfect symmetric storybook mushroom, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'particle-overlay',
            'idx': 6,
            'role': 'particle',
            'parallax': 1.00,
            'scale': 1.00,
            'isolation': 'fullbleed',
            'subject': (
                BG_BLACK_FOR_PARTICLE
                + 'soft floating saffron-yellow pollen motes and faded-rose pink '
                'sparkles and small glowing light-flecks scattered across the '
                'whole frame, varying sizes from tiny pinpoints to small soft '
                'glowing orbs, suspended in air with gentle drift, additive '
                'glow quality, painted with watercolor blooms not digital sharpness'
            ),
        },
        {
            'name': 'ambient-creature',
            'idx': 7,
            'role': 'creature',
            'parallax': 0.55,
            'scale': 0.50,
            'isolation': 'transparent-target',
            'subject': (
                'a single ambient floating jellyfish-creature with translucent '
                'faded-rose dome and ink-aubergine trailing tendrils, glowing '
                'saffron interior light, oneiric weirdo not realistic — the '
                'jellyfish floats horizontally as if in air not water, painted '
                'with delicate wet-edge watercolor washes, located in upper '
                'right portion of frame, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
    ],
}


INKPOOL = {
    'id': 'inkpool',
    'description': 'deep ink-aubergine cave with bioluminescence',
    'layers': [
        {
            'name': 'sky-gradient',
            'idx': 1,
            'role': 'sky',
            'parallax': 0.05,
            'scale': 1.10,
            'isolation': 'fullbleed',
            'subject': (
                'a deep ink-aubergine cave-roof gradient transitioning from '
                'darker purple-black at the top to mid-tone deep purple in the '
                'middle to slightly lighter mauve-purple toward the bottom, '
                'with subtle clusters of glowing cyan and faded-rose mineral '
                'crystal points sparsely embedded in the upper portion like '
                'distant cave-roof stalactite-glow, NO foreground objects, '
                'pure cave-roof gradient texture filling the whole canvas, '
                'bright luminous NOT pure-black, watercolor wash with paper-grain'
            ),
        },
        {
            'name': 'distant-stalactites',
            'idx': 2,
            'role': 'distant',
            'parallax': 0.20,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'a band of distant stalactite-spires layered into purple cave-fog, '
                'silhouetted in deeper ink-aubergine with faint cyan and '
                'faded-rose bioluminescent rim-light along their edges, the '
                'stalactites hang from the upper portion of the frame downward '
                'into the lower-middle, hazy atmospheric perspective with soft '
                'watercolor blur, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-cluster-a',
            'idx': 3,
            'role': 'mid-a',
            'parallax': 0.45,
            'scale': 0.90,
            'isolation': 'transparent-target',
            'subject': (
                'a cluster of bioluminescent moss-formations and small phosphorescent '
                'mushroom-clumps growing on cave-rock outcrops, glowing in cyan '
                'and pop-magenta and faded-rose accents (sparing pop-accents), '
                'organic weirdo-shapes with oneiric distortion, ink-aubergine '
                'rocks with watercolor washes, cluster occupies the LEFT side '
                'of the frame leaving right as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-cluster-b',
            'idx': 4,
            'role': 'mid-b',
            'parallax': 0.45,
            'scale': 0.95,
            'isolation': 'transparent-target',
            'subject': (
                'a horizontal strip of deep-purple inkpool surface with reflective '
                'mirror-like sheen reflecting cyan and faded-rose moss-glow from '
                'above, ink-aubergine ripples and small floating reflective '
                'rocks, the inkpool occupies the bottom-middle horizontal band '
                'of the frame, watercolor with wet-edge bleeds, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'foreground-cluster',
            'idx': 5,
            'role': 'foreground',
            'parallax': 0.85,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'large foreground crystal-spires jutting up from below and '
                'dripping moss-tendrils dangling from above with droplets, '
                'faceted ink-aubergine crystals with cyan and saffron-glow '
                'highlights at their tips, oneiric weirdo-asymmetric crystal '
                'shapes, large dramatic scale framing the edges of the frame, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'particle-overlay',
            'idx': 6,
            'role': 'particle',
            'parallax': 1.00,
            'scale': 1.00,
            'isolation': 'fullbleed',
            'subject': (
                BG_BLACK_FOR_PARTICLE
                + 'soft floating faded-rose pink dust particles and tiny cyan '
                'bioluminescent specks and slow-drifting saffron embers '
                'scattered across the whole frame, varying sizes, suspended '
                'in still cave-air, additive glow quality, watercolor blooms'
            ),
        },
    ],
}


CATHEDRAL = {
    'id': 'cathedral',
    'description': 'bloom-pierced clouds, cosmic temple in sky',
    'layers': [
        {
            'name': 'sky-gradient',
            'idx': 1,
            'role': 'sky',
            'parallax': 0.05,
            'scale': 1.10,
            'isolation': 'fullbleed',
            'subject': (
                'a bright luminous cloud-realm gradient transitioning from soft '
                'peach-orange and warm white at the bottom to soft sky-wash blue '
                'in the middle to faded-rose mauve at the top, with diffuse '
                'bloom-glow patches and gentle horizontal cloud-streak veins, '
                'NO objects in front, ethereal heavenly sky filling whole canvas, '
                'paper-grain watercolor wash, very bright luminous airy'
            ),
        },
        {
            'name': 'distant-spires',
            'idx': 2,
            'role': 'distant',
            'parallax': 0.20,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'a band of distant floating cathedral-spires silhouetted against '
                'bright sun-glow, slender Gothic-temple shapes drifting in the '
                'sky like impossible cloud-castles, weirdo oneiric asymmetric '
                'tower-shapes NOT generic fantasy castles, painted as faded-rose '
                'and mauve silhouettes with saffron-glow rim-light, the spires '
                'span horizontally across the middle of the frame, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-clouds',
            'idx': 3,
            'role': 'mid-a',
            'parallax': 0.45,
            'scale': 0.90,
            'isolation': 'transparent-target',
            'subject': (
                'a cumulus cloud-layer with golden saffron-glow light-shafts '
                'piercing diagonally through gaps between cloud-towers, the '
                'clouds painted with crisp ink underdrawing edges and soft '
                'watercolor body, faded-rose touches where dawn-light catches '
                'cloud edges, the cluster occupies the LEFT half of the frame '
                'leaving the right as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-gargoyles',
            'idx': 4,
            'role': 'mid-b',
            'parallax': 0.45,
            'scale': 0.85,
            'isolation': 'transparent-target',
            'subject': (
                'a small scattered group of cosmic gargoyle-silhouettes — '
                'oneiric body-horror weirdo-angels with extra wings and elongated '
                'asymmetric bodies and multiple faint eye-spots, perched on '
                'cloud-edges, painted as ink-aubergine and faded-rose silhouettes '
                'with saffron-glow rim-light, surreal Moebius-style not scary '
                'just uncanny, occupies the RIGHT side of the frame leaving '
                'left as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'foreground-pillars',
            'idx': 5,
            'role': 'foreground',
            'parallax': 0.85,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'a closer cloud-shelf with weathered marble pillar-fragments '
                'and broken temple-architecture floating upon it, mushroom-cream '
                'and faded-rose pillars with crisp ink outlines, dramatic '
                'large-scale foreground framing the bottom and side edges of '
                'the frame, oneiric weirdo asymmetric impossible architecture, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'particle-overlay',
            'idx': 6,
            'role': 'particle',
            'parallax': 1.00,
            'scale': 1.00,
            'isolation': 'fullbleed',
            'subject': (
                BG_BLACK_FOR_PARTICLE
                + 'small bright white sparkles and saffron-yellow light-streaks '
                'and tiny faded-rose pollen-motes scattered across the whole '
                'frame, with longer streaking light-shafts representing diagonal '
                'sunbeams, additive bright glow quality, watercolor with paper-grain'
            ),
        },
    ],
}


BOSS = {
    'id': 'boss',
    'description': 'saffron-storm chaos with floating eyes/mouths',
    'layers': [
        {
            'name': 'sky-gradient',
            'idx': 1,
            'role': 'sky',
            'parallax': 0.05,
            'scale': 1.10,
            'isolation': 'fullbleed',
            'subject': (
                'a chaotic storm-sky gradient transitioning from saffron-orange '
                'at the bottom to deep pop-magenta in the middle to dark '
                'ink-aubergine purple at the top, with branching pop-magenta '
                'lightning-fork veins streaking diagonally across the upper '
                'portion, churning watercolor cloud-textures, paper-grain wash, '
                'dramatic apocalyptic but luminous NOT pure-black, just sky filling '
                'the whole canvas top to bottom'
            ),
        },
        {
            'name': 'distant-spires',
            'idx': 2,
            'role': 'distant',
            'parallax': 0.20,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'a band of dark twisted alien spires silhouetted against the '
                'storm with a central cyclonic vortex pulling everything inward, '
                'the spires painted as ink-aubergine silhouettes with '
                'saffron-glow rim-light, oneiric weirdo-twisted shapes NOT '
                'normal mountains, vortex spiral visible behind, the band '
                'spans the lower-middle of the frame, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-tornado',
            'idx': 3,
            'role': 'mid-a',
            'parallax': 0.45,
            'scale': 0.95,
            'isolation': 'transparent-target',
            'subject': (
                'a spinning cosmic tornado-debris cloud with chunks of saffron-glow '
                'rock and faded-rose pink debris swirling in a tight rotating '
                'column, ink-aubergine cyclone-edges with crisp ink outlines '
                'and watercolor wash interior, occupies the LEFT-CENTER portion '
                'of the frame leaving right as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'mid-eyes-mouths',
            'idx': 4,
            'role': 'mid-b',
            'parallax': 0.45,
            'scale': 0.80,
            'isolation': 'transparent-target',
            'subject': (
                'a scattered group of disembodied floating uncanny single eyes '
                'and surreal toothless gaping mouth-shapes drifting in the '
                'storm, weirdo oneiric body-horror NOT scary just unsettling '
                'and dreamlike, painted in ink-aubergine and faded-rose with '
                'saffron-glow interior pupils and mouth-glow, occupies the '
                'RIGHT side of the frame leaving left as empty void, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'foreground-rocks',
            'idx': 5,
            'role': 'foreground',
            'parallax': 0.85,
            'scale': 1.00,
            'isolation': 'transparent-target',
            'subject': (
                'jagged saffron-glow lit foreground rocks and broken alien-stone '
                'fragments framing the bottom and sides of the frame, dramatic '
                'high-contrast lighting from below with saffron-orange glow, '
                'ink-aubergine stone with crisp ragged ink outlines, oneiric '
                'weirdo asymmetric impossible-geometry rocks, '
                + BG_BLACK_FOR_BIREFNET
            ),
        },
        {
            'name': 'particle-overlay',
            'idx': 6,
            'role': 'particle',
            'parallax': 1.00,
            'scale': 1.00,
            'isolation': 'fullbleed',
            'subject': (
                BG_BLACK_FOR_PARTICLE
                + 'fine swirling ash-flakes and bright saffron-orange ember-sparks '
                'and small pop-magenta lightning-fragments scattered across '
                'the whole frame in dynamic motion, varying sizes from tiny '
                'pinpoints to small streaks, additive bright glow quality, '
                'watercolor blooms with motion-energy'
            ),
        },
    ],
}


BIOMES = [SLOW_BLOOM, INKPOOL, CATHEDRAL, BOSS]


def make_prompt(layer: dict) -> str:
    return (
        f'{ANTI_CHARACTERS} {layer["subject"]}. {STYLE_STEM}. {PALETTE}'
    )


def submit_layer(biome_id: str, layer: dict) -> dict:
    prompt = make_prompt(layer)
    # 1024x1536 portrait per spec — Flux Pro Ultra uses aspect_ratio
    body_ultra = {
        'prompt': prompt,
        'aspect_ratio': '2:3',  # 1024x1536 effective
        'num_images': 1,
        'enable_safety_checker': False,
        'output_format': 'png',
    }
    try:
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1-ultra', body_ultra)
        model = 'fal-ai/flux-pro/v1.1-ultra'
    except Exception as e:
        # Fallback: Flux Pro v1.1 with explicit dimensions
        print(f'[INFO] {biome_id}/{layer["name"]}: ultra unavailable -> v1.1 ({e})')
        body_v11 = {
            'prompt': prompt,
            'image_size': {'width': 1024, 'height': 1536},
            'num_images': 1,
        }
        req_id, resp_url = submit('fal-ai/flux-pro/v1.1', body_v11)
        model = 'fal-ai/flux-pro/v1.1'

    print(f'[SUBMIT] {biome_id}/{layer["name"]} -> {req_id[:12]}... ({model})')
    return {
        'biome_id': biome_id,
        'layer_idx': layer['idx'],
        'layer_name': layer['name'],
        'role': layer['role'],
        'parallax': layer['parallax'],
        'scale': layer['scale'],
        'isolation': layer['isolation'],
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': model,
        'attempt': 1,
    }


def collect_layer(state: dict) -> dict | None:
    label = f'{state["biome_id"]}/{state["layer_name"]}'
    payload = poll_until_done(state['response_url'], label, max_polls=300)
    url = extract_image_url(payload)
    if not url:
        log_attempt('p1_layers.jsonl', {**state, 'failed': True})
        print(f'[FAIL] {label}: no url')
        return None

    out_dir = RAW_DIR / f'biome-{state["biome_id"]}'
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f'layer-{state["layer_idx"]}_{state["layer_name"]}-raw.png'
    bytes_n = http_download(url, target)
    print(f'[DOWNLOAD] {label}: {bytes_n} bytes -> {target.name}')

    log_attempt('p1_layers.jsonl', {
        **state,
        'url': url,
        'bytes': bytes_n,
        'final': str(target),
    })
    return {**state, 'raw_path': str(target), 'bytes': bytes_n}


def main() -> int:
    print('[PHASE 1] Building job list across 4 biomes...')
    jobs = []
    for biome in BIOMES:
        for layer in biome['layers']:
            jobs.append((biome['id'], layer))
    print(f'[PHASE 1] Submitting {len(jobs)} layer-jobs in parallel...')

    submitted = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for state in ex.map(lambda args: submit_layer(*args), jobs):
            submitted.append(state)

    print(f'[PHASE 1] Polling {len(submitted)} layer-jobs...')
    collected = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for result in ex.map(collect_layer, submitted):
            collected.append(result)

    success = sum(1 for r in collected if r is not None)
    print(f'[PHASE 1 DONE] {success}/{len(jobs)} layers generated')

    # Persist layer-spec for downstream phases
    import json
    spec_dump = []
    for biome in BIOMES:
        spec_dump.append({
            'id': biome['id'],
            'description': biome['description'],
            'layers': [
                {k: v for k, v in lyr.items() if k != 'subject'}
                for lyr in biome['layers']
            ],
        })
    (LOG_DIR := ROOT / 'scripts/sprint17c/_logs').mkdir(parents=True, exist_ok=True)
    (LOG_DIR / 'biome_spec.json').write_text(json.dumps(spec_dump, indent=2))

    return 0 if success == len(jobs) else 1


if __name__ == '__main__':
    raise SystemExit(main())
