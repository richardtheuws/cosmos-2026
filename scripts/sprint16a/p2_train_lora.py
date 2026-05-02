"""
Sprint 16A — Phase 2: Train Cosmo-LoRA via fal.ai/flux-lora-fast-training.

Steps:
1. Upload cosmo_dataset.zip to fal.ai storage → hosted URL
2. Submit training job with trigger_word=rtcosmo, steps=2000, create_masks=True
3. Poll until COMPLETED (~5-15 min)
4. Save returned diffusers_lora_file URL + config_file URL into:
   - scripts/sprint16a/_logs/training_result.json
   - public/assets/case-study/cosmo-lora-v16a/training_result.json
5. Print model URL for downstream use

Cost estimate: ~$2-5 per training run (varies with steps/dataset size).
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _lib import (
    ROOT, LOG_DIR, FAL_KEY,
    submit, poll_until_done, log_attempt, upload_to_fal_storage,
)

ZIP_PATH = ROOT / 'scripts/sprint16a/cosmo_dataset.zip'
RESULT_LOG = LOG_DIR / 'training_result.json'
RESULT_CASE = ROOT / 'public/assets/case-study/cosmo-lora-v16a/training_result.json'

ENDPOINT = 'fal-ai/flux-lora-fast-training'
TRIGGER_WORD = 'rtcosmo'
STEPS = 2000  # 1500-2000 range per Sprint 16A spec; 2000 for richer DNA bake


def main() -> int:
    if not ZIP_PATH.exists():
        print(f'[FAIL] dataset zip missing: {ZIP_PATH}')
        print('       Run: python3 scripts/sprint16a/p1_curate_dataset.py')
        return 2

    zip_kb = ZIP_PATH.stat().st_size // 1024
    print(f'[Sprint 16A/p2] dataset zip: {zip_kb}KB')

    # Step 1: upload zip to fal storage
    print('[upload] sending zip to fal storage...')
    try:
        zip_url = upload_to_fal_storage(ZIP_PATH)
    except Exception as e:
        print(f'[FAIL] upload: {e}')
        return 3
    print(f'[upload] hosted: {zip_url}')

    # Step 2: submit training job
    body = {
        'images_data_url': zip_url,
        'trigger_word': TRIGGER_WORD,
        'steps': STEPS,
        'create_masks': True,
        'is_style': False,
    }
    print(f'[submit] {ENDPOINT}')
    print(f'         trigger_word={TRIGGER_WORD} steps={STEPS} create_masks=True')
    log_attempt('training_attempts.jsonl', {'phase': 'submit', 'body': body})

    try:
        request_id, response_url = submit(ENDPOINT, body)
    except Exception as e:
        print(f'[FAIL] submit: {e}')
        return 4
    print(f'[submit] request_id={request_id}')
    print(f'[submit] response_url={response_url}')

    # Step 3: poll
    print('[poll] training takes ~5-15 min. Polling every 3s...')
    payload = poll_until_done(response_url, label='lora-training', max_polls=600, sleep_s=3.0)
    if not payload:
        print('[FAIL] training did not complete')
        return 5

    # Step 4: extract URLs
    lora_url = None
    config_url = None
    if 'diffusers_lora_file' in payload:
        f = payload['diffusers_lora_file']
        lora_url = f.get('url') if isinstance(f, dict) else f
    if 'config_file' in payload:
        f = payload['config_file']
        config_url = f.get('url') if isinstance(f, dict) else f

    if not lora_url:
        print(f'[WARN] no diffusers_lora_file in payload — keys={list(payload.keys())}')

    result = {
        'sprint': '16A',
        'endpoint': ENDPOINT,
        'request_id': request_id,
        'trigger_word': TRIGGER_WORD,
        'steps': STEPS,
        'lora_url': lora_url,
        'config_url': config_url,
        'full_payload': payload,
    }
    RESULT_LOG.write_text(json.dumps(result, indent=2), encoding='utf-8')
    RESULT_CASE.parent.mkdir(parents=True, exist_ok=True)
    RESULT_CASE.write_text(json.dumps(result, indent=2), encoding='utf-8')

    print('=' * 70)
    print('[DONE] Cosmo-LoRA trained')
    print(f'   lora_url:   {lora_url}')
    print(f'   config_url: {config_url}')
    print(f'   logged to:  {RESULT_LOG}')
    print(f'   trigger:    {TRIGGER_WORD}')
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
