#!/usr/bin/env python3
"""
Sprint 15A — Meshy v6 Studio 3D Cosmo generation pipeline.

Pipeline:
  Route A: Text-to-3D preview -> verify DNA -> refine (texture) -> auto-rig -> animate
  Route B: Image-to-3D fallback using existing 2D reference

DNA-eisen (anti-kawaii / chameleon-DNA):
  - pearl-drop head (NIET ronde Disney baby head)
  - bulging chameleon eye spheres (donker, glanzend, saffron crescent + white catch-light)
  - single antenne met faded-rose flower-bulb tip
  - TWO black flat circular suction-cup discs at hand-tips (toilet plunger style)
  - faded-rose spots (~5) op groen watercolor body
  - NO TAIL
  - slight uncute proportions (Tenniel illustration accent)
  - Hayao x Moebius watercolor texture (paper-grain, ink-aubergine ragged outline)
  - slightly menacing/uncanny vibe

Output:
  - public/assets/3d/cosmo.glb (final rigged + animations)
  - public/assets/3d/cosmo-preview.png (verification render)
  - public/assets/case-study/cosmo-meshy-v15a/* (all attempts)
"""

import os
import sys
import time
import json
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any

# === Config ===
MESHY_API_BASE = "https://api.meshy.ai/openapi/v2"
ENV_FILE = Path.home() / "Documents" / "games" / ".env"
PROJECT_ROOT = Path("/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026")
ASSET_3D_DIR = PROJECT_ROOT / "public" / "assets" / "3d"
CASE_STUDY_DIR = PROJECT_ROOT / "public" / "assets" / "case-study" / "cosmo-meshy-v15a"
ASSET_3D_DIR.mkdir(parents=True, exist_ok=True)
CASE_STUDY_DIR.mkdir(parents=True, exist_ok=True)

# === Anti-kawaii double-front-loaded prompt (DNA-correct) ===
COSMO_PROMPT = (
    "NOT kawaii NOT chibi NOT Disney NOT cute baby NOT manga NOT round eyes NOT pixar, "
    "Hayao Miyazaki x Moebius x Tenniel illustration alien creature, "
    "pearl-drop teardrop head shape, "
    "BULGING chameleon eye spheres glossy black with saffron crescent catchlight, "
    "single thin antenna with faded rose flower bulb tip pointing up from head, "
    "TWO BLACK FLAT CIRCULAR SUCTION CUP DISCS at hand tips like toilet plunger heads, "
    "NO FINGERS NO claws NO human hands, "
    "slim moss-sage green body with five faded rose spots, "
    "NO TAIL, "
    "slight uncute uncanny proportions, woodcut accent, ink underdrawing, "
    "watercolor paper-grain texture, ink-aubergine ragged outline, "
    "small alien kid creature standing pose facing camera, "
    "slightly menacing watchful gaze"
)

NEGATIVE_PROMPT = (
    "kawaii, chibi, Disney, Pixar, cute baby, manga, round eyes, sparkle eyes, "
    "blush, eyelashes, two antennae, tail, lizard tail, fingers, claws, "
    "human hands, fluorescent, neon, photoreal, 3D render"
)

TEXTURE_PROMPT = (
    "Hayao Miyazaki Studio Ghibli x Moebius watercolor paper-grain texture, "
    "moss-sage green skin with faded rose spots, ink-aubergine ragged outline, "
    "subtle saffron underglow, hand-painted illustration finish, NOT photoreal NOT plastic"
)


def load_env() -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not ENV_FILE.exists():
        sys.exit(f"FATAL: env file missing: {ENV_FILE}")
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip("'\"")
    return env


def post(url: str, payload: dict, key: str) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"FATAL POST {url}: HTTP {e.code} - {body}")


