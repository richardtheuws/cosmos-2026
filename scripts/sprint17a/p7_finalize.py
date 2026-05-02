"""Sprint 17A p7 — finalize: copy rigged GLB to public/assets/3d/cosmo.glb.

OVERWRITES Sprint 16B's GLB. Backup is kept in case-study/cosmo-3d-v16b/.
Updates cosmo-rig-spec.json copy if it was written elsewhere.
"""
import shutil
import sys
import json
from pathlib import Path

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
RIGGED = ROOT / 'public/assets/case-study/cosmo-rig-v17a/glb/cosmo_rigged.glb'
TARGET = ROOT / 'public/assets/3d/cosmo.glb'
SPEC_TARGET = ROOT / 'public/assets/3d/cosmo-rig-spec.json'
BACKUP = ROOT / 'public/assets/case-study/cosmo-3d-v16b/cosmo-16b-pre-17a-backup.glb'


def main():
    if not RIGGED.exists():
        print(f'[FAIL] {RIGGED} missing')
        sys.exit(1)
    if TARGET.exists():
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(TARGET, BACKUP)
        print(f'Backed up old cosmo.glb → {BACKUP}')
    shutil.copy2(RIGGED, TARGET)
    print(f'Copied {RIGGED.name} → {TARGET}')
    print(f'  size: {TARGET.stat().st_size//1024} KB')
    if SPEC_TARGET.exists():
        print(f'Spec: {SPEC_TARGET} ({SPEC_TARGET.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
