"""Sprint 16B p6 — build side-by-side: 15A old preview vs 16B-A vs 16B-B vs LoRA hero.

Prints DNA-criteria checklist per attempt as JSON for human review.
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from _lib import ROOT, LOG_DIR

CASE_STUDY = ROOT / 'public/assets/case-study/cosmo-3d-v16b'
ATTEMPTS = CASE_STUDY / 'attempts'
HERO_LORA = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'
OLD_15A_PREVIEW = ROOT / 'public/assets/3d/cosmo-preview.png'

# 4-panel composite: Hero LoRA | 15A old | 16B-A | 16B-B
PANEL = 512
PAD = 16
LABEL_H = 48
W = PANEL * 4 + PAD * 5
H = PANEL + LABEL_H + PAD * 2

img = Image.new('RGBA', (W, H), (24, 22, 28, 255))
draw = ImageDraw.Draw(img)

panels = [
    ('LoRA hero (16A source)', HERO_LORA),
    ('15A old (PIL eyes)', OLD_15A_PREVIEW),
    ('16B-A realistic 22k', ATTEMPTS / 'cosmo-A_realistic-thumb.png'),
    ('16B-B sculpture 25k', ATTEMPTS / 'cosmo-B_sculpture-thumb.png'),
]

try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
except Exception:
    font = ImageFont.load_default()

for idx, (label, path) in enumerate(panels):
    x = PAD + idx * (PANEL + PAD)
    y = PAD
    if path.exists():
        thumb = Image.open(path).convert('RGBA')
        # fit-square
        thumb.thumbnail((PANEL, PANEL), Image.Resampling.LANCZOS)
        # center-paste
        cx = x + (PANEL - thumb.size[0]) // 2
        cy = y + (PANEL - thumb.size[1]) // 2
        # white card behind
        draw.rectangle([x, y, x + PANEL, y + PANEL], fill=(40, 38, 46, 255))
        img.paste(thumb, (cx, cy), thumb)
    else:
        draw.rectangle([x, y, x + PANEL, y + PANEL], outline=(180, 90, 90), width=4)
        draw.text((x + 12, y + 12), '(missing)', fill=(180, 90, 90), font=font)
    draw.text((x + 8, y + PANEL + 8), label, fill=(220, 220, 230, 255), font=font)

out = CASE_STUDY / 'side-by-side-15a-vs-16b.png'
img.save(out)
print(f'[p6] saved -> {out} ({out.stat().st_size/1e3:.1f} KB)')

# DNA checklist per attempt — visual heuristic from thumbs (auto won't fully judge,
# but we encode the spec for the assets manifest).
DNA_CRITERIA = [
    'Pearl-drop head shape geometry',
    'Eye-area = dark bulging spheres (3D mesh, not 2D-painted)',
    'Single antenna geometry + rose flower bulb tip',
    'Suction-cup discs as flat disc-meshes (no claws/fingers)',
    'Faded-rose spots as texture on body',
    'No tail geometry',
    'Watercolor-ish texture (not plastic glossy)',
    'Slight uncute proportions',
]

manual_scores = {
    '16B-A_realistic': {
        'Pearl-drop head shape geometry': True,
        'Eye-area = dark bulging spheres (3D mesh, not 2D-painted)': True,
        'Single antenna geometry + rose flower bulb tip': True,
        'Suction-cup discs as flat disc-meshes (no claws/fingers)': True,  # floating discs visible
        'Faded-rose spots as texture on body': True,  # subtle but present
        'No tail geometry': True,
        'Watercolor-ish texture (not plastic glossy)': False,  # somewhat plastic 3D look
        'Slight uncute proportions': True,
    },
    '16B-B_sculpture': {
        'Pearl-drop head shape geometry': True,
        'Eye-area = dark bulging spheres (3D mesh, not 2D-painted)': True,
        'Single antenna geometry + rose flower bulb tip': True,
        'Suction-cup discs as flat disc-meshes (no claws/fingers)': True,
        'Faded-rose spots as texture on body': True,
        'No tail geometry': True,
        'Watercolor-ish texture (not plastic glossy)': False,  # similar plasticity
        'Slight uncute proportions': True,
    },
}

scoring = {}
for label, scores in manual_scores.items():
    passing = sum(1 for v in scores.values() if v)
    scoring[label] = {'passed': passing, 'total': len(scores), 'detail': scores}
    print(f'[p6] {label}: {passing}/{len(scores)} DNA criteria PASS')

(LOG_DIR / 'p6_dna_scoring.json').write_text(json.dumps({
    'criteria': DNA_CRITERIA, 'scoring': scoring,
}, indent=2))
print(f'[p6] saved scoring -> {LOG_DIR / "p6_dna_scoring.json"}')
