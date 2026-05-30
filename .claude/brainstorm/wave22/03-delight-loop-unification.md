# Wave 22 — D3: Unify the dual trampoline into one canonical, juicy implementation

**Concern owner:** delight-loop unification
**NORTH-STAR anchors:** §3 (trampoline = LOCKED primary delight loop; every Room needs a small juicy repeatable joy), §4 (stop patching, reconsider the system), §5 (quality > speed), Pivot Ledger 2026-05-30 (hard cutover, migrate-before-delete, no `?legacy` escape hatch).

---

## 0. The problem, restated from the code

The LOCKED delight loop exists twice and they are NOT equivalent:

- **Legacy (works, alive):** `InteractionManager.handleTap` raycasts `TrampolineSpots.pickAtNDC` → `CosmoAgent.walkTo(x,z,'bounce')` → on arrival `startBounce()` runs a `worldY` sin-arc (`BOUNCE_HEIGHT 0.6`, `BOUNCE_DURATION_S 0.8`) and fires `onBounce({rollHallucination})` → `CosmoScene` couples kaleido-spike + 30% hallucination + `notifyBounce` (vibe `+0.18`, 5-in-30s → DeepTripMode). This is the juice.
- **Substrate (stub):** `ForestTrampoline.onUse(cosmo)` does `cosmo.root.position.y += 0.05` and nothing else. No walk, no arc, no sound, no vibe, no kaleido. `UniverseHost.ts` (114 lines) wires NO interaction at all — nothing ever *calls* `onUse`. So in production substrate mode the loop is not merely degraded, it is **dead**.

The cutover (Pivot Ledger 2026-05-30) makes the substrate the only path. Per §4 we do not write a third patch on the stub — we promote the legacy loop into the contract and delete the stub.

---

## 1. Canonical wiring — promote the legacy loop into the substrate

**Key contract gap:** `InteractableHandle.onUse(cosmo: CosmoV2Rig)` receives only the *rig*, but the real loop lives on the *agent* (`walkTo`, `startBounce`, `onBounce` events). The arc is `worldY`-driven on the agent and copied into `rig.root.position` each frame; `CosmoAnimDirector` only owns squash-stretch (`root.scale.y`), not the vertical travel. So the stub author tried to move the rig directly and got the +=0.05 dead-end.

