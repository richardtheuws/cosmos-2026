# Wave 22 · D5 — A Real Test + Visual-UAT Gate

**Concern**: Stand up automated tests + a visual-UAT gate, in parallel with the Wave 22 hard cutover.
**Why now (NORTH-STAR §4, §6 Wave-22 entry)**: the cutover *deletes* the legacy biome-cycle with **no `?legacy` escape hatch**. The gate is therefore the only safety net, and per the Wave-22 ledger it must exist *before* the cutover ships. The 21.1→21.2.4 six-patch cascade is the lesson: programmatic UAT can't see pixels, and there was no regression net. `package.json` `test` is still `echo "Tests komen in S2" && exit 0` — zero coverage today.

---

## 1. Vitest unit suite (pure logic, no DOM/Three mocking)

The substrate resolvers are pure functions over plain manifest objects — ideal, high-value, zero-rabbit-hole targets. Cover exactly:

**`src/substrate/ResolveURL.test.ts`** — drive `resolveURLRequest` with a hand-built `ResolveCtx` (an in-memory `knownUniverses` Set + a `loadUniverseManifests` stub returning literal Manifest/Areas/Rooms objects — no fetch, no fs):
- `parseURLRequest`: empty string, missing params, empty-string params (`?universe=`) → all `undefined`.
- Full happy path: valid `universe/area/room` → `changed:false`.
- **Universe fallback**: unknown universe → `forest` + `changed:true` + warns.
- **Area fallback chain** (mirrors `fallbackArea`): unknown area → `manifest.defaultArea` → `entryArea` → `areas[0]`.
- **Room fallback**: unknown room id → first room of area; room valid-id-but-wrong-area → re-resolved to area's room.
- **`changed` semantics**: omitted-param-but-valid-default still sets `changed:true` (the self-heal `replaceState` contract).
- **Edge — "zero valid rooms"**: area whose `rooms` list matches no `rooms.rooms` entry → `resolveURLRequest` throws `…has zero valid rooms`.
- **Edge — defaultArea ⟂ entryArea disagreement**: `manifest.defaultArea !== areas.entryArea` → warns "parent contract wins" and resolves via manifest. Assert with a `vi.spyOn(console,'warn')`.
- Fatal: default universe fails to load → throws.

