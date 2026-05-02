"""Sprint 17C — Phase 3: Finalize layers + composition specs + case-study mockups.

Tasks:
  1. Copy sky-gradient (layer 1) and particle-overlay (layer 6) raws into
     public/assets/backgrounds/biome-{id}/ as they are full-bleed and
     skip BiRefNet.
  2. Write public/assets/backgrounds/biome-{id}/composition-spec.json with
     the layer-list including parallax, scale, blend-mode, and z-position.
  3. Render case-study composition mock-ups for each biome (composited PNG
     showing all layers stacked).
  4. Render side-by-side comparison: old single-image biome vs new layered
     composition (same target dimensions).
"""
from __future__ import annotations
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
RAW_DIR = ROOT / 'scripts/sprint17c/raw'
PUB_BG_DIR = ROOT / 'public/assets/backgrounds'
CASE_DIR = ROOT / 'public/assets/case-study/biomes-v17c'
CASE_DIR.mkdir(parents=True, exist_ok=True)

BIOMES = ['slow-bloom', 'inkpool', 'cathedral', 'boss']

# Per-biome layer manifests (from biome_spec.json or hardcoded)
SPEC = json.loads((ROOT / 'scripts/sprint17c/_logs/biome_spec.json').read_text())


def copy_fullbleed_layers() -> None:
    """Sky (idx 1) and particle (idx 6) — copy raw to public unchanged."""
    for biome in SPEC:
        bid = biome['id']
        for layer in biome['layers']:
            if layer['isolation'] != 'fullbleed':
                continue
            src = RAW_DIR / f'biome-{bid}' / f'layer-{layer["idx"]}_{layer["name"]}-raw.png'
            dst = PUB_BG_DIR / f'biome-{bid}' / f'layer-{layer["idx"]}_{layer["name"]}.png'
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
            print(f'[COPY] {src.name} -> {dst.relative_to(ROOT)}')


# Mid-cluster A/B horizontal positioning (since Flux centered most clusters,
# we anchor them to LEFT and RIGHT thirds via x_offset)
LAYER_PLACEMENT = {
    # name -> {x_offset, y_offset} in normalized [-1,1] coords (0=center, -1=full-left, 1=full-right)
    # Anchors take the BiRefNet'd layer (centered subject) and shift it within the comp frame
    'sky-gradient': {'x': 0.0, 'y': 0.0, 'blend': 'normal'},
    'distant-mountains': {'x': 0.0, 'y': 0.15, 'blend': 'normal'},
    'distant-stalactites': {'x': 0.0, 'y': -0.15, 'blend': 'normal'},
    'distant-spires': {'x': 0.0, 'y': 0.0, 'blend': 'normal'},
    'mid-cluster-a': {'x': -0.25, 'y': 0.10, 'blend': 'normal'},
    'mid-clouds': {'x': -0.25, 'y': 0.0, 'blend': 'normal'},
    'mid-tornado': {'x': -0.20, 'y': 0.0, 'blend': 'normal'},
    'mid-cluster-b': {'x': 0.25, 'y': 0.05, 'blend': 'normal'},
    'mid-gargoyles': {'x': 0.25, 'y': -0.05, 'blend': 'normal'},
    'mid-eyes-mouths': {'x': 0.25, 'y': 0.0, 'blend': 'normal'},
    'foreground-cluster': {'x': 0.0, 'y': 0.20, 'blend': 'normal'},
    'foreground-pillars': {'x': 0.0, 'y': 0.20, 'blend': 'normal'},
    'foreground-rocks': {'x': 0.0, 'y': 0.20, 'blend': 'normal'},
    'particle-overlay': {'x': 0.0, 'y': 0.0, 'blend': 'additive'},
    'ambient-creature': {'x': 0.30, 'y': -0.20, 'blend': 'normal'},
}