**Decision:** the substrate must own a small `SubstrateInteractionManager` (new, in `src/substrate/`) that mirrors the legacy `InteractionManager` tap-path but drives the agent. `UniverseHost` (which already owns the persistent CosmoAgent per RoomHost's comment) constructs it once and feeds it the active room's `RoomHost.getInteractables()`. Wiring:

1. `UniverseHost` holds `CosmoAgent` + `InputController` + camera. On room-enter it calls `interaction.setTargets(roomHost.getInteractables())`.
2. `SubstrateInteractionManager.handleTap(clientX,clientY)`: project each interactable's `anchor` to screen OR raycast — simplest correct path: pick the interactable whose `anchor` is nearest the tapped NDC ray AND within `handle.range`. (We can reuse `TrampolineSpots.pickAtNDC` since `ForestTrampoline` still owns a `TrampolineSpots` for *rendering* — but the canonical pick should be contract-level on `anchor`/`range`, not forest-specific. See §4.)
3. On pick → `agent.walkTo(anchor.x, anchor.z, 'bounce')`. **The agent's existing arrival → `startBounce` → `onBounce` chain is reused unchanged.** This is the migrate-before-delete: the proven arc is not rewritten.
4. `agent.events.onBounce` is wired in `UniverseHost` (the substrate's CosmoScene-equivalent) to: `sfx.play('jump')`, kaleido-spike on `globalUniforms.kaleidoTrigger`, vibe-gain + DeepTrip trigger, 30% hallucination.
5. **`ForestTrampoline.onUse` is deleted** as a bounce-driver. The contract redefines `onUse` to mean "the author's *cosmetic* reaction when Cosmo lands" (e.g. flash the trampoline material, spawn spore-motes) — it is called by the substrate AFTER `startBounce`, and the bounce mechanic is substrate-owned, not author-owned. This removes the +=0.05 footgun permanently: authors can't fake a jump, they decorate a real one.

---

## 2. What "juice" means concretely

The arc + coupling already exist; the wave makes them fire in substrate mode and tunes them. Concrete parameters:

- **Vertical arc (agent, exists):** `worldY = sin(p·π) · 0.6` over `0.8s`. Keep.
- **Squash-stretch (CosmoAnimDirector, exists):** `isJumping` drives `root.scale.y`: anticip `1→0.85` (0.15s), launch `0.85→1.05` via `sin(p·π)` (0.40s), settle `1→0.95→1` (0.25s). **Wire `ctx.isJumping = agent.state==='bouncing'`** so the director's squash-stretch actually triggers on a trampoline bounce (today it keys off jump-state; confirm `bouncing` maps in). Add a tiny `scale.x` counter-curve (`scale.x = 1/√(scale.y)` approx, clamped ±8%) so volume reads conserved — squash widens, stretch narrows. This is the single biggest "alive" win and is cheap.
- **Sound:** `sfx.play('jump')` on `onBounce` (the one-shot already exists in `sfxBus`, vol 0.5). Add a soft landing tick on settle if a `stomp` at low vol reads good — UAT decides.
- **Kaleido pulse coupling:** on `onBounce`, `kaleidoTrigger = min(1, +BOUNCE_KALEIDO_SPIKE)` (constant already exported as `CosmoAgent.BOUNCE_KALEIDO_SPIKE`); pre-tap nudge `+0.1` on pick (legacy `onSpotTapped`) so the tap *feels* registered before Cosmo arrives.
- **Repeatability / the reason they come back:** vibe-gain `+0.18`/bounce; **5 bounces in 30s saturates → DeepTripMode** (the world blooms harder, briefly). 30% per-bounce hallucination overlay. This escalation is what makes a child (or stoned adult) keep tapping — each bounce is the same, but the *world's* response builds. Keep the numbers; they are the locked feel.

---

## 3. The walk-to-it loop in substrate mode

End-to-end, all substrate-owned:

`tap` → `SubstrateInteractionManager` raycasts active interactables → nearest within `range` → `onSpotTapped` cosmetic nudge (kaleido +0.1) → `agent.walkTo(anchor.x, anchor.z, 'bounce')` (existing ~1.5s ease-in/out, `walking-to` state, walk clip) → arrival fires `startBounce` → `bouncing` state, `worldY` arc + squash-stretch + `sfx jump` + kaleido spike + vibe gain (+ maybe hallucination + maybe DeepTrip) → `onBounce`-coupled author `onUse` cosmetic flash → bounce ends → agent returns to `idle` (idle-breath resumes). Tap again → repeat. Miss → no-op (no penalty, per the locked 17D rule).

Pet-loop (hold-on-Cosmo → `petAffect`, vibe +0.25, 2s → DeepTrip) is the *secondary* delight loop in the same manager — port it too so substrate-Cosmo is equally affectionate. It shares the `projectToScreen` + radius logic verbatim.

---

## 4. Generalization — the "delight-loop interactable" pattern for any Room/Universe

The whole point (§3, §3b "your Cosmo visits my world"): this must NOT be forest-special. The contract already has the right shape — `InteractableHandle { anchor, range, update, onUse, dispose }`. We make the substrate, not the author, own the walk+bounce:

- **Substrate owns:** pick (raycast against `anchor`/`range`), `walkTo`, the bounce arc, squash-stretch, sfx, kaleido, vibe. Any Universe that returns *any* `InteractableHandle` array gets the full juicy loop for free.
- **Author owns:** *where* (`anchor`), *how-far* (`range`), *what it looks like* (render its own mesh in its constructor — `ForestTrampoline` keeps its `TrampolineSpots` plane; a second Universe ships e.g. a "gong" or "bounce-flower" plane), and *the cosmetic landing reaction* (`onUse`: flash, particles, a custom sound override).
- **Optional per-interactable override:** add OPTIONAL `arrivalAction?: 'bounce' | 'custom'` and `sfxOnUse?: string` to `InteractableHandle` so the second Universe can swap the jump sound or supply a non-bounce delight (e.g. a spin) without touching the substrate. Default = `'bounce'` → identical to forest. Backwards-compatible (mirrors how `anchor`/`InhabitantHandle.anchor` were added).

This is what proves the contract generic for the Wave-22 second Universe (D4 dependency): it declares one interactable with a different mesh + sound and gets the locked delight feel automatically.

---

## 5. What needs LIVE VISUAL UAT (unconfirmable from code)

The FEEL is the deliverable and the code cannot self-verify it (the 21.2.x cascade proved this). Required Playwright-screenshot + human-review gate items:

1. **Squash-stretch reads as joy, not a glitch** — does `root.scale.y` 0.85→1.05 with the `scale.x` counter-curve look bouncy-alive on the billboard, or does it look like the plane is being crushed? Tune amplitudes against the eye, not the spec.
2. **Tap→walk→bounce timing feels responsive** — the ~1.5s walk before the payoff: does it feel like anticipation or like lag? May need a faster walk in substrate mode.
3. **Kaleido spike + hallucination intensity** at the locked numbers — still "calm baseline + event peak", not "constant trippy" (anti-pattern per §3).
4. **The come-back pull** — does the 5-in-30s DeepTrip escalation actually make a tester want to keep tapping? Subjective; needs a real human session.
5. **Second-Universe interactable** with a swapped mesh/sound feels equally juicy (proves §4 generalization, not just compiles).

Vitest CAN cover: pick-resolution math (anchor/range), `walkTo`-then-`bounce` state sequence, `onBounce` firing vibe-gain + the 5-in-30s saturation. Pixels and feel cannot.
