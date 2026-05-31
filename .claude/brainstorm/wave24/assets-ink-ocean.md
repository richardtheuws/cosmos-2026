# Asset Runbook — Ink-Ocean (Wave 24, Universe 2)

Every NEW visual asset the `universes/ink-ocean/` substrate references, with exact
output path under `public/assets/...`, target dimensions, on-brand fal/nano-banana
prompt, and alpha-cut flag. Generate next; nothing here exists yet (verified
2026-05-31 — `public/assets/objects/{kelp-organ,updraft-current,jellyfish-cyan,deep-glow-lure}.png`
and `public/assets/backgrounds/ink-water-{surface,abyss}-4k.png` are all absent).

**Brand gate for every gen:** Hayao×Moebius watercolor + continuous ink pen-line.
Locked palette ONLY: ink-aubergine / sky-wash / saffron-glow / forest-deep. The ONE
pop-accent is `pop-cyan` (≤5% of frame, only on the jellyfish + lure-orb). No emoji,
no placeholder, no stock, no other saturated colour. The sea breathes; it does not
shake. Regenerate 3–5× until 9/10+. Backgrounds preload eager; objects lazy.

---

## BACKGROUNDS (2) — `public/assets/backgrounds/`

### 1. `ink-water-surface-4k.png` — Room A surface-skin + caustics (preload: true)
- **Dimensions:** 4096 × 2731 (3:2 landscape, matches forest 4K bg convention)
- **Alpha cut:** NO (opaque base wash; it is the backmost textured layer)
- **Prompt (fal flux-pro / nano-banana):**
  > "Underwater seen from mid-depth looking up toward a pale surface, painted as a
  > single continuous Moebius ink pen-line over wet watercolor washes. Upper third
  > a pale sky-wash skin with rippling caustic ink-line ripples suggesting an
  > unreachable surface above; fades downward into deep ink-aubergine water. Cool,
  > translucent, suspended, calm. Hayao Miyazaki × Moebius watercolor, hand-drawn
  > ink contour, soft pastel washes. No characters, no creatures, no text. Muted
  > desaturated palette: sky-wash blue-grey, ink-aubergine purple-black. No saturated
  > colours."
  - Negative: text, watermark, photo, 3D render, vivid neon, characters, logo.

### 2. `ink-water-abyss-4k.png` — Room B deep-trench abyss gradient (preload: true)
- **Dimensions:** 4096 × 2731 (3:2 landscape)
- **Alpha cut:** NO (opaque base wash)
- **Prompt:**
  > "The deep ocean trench, painted as a continuous Moebius ink pen-line over wet
  > washes. Almost entirely ink-aubergine deepening to near-black at the lower edge
  > (the abyss); only a thin faint pale sky-wash band at the very top (the distant
  > surface, far away). Vast, weightless, slightly uncanny but calm — no threat. Soft
  > drifting deep-particle motes in ink. Hayao × Moebius watercolor, hand-drawn ink
  > contour. No characters, no creatures, no text. Desaturated palette: ink-aubergine
  > purple-black to black, faint sky-wash top band. No saturated colours."
  - Negative: text, watermark, photo, vivid neon, characters, bright light.

---

## OBJECTS (4 + 2 layer-helpers) — `public/assets/objects/`

### 3. `kelp-organ.png` — Room A interactable + foreground silhouette (preload: false)
- **Dimensions:** 1024 × 1536 (portrait, tall reed-stand)
- **Alpha cut:** YES (transparent background — BiRefNet/green-screen, used alphaTest 0.05)
- **Prompt:**
  > "A stand of tall underwater kelp drawn as hollow reed-organ-pipes, dark
  > ink-aubergine silhouette ink-contoured with translucent pale sky-wash washes
  > glowing faintly inside the hollow tubes. Vertical, swaying, Moebius continuous
  > pen-line, watercolor. Isolated on a fully transparent background, no scene, no
  > ground, no text. Desaturated ink-aubergine + faint sky-wash interior only."
  - Negative: background, scenery, text, watermark, vivid colour, characters.

### 4. `updraft-current.png` — Room B interactable column (preload: false)
- **Dimensions:** 1024 × 1536 (portrait, tall vertical column)
- **Alpha cut:** YES (rendered additive; transparent background, alphaTest 0)
- **Prompt:**
  > "A vertical column of rising underwater current drawn as upward ink-streak
  > hatching and a slow stream of small rising bubbles, semi-transparent, suggesting
  > moving water lifting upward. Continuous Moebius ink pen-line, faint saffron-glow
  > catchlight where it catches stray light, mostly pale ink lines. Isolated on a
  > fully transparent background, no scene, no text. Desaturated — ink-line + faint
  > saffron only, no saturated colour."
  - Negative: background, solid object, text, watermark, vivid neon, characters.

### 5. `jellyfish-cyan.png` — Room A inhabitant, THE pop-cyan accent (preload: false)
- **Dimensions:** 512 × 640 (small portrait)
- **Alpha cut:** YES (rendered additive bioluminescent; transparent bg, alphaTest 0)
- **Prompt:**
  > "A single small bioluminescent jellyfish, bell and trailing tendrils, drawn as a
  > delicate Moebius continuous ink pen-line with a soft glowing pop-cyan luminescence
  > — the only saturated colour. Translucent watercolor wash, gentle halo. Isolated on
  > a fully transparent background, no scene, no text. Body desaturated ink-line; glow
  > pop-cyan only, restrained."
  - Negative: background, scene, text, watermark, multiple creatures, magenta, lime.