**`src/substrate/ResolveMood.test.ts`** — `resolveMood(manifest, area, room?)`:
- Each preset (`calm-baseline`/`deep-trip`/`neutral`) → correct `PRESET_PALETTES` ambient/primary/intensity.
- Unknown preset object → defaults to `calm-baseline` palette.
- `manifest.post.intensityCurve` overrides preset intensity per-key (partial merge).
- Area `moodOverrides` override ambient/primary and per-key `post.*`; absent keys inherit.
- `_room` param ignored today (assert it doesn't throw / change output — locks the "reserved" contract).

**`src/substrate/contracts/ManifestSchema.test.ts`** + **`AreasSchema.test.ts`** + **`RoomsSchema.test.ts`** — the dev/prod split is the highest-value invariant:
- `validateManifest`: lenient mode backfills defaults + warns (assert returned shape); strict mode (`lenient:false`) **throws** on missing `name`, bad `post.preset`, non-array `assets`, non-`1.x` version.
- `validateAreasManifest`: zero areas warns/throws per mode; unknown `pathExperience.kind` warns(dev)/throws(prod); `moodOverrides` partial parse.
- `validateRoomsManifest`: **backwards-compat backfill** — room missing `area` → `defaultArea` + soft warn; zero rooms; exit defaults; `biomeKey` null-vs-undefined distinction (line 77-82 is subtle — lock it).

**Config / deps to add** (devDependencies): `vitest`, `@vitest/coverage-v8` (optional). Add `vitest.config.ts` with `test: { environment: 'node', include: ['src/**/*.test.ts'] }` — node env, no jsdom needed (all targets are pure). Tests live beside source (`*.test.ts`); already excluded from the Vite build (only HTML entries are rollup inputs) but add `**/*.test.ts` to `tsconfig` exclude so `tsc --noEmit` in `build` stays clean, OR rely on vitest's own transform. Target: ~40-50 assertions, runs <1s.

---

## 2. Playwright visual-UAT harness (committed artifacts → required human review)

**No committed self-UAT pipeline exists.** Commit 703421b's "self-UAT" was an *ad-hoc* manual Playwright run by Claude, never checked in (only the memory note "programmatic UAT cannot see pixels" survived). We build the real, committed thing now.

**`scripts/uat/shots.mjs`** (Playwright, `chromium.launch`):
1. `npm run build` then `npm run preview` (or `vite preview --port 4173`) → boot the built `/play/` against the real dist bundle, not dev.
2. Navigate + screenshot the **three load-bearing states** the cutover must prove:
   - **Cosmo-in-clearing**: `/play/?substrate=v2&universe=forest&area=…&room=clearing` (the migrated legacy clearing Room — proves trampoline/parallax/HUD parity).
   - **Cosmo-in-deep-grove after traversal**: load clearing, drive the room→room exit (click exit / call the traversal hook via `page.evaluate`), wait for biome-blend settle, screenshot — proves Room↔Room transition + StatePersistence.
   - **Second universe**: `?universe=<wave22-second>` — proves the contract is generic (D4) + portal transition + state-carry (§3b "your Cosmo visits my world").
3. Each: `waitForFunction` on a substrate "ready" signal (e.g. a `window.__substrateReady` flag set on room-enter — add it in D-runtime), wait an extra fixed settle for post-FX, then `page.screenshot`. Also capture `console` errors/warns into a sidecar `.log` and **fail the run if any `console.error` fired** (cheap programmatic floor under the human pixel-check).

**Committed artifact set** → `uat/baseline/` (checked into git):
- `clearing.png`, `deep-grove.png`, `second-universe.png`
- `<state>.console.log` per shot
- `uat/REVIEW.md` — a sign-off form: shot filenames, the git SHA + version they were taken at, and a `Signed-off-by: <human> @ <date>` line that a person fills in *after looking at the pixels*. **The script never writes the sign-off line** — that's the human gate.

This is a **human-review artifact, not an auto-pass**: the script produces pixels + asserts no console errors; a person opens the three PNGs and signs `REVIEW.md`. We do **not** do pixel-diff baselining this wave (Cosmo's watercolor + post-FX are intentionally non-deterministic frame-to-frame; a diff threshold would either thrash or rubber-stamp).

**Deps**: `@playwright/test` (or bare `playwright`), `npx playwright install chromium` documented in `uat/README.md`.

---

## 3. Wiring into package.json + deploy

**package.json scripts**:
```jsonc
"test":       "vitest run",
"test:watch": "vitest",
"uat:shots":  "node scripts/uat/shots.mjs",
"predeploy":  "npm run typecheck && npm run test && npm run build"
```
`test` now actually runs Vitest (kills the `echo "Tests komen in S2"` stub). `predeploy` gains `test` before `build` so a red unit suite blocks the ship at the npm layer.

**deploy-ftp gate** — mirror the existing **STEP 0 regression-gate pattern** (`deploy-ftp.sh` already curl-greps `id="minimap-canvas"` to block landing downgrades). Add a **STEP 0.5 UAT gate** for `cosmos-2026` deploys: before upload, assert `uat/REVIEW.md` exists AND contains a `Signed-off-by:` line AND its recorded git-SHA matches `HEAD` (so a stale sign-off from an old commit can't wave a new bundle through). No sign-off / stale SHA → `[STEP 0.5 BLOCKED]`, bypassable only with an explicit `--skip-uat` flag (deliberate, logged, same posture as `--force-downgrade`). The human flow is: `npm run uat:shots` → eyeball 3 PNGs → sign `REVIEW.md` → `git commit` → deploy.

---

## 4. Scope discipline (explicitly OUT)

- **No pixel-diff / visual-regression baselining.** Non-deterministic watercolor + post-FX makes thresholds worthless this wave. Human eyeball is the check.
- **No DOM/Three/WebGL unit mocking.** Renderer, CosmoScene, AnimDirector, parallax, post-FX are out of unit scope — Playwright covers them at the integration layer via real pixels. Don't build a jsdom+gl-stub rabbit hole.
- **No coverage threshold gates / CI matrix / GitHub Actions.** Local `predeploy` + deploy-ftp STEP 0.5 is the gate this wave. CI is a later wave.
- **No tests for the legacy biome-cycle** — it's being deleted; don't write a net for a corpse.
- **No E2E for mic-input / Life System** (Wave 19b, paused).
- **No Phaser/Howler/Tone unit tests.** Audio + the Phaser layer are out; resolvers + schemas + the 3 visual states are the load-bearing surfaces for *this* cutover.
- Keep the suite <1s and the harness to 3 shots. The goal is a safety net for the hatch-less cutover, not a comprehensive test pyramid.
