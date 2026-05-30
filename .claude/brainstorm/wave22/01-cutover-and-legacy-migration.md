# Wave 22 — The Hard Cutover + Legacy-Migration Plan

> Concern owner: cutover & migration. Honors NORTH-STAR §6 Pivot Ledger entry **2026-05-30 — Wave 22** (hard cutover, no `?legacy` escape hatch, parity-before-deletion, visual-UAT gate is the only safety net). This doc is the deletion choreography; D4/D6 and the second-Universe live in sibling docs.

## 0. The single load-bearing fact

In substrate mode **both paths already tick the same `ParallaxScene`**:

- `main.ts:348` — `manager.register((u) => parallax.update(u, motion))` (always runs).
- `RoomHost.tick` → `DefaultBackground.update` → `parallax.update(u, ctx.motion)` (runs *only if* `behavior.background` returns `DefaultBackground` — today forest returns the **no-op `ForestBackground`**, so the substrate background driver is bypassed and parallax is ticked exactly once, by main.ts).

That no-op is the v2.2.4 scar (double-tick → stacked decoration artifacts). The cutover must keep parallax ticked **exactly once** at every step. This invariant governs both the boot-path change (§1) and D4 (§3).

---

## 1. Boot-path change (main.ts)

Today the substrate is gated on `?substrate=v2` (`main.ts:51-53`) and runs *additively* alongside legacy. Cutover = make substrate unconditional, delete the legacy-only branches.

**Invert, don't delete-and-rewrite:**

1. **Delete the flag.** Remove `const useSubstrate = …` (51-53). It becomes always-true.
2. **Delete the legacy biome-cycle start.** Remove the `if (!useSubstrate) { biomeMgr.start(); }` block (297-299). `BiomeManager` stays constructed (285-293) — substrate reuses it for `startMoodCrossfade` during transitions and `onChange`→`loadBiome` — but its **auto-cycling `.start()` is never called on the production path**. Keep `.start()` only inside the `catch` recovery (325) as the last-ditch fallback if substrate boot throws.
3. **Make substrate boot unconditional.** Drop the `if (useSubstrate)` wrapper (306); `substrateLoader = new SubstrateLoader({…}); await substrateLoader.boot();` runs always. Keep the try/catch — on throw, fall back to `biomeMgr.start()` (this is now the *only* legacy code left, and it is a crash-recovery path, not a user-selectable mode). This satisfies "no `?legacy` escape hatch" while still not white-screening on a manifest 404.
4. **Keep the substrate tick** (349-352) — now always registered.
5. **Initial paint** (113 `await parallax.loadBiome(BIOMES['slow-bloom'])`) stays — it is harmless first-paint before the room's biome loads, and protects against a flash if boot is slow.

**Not touched** (these are substrate-shared, not legacy): `CosmoStage`, `CosmoAgent`, `CosmoAI`, `ObstacleManager`, `TrampolineSpots`, `MotionController`, `AudioFFTBridge`, `TrippyEventDirector`, Phaser `CosmoScene` start. They are injected into `SubstrateLoader` and survive cutover untouched.

---

## 2. Parity migration checklist (dependency order)

"Parity" = the live `/play/` clearing Room, with no flag, renders and behaves at least as well as today's legacy auto-cycle. Migrate **before** deleting anything in §5.

| # | Legacy-owned working piece | Where it lives post-cutover | Parity definition (what UAT confirms) |
|---|---|---|---|
| 1 | **Parallax world paint** (main.ts:348) | Stays in main.ts OR moves into `DefaultBackground` — see D4 §3. Pick ONE owner. | World renders, parallax pans on motion, post-FX composer runs — and is ticked **exactly once/frame**. |
| 2 | **Cosmo stack** (Agent/AI/Stage/obstacles/trampolineSpots) | Already injected into SubstrateLoader; no move. | Cosmo arrives, idles, breathes, walks; obstacles spawn; trampoline-spots hover-bob. |
| 3 | **CosmoScene HUD/onboarding wiring** (NebulaPortal, OnboardingDirector, VibeMeter, InteractionManager, DeepTripMode, agentEventShim) | Unchanged — `phaserGame.scene.start('CosmoScene', …)` fires on both paths today (252-263). | First-visit magic-moment plays (portal→arrival→wave→first-hint); vibe-ring tracks Cosmo; bounce→kaleido spike + hallucination roll; pet→saffron flush. |
| 4 | **Calm post-FX preset** | `UniverseHost.applyUniverseDefaults()` writes `manifest.post.intensityCurve` into `globalUniforms.biomeIntensity`. Verify forest `manifest.json` carries calm-baseline values equal to today's legacy defaults. | Bloom/kaleido/fluid/chroma at calm baseline; event-peaks (bounce, deep-trip) still spike and decay. |
| 5 | **Trampoline delight-loop** (tap→walk→bounce) | Substrate `ForestTrampoline` (behavior.ts:378) registers the interactable; CosmoScene's `InteractionManager` must target substrate interactables, not only the legacy `TrampolineSpots`. | Tap the trampoline → Cosmo walks to it → bounces → kaleido spike fires. **This is the locked primary loop (NORTH-STAR §3) — it MUST work or cutover blocks.** |
| 6 | **Biome crossfade on transition** | `BiomeManager.startMoodCrossfade` via substrate transition drivers. | Room→room blend is continuous (no hard cut), no double-paint. |

