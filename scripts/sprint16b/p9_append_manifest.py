"""Sprint 16B p9 — append entry to assets-generated.json."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'assets-generated.json'

data = json.loads(MANIFEST.read_text())

entry = {
    'sprint': 'Sprint 16B — 3D Cosmo rebuild from LoRA hero (DNA-correct mesh)',
    'generated': '2026-05-02',
    'strategy': 'image-to-3D from Sprint 16A LoRA hero (cosmo-hero-lora.png) — DNA-correct mesh (no PIL-paint workaround)',
    'pipeline': 'fal.ai upload → Meshy Studio /openapi/v1/image-to-3d (realistic, polycount=22000) → polled SUCCEEDED ~110s → GLB downloaded → gltf-transform optimize (draco+webp) for fallback',
    'context': 'Sprint 15A cosmo.glb rendered off-brand 3D-blob-eyes because input had PIL-painted-eyes (2D painting interpreted as 3D depth). 16B uses the clean LoRA-rendered Cosmo (Sprint 16A 10/10 DNA) as image-to-3D input, yielding a mesh with eye geometry as native 3D bulging spheres.',
    'meshy_endpoint': 'https://api.meshy.ai/openapi/v1/image-to-3d',
    'art_style_winner': 'realistic',
    'attempts': [
        {
            'label': '16B-A_realistic',
            'task_id': '019de80e-1bf0-7db5-8521-be429fbb113e',
            'art_style': 'realistic',
            'target_polycount': 22000,
            'texture_resolution': 2048,
            'mesh': {'verts': 15137, 'tris': 21978, 'materials': 1, 'textures': 4, 'skins': 0, 'animations': 0},
            'glb_size_raw_mb': 10.08,
            'glb_size_draco_kb': 752,
            'consumed_credits': 30,
            'dna_score': '7/8',
            'verdict': 'SHIP'
        },
        {
            'label': '16B-B_sculpture',
            'task_id': '019de80e-3356-7dbb-8750-fa871e1b8e70',
            'art_style': 'sculpture',
            'target_polycount': 25000,
            'texture_resolution': 2048,
            'mesh': {'verts': 17081, 'tris': 24999, 'materials': 1, 'textures': 4, 'skins': 0, 'animations': 0},
            'glb_size_raw_mb': 9.9,
            'glb_size_draco_kb': 750,
            'consumed_credits': 30,
            'dna_score': '7/8',
            'verdict': 'BACKUP — comparable quality, slightly higher polycount'
        }
    ],
    'shipped': {
        'glb': 'public/assets/3d/cosmo.glb (10.08 MB raw — engine has no DRACOLoader yet)',
        'preview': 'public/assets/3d/cosmo-preview.png',
        'animation_spec': 'public/assets/3d/cosmo-animation-spec.json (15A blueprint, still applicable for procedural anim)',
    },
    'note_draco': 'Compressed 752 KB GLB available in public/assets/case-study/cosmo-3d-v16b/attempts/cosmo-A_realistic-draco.glb. Engine swap to DRACOLoader is a future optimization (not done in 16B per spec).',
    'live_test_pre_deploy': 'PASS — meshes=1, verts=15137, tris=21978, h=1.911 units, scale check OK, GLTFLoader can parse without DRACOLoader.',
    'cost_usd': 0.60,
    'rigging': 'NOT attempted — Sprint 15A confirmed Meshy auto-rig fails on alien anatomy. CosmoAgent uses procedural transforms per cosmo-animation-spec.json (15A pattern).',
    'case_study': 'public/assets/case-study/cosmo-3d-v16b/',
    'side_by_side_evidence': 'public/assets/case-study/cosmo-3d-v16b/side-by-side-15a-vs-16b.png — shows 15A PIL-eye-disaster vs clean 16B mesh-eyes',
}

data['sprints'].append(entry)
MANIFEST.write_text(json.dumps(data, indent=2))
print(f'[p9] appended Sprint 16B entry to {MANIFEST}')
print(f'[p9] total sprints in manifest: {len(data["sprints"])}')
