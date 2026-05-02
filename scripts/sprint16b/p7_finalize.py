"""Sprint 16B p7 — finalize: copy winner GLB to public/assets/3d/cosmo.glb.

Strategy: ship the DRACO-COMPRESSED winner (16B-A) as cosmo.glb (752 KB vs 10MB).
Fallback uncompressed copy preserved in case-study for reproducibility.

Also: copy winner thumbnail to public/assets/3d/cosmo-preview.png (overwrite 15A).
"""
from __future__ import annotations
import json
import shutil
from pathlib import Path
from _lib import ROOT, LOG_DIR

ATTEMPTS = ROOT / 'public/assets/case-study/cosmo-3d-v16b/attempts'
PROD_DIR = ROOT / 'public/assets/3d'

WINNER_GLB_RAW = ATTEMPTS / 'cosmo-A_realistic.glb'
WINNER_GLB_DRACO = ATTEMPTS / 'cosmo-A_realistic-draco.glb'
WINNER_THUMB = ATTEMPTS / 'cosmo-A_realistic-thumb.png'

PROD_GLB = PROD_DIR / 'cosmo.glb'
PROD_PREVIEW = PROD_DIR / 'cosmo-preview.png'
PROD_GLB_RAW = PROD_DIR / 'cosmo-uncompressed.glb'  # fallback for debugging

# Backup the 15A version before overwriting
BACKUP_DIR = ROOT / 'public/assets/case-study/cosmo-3d-v16b/sprint15a-backup'
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
if PROD_GLB.exists():
    shutil.copy2(PROD_GLB, BACKUP_DIR / 'cosmo-15a.glb')
    print(f'[p7] backed up 15A GLB -> {BACKUP_DIR / "cosmo-15a.glb"}')
if PROD_PREVIEW.exists():
    shutil.copy2(PROD_PREVIEW, BACKUP_DIR / 'cosmo-15a-preview.png')
    print(f'[p7] backed up 15A preview -> {BACKUP_DIR / "cosmo-15a-preview.png"}')

# Ship draco-compressed as cosmo.glb (game loads via DRACOLoader)
shutil.copy2(WINNER_GLB_DRACO, PROD_GLB)
print(f'[p7] {PROD_GLB.name} <- DRACO ({PROD_GLB.stat().st_size/1e3:.1f} KB)')

# Keep raw uncompressed as fallback / debugging
shutil.copy2(WINNER_GLB_RAW, PROD_GLB_RAW)
print(f'[p7] {PROD_GLB_RAW.name} <- raw ({PROD_GLB_RAW.stat().st_size/1e6:.2f} MB)')

# Preview
shutil.copy2(WINNER_THUMB, PROD_PREVIEW)
print(f'[p7] {PROD_PREVIEW.name} <- {WINNER_THUMB.name} ({PROD_PREVIEW.stat().st_size/1e3:.1f} KB)')

manifest = {
    'sprint': '16B',
    'date': '2026-05-02',
    'winner': '16B-A_realistic',
    'production': {
        'glb': 'public/assets/3d/cosmo.glb',
        'glb_uncompressed_fallback': 'public/assets/3d/cosmo-uncompressed.glb',
        'preview': 'public/assets/3d/cosmo-preview.png',
    },
    'sizes': {
        'glb_draco': PROD_GLB.stat().st_size,
        'glb_raw': PROD_GLB_RAW.stat().st_size,
        'preview': PROD_PREVIEW.stat().st_size,
    },
    'mesh_stats': {
        'verts': 15137,
        'tris': 21978,
        'meshes': 1,
        'materials': 1,
        'textures': 4,
        'skins': 0,
        'animations': 0,
        'height_units': 1.911,
        'width_units': 1.556,
    },
    'meshy_task_id': '019de80e-1bf0-7db5-8521-be429fbb113e',
    'art_style': 'realistic',
    'target_polycount': 22000,
    'texture_resolution': 2048,
    'consumed_credits': 30,
    'cost_usd_estimate': 0.30,
    'source_image': 'public/assets/sprites/cosmo-hero-lora.png (Sprint 16A LoRA hero, 4096² RGBA)',
}
out = ROOT / 'public/assets/case-study/cosmo-3d-v16b/manifest.json'
out.write_text(json.dumps(manifest, indent=2))
print(f'[p7] saved manifest -> {out}')
