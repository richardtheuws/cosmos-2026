# Wave 19 — Rig Diagnosis: Cosmo's melting alien eyes

**Author**: rig-diagnostic agent
**Date**: 2026-05-02
**Scope**: GLB only — Cosmo renders OUTSIDE post-FX composer (Sprint 18 invariant). Cause is in the rig.

---

## 1. Diagnosis — HYPOTHESIS CONFIRMED with hard numbers

**Verdict**: weight-paint bleed between `bone_head` and `bone_eye_l` / `bone_eye_r`. Numbers don't lie.

### Live GLB structure (parsed from `cosmo.glb`, 9.9 MB, glTF 2.0, Blender exporter v5.1.18)
- 1 mesh (`Mesh_0`), 1 primitive, 1 material — **eyes & body share the same mesh slot**.
- 1 skin, 10 joints (`bone_root`, `bone_spine`, `bone_head`, `bone_eye_l`, `bone_eye_r`, `bone_antenne`, `bone_arm_l/r`, `bone_disc_l/r`).
- 4 baked animations (`idle`, `sit`, `stretch`, `wave`) — 30 channels each.
- 15 137 vertices total. No morph targets, no extra material slots, no shape-keys.
- **Bone hierarchy**: `cosmo_armature → [bone_root → bone_spine → bone_head]`, but `bone_eye_l`, `bone_eye_r`, `bone_antenne` are **siblings of `bone_root` directly under `cosmo_armature`** — not children of `bone_head`. So head rotation does NOT propagate through the skeleton to the eye-bones.

### Vertex weight scan (every vertex, JOINTS_0 + WEIGHTS_0)
| Bucket | Count |
|---|---|
| Eyes-only (cleanly weighted to eye-bones) | **102** |
| Head-only | 523 |
| **MIXED head+eye (the bleed)** | **1 519** |
| Neither | 12 993 |

Sample mixed verts: `headW ≈ 0.54`, `eyeLW ≈ 0.46` — **a near-perfect 50/50 split across 1 519 verts** in the face region (y ∈ [0.42 .. 0.75], z ∈ [-0.43 .. 0.34], i.e. the entire forehead-around-eyes shell).

### Why this melts on screen
1. `CosmoAgent.applyMotion` rotates `bone_head` by yaw + pitch (max ≈ 0.4 + 0.2 rad).
2. `CosmoAgent.applyAIBoneHints` (AI looking-around state) `multiply()`s another yaw on top — peak combined ≈ 0.65 rad ≈ 37°.
3. **Nothing rotates `bone_eye_l` / `bone_eye_r`.** They sit at rest-pose on `cosmo_armature`.
4. Linear-blend skinning on the 1 519 mixed verts then averages a rotated head-bone matrix with an identity eye-bone matrix → those verts move at **half** the head's angle → vertices around the eye-rim lag, the actual eye-pupil verts stay rigid, the face shell **shears**. The visible artefact: black pupils stretch/drip downward as the camera pans, exactly as in the screenshots.

### What it is NOT
- **Not post-FX**: Cosmo bypasses the composer (Sprint 18 invariant locked in `cosmoStage.ts` lines 41–57).
- **Not material/IOR**: single `MeshStandardMaterial`, no transmission/IOR/clearcoat.
- **Not morph-target drift**: zero morph targets in the GLB.
- **Not bad inverse-bind matrices**: the bleed is in WEIGHTS_0, the IBMs are consistent with rest-pose (verified by 102 clean eye-verts rendering correctly when head is at rest).
- **Not the AI-yaw alone**: `applyMotion` already produces visible drift even with AI inactive — AI just amplifies it.

---

## 2. Three fix-paths