- **Note:** this is the universe's signature ≤5% accent — keep the cyan small/restrained.

### 6. `deep-glow-lure.png` — Room B inhabitant, the uncanny lure-orb (preload: false)
- **Dimensions:** 512 × 512 (square)
- **Alpha cut:** YES (rendered additive; transparent bg, alphaTest 0)
- **Prompt:**
  > "A single small deep-sea anglerfish lure: one luminous pop-cyan glowing orb with a
  > soft cold cyan halo, hanging in black water, faintly uncanny and lonely. Drawn as a
  > sparse Moebius ink pen-line with a glowing cyan core. Isolated on a fully
  > transparent background, no scene, no creature body visible, no text. Everything
  > desaturated except the single cyan glow."
  - Negative: background, fish body, text, watermark, magenta, lime, busy detail.

### 7. `light-shaft.png` — Room A saffron god-ray (×3 reused) (preload: false)
- **Dimensions:** 512 × 1536 (tall narrow shaft)
- **Alpha cut:** YES (rendered additive light; transparent bg, alphaTest 0)
- **Prompt:**
  > "A single vertical cathedral shaft of warm saffron-glow light combing down through
  > dark underwater, drawn as ruled ink-hatching catching drifting motes — a god-ray in
  > water. Soft, warm saffron against implied cool dark. Continuous Moebius ink line.
  > Isolated on a fully transparent background, no scene, no text. Saffron-glow + faint
  > ink hatching only."
  - Negative: background, scene, text, watermark, vivid neon, characters, hard edges.
- **Note:** ONE asset, instanced 3× in `behavior.ts` (phase-offset sway, x-offset).

### 8. `water-motes.png` — drifting suspended-particle field (both rooms) (preload: false)
- **Dimensions:** 1024 × 1024 (square, tiled/drifted)
- **Alpha cut:** YES (rendered additive; transparent bg, alphaTest 0)
- **Prompt:**
  > "A sparse field of tiny drifting underwater motes and slow suspended particles,
  > faint pale ink dots and specks scattered over transparency, suggesting dust
  > suspended in still water. Very subtle, Moebius ink, near-monochrome pale. Isolated
  > on a fully transparent background, no scene, no text. Desaturated pale only."
  - Negative: background, dense, bright, text, watermark, colour, large shapes.

---

## AUDIO — `public/assets/audio/music/` (REGEN REQUIRED)

Both beds already exist on disk but are **stubs that MUST be regenerated**:
- `ink-ocean-shafts.mp3` — currently **19.824s** → needs a seamless **~90s** loop.
- `ink-ocean-trench.mp3` — currently **19.800s** → needs a seamless **~90s** loop.

Each room declares its bed via `rooms.json audioBed` (DefaultAudio swaps on room-enter,
loops at 0.45 volume through AudioFFTBridge). Suno prompts (from the design doc §2):

- **ink-ocean-shafts.mp3 (Room A):** "Beatless underwater drone, deep submerged ambient.
  Low-passed pad swells, distant filtered whale-throat moan, soft sub-bass pressure pulse
  ~every 8s. Glassy bowed-string harmonics far in the background, occasional single
  sustained marimba-mallet note ringing through water. No percussion, no beat. Watercolor-
  Moebius calm, weightless, suspended. Loopable seamless 90s, headphone-intimate, quiet."
- **ink-ocean-trench.mp3 (Room B):** "Deep-abyss beatless drone, heavier and lower than the
  upper water. Sub-bass pressure pulse ~every 10s, very long filtered whale-moan swells
  fading in and out, a faint metallic sonar-ping echo far away (~once per 20s, randomized).
  Glassy harmonic shimmer occasionally rising from below. No beat, no percussion. Vast,
  weightless, slightly uncanny but never tense. Loopable seamless 90s, headphone-intimate, quiet."

### SFX (ElevenLabs) — referenced in behavior comments, not yet wired (runtime-wirer)
Not file-path-referenced by the substrate yet (no SFX-emit hook in the contract), but
named for generation so the audio-director can produce them:
1. **kelp-organ-swell** — "Slow underwater pipe-organ swell, low/reedy, saffron-tinted
   overtone blooms then bends down, ~1.8s, all breath, no attack-click." (Room A onUse #1)
2. **jellyfish-chime** — "Single soft glassy bell-chime, faint, cyan shimmer-tail + wet
   halo, ~700ms." (Room A inhabitant cross-center)
3. **bubble-release** — "Short cluster of slow rising bubble-blips, wet, ~500ms." (Float-Tap)
4. **updraft-ride** — "Rising whoosh of pressurized water + bubble column, pitch rising,
   ~2s, settling sigh on release, all breath/water." (Room B onUse #1)
5. **deep-glow-pulse** — "Very low slow glassy throb, faint cyan-cold shimmer, ~900ms,
   felt more than heard." (Room B inhabitant pulse)
6. **surface-call** — "Faint distant choral 'aah' swell, warm saffron edge, ~1.5s." (rise-up)
7. **submersion-swell (portal)** — "Deep watery whoosh-suck, rising pressure-drop, muffling
   low-pass sweep, capped by a soft saffron bell, ~1.4s." (universe-arrival ceremony)
