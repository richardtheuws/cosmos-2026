"""Append Sprint 15C entry to assets-generated.json."""
import json
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
manifest_path = ROOT / 'assets-generated.json'

data = json.loads(manifest_path.read_text())

# Build sprint 15C entry
sprint_15c = {
    'sprint': 'Sprint 15C — Weird object-vocabulary (8 objects)',
    'generated': '2026-05-02',
    'strategy': (
        'WEIRDO-energy: oneirisch, ongemakkelijk-fascinerend. Quality > quantity. '
        'Hayao×Moebius watercolor coherent met biomes + Cosmo. Per object 1-3 '
        'attempts; switch Flux Pro Ultra → Flux Dev voor stylized illustration '
        'when Pro forced photoreal aesthetic (Sprint 11C trampoline pattern '
        'confirmed). Mouth-pillar sprite-sheet via 4-separate-frames + PIL '
        'composite (deterministic alternative to single-image sprite-sheet '
        'which suffers from symmetry-bias).'
    ),
    'model_primary': 'fal-ai/flux-pro/v1.1-ultra',
    'model_fallback_for_stylized': 'fal-ai/flux/dev',
    'post_processing': 'fal-ai/birefnet (remove-bg) for subjects, NOT for sprite-sheet',
    'shared_style_stem': (
        'Cosmic Adventure 2026 hand-painted watercolor with ink underdrawing, '
        'paper-grain texture, faded-rose mineral wash + saffron-glow underlight '
        '+ ink-aubergine ragged outline, Studio Ghibli x Moebius x Tenniel '
        'illustration style, oneiric dreamlike unsettling-fascinating mood'
    ),
    'assets': [
        {
            'file': 'public/assets/objects/organic-flesh-trampoline.png',
            'model': 'fal-ai/flux/dev',
            'size': '512x512',
            'attempts': 2,
            'wow': 8,
            'weirdo': 8,
            'altitude': 0,
            'behaviour': 'trampoline-bounce',
            'audio_cue': 'wet-thump pulse',
            'notes': (
                'V1 (Flux Pro Ultra): photoreal ceramic mushroom, no body-horror '
                '— REJECTED (3/10). V2 (Flux Dev top-down): radial gill-pleats + '
                'central pucker + sickly faded-rose veins — ACCEPTED. Lesson: '
                'Flux Pro forces photo-aesthetic for "mushroom-cap" tokens, '
                'Flux Dev pliabler for stylized body-horror illustration.'
            ),
        },
        {
            'file': 'public/assets/objects/eyeball-sentry.png',
            'model': 'fal-ai/flux-pro/v1.1-ultra',
            'size': '256x256',
            'attempts': 1,
            'wow': 9,
            'weirdo': 9,
            'altitude': 100,
            'behaviour': 'follow-cosmo-blink',
            'audio_cue': 'wet-blink + low whisper',
            'notes': (
                'STANDOUT first-pass: vertical-slit chameleon-iris with rings of '
                'saffron + faded-rose + pop-cyan, wet pearlescent sphere — '
                'unsettling sentient eyeball. Ultra worked perfectly here.'
            ),
        },
        {
            'file': 'public/assets/objects/mouth-pillar-sheet.png',
            'model': 'fal-ai/flux/dev (4 frames composited)',
            'size': '1024x512 (4 frames @ 256x512 horizontal grid)',
            'attempts': 3,
            'wow': 8,
            'weirdo': 8,
            'altitude': 200,
            'behaviour': 'open-on-beat-damage-when-open',
            'audio_cue': 'wet-jaw-creak + breath',
            'notes': (
                'V1 (Flux Pro v1.1, single-image sprite-sheet): all 4 panels '
                'wide-open (symmetry-bias) — REJECTED. V2 (Flux Dev, single-image): '
                'still uniform mouths — REJECTED. V3 (4 separate flux-dev calls + '
                'PIL composite into 1024x512 sheet): closed/quarter/half/wide — '
                'WORKS. Lesson: diffusion can not be told to render '
                'sequential-animation states in one image, render each frame '
                'separately and composite deterministically.'
            ),
        },
        {
            'file': 'public/assets/objects/melting-clock-bubble.png',
            'model': 'fal-ai/flux/dev',
            'size': '384x384',
            'attempts': 2,
            'wow': 7,
            'weirdo': 7,
            'altitude': 500,
            'behaviour': 'time-slow-on-touch',
            'audio_cue': 'reverse-tick-warble',
            'notes': (
                'V1 (Flux Pro Ultra): photoreal silver pocket-watch with one drip, '
                'no bubble enclosure — REJECTED. V2 (Flux Dev with WATERCOLOR '
                'PAINTING lead): watercolor clock with drip + softer iridescent '
                'bubble-enclosure feel — ACCEPTED. Bubble could be more orb-like '
                'but acceptable for game-scale.'
            ),
        },
        {
            'file': 'public/assets/objects/secret-crystal.png',
            'model': 'fal-ai/flux-pro/v1.1-ultra',
            'size': '256x256',
            'attempts': 1,
            'wow': 7,
            'weirdo': 7,
            'altitude': 1000,
            'behaviour': 'visible-only-when-kaleido-gt-0.8',
            'audio_cue': 'glass-shimmer-chord',
            'notes': (
                'First-pass success: pop-magenta + saffron crystal cluster with '
                'angular facets and prismatic refraction. Slight kawaii-tint but '
                'acceptable as hidden collectible.'
            ),
        },
        {
            'file': 'public/assets/objects/floating-star.png',
            'model': 'fal-ai/flux/dev',
            'size': '128x128',
            'attempts': 2,
            'wow': 5,
            'weirdo': 5,
            'altitude': 0,
            'behaviour': 'collect-on-touch (+5 vibe-meter)',
            'audio_cue': 'chime-up',
            'notes': (
                'V1 (Flux Pro Ultra): clipart-style flat blue cartoon star — '
                'REJECTED. V2 (Flux Dev WATERCOLOR PAINTING lead): better paper-'
                'grain + saffron core + pop-cyan body — ACCEPTED. Generic '
                'collectible, lowest weirdo of set — acceptable per brief.'
            ),
        },
        {
            'file': 'public/assets/objects/upside-down-tree.png',
            'model': 'fal-ai/flux/dev',
            'size': '512x768',
            'attempts': 4,
            'wow': 7,
            'weirdo': 7,
            'altitude': 300,
            'behaviour': 'static-obstacle-jump-under-or-around',
            'audio_cue': 'wind-chime-low-creak',
            'notes': (
                'V1 (Ultra): two-tree topology (lollipop with leafy crown above '
                'roots in middle) — REJECTED. V2 (Flux Dev "growing downward"): '
                'still two-tree — REJECTED. V3 (Flux Pro v1.1 "shape-not-'
                'orientation"): flame-bush with dripping roots — partial. V4 '
                '(Flux Dev THREE-ZONE prompt without word "tree"): '
                'TOP=root-fan + MIDDLE=trunk + BOTTOM=mossy-leaf-ball — '
                'ACCEPTED. Lesson: Flux "tree" sample-bias is unbreakable — '
                'must describe as 3-zone shape composition without using '
                '"tree" as a noun anchor.'
            ),
        },
        {
            'file': 'public/assets/objects/breathing-portal.png',
            'model': 'fal-ai/flux-pro/v1.1-ultra',
            'size': '384x384',
            'attempts': 1,
            'wow': 8,
            'weirdo': 8,
            'altitude': 800,
            'behaviour': 'enter-on-touch-biome-switch',
            'audio_cue': 'breathing-drone + chord-shift',
            'notes': (
                'STANDOUT first-pass: concentric pulsing aura-bands (saffron + '
                'magenta + cyan) ringing a window into mushroom-biome with '
                'star-rain visible. Hayao watercolor portal — perfect biome-'
                'switch object, "feels" like it breathes.'
            ),
        },
    ],
    'cost_estimate_usd': '~$1.85',
    'cost_breakdown': {
        '8 first-pass jobs (7 ultra + 1 pro v1.1 sheet)': 0.45,
        '7 BiRefNet first-pass (skipped sheet)': 0.20,
        '5 retry-1 jobs (all flux-dev)': 0.13,
        '4 retry-1 BiRefNet (skipped sheet)': 0.12,
        '4 mouth-frame retry-2 (flux-dev portrait panels)': 0.10,
        '1 tree retry-2 (flux pro v1.1 + birefnet)': 0.08,
        '1 tree retry-3 v4 (flux dev + birefnet)': 0.05,
    },
    'reference_grid': 'public/assets/case-study/objects-v15c/reference-grid-v15c.png',
    'case_study_dir': 'public/assets/case-study/objects-v15c/',
    'wiring_doc': (
        'ObjectManager preload via assetPath. Per-object spawn-config: '
        '{ altitude, frequency, behaviour-class, audio-cue }. Sprint 15B handles '
        'actual ObjectManager wiring; this manifest provides the asset paths + '
        'per-object metadata.'
    ),
    'object_spawn_config': [
        {'key': 'organic-flesh-trampoline', 'altitude': 0, 'asset': 'objects/organic-flesh-trampoline.png',
         'behaviour': 'trampoline-bounce', 'audio_cue': 'wet-thump-pulse',
         'size': [512, 512], 'transparent': True},
        {'key': 'eyeball-sentry', 'altitude': 100, 'asset': 'objects/eyeball-sentry.png',
         'behaviour': 'follow-cosmo-blink', 'audio_cue': 'wet-blink-low-whisper',
         'size': [256, 256], 'transparent': True},
        {'key': 'mouth-pillar', 'altitude': 200, 'asset': 'objects/mouth-pillar-sheet.png',
         'behaviour': 'open-on-beat-damage-when-open', 'audio_cue': 'wet-jaw-creak-breath',
         'size': [1024, 512], 'transparent': False, 'sprite_sheet': True,
         'frame_size': [256, 512], 'frame_count': 4,
         'frame_states': ['closed', 'quarter', 'half', 'open']},
        {'key': 'melting-clock-bubble', 'altitude': 500, 'asset': 'objects/melting-clock-bubble.png',
         'behaviour': 'time-slow-on-touch', 'audio_cue': 'reverse-tick-warble',
         'size': [384, 384], 'transparent': True, 'effect_duration_s': 4,
         'time_scale': 0.5},
        {'key': 'secret-crystal', 'altitude': 1000, 'asset': 'objects/secret-crystal.png',
         'behaviour': 'visible-only-when-kaleido-gt-0.8', 'audio_cue': 'glass-shimmer-chord',
         'size': [256, 256], 'transparent': True, 'visible_threshold': 0.8},
        {'key': 'floating-star', 'altitude': 0, 'asset': 'objects/floating-star.png',
         'behaviour': 'collect-on-touch', 'audio_cue': 'chime-up',
         'size': [128, 128], 'transparent': True, 'vibe_delta': 5},
        {'key': 'upside-down-tree', 'altitude': 300, 'asset': 'objects/upside-down-tree.png',
         'behaviour': 'static-obstacle-jump-under-or-around', 'audio_cue': 'wind-chime-low-creak',
         'size': [512, 768], 'transparent': True},
        {'key': 'breathing-portal', 'altitude': 800, 'asset': 'objects/breathing-portal.png',
         'behaviour': 'enter-on-touch-biome-switch', 'audio_cue': 'breathing-drone-chord-shift',
         'size': [384, 384], 'transparent': True},
    ],
}

data['sprints'].append(sprint_15c)
manifest_path.write_text(json.dumps(data, indent=2))
print(f'Sprint 15C appended. Total sprints: {len(data["sprints"])}')
print(f'Sprint 15C assets: {len(sprint_15c["assets"])}')