**Dependency order:** 1 (background owner decided) → 4 (post-FX preset matches) → 2 (Cosmo renders) → 5 (trampoline loop) → 3 (HUD/onboarding) → 6 (transitions). Item 5 is the gating acceptance criterion.

⚠ **Item 5 has a real wiring gap to close in Wave 22:** `InteractionManager` (CosmoScene) was built around the legacy `TrampolineSpots`. The substrate `ForestTrampoline.onUse` only pushes `cosmo.root.position.y += 0.05` (a stub bridge, behavior.ts:413). Parity requires the substrate interactables (exposed via `RoomHost.getInteractables()`) to be handed to the InteractionManager so taps resolve against the substrate trampoline and trigger the full bounce/kaleido path. This is the highest-risk migration item.

---

## 3. D4 — substrate owns the background (un-no-op `ForestBackground`)

**Goal:** a Universe configures the single shared `ParallaxScene` through its `behavior.background`, WITHOUT recreating the v2.2.4 double-ParallaxScene/double-tick bug.

The contract extension the CHANGELOG keeps deferring is **already present**: `SubstrateCtx` exposes `canvas`, `renderer`, `motion` (BehaviorContract.ts:46-56), and `SubstrateBootCtx`/`RoomHost` already thread the *shared* `parallax` instance. The missing piece is exposing that shared instance to `behavior.background` so the author configures it instead of building a second one.

**Minimal, safe design (single owner of the tick):**

1. **Add `parallax: ParallaxScene` to `SubstrateCtx`** (one field; populated by SubstrateLoader from `bootCtx.parallax`). This is the deferred extension — make it concrete now.
2. **Un-no-op `ForestBackground`:** its constructor calls `ctx.parallax.loadBiome(BIOMES[room.biomeKey ?? 'slow-bloom'])` (exactly what `DefaultBackground` does today). It does **NOT** construct a new `ParallaxScene`. Its `update()` is the per-frame parallax tick.
3. **Move the single parallax tick OUT of main.ts into the background driver.** Delete `manager.register((u) => parallax.update(u, motion))` from main.ts (348). The background handle (`ForestBackground` or `DefaultBackground`) becomes the *sole* caller of `parallax.update`, invoked once via `RoomHost.tick → background.update`. This removes the double-tick structurally: there is exactly one code path that ticks parallax, and it lives where biome ownership lives.
   - Guard: `RoomHost` constructs exactly one background per room (it does — line 62-64), and `ForestBackground` reuses the shared instance (never `new ParallaxScene`). So one instance, one tick.
4. **`DefaultBackground` is unchanged** — it already wraps the shared parallax correctly. After this change, `DefaultBackground` and an un-no-opped `ForestBackground` are nearly identical; forest's exists only to demonstrate the override seam for the second Universe.

**Why this can't reintroduce the bug:** the v2.2.4 failure was *two* ParallaxScenes on one canvas + *two* ticks. The new rule is explicit and enforced by structure: (a) only SubstrateLoader ever calls `new ParallaxScene`; backgrounds receive it by reference; (b) only `RoomHost.tick → background.update` calls `parallax.update`, and main.ts no longer does. The second Universe proves D4 by setting a *different* `biomeKey` and seeing its own world paint through the same single instance.

🔴 **Needs human visual UAT:** that after moving the tick, parallax still pans on motion and the clearing renders identically (no flash, no stacked decorations, no frozen background). I cannot see pixels.

---

## 4. D6 — dead head-track / focusPoint cleanup

