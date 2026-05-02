"""Sprint 16B p1 — upload cosmo-hero-lora.png to fal.ai storage for Meshy ingestion."""
from __future__ import annotations
import json
from pathlib import Path
from _lib import upload_to_fal, ROOT, LOG_DIR

HERO = ROOT / 'public/assets/sprites/cosmo-hero-lora.png'

if __name__ == '__main__':
    assert HERO.exists(), f'hero missing: {HERO}'
    print(f'[p1] uploading {HERO.name} ({HERO.stat().st_size/1e6:.2f} MB) ...')
    url = upload_to_fal(HERO)
    print(f'[p1] hosted_url = {url}')
    out = LOG_DIR / 'p1_uploaded.json'
    out.write_text(json.dumps({'hero_url': url, 'src': str(HERO)}, indent=2))
    print(f'[p1] saved -> {out}')
