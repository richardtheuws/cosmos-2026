"""Sprint 17A p5 — inspect rigged GLB (verts/tris/skins/anim/bones).

Pure-Python GLB parser, no Three.js needed. Prints metrics + acceptance gate:
- polycount in [15k, 30k]
- 9+ bones with bone_* prefix
- 4 animation clips
- file <12MB
"""
from __future__ import annotations
import json
import struct
import sys
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
LOG_DIR = ROOT / 'scripts/sprint17a/_logs'
RIGGED = ROOT / 'public/assets/case-study/cosmo-rig-v17a/glb/cosmo_rigged.glb'


def parse_glb(path: Path) -> dict:
    raw = path.read_bytes()
    assert raw[0:4] == b'glTF', f'not GLB: {path}'
    chunk_len = struct.unpack('<I', raw[12:16])[0]
    gltf = json.loads(raw[20:20 + chunk_len].decode('utf-8'))
    meshes = gltf.get('meshes', [])
    accessors = gltf.get('accessors', [])
    materials = gltf.get('materials', [])
    textures = gltf.get('textures', [])
    skins = gltf.get('skins', [])
    animations = gltf.get('animations', [])
    nodes = gltf.get('nodes', [])

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

    # Collect bone names
    bone_names = []
    for skin in skins:
        for joint_idx in skin.get('joints', []):
            n = nodes[joint_idx].get('name', f'<unnamed-{joint_idx}>')
            bone_names.append(n)

    anim_names = [a.get('name', '<unnamed>') for a in animations]
    anim_lengths = []
    for anim in animations:
        # max time of all samplers
        mx = 0.0
        for sampler in anim.get('samplers', []):
            in_idx = sampler.get('input')
            if in_idx is None:
                continue
            acc = accessors[in_idx]
            mx = max(mx, acc.get('max', [0])[0] if isinstance(acc.get('max'), list) else 0)
        anim_lengths.append(round(mx, 3))

    return {
        'file': str(path),
        'size_mb': round(path.stat().st_size / 1e6, 2),
        'meshes': len(meshes),
        'verts': total_verts,
        'tris': total_tris,
        'materials': len(materials),
        'textures': len(textures),
        'skins': len(skins),
        'bones': bone_names,
        'bone_count': len(bone_names),
        'animations': anim_names,
        'animation_count': len(animations),
        'animation_lengths_s': anim_lengths,
    }


def acceptance_gate(info: dict) -> tuple[bool, list[str]]:
    failures = []
    if info['tris'] < 15000 or info['tris'] > 30000:
        failures.append(f"polycount {info['tris']} OUT OF [15000, 30000]")
    bone_pref = [b for b in info['bones'] if b.startswith('bone_')]
    if len(bone_pref) < 9:
        failures.append(f"bones with 'bone_' prefix {len(bone_pref)}/9")
    expected = {'bone_root', 'bone_spine', 'bone_head', 'bone_eye_l', 'bone_eye_r',
                'bone_antenne', 'bone_arm_l', 'bone_arm_r', 'bone_disc_l', 'bone_disc_r'}
    missing = expected - set(info['bones'])
    if missing:
        failures.append(f"missing bones: {sorted(missing)}")
    if info['animation_count'] < 4:
        failures.append(f"animation count {info['animation_count']}/4")
    expected_clips = {'idle', 'wave', 'stretch', 'sit'}
    missing_clips = expected_clips - set(info['animations'])
    if missing_clips:
        failures.append(f"missing clips: {sorted(missing_clips)}")
    if info['size_mb'] > 12:
        failures.append(f"size {info['size_mb']}MB OVER 12MB")
    return len(failures) == 0, failures


def main():
    if not RIGGED.exists():
        print(f'[FAIL] {RIGGED} missing — run p4_run_blender.sh first')
        sys.exit(1)
    info = parse_glb(RIGGED)
    print(json.dumps(info, indent=2))
    ok, failures = acceptance_gate(info)
    info['acceptance_ok'] = ok
    info['acceptance_failures'] = failures
    (LOG_DIR / 'p5_inspection.json').write_text(json.dumps(info, indent=2))
    if ok:
        print('\n[ACCEPT] All gates passed.')
    else:
        print('\n[REJECT] Failures:')
        for f in failures:
            print(f'  - {f}')


if __name__ == '__main__':
    main()
