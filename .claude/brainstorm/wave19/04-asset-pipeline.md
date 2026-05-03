# Asset Pipeline Roadmap — Wave 19 (Cosmo Life System)

## A. Inventory snapshot

**Backgrounds (4 biomes, 4K each)**: `biome-boss`, `biome-cathedral`, `biome-inkpool`, `biome-slow-bloom` (+ `inkpool-hollow`, `slow-bloom-v2` variants, grass-strip).

**Weirdo objects (8)**: breathing-portal, eyeball-sentry, floating-star, melting-clock-bubble, mouth-pillar-sheet, organic-flesh-trampoline, secret-crystal, upside-down-tree.

**Particles (6)**: particle-1..6 — generic shimmer/dust set.

**Cosmo sprites**: walk x3 (cleaned), jump-up, jump-fall, cling, hero-4K, hero-LoRA, 4 poses (idle-breath, sit-sniff, stretch, wave-uncanny). LoRA variants in `v2/v3/v4`.

**Audio — SFX (13)**: cosmo-coo x3, cling/jump/stomp/hurt, bomb-throw/boom, pickups, globe-trigger, bonus-warp.
**Music (7)**: title, slow-bloom-loop, inkpool-loop, hallucination-peak x2, damage-warp, boss-stinger.
**Voices (3)**: globe-l1 x3.

**GAPS for Life System**:
- No "calm/idle" sprites for sit-cross-legged, lie-back, stargaze, nibble, pet (autonomous loops are starved).
- No interactable life-props (mushrooms, beetles, bioluminescent puddles) — only weirdo set is hostile/trippy.
- Particles are generic; no mood-clusters (calm-shimmer / glitch-shard / deep-trip-cascade).
- Audio: no "Cosmo activity" SFX (chewing, humming, sneezing, snoring) — the cooing covers happy-only.
- No ambient-bed for "neutral wandering" between trippy peaks.

---

## B. Asset categories needed for Wave 19

| # | Bucket | Count | Why |
|---|--------|-------|-----|
| 1 | **Backgrounds** (mood-loops) | 3-5 | autonomous "Cosmo travels" calls for variety beyond 4 boss biomes; need calm + dream + neutral beds |
| 2 | **Items / interactables** | 10-14 | one per autonomous activity (nibble-mushroom, beetle, melting-pen, dream-pillow, puddle, shadow-twin, etc.) |
| 3 | **FX particles (mood sets)** | 8 | calm-shimmer, glitch-shard, deep-trip-cascade, sleep-zzz-glow, pet-affection-heart-shard, sneeze-burst, focus-orbit, boredom-fog |
| 4 | **Cosmo pose variants** | 6-8 | sit-cross-legged, lie-back-stargaze, head-tilt-90, point-up, sniff-ground, yawn, pet-receive, peek-shy (rtcosmo LoRA) |
| 5 | **Audio** | 10-12 | 8 activity-SFX (chew, hum, snore, sneeze, paw-tap, sigh, giggle, hiccup) + 2-3 ambient-beds (calm-wander, dream-soft, twilight-reflect) |

---

## C. Top-5 production-ready prompts

### 1. Background — "calm-wander dawn meadow" (Flux Pro)
- **Tool**: `fal-ai/flux-pro/v1.1`, 2048×1024, no transparent BG
- **Prompt**: `Hayao Miyazaki x Moebius watercolor dawn meadow, soft pastel cosmic horizon, gently swaying alien grass, distant nebula in pale apricot sky, hand-painted gouache texture, SEAMLESS UNIFORM TEXTURE, parallax-ready side-scroll layout, no characters, no text`
- **Negative**: `dark, scary, eyes, faces, busy detail, sharp horror, text, watermark`
- **Cost**: $0.05/run × 3 regen = $0.15
- **Post**: upscale to 4K via Real-ESRGAN ($0.02)

### 2. Item — "nibble-mushroom" (Flux Dev + BiRefNet)
- **Tool**: `fal-ai/flux/dev`, 1024×1024, transparent target
- **Prompt**: `single small bioluminescent mushroom, watercolor cosmic palette teal and salmon, glowing gills underneath, hand-painted Moebius style, isolated subject on plain white background, soft inner glow, no shadow`
- **Negative**: `multiple objects, scene, ground, grass, text, realistic photo`
- **Cost**: $0.025 × 3 = $0.075 + BiRefNet $0.01
- **Post**: BiRefNet remove-bg (this IS a subject, OK per memory)