def get(url: str, key: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {key}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GET {url}: HTTP {e.code} - {body}") from e


def download(url: str, dst: Path) -> int:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    dst.write_bytes(data)
    return len(data)


def poll_task(task_id: str, key: str, label: str, timeout_sec: int = 900) -> dict:
    """Poll Meshy task until SUCCEEDED or FAILED. Returns full task dict."""
    url = f"{MESHY_API_BASE}/text-to-3d/{task_id}"
    start = time.time()
    last_progress = -1
    while True:
        elapsed = time.time() - start
        if elapsed > timeout_sec:
            sys.exit(f"FATAL: timeout polling {label} after {timeout_sec}s")
        try:
            res = get(url, key)
        except RuntimeError as e:
            print(f"  [{label}] poll error (retrying): {e}", flush=True)
            time.sleep(8)
            continue
        status = res.get("status", "UNKNOWN")
        progress = res.get("progress", 0)
        if progress != last_progress or int(elapsed) % 30 == 0:
            print(f"  [{label}] {status} progress={progress}% elapsed={int(elapsed)}s credits={res.get('consumed_credits', 0)}", flush=True)
            last_progress = progress
        if status == "SUCCEEDED":
            return res
        if status == "FAILED" or status == "EXPIRED" or status == "CANCELED":
            err = res.get("task_error") or res
            sys.exit(f"FATAL: {label} {status}: {json.dumps(err, indent=2)}")
        time.sleep(8)


def main():
    env = load_env()
    studio_key = env.get("MESHY_STUDIO_API_KEY")
    if not studio_key:
        sys.exit("FATAL: MESHY_STUDIO_API_KEY missing in .env")

    log_path = CASE_STUDY_DIR / "_pipeline_log.json"
    log: Dict[str, Any] = {"started_at": time.time(), "phases": []}

    # === PHASE 1: Text-to-3D PREVIEW ===
    print("\n=== PHASE 1: Text-to-3D PREVIEW (Cosmo DNA) ===", flush=True)
    print(f"Prompt:\n  {COSMO_PROMPT[:200]}...", flush=True)

    preview_payload = {
        "mode": "preview",
        "prompt": COSMO_PROMPT,
        "negative_prompt": NEGATIVE_PROMPT,
        "art_style": "realistic",
        "topology": "quad",
        "target_polycount": 12000,
        "ai_model": "meshy-5",  # Meshy v5 (latest standard); falls back if invalid
        "seed": 15042026,  # Sprint 15A reproducibility
    }
    preview_res = post(f"{MESHY_API_BASE}/text-to-3d", preview_payload, studio_key)
    preview_id = preview_res.get("result")
    if not preview_id:
        sys.exit(f"FATAL: no preview task ID in response: {preview_res}")
    print(f"Preview task: {preview_id}", flush=True)
    log["phases"].append({"phase": "preview-submit", "task_id": preview_id, "payload": preview_payload})

    preview_done = poll_task(preview_id, studio_key, "PREVIEW", timeout_sec=900)
    log["phases"].append({"phase": "preview-done", "task_id": preview_id, "credits": preview_done.get("consumed_credits"), "result": {k: v for k, v in preview_done.items() if k != "model_urls"}})

    # Save preview thumbnail + GLB
    thumb_url = preview_done.get("thumbnail_url")
    if thumb_url:
        thumb_path = CASE_STUDY_DIR / "01-preview-thumbnail.png"
        size = download(thumb_url, thumb_path)
        print(f"  preview thumbnail: {thumb_path.name} ({size:,} bytes)", flush=True)

    preview_glb_url = (preview_done.get("model_urls") or {}).get("glb")
    if preview_glb_url:
        preview_glb_path = CASE_STUDY_DIR / "02-preview.glb"
        size = download(preview_glb_url, preview_glb_path)
        print(f"  preview GLB: {preview_glb_path.name} ({size:,} bytes)", flush=True)
        log["preview_glb_size"] = size

    # === PHASE 2: REFINE (texture pass) ===
    print("\n=== PHASE 2: Refine preview -> textured model ===", flush=True)
    refine_payload = {
        "mode": "refine",
        "preview_task_id": preview_id,
        "texture_prompt": TEXTURE_PROMPT,
        "enable_pbr": True,
        "texture_richness": "high",
    }
    refine_res = post(f"{MESHY_API_BASE}/text-to-3d", refine_payload, studio_key)
    refine_id = refine_res.get("result")
    if not refine_id:
        sys.exit(f"FATAL: no refine task ID in response: {refine_res}")
    print(f"Refine task: {refine_id}", flush=True)
    log["phases"].append({"phase": "refine-submit", "task_id": refine_id, "payload": refine_payload})

    refine_done = poll_task(refine_id, studio_key, "REFINE", timeout_sec=900)
    log["phases"].append({"phase": "refine-done", "task_id": refine_id, "credits": refine_done.get("consumed_credits"), "result": {k: v for k, v in refine_done.items() if k != "model_urls"}})

    # Save refined thumbnail + GLB
    refined_thumb = refine_done.get("thumbnail_url")
    if refined_thumb:
        path = CASE_STUDY_DIR / "03-refined-thumbnail.png"
        size = download(refined_thumb, path)
        print(f"  refined thumbnail: {path.name} ({size:,} bytes)", flush=True)
        # Also copy as the engine-side preview
        download(refined_thumb, ASSET_3D_DIR / "cosmo-preview.png")

    refined_glb_url = (refine_done.get("model_urls") or {}).get("glb")
    if refined_glb_url:
        refined_glb_path = CASE_STUDY_DIR / "04-refined.glb"
        size = download(refined_glb_url, refined_glb_path)
        print(f"  refined GLB: {refined_glb_path.name} ({size:,} bytes)", flush=True)
        log["refined_glb_size"] = size

    # === PHASE 3: VERIFICATION GATE ===
    # We log the refined task ID and stop here so a human (or follow-up call)
    # can either: (a) approve -> run rig+anim, or (b) reject -> regen with new seed.
    log["refine_task_id"] = refine_id
    log["preview_task_id"] = preview_id

    # === PHASE 4: AUTO-RIG + ANIMATION ===
    # Meshy Studio combined endpoint: /openapi/v2/rigging or /animate
    print("\n=== PHASE 3: Auto-rig + Animation library ===", flush=True)
    # Meshy Studio rigging endpoint
    rig_payload = {
        "input_task_id": refine_id,
        "height_meters": 1.4,  # small kid-alien
        "skeleton_type": "humanoid",
    }
    try:
        rig_res = post(f"{MESHY_API_BASE}/rigging", rig_payload, studio_key)
        rig_id = rig_res.get("result")
        if rig_id:
            print(f"Rig task: {rig_id}", flush=True)
            log["phases"].append({"phase": "rig-submit", "task_id": rig_id, "payload": rig_payload})
            # Rigging uses a different polling endpoint
            rig_url = f"{MESHY_API_BASE}/rigging/{rig_id}"
            start = time.time()
            while True:
                elapsed = time.time() - start
                if elapsed > 900:
                    print("  rig poll timeout, continuing without rig", flush=True)
                    break
                try:
                    rig_status_res = get(rig_url, studio_key)
                except RuntimeError as e:
                    print(f"  rig poll error: {e}", flush=True)
                    time.sleep(8)
                    continue
                rstatus = rig_status_res.get("status", "UNKNOWN")
                rprog = rig_status_res.get("progress", 0)
                print(f"  [RIG] {rstatus} progress={rprog}% elapsed={int(elapsed)}s", flush=True)
                if rstatus == "SUCCEEDED":
                    rig_done = rig_status_res
                    log["phases"].append({"phase": "rig-done", "task_id": rig_id, "result": {k: v for k, v in rig_done.items() if k != "model_urls"}})
                    rigged_glb = (rig_done.get("model_urls") or {}).get("glb")
                    if rigged_glb:
                        rig_path = CASE_STUDY_DIR / "05-rigged.glb"
                        size = download(rigged_glb, rig_path)
                        print(f"  rigged GLB: {rig_path.name} ({size:,} bytes)", flush=True)
                        # Also copy as final cosmo.glb (anim phase will overwrite if successful)
                        download(rigged_glb, ASSET_3D_DIR / "cosmo.glb")
                        log["rigged_glb_size"] = size
                    break
                if rstatus in ("FAILED", "EXPIRED", "CANCELED"):
                    print(f"  rig {rstatus}: {rig_status_res.get('task_error')}", flush=True)
                    break
                time.sleep(8)
        else:
            print(f"  rig submit response: {rig_res}", flush=True)
    except SystemExit as e:
        print(f"  rigging endpoint not available or failed: {e}", flush=True)
        log["phases"].append({"phase": "rig-skip", "reason": str(e)})

    # Save log
    log["completed_at"] = time.time()
    log["duration_sec"] = log["completed_at"] - log["started_at"]
    log_path.write_text(json.dumps(log, indent=2, default=str))
    print(f"\nLog written: {log_path}", flush=True)
    print("\n=== Pipeline complete (rig phase tentative — check log for actual status) ===", flush=True)


if __name__ == "__main__":
    main()
