# Asset Runbook — Universe: Mushroom Forest (Wave 24, Phase 1b deepen)

Two NEW visual assets. Both are *additive light* planes painted on the shared
scene (Option A underglow / warm-beam). No audio assets needed — `clearing-bloom-loop.mp3`
and `deep-grove-loop.mp3` already ship in `public/assets/audio/music/`.

Brand gate for both: Hayao×Moebius watercolor, locked palette only, pop-accent
≤5% peak-only, no emoji/placeholder/stock. Generated via fal.ai (Flux Dev for
painterly objects) or nano-banana green-screen for clean alpha. These render with
`THREE.AdditiveBlending`, so they should be painted on a **pure black** background
(black = transparent under additive) and alpha-cut.

---

## 1. `public/assets/objects/sunbeam-patch.png`

- **Used by:** `SunbeamPatch` interactable (Clearing). Painted as (a) a flat
  ground pool laid on the moss and (b) a faint stretched vertical shaft reusing
  the same texture.
- **Dimensions:** 1024×1024 px, square (the mesh stretches it both flat and
  tall, so a soft radial/elongated glow centered in frame reads correctly in
  both orientations).
- **Alpha-cut:** YES. Soft feathered alpha at the edges; painted on pure black
  for additive blending.
- **fal / nano-banana prompt:**
  > "A soft watercolor shaft of warm sunlight pooling on forest moss, seen as a
  > luminous oval of mushroom-cream and saffron-glow light, faint drifting
  > dust-motes suspended in the beam, Hayao Miyazaki × Moebius watercolor wash,
  > gentle feathered edges fading to nothing, painted on a pure black background,
  > no objects, no creatures, no text, calm and tender, light as a hint not a
  > spotlight, high detail, soft grain."
- **Palette:** mushroom-cream + saffron-glow only. NO pop-accent (the warm
  Clearing peak lives on the nectar-glint, not here).

---

## 2. `public/assets/objects/glow-cap-cluster.png`

- **Used by:** `EchoCap` interactable (Deep Grove). ONE painted glow-cap tile,
  instanced 4× across the cluster (nearest = the touch-cap, rest cascade). Also
  serves as the Option-A underglow source for the room (additive glow over the
  shared `slow-bloom` background — NOT a new biome).
- **Dimensions:** 768×768 px, square.
- **Alpha-cut:** YES. Painted on pure black for additive blending; soft alpha
  on the cap silhouette + a luminous underside.
- **fal / nano-banana prompt:**
  > "A single small mushroom cap glowing from beneath, moss-sage cap with a
  > luminous sky-wash blue-green underside emitting soft light, Hayao × Moebius
  > watercolor, the glow rising from the ground up, faintly cool and
  > bioluminescent, a momentary pop-cyan hot-core at the very center (under 5%
  > of frame), painted on a pure black background, no creatures, no text,
  > intimate and hushed, soft feathered light edges, high detail."
- **Palette:** moss-sage + sky-wash, with a small **pop-cyan** hot-core
  (event-peak only — the touch-flare scales it up briefly in `EchoCap.update`).
  Keep the cyan core tight (≤5% of the tile) so the calm-baseline pulse stays
  inside the cool locked palette.

---

## Notes for the asset generator

- Regenerate 3–5× and pick the most painterly, least "sticker-like" result —
  these are *light*, not objects with hard outlines.
- Because both render additive, brightness in the PNG = emitted light; keep the
  cores soft so the breathing (`±4%` sine on the sunbeam, slow offset pulse on
  the caps) reads as alive, not as a flicker.
- No `rtcosmo` needed (no Cosmo in either asset).
