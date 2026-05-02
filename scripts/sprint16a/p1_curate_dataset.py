"""
Sprint 16A — Phase 1: Curate the 10-image LoRA training dataset.

Strategy:
- 1× Sprint 4.5 H3 winner (canonical concept — best 2D)
- 1× Sprint 14A 4K painted-eyes (DNA-correct: chameleon eyes + no tail)
- 1× canonical-v2-cleaned (paper-grain reference, even with kawaii eyes)
- 3× H1/H2/H4 hybride iteraties (Hayao watercolor, body language)
- 2× v053 originals (pose variation: walk-1, jump-up — clean style)
- 1× v053 cling pose (side-cling, body-mass)
- 1× v3-moebius-mainline (alt pose / character study)

Each image is resized to 1024×1024 (already are) and saved with a sidecar
.txt caption containing trigger word `rtcosmo` + per-image pose description.

Output: scripts/sprint16a/dataset/cosmo_<n>.png + cosmo_<n>.txt + dataset.zip
Also copies the dataset to public/assets/case-study/cosmo-lora-v16a/dataset/
for case-study trail.
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image
import zipfile
import shutil

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
DATASET_DIR = ROOT / 'scripts/sprint16a/dataset'
CASE_DIR = ROOT / 'public/assets/case-study/cosmo-lora-v16a/dataset'
DATASET_DIR.mkdir(parents=True, exist_ok=True)
CASE_DIR.mkdir(parents=True, exist_ok=True)

TRIGGER = 'rtcosmo'

# Shared style stem (ALL captions). Burned into LoRA so trigger word
# becomes a stable handle for the whole DNA cluster.
STYLE_STEM = (
    'hayao moebius watercolor with paper grain, painterly ink underdrawing, '
    'chameleon bulging spherical eyes glossy black with saffron catchlight, '
    'single antenna with faded rose flower bulb tip, two black flat suction cup discs at hand tips, '
    'faded rose spots on green moss-sage watercolor body, slim kid-frame proportions, '
    'no tail, slight overbite mouth, slightly uncute proportions, NOT kawaii NOT chibi NOT Disney'
)

# Per-image pose riders. Variation forces the model to associate the trigger
# word with the DNA cluster — not a single pose.
SOURCES = [
    # (source_path, pose_description, file_label)
    ('public/assets/case-study/cosmo-redesigns/cosmo-h3-hayao-chameleon.png',
     'standing front-facing pose centered against soft peach-pink moon halo backdrop',
     'cosmo_01_h3'),
    ('public/assets/case-study/cosmo-rerender-v14a/routeBplus-painted-eyes-1024.png',
     'standing pose with arms slightly out chameleon eye spheres clearly visible',
     'cosmo_02_v14a_painted'),
    ('public/assets/sprites/v3/cosmo-canonical-v2-cleaned.png',
     'standing neutral pose three-quarter view full body silhouette on transparent background',
     'cosmo_03_canonical_v2'),
    ('public/assets/case-study/cosmo-redesigns/cosmo-h1-hayao-moebius-suction.png',
     'side-view standing with both suction-cup hands hanging at sides',
     'cosmo_04_h1'),
    ('public/assets/case-study/cosmo-redesigns/cosmo-h2-hayao-moebius-suction.png',
     'three-quarter view standing with arms slightly raised showing suction cup discs',
     'cosmo_05_h2'),
    ('public/assets/case-study/cosmo-redesigns/cosmo-h4-hayao-chameleon-bigger.png',
     'larger frame fill standing pose chameleon eyes prominent',
     'cosmo_06_h4'),
    ('public/assets/sprites/cosmo-walk-1.png',
     'walking pose mid-stride side profile facing right',
     'cosmo_07_walk1'),
    ('public/assets/sprites/cosmo-jump-up.png',
     'jumping upward apex pose arms slightly raised excited expression',
     'cosmo_08_jumpup'),
    ('public/assets/sprites/cosmo-cling.png',
     'wall-cling pose body pressed flat against vertical surface side view',
     'cosmo_09_cling'),
    ('public/assets/case-study/cosmo-redesigns/cosmo-v3-moebius-mainline.png',
     'standing portrait moebius linework full body painterly watercolor',
     'cosmo_10_v3'),
]


def caption_for(pose: str) -> str:
    return f'{TRIGGER}, {pose}, {STYLE_STEM}'


def prep_image(src_path: Path, dst_path: Path) -> tuple[int, int]:
    im = Image.open(src_path)
    # Force RGB (training pipeline does not need alpha; for transparent PNGs
    # composite onto white so background is consistent across dataset).
    if im.mode in ('RGBA', 'LA'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        if im.mode == 'RGBA':
            bg.paste(im, mask=im.split()[3])
        else:
            bg.paste(im.convert('RGB'))
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    # Resize to 1024 square (all sources already 1024² but force exact)
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst_path, 'PNG', optimize=True)
    return im.size


def main() -> int:
    print(f'[Sprint 16A] Curating {len(SOURCES)} images for Cosmo-LoRA training')
    manifest = []
    for src_rel, pose, label in SOURCES:
        src = ROOT / src_rel
        if not src.exists():
            print(f'  [SKIP] missing source: {src_rel}')
            continue
        dst_img = DATASET_DIR / f'{label}.png'
        dst_txt = DATASET_DIR / f'{label}.txt'
        case_img = CASE_DIR / f'{label}.png'
        case_txt = CASE_DIR / f'{label}.txt'
        size = prep_image(src, dst_img)
        caption = caption_for(pose)
        dst_txt.write_text(caption + '\n', encoding='utf-8')
        # Mirror to case-study trail
        shutil.copy2(dst_img, case_img)
        shutil.copy2(dst_txt, case_txt)
        manifest.append({'label': label, 'source': src_rel, 'caption': caption})
        print(f'  [OK] {label}: {size} | {len(caption)}c caption')

    # Build zip for fal.ai training endpoint
    zip_path = ROOT / 'scripts/sprint16a/cosmo_dataset.zip'
    print(f'[zip] writing {zip_path}')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for entry in manifest:
            label = entry['label']
            z.write(DATASET_DIR / f'{label}.png', f'{label}.png')
            z.write(DATASET_DIR / f'{label}.txt', f'{label}.txt')
    zip_size = zip_path.stat().st_size
    print(f'[zip] {zip_size//1024}KB containing {len(manifest)} image+caption pairs')

    # Write JSON manifest for case-study transparency
    import json
    manifest_path = ROOT / 'public/assets/case-study/cosmo-lora-v16a/dataset_manifest.json'
    manifest_path.write_text(json.dumps({
        'sprint': '16A',
        'trigger_word': TRIGGER,
        'style_stem': STYLE_STEM,
        'image_count': len(manifest),
        'images': manifest,
    }, indent=2), encoding='utf-8')
    print(f'[manifest] {manifest_path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
