# Wave 21.2 — Cosmo as a hero-PNG billboard

**Status**: planning, locked
**Authored**: 2026-05-05
**Pivot ledger entry**: NORTH-STAR.md §6 (2026-05-05, second entry of the day)
**Trigger**: Live UAT of v2.2.1 showed regenerated decals as full-frame paintings with mushroom-bg attached, stacked as rectangles + black ovoids on the capsule. Three decal-attempts did not converge.

> Read NORTH-STAR.md first. Per §4 brave-reconsideration: when patches don't converge, reconsider the system. The system being retired is the **decal-on-capsule paradigm** for Cosmo's skin. The hero-PNG already exists, is canonically 10/10 DNA, and reads as a real Cosmo. Use it directly as a billboard texture.

## 1 · What's failing and why

Three decal attempts:

1. **Sprint 16A LoRA hero** — worked: produced one canonical 10/10 PNG of full Cosmo. Single image, no isolation needed.
2. **Wave 21 PIL-crop decals** — failed: cropping a region of the hero produced flat-color regions, not painted decals. Body-skin read as solid green capsule.
3. **Wave 21.1 fal.ai-regen decals** — failed: fal.ai with LoRA + negative prompts + "anatomical study sheet" framing produced *full-frame paintings* with the organ inside a mushroom-scene. BiRefNet alpha-cut couldn't isolate organ from scene because mushrooms register as foreground. On screen: Cosmo became a collage of mushroom-painting rectangles + black ovoids.

Diagnosis: **diffusion models trained on whole-character data do not isolate to a single body part cleanly even with negatives**. The bias toward painting-the-context wins. We can fight it forever or stop trying.

## 2 · Locked decisions