def write_composition_specs() -> None:
    """Write composition-spec.json per biome with full layer manifest."""
    for biome in SPEC:
        bid = biome['id']
        layers_out = []
        for layer in biome['layers']:
            placement = LAYER_PLACEMENT.get(layer['name'], {'x': 0.0, 'y': 0.0, 'blend': 'normal'})
            layers_out.append({
                'idx': layer['idx'],
                'name': layer['name'],
                'role': layer['role'],
                'file': f'layer-{layer["idx"]}_{layer["name"]}.png',
                'parallax_multiplier': layer['parallax'],
                'scale': layer['scale'],
                'x_offset': placement['x'],
                'y_offset': placement['y'],
                'blend_mode': placement['blend'],
                # z-position for Three.js: smaller (more negative) = farther back
                # Map parallax 0.05 (slowest, farthest) -> z=-200 to parallax 1.0 (nearest) -> z=0
                'z_position': round(-200 * (1.0 - layer['parallax']), 1),
                'opacity': 1.0,
            })
        spec = {
            'biome_id': bid,
            'description': biome['description'],
            'frame_size': {'width': 1024, 'height': 1536},
            'layer_count': len(layers_out),
            'layers': layers_out,
            'parallax_notes': (
                'parallax_multiplier: world-space camera-X displacement is multiplied '
                'by this factor to shift each layer. 0.05 = nearly stationary (sky), '
                '1.0 = full motion (foreground particle). z_position is for Three.js '
                'depth-sort; lower = farther back.'
            ),
            'blend_modes': {
                'normal': 'standard alpha-over compositing',
                'additive': 'additive blend (THREE.AdditiveBlending or globalCompositeOperation=lighter); particle layers',
            },
        }
        out = PUB_BG_DIR / f'biome-{bid}' / 'composition-spec.json'
        out.write_text(json.dumps(spec, indent=2))
        print(f'[SPEC] {out.relative_to(ROOT)}')


def render_composition_mockup(bid: str) -> None:
    """Composite all layers into a 1024x1536 preview as if rendered.

    Approximation only — Three.js will do this dynamically with parallax shift.
    Mockup uses x_offset=0,y_offset=0 baseline (as if camera at center).
    """
    biome = next(b for b in SPEC if b['id'] == bid)
    canvas = Image.new('RGBA', (1024, 1536), (0, 0, 0, 0))
    biome_dir = PUB_BG_DIR / f'biome-{bid}'

    for layer in biome['layers']:
        layer_path = biome_dir / f'layer-{layer["idx"]}_{layer["name"]}.png'
        if not layer_path.exists():
            print(f'[SKIP] missing {layer_path.name}')
            continue
        img = Image.open(layer_path).convert('RGBA')
        # Resize to canvas height preserving aspect (most layers are 1024x1536 already)
        if img.size != (1024, 1536):
            img = img.resize((1024, 1536), Image.LANCZOS)

        placement = LAYER_PLACEMENT.get(layer['name'], {'x': 0.0, 'y': 0.0, 'blend': 'normal'})
        scale = layer['scale']
        if scale != 1.0:
            new_w = int(1024 * scale)
            new_h = int(1536 * scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)
        else:
            new_w, new_h = 1024, 1536

        # Calculate paste offset
        cx = 512 + int(placement['x'] * 512) - new_w // 2
        cy = 768 + int(placement['y'] * 768) - new_h // 2

        if placement['blend'] == 'additive':
            # Manual additive blend: convert layer's RGB to additive over canvas
            # Use ImageChops with screen approximation
            tmp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
            tmp.paste(img, (cx, cy), img)
            from PIL import ImageChops
            # Simulate additive: add layer to canvas (limited by 255)
            base_rgb = canvas.convert('RGB')
            top_rgb = tmp.convert('RGB')
            blended_rgb = ImageChops.add(base_rgb, top_rgb)
            # Re-attach alpha from canvas (blend doesn't replace alpha)
            blended = blended_rgb.convert('RGBA')
            canvas = blended
        else:
            canvas.paste(img, (cx, cy), img)

    out = CASE_DIR / f'biome-{bid}-composition-mockup.png'
    canvas.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'[MOCKUP] {out.relative_to(ROOT)}')