The billboard pivot (Wave 21.2) already retired the bones head-track needed. The dead path is **cosmetic dead weight**, not a bug — clean it honestly:

**Remove (truly dead):**
- `main.ts:366` `cosmoAgent.applyMotion(motion)` — comment claims "head-track… looks at the player" but the billboard director ignores it; `applyMotion` is a near-no-op on the billboard rig (CosmoAgent.ts:11). Remove the call **only after** confirming `applyMotion` has no surviving side-effect on the billboard (it smooths an internal yaw that nothing reads). If it is a pure no-op, delete the call and the stale comment.
- `AnimCtx.focusPoint` (cosmoAnimDirector.ts:64) and its derivation in `CosmoAgent.tickAnimDirector` (the `focusPoint`/`animFocusPoint` block ~1082-1101): the director never consumes it. Remove the field + derivation to stop computing a value nobody reads.

**Honestly implement as a UV-offset cue (do NOT silently keep stubs):** the "looking at you" parallax. If we want the cue back, implement it as a real `texture.offset.x` nudge on the hero plane driven by `motion` pan (the same pattern `ForestInhabitant`'s mouth-pillar used for UV-offset). Otherwise **delete the deferral comments** in cosmoAnimDirector.ts (18, 62-64) so the file stops advertising a feature that doesn't exist. NORTH-STAR §4: don't carry a third patch on a dead path — either build the UV cue or remove the scaffolding. Recommendation for Wave 22: **remove the scaffolding now**, defer the UV cue to a later wave with its own entry (it is not load-bearing for the cutover).

---

## 5. Deletion order + rollback (commit boundaries)

Legacy is deleted **only after UAT-confirmed parity**. With no `?legacy` hatch, the git history is the rollback. Each commit is independently revertable and leaves a working build.

1. **`feat: D4 — SubstrateCtx.parallax + ForestBackground owns the single tick`**
   Add `parallax` to ctx; un-no-op `ForestBackground`; move the parallax tick out of main.ts into the background driver. Substrate still gated behind `?substrate=v2` here. → UAT both `/play/` (legacy, unchanged) and `/play/?substrate=v2` (D4 active). Confirm single-tick, no double-paint. **GATE: human visual UAT.**
2. **`fix: trampoline parity — InteractionManager targets substrate interactables`**
   Close the §2-item-5 gap. Still flag-gated. → UAT `?substrate=v2`: tap→walk→bounce→kaleido. **GATE: human visual UAT of the primary delight loop.**
3. **`chore: D6 — remove dead head-track/focusPoint scaffolding`**
   Pure deletion; build stays green. → tsc + Vitest.
4. **`feat: hard cutover — substrate is the production path`**
   Delete `useSubstrate` flag + the `if (!useSubstrate) biomeMgr.start()` branch + the `if (useSubstrate)` wrapper (substrate boot becomes unconditional; `biomeMgr.start()` survives only inside the boot-catch). → UAT plain `/play/` (no query string) shows the substrate clearing. **GATE: full human visual UAT + committed Playwright screenshot artifact (per ledger decision 3).**
5. **`chore: delete legacy biome-cycle dead code`**
   Only after commit 4's UAT passes: remove any now-unreachable legacy-only code the auditor confirms dead. Conservative — the shared Cosmo/HUD/parallax/BiomeManager stack stays. This is the irreversible step; it ships in a separate commit so revert of 5 alone restores the dead code without touching the live cutover.

**Rollback rule:** if commit-4 UAT fails, `git revert` commit 4 (restores the flag) — commits 1-3 are parity-improvements that stand on their own and stay shipped. Do **not** delete legacy (commit 5) in the same PR as the cutover (commit 4); a green commit-4 UAT is the precondition for commit 5.

---

## 6. UAT flags (cannot be verified programmatically — pixels)

- D4: parallax pans on motion + clearing renders with no flash/stack/freeze after the tick move (§3).
- Trampoline loop: tap→walk→bounce→kaleido spike reads correctly (§2.5, §5 commit 2).
- Onboarding magic-moment still fires on first visit under cutover (§2.3).
- Calm baseline post-FX matches today's feel; event-peaks still spike & decay (§2.4).
- Plain `/play/` (no query) shows substrate clearing, not a blank or legacy auto-cycle (§5 commit 4).

These five are the load-bearing gate. Programmatic UAT (bundle-ref, curl-reachable, logic-marker grep, Vitest resolvers) confirms the *plumbing*; only human eyes confirm the *world*.