### 2.1 Cosmo geometry
- A single `THREE.Mesh` with `THREE.PlaneGeometry` carrying `cosmo-hero-lora.png` as `map` (and same as `alphaMap` if the PNG isn't already RGBA — it is RGBA per Sprint 16A memory).
- Plane sized to match Cosmo's existing capsule footprint at root scale=1: roughly 1.2 wide × 1.8 tall world-units.
- `MeshBasicMaterial` with `transparent: true`, `alphaTest: 0.1`, `depthWrite: false`.
- Plane **billboards toward camera always** (normal facing camera, Y-axis locked vertical so Cosmo doesn't roll). This is implemented as a `lookAt(camera.position)` call in the per-frame tick, with the up-vector locked to world-up.
- The plane is parented to the existing `root: THREE.Object3D` that CosmoAgent already moves. So all existing position/walk/jump-arc translation logic continues to work without changing CosmoAgent's positional API.

### 2.2 What dies
- The capsule-body mesh (cylinder / capsule geometry + `skinMaterial`).
- The sphere-head + headBone.
- The 4 disc-arm meshes + their disc-bones (left-hand-up, right-hand-up, left-foot-down, right-foot-down).
- The 6 v2-final decal-planes (eyeDecalL, eyeDecalR, mouthDecal, antennaDecal, body-skin texture, disc-suction texture).
- The face-decal compositing path.
- The `buildCosmoV2()` factory's bone-tree creation.
- The 6 PNG files at `public/assets/cosmo/decals/v2-final/` are NOT deleted from disk (rollback safety) but no longer loaded by the rig.

### 2.3 What survives in CosmoAnimDirector

The Director currently has 7 anims. After billboard-cutover:

| Anim | Survives? | Why |
|---|---|---|
| **idle-breath** | YES | `root.scale.y` pulse — billboard plane scales fine |
| **blink** | NO (or simplified) | needs eye-decal-plane scale; no eye-decal exists. Billboard hero has eyes painted-in, no separate plane to collapse. **Optional**: a tiny ALPHA-MASKED secondary plane positioned at eye-area painted as "closed eyelids" that fades in/out. Out of scope this wave. |
| **head-track** | NO | needs head-bone quaternion; no head-bone. Billboard always faces camera but doesn't *track focus point*. **Possible re-imagining**: subtle sub-pixel UV-offset of the texture toward the focus point (max ±0.01 of UV space), giving the eye-painting a faint "looking at you" parallax. **Optional**: implement if time permits. |
| **antenna-bob** | NO | needs antenna-bone; no bone. Antenna is part of the painted plane. Static, but the plane subtly bobs via idle-breath which moves the antenna with it. |
| **walk** | YES | translate `root.position.x/z` per velocity. Billboard moves with the root. Disc-y-oscillation dies (no discs); replace with a faint **plane.rotation.z** sway (±0.03 rad at walk-rate) to suggest stride. |
| **jump-arc** | YES | translate `root.position.y` over 3 phases. Squash-stretch of `root.scale.y` survives (anticipation 0.85 → launch 1.05 → settle 0.95). |
| **climb** | YES | `root.rotation.z = π/2`. Billboard rotates with root. |

**Net**: 4 surviving anims (idle-breath, walk-sway, jump-arc, climb). 3 retired (blink, head-track, antenna-bob). Optional UV-parallax-track and optional eyelid-overlay-blink can land in a future wave when we want to add subtler life signs.

The Director's stack-composition rules still hold: idle-breath + walk-sway can stack; jump-arc preempts walk-sway; climb preempts walk-sway and jump-arc.

### 2.4 What CosmoAgent stays responsible for
- Position (worldX, worldY, worldZ).
- Discrete state machine (idle/walking/jumping/climbing).
- AI directives (CosmoAI applies head-yaw, etc — those become no-ops for the billboard but the API stays compatible).
- `tickAnimDirector(dt, motion)` — still called per frame; Director just has fewer things to animate.

### 2.5 What `buildCosmoV2()` becomes
A 30-line function instead of 200:
1. Create `root: THREE.Object3D`.
2. Load `assets/sprites/cosmo-hero-lora.png` via TextureLoader.
3. Create plane geometry + basic material with the texture.
4. Add plane as child of root.
5. Return `CosmoV2Rig { root, plane, billboardLookAtCamera() }` (the rig type loses its bone references; the API gets a new `update(camera)` method that does the lookAt).

Type updates ripple to:
- `CosmoAgent` — drop bone refs, drop FaceState compositing, simplify `applyMotion`.
- `CosmoAnimDirector` — drop blink/head-track/antenna-bob code paths.
- Anything that imports `CosmoV2Rig` — verify no callers depend on the dropped fields.

### 2.6 Hero-image preflight
- Path: `public/assets/sprites/cosmo-hero-lora.png` (exists, 4.96 MB, May 2 mtime — confirmed).
- Loaded via `assetPath('assets/sprites/cosmo-hero-lora.png')` (substrate-friendly).
- Already has alpha channel per Sprint 16A memory (4096² RGBA).
- If alpha is poor or missing, runtime falls back to chroma-key on white via shader (out of scope unless visible).

## 3 · Out of scope (defer)
- Pure 3D Cosmo via Meshy v6 + auto-rig + texture-projection — Wave 22+ ambition.
- Eyelid-overlay-blink secondary plane.
- UV-parallax head-track.
- Multiple poses (Cosmo-walking-frame, Cosmo-jumping-frame, Cosmo-resting-frame). Wave 22+ if user-feedback wants more anim.
- Removing the 6 v2-final decal PNGs from disk (rollback safety; will clean up in Wave 22 once billboard is stable).

## 4 · Agent breakdown (1 agent, sequential — no parallelism needed)

### 4.1 billboard-cosmo (general-purpose, runs alone)

The work touches `src/three/cosmoV2.ts`, `src/three/cosmoAnimDirector.ts`, `src/phaser/entities/CosmoAgent.ts`. All three files. No parallel agent because the work braids — bones disappear in cosmoV2, animation references in director must drop, agent's compositing must simplify. One single-threaded agent does it cleanly.

Briefing focuses on:
- Read NORTH-STAR §6 2026-05-05 (second entry today) for the why.
- Read this brainstorm doc §2 for locked scope.
- Implement §2.1, §2.5 in cosmoV2.ts.
- Strip §2.3 retired anims from cosmoAnimDirector.ts.
- Update §2.4 CosmoAgent.ts callsites accordingly.
- Verify TSC clean + npm run build clean.
- Run `npm run dev` + curl the play URL to verify the page boots and the bundle references the hero-PNG path.
- Output: `.claude/brainstorm/wave21-2/01-billboard-impl.md` with file diffs, LOC counts, what was retired, what survives.

## 5 · Phase 2 (me orchestrating, after agent done)
1. TSC clean + build clean verification.
2. Bump VERSION → 2.2.2 + package.json + main.ts.
3. CHANGELOG entry.
4. `npm run updates:build` + clean rebuild.
5. lftp mirror redeploy.
6. CF cache purge_everything.
7. Live UAT URLs check.
8. Surface to Richard for visual UAT.

## 6 · Risk register

| Risk | Mitigation |
|---|---|
| Billboard plane has wrong scale → Cosmo too big or too small in scene | Match existing capsule visual scale (1.2 × 1.8 world-units). Verify via in-scene composition. Tune via constant. |
| Hero-PNG alpha is not clean → Cosmo has white halo or visible bg edges | Sprint 16A memory says BiRefNet was applied. If halo visible, add `alphaTest: 0.1` to material. If still bad, post-process with a one-shot remove-bg pass via fal.ai (small cost). |
| Removed bones break some downstream code (e.g. CosmoAI head-yaw, OnboardingDirector wave-uncanny) | Keep the API surface compatible — `applyMotion(motion)` and `applyAI(directive)` remain methods on CosmoAgent, just become no-ops or simplified. Don't break the call signature. |
| Walk-sway looks wrong | Tune amplitude. If it reads bad, kill it; idle-breath alone is enough life-sign. |
| Lighting on the painted plane looks flat | `MeshBasicMaterial` doesn't react to lights — that's intentional. The painting is already lit. Don't switch to `MeshStandardMaterial`. |
| Performance regression | Should be net win — fewer geometries, fewer materials, fewer per-frame matrix updates. |

## 7 · Memory hooks
- Update `cosmo_decals_wave21_1.md` with the retire-decals-paradigm note.
- Add `cosmo_billboard_wave21_2.md` documenting the pivot rationale + what works + what's lost.
- Update `next_session.md` once 2.2.2 lands clean.

## 8 · Success criteria (visible)
- On `/play/?substrate=v2`: a single painted Cosmo (the canonical hero) stands in front of the parallax mushroom forest.
- Cosmo subtly breathes (idle-breath).
- When motion-controller drives velocity, Cosmo translates left/right and sways slightly.
- Tap to pet → kaleido nudge fires (existing InteractionManager path stays wired).
- No rectangles. No black ovoids. No collage.

## 9 · The lesson — locked into memory
**Diffusion models with whole-character training data don't isolate to organ-decals cleanly.** Three attempts confirmed it. Future Cosmo skinning either uses (a) the canonical hero PNG as a single texture (this wave's path), (b) a 3D model from Meshy with proper UV-mapping for texture projection (Wave 22+), or (c) a from-scratch hand-painted decal-set authored without diffusion (out-of-scope budget-wise). What we do NOT do: fourth attempt at diffusion-isolated organ decals.
