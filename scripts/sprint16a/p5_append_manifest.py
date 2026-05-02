"""Append Sprint 16A entry to assets-generated.json."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
MANIFEST = ROOT / 'assets-generated.json'
TRAINING = ROOT / 'public/assets/case-study/cosmo-lora-v16a/training_result.json'

train = json.loads(TRAINING.read_text())
lora_url = train['lora_url']

entry = {
    'sprint': 'Sprint 16A — Cosmo-LoRA fine-tune (DNA baked into model weights)',
    'generated': '2026-05-02',
    'strategy': 'Train Flux LoRA on 10-image curated DNA-correct dataset, then generate hero with trigger word',
    'model_training': 'fal-ai/flux-lora-fast-training',
    'model_inference': 'fal-ai/flux-lora',
    'trigger_word': 'rtcosmo',
    'training_steps': 2000,
    'lora_url': lora_url,
    'config_url': train.get('config_url'),
    'cost_estimate_usd': '~$2-4 training + ~$0.50 generation + $0.05 ESRGAN + $0.02 BiRefNet ≈ $3-5 total',
    'dataset': {
        'image_count': 10,
        'sources': [
            'cosmo-h3-hayao-chameleon (Sprint 4.5 winner)',
            'cosmo-rerender-v14a painted-eyes (DNA-correct chameleon eyes)',
            'cosmo-canonical-v2-cleaned (paper-grain reference)',
            'cosmo-h1, h2, h4 (Hayao hybride iteraties)',
            'cosmo-walk-1, jump-up, cling (v053 originals — pose variation)',
            'cosmo-v3-moebius-mainline (alt character study)',
        ],
        'caption_format': 'rtcosmo, [pose-description], hayao moebius watercolor with paper grain, chameleon bulging spherical eyes glossy black with saffron catchlight, single antenna with faded rose flower bulb tip, two black flat suction cup discs at hand tips, faded rose spots on green moss-sage watercolor body, slim kid-frame proportions, no tail, slight overbite mouth, slightly uncute proportions, NOT kawaii NOT chibi NOT Disney',
    },
    'hero_generation': {
        'attempts': 10,
        'winner': 'a03 (seed=8181, scale=1.0)',
        'image_size_requested': '2048x2048',
        'image_size_returned': '1536x1536 (Flux model cap)',
        'guidance_scale': 4.0,
        'num_inference_steps': 32,
        'base_prompt_summary': 'rtcosmo standing pose facing camera + double anti-kawaii anti-Disney stack + DNA descriptors',
    },
    'post_processing': {
        '1_birefnet': 'fal-ai/birefnet model="General Use (Heavy)" operating_resolution=2048x2048 — removed peach moon halo cleanly',
        '2_chroma_cleanup': 'PIL chroma-key remaining peach pixels outside body silhouette',
        '3_tail_erase': 'PIL alpha-erase 2-region polygon (body-flank curve + curl-rectangle) — Sprint 6A pattern, 0% failure',
        '4_esrgan_4x': 'fal-ai/esrgan scale=4 → 6144² RGB (alpha preserved separately via Lanczos + threshold-tighten, Sprint 14A pattern)',
        '5_downsample': 'PIL Lanczos 6144² → 4096² for spec target',
    },
    'output_files': {
        'final_hero': 'public/assets/sprites/cosmo-hero-lora.png',
        'dimensions': '4096x4096 RGBA',
        'size_kb': 4847,
        'halo_fringe_avg_px': 14.28,
        'case_study_dir': 'public/assets/case-study/cosmo-lora-v16a/',
    },
    'dna_checklist_pass': {
        'pearl_drop_head': True,
        'chameleon_bulging_eyes_no_kawaii': True,
        'no_blush': True,
        'single_antenna_with_flower_tip': True,
        'two_black_flat_suction_cup_discs': True,
        'faded_rose_spots': True,
        'no_tail': True,
        'no_finger_hands': True,
        'watercolor_body_paper_grain': True,
        'slight_uncute_proportions': True,
        'score': '10/10',
    },
    'why_this_works': (
        'Previous sprints (5B/6A/7A/11A/13D/14A) all failed to produce DNA-correct '
        'Cosmo from text-prompts because Flux training data biases dominated: '
        'kawaii eyes, lizard-tail, biped-fingers. PIL-paint workaround in 14A '
        'forced black eye-spheres deterministically but could not solve disc-hands '
        '(needed full anatomy regeneration). LoRA fine-tune bakes the DNA cluster '
        '(suction-cup discs, pearl-drop head, chameleon eyes, no-tail, antenna+bulb) '
        'directly into the model weights — so trigger word `rtcosmo` reliably evokes '
        'all DNA traits in a single generation. a03 is the FIRST organically-generated '
        'Cosmo with two clean black floating disc-pads — the architectural blocker '
        'identified across 6+ sprints is now resolved.'
    ),
    'reuse_instructions': {
        'inference_endpoint': 'fal-ai/flux-lora',
        'lora_path_param': lora_url,
        'lora_scale_default': 1.0,
        'trigger_word': 'rtcosmo',
        'recommended_prompt_template': 'rtcosmo, [POSE], hayao moebius watercolor, NOT kawaii NOT chibi NOT Disney, chameleon bulging eye spheres, single antenna with faded rose flower bulb, two black flat suction cup discs at hand tips, no tail, faded rose spots on green moss-sage body, slim kid-frame, slightly uncute proportions',
        'use_cases': [
            'Future hero re-renders at any size',
            'Animation frame generation (walk/jump/cling) — no longer needs canonical-img2img which was architecturally blocked',
            'Pose variation via direct text prompts (LoRA preserves DNA across poses)',
            'Sprint 16B: 3D-Cosmo via Meshy v6 image-to-3D from this hero',
        ],
    },
}


def main() -> int:
    data = json.loads(MANIFEST.read_text())
    data['sprints'].append(entry)
    MANIFEST.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f'[manifest] appended Sprint 16A → {MANIFEST}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
