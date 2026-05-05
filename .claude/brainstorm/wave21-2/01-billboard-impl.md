# Wave 21.2 — Billboard Cosmo implementation report

**Status**: implemented, programmatic gate green
**Authored**: 2026-05-05
**Source plan**: `.claude/brainstorm/wave21-2/00-billboard-cosmo.md`
**Pivot ledger entry**: NORTH-STAR.md §6 (2026-05-05, second entry)

## 1. Executive summary

Cosmo is no longer a primitive-skeleton rig wearing painted decals. He is a single textured plane carrying the canonical `cosmo-hero-lora.png` (Sprint 16A LoRA-locked, 4096² RGBA, BiRefNet-cut alpha), Y-locked-billboarded toward the camera every frame.

Three implementation files were rewritten or simplified. `cosmoV2.ts` collapsed from 374 LOC to 133 LOC, dropping the capsule body, sphere head, antenna shaft+bulb, six v2-final decal planes, four disc-arms, all bone tree wiring, the `FaceState` enum, and the `setFaceState()` method. `cosmoAnimDirector.ts` collapsed from 446 LOC to 224 LOC, retiring the blink, head-track, and antenna-bob anims (each depended on bones that no longer exist). The director's surviving anim set — idle-breath, walk-sway, jump-arc squash-stretch, and climb 90° rotation — touches only `root.scale.y`, `plane.rotation.z`, and `root.rotation.z`. Walk-sway replaces the dead disc-Y bob with a tiny `plane.rotation.z` ±0.03 rad oscillation at walk-rate, only firing above the velocity threshold.

`CosmoAgent.ts` kept its full public API (`update`, `applyMotion`, `applyAI`, `attachAI`, `walkTo`, `bounce`, `petAffect`, `tickAnimDirector`) so substrate, CosmoAI, and InteractionManager continue to call without change. The single signature break is `tickAnimDirector(dt, motion, camera)` — camera was added so the director can call `rig.update(camera)` at the end of its tick. `main.ts` line 373 was updated accordingly.

Verification: TSC clean (exit 0). Build clean. Dev-server responds 200 on `/play/` with the correct `<title>`. The hero PNG asset returns 200. The compiled bundle contains the `cosmo-hero-lora` string, proving the texture path is wired into the deployed runtime.

## 2. File diffs

| File | Before LOC | After LOC | Delta |
|---|---|---|---|
| `src/three/cosmoV2.ts` | 374 | 133 | −241 (−64%) |
| `src/three/cosmoAnimDirector.ts` | 446 | 224 | −222 (−50%) |
| `src/phaser/entities/CosmoAgent.ts` | 1146 | 1137 | −9 (constructor + tickAnimDirector docstring + signature; pet-affect kept as no-op) |

Total net delta across the three files: **−472 LOC** (≈30% of the rig surface area).

## 3. Inventory of what was retired

### From `cosmoV2.ts`
- `V2_ASSET_BASE` and `V2_FINAL_DECAL_BASE` constants
- `FACE_STATES` array + `FaceState` type export
- Capsule body geometry + mesh (`bodyGeo`, `bodyMesh`)
- Sphere head geometry + mesh (`headGeo`, `headMesh`)
- Body's `MeshStandardMaterial` skin (with v2-final/wave20a fallback chain)
- Sphere head pearl-drop scale shaping
- Antenna base + tip Object3Ds, antenna-shaft cylinder, antenna-bulb sphere
- Composite face decal plane + 4 face-state texture map (`faceTextures.{neutral,coo,blink,wave}`)
- Split decals: `eyeDecalL`, `eyeDecalR`, `mouthDecal`, `antennaFlowerDecal`
- Disc-suction texture loading + `discMaterial` + 2 disc Object3Ds (`discL`, `discR`) + their cylinder meshes
- `loadDecalPlane(...)` helper
- `setFaceState(state)` public method
- All 11 bone-related fields on `CosmoV2Rig` (`body`, `head`, `antennaBase`, `antennaTip`, `faceDecal`, `eyeDecalL`, `eyeDecalR`, `mouthDecal`, `antennaFlowerDecal`, `discL`, `discR`)

### From `cosmoAnimDirector.ts`
- All blink machinery: `blinkLNextAt`, `blinkRNextAt`, `blinkLPhase`, `blinkRPhase`, `BLINK_DURATION_S`, `BLINK_INTERVAL_MIN_S/MAX_S`, `tickBlink()`, `applyEyeBlinkScaleL/R()`, `nextBlinkAt()`, `blinkScaleY()` helpers, `eyeDecalL`/`eyeDecalR` refs and the `setEyeDecals()` method
- All head-track machinery: `HEAD_TRACK_LERP_RATE`, `HEAD_YAW_MAX_RAD`, `HEAD_PITCH_MAX_RAD`, `tickHeadTrack()`, `lastTargetHeadYaw` memo
- All antenna-bob machinery: `ANTENNA_SPRING_RATE`, `ANTENNA_SPRING_DAMP`, `ANTENNA_LAG_AMPL`, `antennaYaw`, `antennaYawVel`, `tickAntenna()`, `antennaRestQuat`
- All disc-walk-bob: `WALK_DISC_AMPL`, `discL`/`discR` rest-Y captures, the per-disc Y-sin oscillation, `relaxDiscs()` (replaced with `relaxSway()` on the plane rotation)
- Climb-disc hand-walk (`CLIMB_DISC_AMPL`, `CLIMB_DISC_FREQ`)
- Body-rest-quat capture and the climb body-quaternion compose (replaced with direct `root.rotation.z = π/2`)
- Scratch quaternion / euler / vec3 helpers (no longer needed)
- The setEyeDecals() public method

