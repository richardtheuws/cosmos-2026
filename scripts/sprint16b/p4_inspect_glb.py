"""Sprint 16B p4 — inspect GLB structure (verts/tris/skins/anim) for both attempts.

Pure-Python GLB parser, no Three.js needed.
"""
from __future__ import annotations
import json
import struct
from pathlib import Path
from _lib import ROOT, LOG_DIR

ATTEMPTS = ROOT / 'public/assets/case-study/cosmo-3d-v16b/attempts'


def parse_glb(path: Path) -> dict:
    raw = path.read_bytes()
    assert raw[0:4] == b'glTF', f'not GLB: {path}'
    chunk_len = struct.unpack('<I', raw[12:16])[0]
    gltf = json.loads(raw[20:20 + chunk_len].decode('utf-8'))
    meshes = gltf.get('meshes', [])
    accessors = gltf.get('accessors', [])
    materials = gltf.get('materials', [])
    textures = gltf.get('textures', [])
    images = gltf.get('images', [])
    skins = gltf.get('skins', [])
    animations = gltf.get('animations', [])

    total_verts = 0
    total_tris = 0
    for mesh in meshes:
        for prim in mesh.get('primitives', []):
            attrs = prim.get('attributes', {})
            pos_idx = attrs.get('POSITION')
            if pos_idx is not None:
                total_verts += accessors[pos_idx].get('count', 0)
            idx = prim.get('indices')
            if idx is not None:
                total_tris += accessors[idx].get('count', 0) // 3

    return {
        'file': path.name,
        'size_mb': round(path.stat().st_size / 1e6, 2),
        'meshes': len(meshes),
        'primitives': sum(len(m.get('primitives', [])) for m in meshes),
        'verts': total_verts,
        'tris': total_tris,
        'materials': len(materials),
        'textures': len(textures),
        'images': len(images),
        'skins': len(skins),
        'animations': len(animations),
    }


if __name__ == '__main__':
    p3 = json.loads((LOG_DIR / 'p3_results.json').read_text())
    inspections = []
    for entry in p3:
        if entry.get('status') != 'SUCCEEDED':
            continue
        glb_path = Path(entry['glb_path'])
        if not glb_path.exists():
            continue
        info = parse_glb(glb_path)
        info['label'] = entry['label']
        info['art_style'] = entry['art_style']
        info['target_polycount'] = entry['target_polycount']
        info['consumed_credits'] = entry.get('consumed_credits')
        inspections.append(info)
        print(f"[p4] {entry['label']}: verts={info['verts']} tris={info['tris']} "
              f"materials={info['materials']} textures={info['textures']} "
              f"skins={info['skins']} anim={info['animations']} size={info['size_mb']}MB")

    out = LOG_DIR / 'p4_inspections.json'
    out.write_text(json.dumps(inspections, indent=2))
    print(f'[p4] saved -> {out}')
