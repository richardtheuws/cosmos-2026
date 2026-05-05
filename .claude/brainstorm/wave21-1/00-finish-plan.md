# Wave 21.1 — finish plan (post-live-UAT)

**Status**: planning, locked
**Authored**: 2026-05-05
**Pivot ledger entry**: NORTH-STAR.md §6 (2026-05-05)
**Trigger**: Richard's live UAT screenshot of `/play/?substrate=v2` showed (a) marketing-chrome around the game and (b) a green-pill Cosmo with bat-wing discs and a brown antenna ball

> Read NORTH-STAR.md first. This plan finishes Wave 21 by retiring the PIL-crop decal-pivot and stripping the marketing chrome from `/play/`. Quality bar: this is what should have shipped in v2.2.0. We didn't see it because programmatic UAT can't see pixels.

## 1 · The two failures

### 1.1 Cosmo is a green pill (cycle: cosmo-regen)

The Wave 21 cosmo-finisher saved 97% of budget by deterministic-cropping the 6 decals out of `cosmo-hero-lora.png` (Sprint 16A canonical 10/10 hero). Cropping a *region* of a finished painting does NOT produce a free-standing painted decal — the crops are flat-color regions that read as solid green when applied to the capsule. Visible on screen:

- Body-skin: solid green capsule, no rose-spots, no watercolor brushwork, no DNA painting
- Suction-discs: render as black bat-wings (the crop pulled an underbody shadow region)
- Antenna-bulb: brown ball (crop pulled antenna stem-base, not flower-bulb top)
- Mouth: invisible or imperceptible
- Eyes: mostly OK because eye region of hero is high-contrast

**Sunk cost is not an argument.** The PIL-crop pivot served its budget purpose; it does not serve the brand. Retire it.

### 1.2 `/play/` wears marketing chrome (cycle: chrome-strip)

