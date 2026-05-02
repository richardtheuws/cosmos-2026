"""Sprint 17A p9 — append Sprint 17A entry to assets-generated.json."""
import json
from datetime import datetime
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'assets-generated.json'
LOG_DIR = ROOT / 'scripts/sprint17a/_logs'

POSES = ['idle-breath', 'wave-uncanny', 'stretch', 'sit-sniff']


def main():
    data = json.loads(MANIFEST.read_text())
    p1 = json.loads((LOG_DIR / 'p1_results.json').read_text()) if (LOG_DIR / 'p1_results.json').exists() else []
    p2 = json.loads((LOG_DIR / 'p2_results.json').read_text()) if (LOG_DIR / 'p2_results.json').exists() else []
    p5 = json.loads((LOG_DIR / 'p5_inspection.json').read_text()) if (LOG_DIR / 'p5_inspection.json').exists() else None

    pose_entries = []
    for name in POSES:
        winner_p2 = next((r for r in p2 if r.get('pose') == name and r.get('ok')), None)
        if not winner_p2:
            continue
        pose_entries.append({
            'pose': name,
            'file': f'public/assets/sprites/cosmo-pose-{name}.png',
            'winner_attempt': winner_p2.get('tag'),
            'esrgan_used': winner_p2.get('esrgan', True),
            'pipeline': 'fal-ai/flux-lora (rtcosmo) → BiRefNet Heavy → ESRGAN 4x → Lanczos 4096',
            'lora_url': 'https://v3b.fal.media/files/b/0a98931e/10m_xs8iJYAfgyWc7fVbr_pytorch_lora_weights.safetensors',
            'trigger_word': 'rtcosmo',
        })

    glb_info = {
        'file': 'public/assets/3d/cosmo.glb',
        'spec_file': 'public/assets/3d/cosmo-rig-spec.json',
        'overwrites': 'sprint16b cosmo.glb',
        'pipeline': 'Blender 5.1 headless: import 16B mesh → 10-bone armature → distance-based weights → 4 NLA clips → GLB export',
    }
    if p5:
        glb_info.update({
            'tris': p5.get('tris'),
            'verts': p5.get('verts'),
            'bone_count': p5.get('bone_count'),
            'animations': p5.get('animations'),
            'size_mb': p5.get('size_mb'),
            'acceptance_ok': p5.get('acceptance_ok'),
        })

    entry = {
        'sprint': 'Sprint 17A — Cosmo 4 LoRA-poses + Blender handmade-rig + procedural-tilt-bones',
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'strategy': 'Hybrid: Track A (4 LoRA static poses) + Track B (Blender rig on 16B base mesh) + Track C (rig-spec doc)',
        'poses': pose_entries,
        'rigged_glb': glb_info,
        'cost_usd_estimate': '~$1.00 (16 LoRA gens × ~0.05 + 4 BiRefNet + 4 ESRGAN; Blender local = $0)',
    }

    sprints = data.setdefault('sprints', [])
    # Replace if Sprint 17A already present
    sprints = [s for s in sprints if s.get('sprint', '').find('Sprint 17A') == -1]
    sprints.append(entry)
    data['sprints'] = sprints

    MANIFEST.write_text(json.dumps(data, indent=2))
    print(f'Appended Sprint 17A → {MANIFEST.name}')


if __name__ == '__main__':
    main()