### 3. Particle set — "deep-trip-cascade" (nano-banana, 8 frames)
- **Tool**: `nano-banana` Gemini Pro, 256×256 each, transparent
- **Prompt** (per frame): `single abstract psychedelic particle, melting iridescent shard, watercolor bleed, deep purple-magenta-cyan, isolated on transparent background, soft glow, frame N of 8 dispersing animation`
- **Negative**: `character, object, scene, text`
- **Cost**: 8× $0.039 ≈ $0.31
- **Post**: composite into 1024×512 sprite-sheet via Pillow script

### 4. Cosmo pose — "sit-cross-legged stargaze" (Flux Dev + rtcosmo LoRA)
- **Tool**: `fal-ai/flux-lora` with `rtcosmo` trigger (LoRA v16a), 1024×1024, transparent
- **Prompt**: `rtcosmo character sitting cross-legged on ground, head tilted up gazing at cosmic sky, calm peaceful expression, hands on knees, full body visible, side-three-quarter view, watercolor cosmic style, isolated on white background`
- **Negative**: `multiple cosmos, weapons, text, busy background`
- **Cost**: $0.05 × 4 (DNA-check rejects ~30%) = $0.20 + BiRefNet $0.01
- **Post**: BiRefNet → DNA-validation script → reject if drift >threshold

### 5. Audio — "Cosmo chewing/nibble" (ElevenLabs sound-gen)
- **Tool**: ElevenLabs Sound Effects API, 2-3 sec clip
- **Prompt**: `small creature chewing soft food, gentle wet munching, cute and organic, no voice, mono, loopable`
- **Cost**: $0.08/clip × 3 variants = $0.24
- **Post**: normalize to -16 LUFS, register in `_HOWLER_CONFIG.json`

---

## D. Cost estimate

| Tier | P50 | P90 (regenerate factor 2-3x) |
|------|-----|------|
| Backgrounds (5) | $1.10 | $2.50 |
| Items (12) | $1.10 | $2.40 |
| Particles (8 sets × 8 frames) | $2.50 | $4.00 |
| Cosmo poses (7) | $1.55 | $3.20 |
| Audio (12) | $2.40 | $3.60 |
| Music beds (3 Suno) | $0.00 (subscription) | $0.00 |
| **Total** | **~$8.65** | **~$15.70** |

Rounded ceiling: **$20** (well under monthly fal budget; quality > cost per memory).

---

## E. Pipeline scripts to write

`scripts/sprint19/`:
- `generate-backgrounds.sh` — Flux Pro batch, 5 prompts, 4K upscale chain
- `generate-items.sh` — Flux Dev + BiRefNet pipeline, 12 items
- `generate-particles.py` — nano-banana 8×8 frames + Pillow sprite-sheet composite
- `generate-cosmo-poses.sh` — Flux+rtcosmo LoRA + BiRefNet + DNA-validation gate
- `generate-audio.sh` — ElevenLabs SFX batch + LUFS normalize via ffmpeg
- `register-howler.mjs` — auto-update `_HOWLER_CONFIG.json` from new SFX
- `validate-cosmo-dna.py` — embedding diff vs `cosmo-hero-lora.png` reference, reject >0.18

---

## F. Priority tiers

**Tier 1 — Sprint 19a (ship-blocking, ~$5)**
- 3 backgrounds (calm-wander, dream-soft, twilight-reflect)
- 4 items (mushroom, beetle, dream-pillow, puddle)
- 2 particle sets (calm-shimmer, sleep-zzz-glow)
- 4 Cosmo poses (sit-cross-legged, lie-back, sniff-ground, yawn)
- 4 audio cues (chew, hum, snore, sigh) + 1 ambient bed

**Tier 2 — Sprint 19b (~$5)**
- 2 extra backgrounds, 6 items, 4 particle sets, 3 poses, 6 audio + 2 ambient beds

**Tier 3 — Sprint 19c+ (~$5)**
- Long-tail: 3-min "deep trip" hallucination-cascade asset, shadow-twin pose, hiccup/giggle SFX, rare-event interactables.

---

## G. Open questions (for orchestrator)

1. **Suno per biome?** Premium tier required for 3 ambient beds — greenlit or recycle existing slow-bloom-loop?
2. **Mic-blow input greenlit?** Affects whether we need "wind-react" SFX/particles bucket.
3. **fal.ai key budget reset** since 2026-05-02 incident? Need confirmation before kicking off Tier 1 batch.
4. **DNA-validation threshold** — current is 0.18 cosine (memory). Tighten to 0.15 for marketing-grade poses or keep loose for variety?
5. **BiRefNet on backgrounds?** Memory says NO for landscapes — confirm we keep that rule for all 5 background prompts.
6. **Ambient-bed format** — 60-sec loops or 2-min through-composed? Affects Suno credit consumption.