Live screenshot shows:
- Top-right nav pill: "← Home / Het Verhaal / Updates" (Dutch nav into the marketing pages)
- Top-right version pill: `v2.2.0 · substrate` (good for QA, distracting in canonical view)
- Top-left "0m" altitude counter
- The game canvas is pinched into a center column with **black bars** on the left and right (mobile-portrait aspect-ratio rendering on a desktop viewport — the canvas isn't filling the viewport)

NORTH-STAR §3 says the world breathes. Right now the browser chrome breathes around it. The play surface is meant to be *the experience*, not a game-in-a-frame. Close the tab to leave; there is no menu to go back to.

## 2 · Locked decisions

### 2.1 Decal regeneration — real fal.ai Flux LoRA, no shortcuts
- Use `rtcosmo` LoRA (Sprint 16A trained model URL — stored in `cosmo_lora_v16a.md`).
- Model: fal-ai/flux-pro/v1.1 with the LoRA attached.
- **The whole-character bleed gotcha** that triggered the Wave 21 crop-pivot is the actual problem to solve, not avoid. Two strategies, used together:
  - **Negative-prompt + LoRA-scale tuning** (start scale=0.6, climb to 0.9 only if DNA features dropping). Negative prompts: "no full character, no body silhouette, no full Cosmo, isolated body part only, single anatomy element only, on white background"
  - **Prompt-engineering toward isolated organ rendering**: lead with explicit "isolated body part painting", "isolated [organ]", "anatomical study sheet", "single-element decal". Test with low LoRA scale first; only raise if the DNA painting drops.
- **Quality bar**: 9.5+/10 DNA per decal, scored against `cosmo_dna.md` criteria. No 9/10 ships.
- **Regen budget**: explicit no-cap. If a decal needs 30 attempts, it gets them. Cost target ~$15-30 for the sprint, blow through if needed.
- **BiRefNet alpha-cut** for transparent backgrounds.
- **Output**: 4096² RGBA PNG → `public/assets/cosmo/decals/v2-final/{eyes-l,eyes-r,mouth-neutral,body-skin,disc-suction,antenna-flower}.png` (overwrite the crops in place — same filenames, no path changes needed elsewhere).

### 2.2 Capsule-mesh hide-when-painted
The current rig paints body-skin as the *material* of the capsule. If the painted body-skin loads, the capsule IS the painting — no separate "hide capsule" step needed in code. **What's actually broken**: the body-skin crop is a flat-color region. Once the regen lands a real watercolor body-skin, the capsule is automatically painted.

But: spot-check. If after regen the body still reads as a capsule-shape rather than Cosmo-body-shape, the issue is the cylinder-capsule mesh shape itself, not the skin. In that case, post-regen we may need to swap the body geometry for a more Cosmo-shaped form. Out of scope unless visible.

### 2.3 `/play/` chrome strip
- Delete `<nav class="hud-nav">` and its 3 anchor links from `play/index.html`.
- Delete `<span class="hud-version">` from in-canvas (move to a tiny corner-text under canvas, or kill outright — pill is dev-noise on the canonical view).
- Keep `0m` altitude counter only if it's gameplay-meaningful right now; it's not (no movement metrics on screen yet) → **delete**.
- Black bars: investigate viewport/canvas sizing. The play-shell already sets `inset: 0; width: 100%; height: 100%` — but the screenshot shows the canvas constrained mid-screen. Likely cause: a max-width on `.play-shell` or canvas, or a fixed-aspect-ratio plane in Three.js. Find + fix.
- Result: `/play/?substrate=v2` is full-viewport, edge-to-edge canvas, zero chrome. Just Cosmo + the world.
- Set `<html lang="en">` (was `nl`; the page has no Dutch text after strip).
- Update `<title>` from "Speel · ..." to "Cosmo's Universe — play".

### 2.4 Out of scope (explicit)
- Cutover to substrate-as-default (still feature-flagged this release; cutover after Wave 21.1 lands clean and you've UAT'd the regen)
- Audio finalization
- Mobile-specific sizing (chrome strip needs to work on mobile too — but no special mobile UI added; chrome is gone for everyone)
- Wave 22 first-non-forest Universe (deferred as planned)

## 3 · Agent breakdown — 2 truly parallel

Independent file domains, no overlap.

### 3.1 chrome-stripper (general-purpose, runs now)
- Files touched: `play/index.html` (heavy edit), maybe `assets-generated.json` (none expected), maybe a viewport CSS file. NOT cosmo files, NOT substrate files.
- Output: stripped HTML + verification (`npm run dev` + curl shows reduced chrome + canvas full-viewport).

### 3.2 cosmo-regen (Asset Generator, runs now)
- Files touched: `public/assets/cosmo/decals/v2-final/*.png` (overwrite all 6), maybe `assets-generated.json` (manifest update), maybe `src/three/cosmoV2.ts` (only if visible test reveals capsule-shape issue post-regen).
- Output: 6 fresh decals at 9.5+/10 DNA + brainstorm doc with prompts/seeds/scores.

## 4 · After both land — phase 2 (me orchestrating)

1. Build clean, serve dev, screenshot via curl-html-content (browser MCP unreliable — surface to Richard for visual check).
2. Bump VERSION → 2.2.1 + package.json + main.ts + HUD-pill (or remove HUD-pill text if chrome-stripper kills it; in that case, keep `VERSION` const for diagnostic).
3. CHANGELOG entry: "2.2.1 — Wave 21.1 finish: real Cosmo decals + chrome-strip on /play/".
4. `npm run updates:build` + clean rebuild.
5. lftp mirror redeploy (NOT deploy-ftp.sh — it auto-rebuilds and races).
6. CF cache purge_everything.
7. Live UAT URLs check + surface to Richard for the actual visual gate.

## 5 · Memory hooks
- Update `cosmo_decals_wave21.md` with the regen results + retired-crop note.
- Update `next_session.md` to point at Wave 22 once 2.2.1 lands clean.
- Add `feedback_visual_uat_required.md` (cross-game): programmatic UAT cannot see pixels — every "visual" deliverable needs a real eyes-on UAT before claiming ship.

## 6 · Risk register
| Risk | Mitigation |
|---|---|
| LoRA whole-character bleed defeats negative-prompts at every scale | Try without LoRA (raw Flux Pro + reference-image style transfer). Fall back to nano-banana CLI if Flux Pro can't isolate. |
| Body-skin renders OK but capsule-shape still reads as "pill" | Geometry swap is out of scope unless visible. If visible, defer to Wave 21.2. |
| Chrome-strip breaks the canvas sizing on mobile | Test in viewport-narrow + viewport-wide. The current `.play-shell { inset: 0 }` should hold. |
| Regen blows past $30 with no convergence | Stop at $40 and surface to Richard with what each attempt produced. Don't ship a 7/10 just to close the budget. |

## 7 · The visual UAT gap (memory cross-game)
Wave 21 shipped with programmatic UAT all-green. The screenshot showed it was visually broken. Programmatic UAT proves *that the bytes arrived*; it cannot prove *that the bytes paint the right thing*. Future waves with visible deliverables MUST end on real visual UAT — by Richard, by browser-MCP if available, or by deploy + immediate Richard-checks-it. Save this learning.