### From `CosmoAgent.ts`
- Bone field captures in the constructor: `headBone`, `headRestQuat`, `antennaBone`, `antennaRestQuat`, `spineBone`, `spineRestQuat` are now set to null (kept as fields for the API surface but never populated)
- The constructor's `setEyeDecals` call (method removed from director)
- `setFaceState(state: FaceState)` shortcut method (deleted entirely)
- The `FaceState` import from cosmoV2

## 4. What survives in the AnimDirector

Four anims, all root- or plane-transform driven:

| Anim | Trigger | Effect |
|---|---|---|
| **idle-breath** | velocity below threshold AND not jumping AND not climbing | `root.scale.y` sinusoidal pulse at 0.4 Hz, ±2% |
| **walk-sway** | velocity above threshold AND not jumping AND not climbing | `plane.rotation.z` sinusoidal sway at speed-scaled freq (4–12 rad/s), ±0.03 rad |
| **jump-arc** | `ctx.isJumping === true` | 3-phase root.scale.y squash → stretch → settle (0.85 → 1.05 → 0.95 over 0.80s) |
| **climb** | `ctx.isClimbing === true` | `root.rotation.z = π/2` (relaxes back to 0 when released) |

Composability: idle-breath + walk-sway can stack (different transforms). Jump preempts walk (jump owns root.scale.y). Climb preempts everything (root rotates 90°).

End of every tick: `rig.update(ctx.camera)` runs the Y-locked lookAt so the plane faces the camera with the freshly-written transforms.

## 5. AnimCtx shape change

Added `camera: THREE.Camera` field. Existing fields (`velocity`, `focusPoint`, `isJumping`, `isClimbing`) retained. `focusPoint` is preserved for API stability and future UV-parallax head-track reintroduction; the billboard director ignores it.

## 6. TS errors hit and how resolved

None. After all edits TSC reported zero errors on the first run. `noUnusedLocals` does not apply to class fields, so the unpopulated `headBone`/`antennaBone`/`bodyMaterials` fields on CosmoAgent compile cleanly.

## 7. TODOs surfaced

- **Pet-affect saffron blush is now a visual no-op.** `CosmoAgent.beginPetAffect()` / `applyPetAffect()` / `clearPetAffect()` still exist and the `onPet` event still fires, but `bodyMaterials` is empty (no MeshStandardMaterial body to tint), and `antennaBone` is null (no quaternion to tilt). This means the *event hook* and *state-machine entry* survive, but the painted blush + antenna-tilt visuals are gone. Acceptable for 21.2 ship; revisit in a future wave if the pet-affect needs a visible signal (options: alpha-pulse the plane, briefly tint via material.color, particle spew handled host-side via existing `onPet` event).
- **CosmoAI head-yaw / spine-bend hints become silent on the rig.** `applyAI` still smooths the AI's `headYawHint` / `spineBendHint` into private fields, and `applyAIBoneHints()` is called per-frame, but with `headBone`/`spineBone` null both branches return without writing anything. The internal smoothing state stays alive for tests/diagnostics. If we want AI-driven pose cues again, revisit with UV-parallax or plane.rotation.y micro-sway.
- **`cosmoAgent.setFaceState()` was removed.** No callers in `src/` reference it. If a substrate `behavior.ts` file (in `universes/forest/` or third-party) tried to call it, that would be a TS error — but `BehaviorContract.ts` doesn't expose it, and the contract's `InteractableHandle.onUse(cosmo: CosmoV2Rig)` argument is the rig (which also no longer has `setFaceState`). Substrate authors who relied on this need to react via the host-side event bus (`onPet`, `onBounce`) instead. Surface as a contributor-doc note in a future wave's CONTRIBUTING update.
- **6 retired decal PNGs still on disk** at `public/assets/cosmo/decals/v2-final/*.png`. Per the plan, kept for rollback safety. Can be deleted once Wave 22+ confirms billboard is stable.
- **The `applyMotion()` head-yaw / head-pitch smoothing still computes `this.headYaw` / `this.headPitch` every frame** but doesn't apply them. Cheap, harmless, kept so applyMotion's API stays stable. Worth a cleanup pass in a "tidy after 21.2 settles" wave.
- **Substrate `BehaviorContract.ts` still imports `CosmoV2Rig`** — that import succeeds because the new shape's `root: THREE.Group` field is the only field substrate authors realistically use (they consume `cosmo.root` as the parent for inhabitants and read `cosmo.root.position` for proximity). The new fields (`plane`, `update`, `dispose`) are additive. No contract change needed. If a third-party `behavior.ts` referenced `cosmo.head` directly, it will now error — surface in CONTRIBUTING as part of the next docs sweep.

## 8. Verification gate results

| Check | Command | Result |
|---|---|---|
| TSC clean | `npx tsc --noEmit` | exit 0, zero errors |
| Build clean | `npm run build` | green, 76 modules, dist/ written |
| Dev server boots | `npm run dev` | Vite ready in 86 ms on :5173 |
| /play/ title | `curl /play/ \| grep <title>` | `<title>Cosmo's Universe — play</title>` |
| Hero asset reachable | `curl /assets/sprites/cosmo-hero-lora.png` | HTTP 200 |
| Bundle contains hero path | `grep cosmo-hero-lora dist/assets/main-*.js` | match found |

Visual UAT is the orchestrator's responsibility. Programmatic gate green.
