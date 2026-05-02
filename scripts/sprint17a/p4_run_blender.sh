#!/bin/bash
# Sprint 17A — Track B step 2 wrapper: run Blender headless rig.
# Reads p3_decision.json to know which GLB to rig.

set -e

ROOT="/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026"
SCRIPT="$ROOT/scripts/sprint17a/p4_blender_rig.py"
DECISION="$ROOT/scripts/sprint17a/_logs/p3_decision.json"
OUT_GLB="$ROOT/public/assets/case-study/cosmo-rig-v17a/glb/cosmo_rigged.glb"
OUT_SPEC="$ROOT/public/assets/3d/cosmo-rig-spec.json"
LOG="$ROOT/scripts/sprint17a/_logs/p4_blender.log"

if [ ! -f "$DECISION" ]; then
  echo "Run p3 first to produce p3_decision.json"
  exit 1
fi

INPUT_GLB=$(python3 -c "import json,sys;print(json.load(open('$DECISION'))['glb'])")
echo "Input GLB: $INPUT_GLB"
echo "Output GLB: $OUT_GLB"

mkdir -p "$(dirname "$OUT_GLB")"
mkdir -p "$(dirname "$OUT_SPEC")"

blender --background --python "$SCRIPT" -- \
  --input "$INPUT_GLB" \
  --output "$OUT_GLB" \
  --specout "$OUT_SPEC" 2>&1 | tee "$LOG"

echo "Done. GLB: $OUT_GLB | Spec: $OUT_SPEC"
ls -la "$OUT_GLB"