def render_side_by_side(bid: str) -> None:
    """Render side-by-side: old single 4K vs new layered composition mockup."""
    old_path = PUB_BG_DIR / f'biome-{bid}-4k.png'
    new_path = CASE_DIR / f'biome-{bid}-composition-mockup.png'
    if not old_path.exists() or not new_path.exists():
        print(f'[SKIP side-by-side] {bid}: missing source')
        return
    old = Image.open(old_path).convert('RGB')
    new = Image.open(new_path).convert('RGB')
    # Match heights at 1024
    h = 1024
    old_w = int(old.width * h / old.height)
    new_w = int(new.width * h / new.height)
    old = old.resize((old_w, h), Image.LANCZOS)
    new = new.resize((new_w, h), Image.LANCZOS)

    GAP = 40
    LABEL_H = 60
    composite = Image.new('RGB', (old_w + new_w + GAP, h + LABEL_H), (24, 18, 32))
    composite.paste(old, (0, LABEL_H))
    composite.paste(new, (old_w + GAP, LABEL_H))

    # Labels
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(composite)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 28)
    except IOError:
        font = ImageFont.load_default()
    draw.text((20, 14), f'biome-{bid} v0.5  (single 4K image)', fill=(220, 200, 240), font=font)
    draw.text((old_w + GAP + 20, 14), f'biome-{bid} v17C  (layered composition, parallax-ready)', fill=(220, 200, 240), font=font)

    out = CASE_DIR / f'biome-{bid}-sidebyside.png'
    composite.save(out, 'PNG', optimize=True)
    print(f'[SIDE-BY-SIDE] {out.relative_to(ROOT)}')


def render_layer_strip(bid: str) -> None:
    """Render a horizontal strip showing each layer in isolation."""
    biome = next(b for b in SPEC if b['id'] == bid)
    biome_dir = PUB_BG_DIR / f'biome-{bid}'

    layer_imgs = []
    for layer in biome['layers']:
        path = biome_dir / f'layer-{layer["idx"]}_{layer["name"]}.png'
        if not path.exists():
            continue
        img = Image.open(path).convert('RGBA')
        # Render against a checker-bg for transparent layers, jet-black for opaque
        if layer['isolation'] == 'transparent-target':
            bg = Image.new('RGBA', img.size, (40, 30, 50, 255))
        else:
            bg = Image.new('RGBA', img.size, (0, 0, 0, 255))
        merged = Image.alpha_composite(bg, img)
        layer_imgs.append((layer, merged))

    if not layer_imgs:
        return

    # Resize each to 320x480 portrait thumb
    THUMB_W, THUMB_H = 320, 480
    GAP = 16
    LABEL_H = 50
    n = len(layer_imgs)
    total_w = THUMB_W * n + GAP * (n - 1)
    total_h = THUMB_H + LABEL_H

    strip = Image.new('RGB', (total_w, total_h), (16, 12, 24))
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(strip)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
    except IOError:
        font = ImageFont.load_default()

    for i, (layer, img) in enumerate(layer_imgs):
        thumb = img.convert('RGB').resize((THUMB_W, THUMB_H), Image.LANCZOS)
        x = i * (THUMB_W + GAP)
        strip.paste(thumb, (x, LABEL_H))
        label = f'L{layer["idx"]} {layer["name"]} (P={layer["parallax"]})'
        draw.text((x + 8, 12), label, fill=(220, 200, 240), font=font)

    out = CASE_DIR / f'biome-{bid}-layer-strip.png'
    strip.save(out, 'PNG', optimize=True)
    print(f'[LAYER-STRIP] {out.relative_to(ROOT)}')


def main() -> int:
    print('[PHASE 3] Copying full-bleed (sky + particle) layers...')
    copy_fullbleed_layers()

    print('[PHASE 3] Writing composition-spec.json per biome...')
    write_composition_specs()

    print('[PHASE 3] Rendering composition mockups...')
    for bid in BIOMES:
        render_composition_mockup(bid)

    print('[PHASE 3] Rendering side-by-side (old vs new) per biome...')
    for bid in BIOMES:
        render_side_by_side(bid)

    print('[PHASE 3] Rendering layer-strip per biome...')
    for bid in BIOMES:
        render_layer_strip(bid)

    print('[PHASE 3 DONE]')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