### Path A — Rig rebake (Blender weight-paint cleanup)
Open `cosmo.glb` in Blender, select the eye-region verts (102 clean + 1 519 bleed), zero-out the `bone_head` weights on those verts, normalise the eye-bones to 1.0 across the eye-shell, **also re-parent `bone_eye_l/_r` under `bone_head`** so the eyes inherit head rotation by default. Re-bake the 4 clips. Export new GLB through the Sprint 17A pipeline.
- **Files**: `public/assets/3d/cosmo.glb` (replaced), `cosmo-rig-spec.json` (note new parent), nothing else.
- **Dev-time**: 3–5 h (Blender + 4-clip re-bake + Meshy/Studio QA). Not hard but slow.
- **Risk**: medium. Mesh-shape DNA-drift if a vertex slips. Requires the original `.blend` (need to confirm we still have it — see Open Q's). Re-bake might re-introduce the Sprint 16A LoRA-eye-shape drift.
- **What could still go wrong**: if the rig was built on top of the failed Meshy auto-rig (animation-spec line 15 says `Meshy auto-rig faalde`) and our 17A pipeline only added bones+weights post-hoc, the Blender source may be lost — meaning Path A becomes "rebuild rig from scratch", which is no longer 3–5 h.
- **Life-System interaction**: clean. A correct rig is a precondition for any future work.

### Path B — Hard-attach `THREE.SphereGeometry` eye-spheres
After GLTF load, `traverse` to find any verts with `eyeLW + eyeRW > 0.3` and **hide them by zero-ing their POSITION**, then add two non-skinned `THREE.SphereGeometry` (radius ≈ 0.10 from the eye-bbox we measured: x ∈ [-0.15..0.15], y ∈ [0.46..0.73], z ∈ [0.14..0.34]) parented to `bone_head`. Paint them with the existing pop-magenta material (or a dedicated black emissive). They rotate rigidly with the head — zero deform.
- **Files**: `src/phaser/entities/CosmoAgent.ts` (post-load helper, ~40 lines), no GLB change.
- **Dev-time**: 2–3 h.
- **Risk**: low–medium. The painted eye-shell on the body mesh is hand-styled (Hayao×Moebius watercolour), so spheres might read as plastic toys against painted body. Mitigation: use a `MeshBasicMaterial` with the same toon-shaded look as the body, or paint a small flat disc instead of a sphere.
- **What could still go wrong**: parenting under `bone_head` puts the eyes in bone-local space, but Three.js `SkinnedMesh` bones have weird scales from the rig-bake — easy to add then realise the sphere is at the foot. Need to read `bone_head.matrixWorld` once and convert. Also: hiding verts via POSITION nudge leaves a hole in the geometry; better to keep them and slap an opaque black material patch on top — but then we have z-fighting. Cleanest: the SphereGeometry sits **just slightly in front** of the painted-eye verts so it visually covers them.
- **Life-System interaction**: clean. Eye-spheres can later carry their own emissive-pulse uniform for stress/joy without bone-rig coupling.

### Path C — Zero skin-weights of `bone_head` on eye-verts in JS post-load
After `loader.loadAsync`, walk `mesh.geometry.attributes.skinWeight` and `skinIndex`. For every vertex where `eyeLW + eyeRW > 0.3` AND `headW > 0.1`: set the head-slot weight to 0, redistribute that weight onto the eye-bones (or normalise back to 1). Mark `attributes.skinWeight.needsUpdate = true`. Then re-parent (in JS) `bone_eye_l` and `bone_eye_r` under `bone_head` via `bone_head.attach(bone_eye_l)` so they inherit yaw/pitch.
- **Files**: `src/phaser/entities/CosmoAgent.ts` — single `fixSkinWeights()` helper called from `kickOffGLBLoad()` after the scene assigns. ~25 lines.
- **Dev-time**: 1–2 h. Lowest cost.
- **Risk**: low. We have full vertex coordinates in JS, can scope by bbox + slot-weight. Reversible (no asset change).
- **What could still go wrong**:
  - The attachment-points of the eye-bones in their rest-pose are in armature-space, not head-space. Re-parenting via `bone_head.attach` should auto-recompute the local transform, but if the inverse-bind matrices stored in the skin's IBM accessor are pre-computed against the OLD parent, re-parenting will misplace the eye-pupil. Need to verify by inspection.
  - The 102 clean eye-verts will now follow `bone_head` (good) but with full weight on a re-parented `bone_eye_l/r` — if the IBM is wrong, the pupils slide off the face.
  - If the user's GLB pipeline ever re-bakes the asset, this fix gets re-applied silently — not a problem, but worth documenting.
- **Life-System interaction**: clean. Pure rendering-side fix, doesn't constrain future ECS-driven mood-states.

---

## 3. Recommendation — **Path C**, with a Path-B fallback ready to ship if C exposes IBM problems

Reasons in order:
1. **Lowest cost (1–2 h)** for the highest-confidence fix — we know exactly which verts to zero (the 1 519 bleed-set is identifiable by `headW > 0.1 && (eyeLW + eyeRW) > 0.3`).
2. **Reversible**: no asset-bake step, no Blender dependency, no DNA-drift risk on the Hayao×Moebius silhouette which we just LoRA-locked in Sprint 16A.
3. **No new visual style** introduced — keeps the painted eye texture intact, just stops it from shearing. Path B replaces the painted eyes with primitives, which is a brand-look bet I don't want to make in Wave 19.
4. **Path A is too expensive** for a fix-pass — and possibly blocked by lost `.blend` source.
5. **If Path C fails on IBM weirdness**, Path B is a 2–3 h escape valve already scoped above; we lose a few hours but don't get stuck.

Implementation outline (pseudocode, no code yet — orchestrator implements):
```
after gltf loaded:
  for each vertex v:
    if (skinIndex contains headSlot AND headWeight > 0.1
        AND (eyeLWeight + eyeRWeight) > 0.3):
      take headWeight, redistribute to whichever eye-bone slot is already on this vert
      (or, simpler: just zero headWeight and renormalise the remaining 3 weights to 1)
  flag skinWeight.needsUpdate = true
  bone_head.attach(bone_eye_l)
  bone_head.attach(bone_eye_r)
  // Verify visually with a debug yaw sweep at boot
```

**Acceptance gate**: capture before/after frames at `panX = -1`, `panX = 0`, `panX = +1`. Verify eye-pupils translate rigidly with the head silhouette in all three. Run the Sprint 16A DNA-check (chameleon eyes, saffron catchlight) — must still PASS.

---

## 4. Open questions for orchestrator

1. **Do we still have the source `.blend` for Cosmo?** If not, Path A is off the table (would need a from-scratch re-rig). Suspect it's at `~/Documents/cosmos-2026/blender/cosmo.blend` or in the Sprint 17A pipeline scripts; orchestrator to confirm before considering A.
2. **Are the eye-bone IBMs computed against `cosmo_armature` (sibling parent) or `bone_head`?** Need to inspect `skins[0].inverseBindMatrices` accessor in the GLB — if they're against armature-space, Path C's `bone_head.attach()` re-parent step will drag the rest-pupil position. Easy to check by reading the 16-float row for `bone_eye_l`.
3. **Does the user accept "rigidly-rotating pupils" stylistically?** The current melting eyes are a bug, but Cosmo's brand-DNA includes "chameleon-bulging-eyes that track independently". Path C breaks independent eye-track — eyes will lock to head yaw. If we want both fixed-melting AND independent track, we need an extra `bone_eye_l/_r` quaternion driver in `applyMotion` (cheap, ~20 lines) once the bleed is gone.
4. **Should `bone_antenne` get the same bleed-check?** The rig spec mentions FFT-driven antenna wiggle — if antenna verts are also weight-bleeding into `bone_head`, we'd see the antenna deform on head-pan too. Out of scope for Wave 19 if the user only reported eyes, but worth a 10-min check during the Path C implementation since the scanner is already written.
