# Wave 24 — Universe 1: The Mushroom Forest (deepened to 2 alive rooms)

> Design canvas for human review. NOT production code. Held to NORTH-STAR, the Dweller Lens, the locked brand/visual/language gate, and the §3 substrate schema (mirrored from the live `universes/forest/` JSON + `behavior.ts`).
>
> **Continuity note (do not break):** The Clearing is LIVE — blue/white trampoline, painted Cosmo billboard, eyeball-sentry watching, floating-star sparkle. Deep Grove is partially live (breathing-portal at the far edge per `behavior.ts`). The-hollow's mouth-pillar was retired 2026-05-05 (NORTH-STAR §4 brave-reconsideration: 4 incoherent painted frames, do not revive). This canvas **deepens The Clearing** and **brings Deep Grove to full Sims-density** as the contrasting second room. The-hollow stays a declared-quiet stub (out of scope this wave; the graph edge remains valid).

---

## 1. UNIVERSE IDENTITY

**Name (English shown to player):** *The Mushroom Forest*
(`displayNameEn` keeps the existing nav-suffix: "The Mushroom Forest — Cosmo's entry Universe".)

**One-line soul:** The first breath — a sun-warmed clearing under a canopy that slow-blooms nectar, where a little uncanny creature has made a home and will bounce for you if you ask.

**The dweller question it answers (why visit):**
- *Beautiful* — yes. Mushroom-cream light filtering through a moss-sage canopy, nectar catching saffron-glow as it drips. The most welcoming frame in the whole substrate; the room you'd screenshot.
- *Fun* — yes. The trampoline is the canonical delight-loop: walk Cosmo over, he bounces, trick-spins layer on, he settles. Free, skill-less, repeatable, juicy every time.
- *Strange* — quietly. An eyeball on a stalk watches you bounce. A portal breathes in the grove. Nothing leaps out; the weirdness is peripheral, the way a forest is full of eyes you only half-see. (Calm baseline; peaks on events only.)

This is the **home** — the room a first-time visitor lands in. It must be the warmest, least demanding, most obviously "a place someone made with love." It seeds building by being *legible*: you can feel a builder chose this trampoline, placed that eyeball, hung that star.

**Sensory signature (how it differs from Ink-Ocean & Universe-3 at a glance/listen):**
- *Glance:* horizontal, grounded, warm-lit, daytime. Cream sky, sage floor, a clear horizon line. Where Ink-Ocean is vertical/suspended/ink-dark and U3 is vast/sparse, the Forest is **intimate-but-open** — a held breath of warm air. Two contrasting rooms within it: the Clearing reads *open + sunlit*; Deep Grove reads *enclosed + underglow-dim*, the same canopy seen from beneath.
- *Listen:* the only universe whose bed is **warm + organic-acoustic** (felt mallets, breath, wood). Ink-Ocean is submerged/filtered; U3 is wind or crystal-hum. The Forest sounds like *shade on a warm day*.

---

## 2. THE TWO ROOMS

### ROOM A — **The Clearing** *(LIVE — deepened, full continuity preserved)*

**Felt arrival (first 3 seconds):**
You arrive through a 1.4s saffron→ink-aubergine nebula-portal (the existing `forestArrival`, hue 0.62). The portal-bloom dissolves and you're standing in warm cream light. A canopy of slow-bloom mushrooms arches overhead; a single fat bead of nectar swells on a cap and falls — *plip* — into the moss. Cosmo is already here, mid-stretch, blinking his bulging chameleon eyes at the light. Down at z-2, the blue-and-white trampoline waits, its membrane gently breathing (the existing hover-bob). Up and to the right, a small floating-star turns. And on its stalk to the right, an eyeball-sentry slowly rotates to look at *you*. You feel: *welcomed, slightly watched, safe.*

**PALETTE:**
- **Foreground:** moss-sage ground plane, mushroom-cream trampoline highlights (the live blue/white classic stays — it is the shipped delight-object), faded-rose spots echoing Cosmo's body on the nearest mushroom caps.
- **Mid:** Cosmo (green body, faded-rose spots, saffron-crescent catchlight), the eyeball-sentry, mushroom-cream caps with moss-sage gills.
- **Background:** sky-wash horizon graduating up into mushroom-cream; soft forest-deep at the canopy edges for depth.
- **Pop-accent (≤5%):** **pop-magenta** — ONLY on the nectar-bead the instant it catches the light before it falls (a single 0.4s glint), and a hairline magenta rim on the floating-star. Total frame coverage well under 5%, and only on event-peaks.

**SOUND:**
- *(a) Ambient bed — Suno prompt sketch:*
  > "Beatless warm drone, ~52 bpm felt-pulse (no percussion), soft felted vibraphone + breathy low flute + distant wood-chimes, sun-through-leaves mood: welcoming, open, gently curious, Hayao-calm watercolor, loopable seamless, headphone-intimate, low-key, no melody-hook — just a slow breathing pad."
  > loop: yes · target LUFS: quiet (sits under SFX) · length: 90s seamless · ships to `public/assets/audio/music/slow-bloom-loop.mp3` (the bed name already referenced in `behavior.ts`).
- *(b) Event sounds (ElevenLabs SFX):*
  1. **Trampoline bounce peak** → "soft taut membrane *boing* with a felted wooden core and a brief saffron-shimmer tail, organic not rubbery, ~550ms; each successive bounce slightly higher-pitched then settling." (Tied to `onUse` → `bounce` clip.)
  2. **Nectar-drip** → "a single round wet *plip* into soft moss, with a tiny crystalline overtone, ~300ms." (Ambient-life peak, fires ~every 18–30s, randomized — the room's idle heartbeat.)
  3. **Eyeball-sentry turn** → "a slow wet ocular *creak*, like a leather iris widening, very soft, ~700ms." (Fires when the sentry rotates to track Cosmo/player — see inhabitant below.)
- *Calm→peak→settle curve:* baseline = bed + occasional drip. Peak = the player triggers the trampoline; bounce SFX stacks for the 2–4 bounce cycle while trick-spin pitch rises, then the final settle SFX descends and the bed re-emerges. The room returns fully to calm within ~3s. **Nothing peaks unprompted except the gentle drip.**

**VIBE (pocket-escape test):** Emotional register = *arrival, shelter, gentle welcome.* Holds a 12-min metro ride because there's always something small to notice (the drip, the star's turn, the sentry tracking you) and one thing to *do* (bounce Cosmo) that rewards every tap without ever demanding skill or attention. Drift-in: Cosmo stretches, idles, occasionally wanders to the trampoline **on his own** (see below) — he lives whether you act or not.

**INTERACTABLES (1–2):**

1. **The Trampoline** *(LIVE — example #1, kept exactly; deepened only in juice).*
   - *Object:* the shipped blue/white painted trampoline (`organic-flesh-trampoline.png` lineage, now the classic blue/white per v2.2.9). On-brand, painted, no placeholder. Anchored at `room.anchor` z-2.0, range 2.0 (mirrors `ForestTrampoline`).
   - *onUse → clips:* `walkTo` → `walk` clip → on arrival `bounce` clip (loop, 2–4 cycles) with **procedural trick-spins** (rollZ/pitchX) layered on top per cycle, then `idle` settle. Optionally a `wink` one-shot on the final landing ("got it").
   - *Calm-baseline `update`:* the membrane hover-bob (existing `TrampolineSpots.update`) — breathing, not bouncing.
   - *Event-peak:* the bounce cluster + rising SFX + magenta-nectar glint sympathy-firing once at apex.
   - *Visitor feels:* delight + the small pride of "I made him do that," repeatable forever. The seed-building hook: *"a builder placed ONE object and it gives this much joy — what's my one object?"*

2. **The Sunbeam Patch** *(NEW interactable — deepens the room).*
   - *Object:* a painted shaft of warm light spilling through a canopy gap onto the moss — a soft mushroom-cream/saffron-glow watercolor pool on the ground (a painted decal plane, faintly animated dust-motes drifting in it; NOT a particle gimmick, just slow painterly motes). Anchored ~x+2.5, range 1.6.
   - *onUse → clips:* `walkTo` → on arrival `stretch` clip (one-shot, "waking/limbering in the warmth"), then settles to `idle` *inside* the beam where his catchlight brightens. If used again immediately → `look` up at the canopy gap.
   - *Calm-baseline `update`:* the dust-motes drift; the beam's intensity breathes ±4% on a ~9s sine (matches the breathing-portal cadence — the world breathes).
   - *Event-peak:* a soft warm swell — the bed brightens a touch, the saffron-glow blooms, Cosmo's catchlight peaks for the stretch. Settles in ~2s.
   - *Visitor feels:* tenderness; the urge to "let him rest a moment." A second, *slower* loop that contrasts the trampoline's energy — proof a room can hold two delight-tempos.
   - *Animation request:* none new — `stretch` + `look` cover it.

**COSMO here (idle/dweller behavior):** Default `idle` near the anchor. Autonomous micro-life on a slow random timer (every ~20–40s, only when the player is idle): occasionally `walk`s to the trampoline and does a *single* unprompted `bounce` then returns (he's a dweller — he plays alone); occasionally drifts into the Sunbeam Patch and `stretch`es; occasionally `look`s up when a nectar-drip falls. He notices the eyeball-sentry with an occasional `look` toward it, holding a beat — the uncanny acknowledgement. **Never** more than one autonomous action per cycle; the baseline stays calm.

**SUBSTRATE DATA — `rooms.json` entry (Room A, conformant, continuity-preserved):**
```json
{
  "id": "clearing",
  "area": "the-mushroom-stand",
  "displayName": "The Clearing",
  "displayNameEn": "The Clearing",
  "description": "A soft mushroom-cream open space where Cosmo arrives. The trampoline and a warm sunbeam patch live here.",
  "anchor": { "x": 0, "y": 0, "z": 0 },
  "cameraBounds": { "panRangeX": 1.6, "panRangeY": 0.6 },
  "biomeKey": "slow-bloom",
  "exits": [
    { "to": "deep-grove", "via": "left-mushroom-path", "distance": 12 },
    { "to": "the-hollow", "via": "down-burrow", "distance": 8 }
  ]
}
```
*behavior.ts hook:* extend `forestInteractables(ctx)` to return `[ForestTrampoline, SunbeamPatch]` when `ctx.room.id === 'clearing'`. `SunbeamPatch` is a new `InteractableHandle` (painted decal plane + breathing `update` + `stretch`/`look` `onUse`). No background override (stays biome-based, `slow-bloom`). Sentry-track behavior added to `eyeball-sentry` inhabitant `update` (see Room A inhabitant note).

---

### ROOM B — **Deep Grove** *(contrasting room — underglow hollow beneath the same canopy)*

**The contrast:** Same forest, same canopy — but seen from *underneath*, deeper in, where the light has to fall further. Where the Clearing is open + sunlit + horizontal, Deep Grove is **enclosed + dim + intimate**, lit from below by glowing fungus. This is the "deep-grove / underglow hollow" the brief asked for, and it keeps full continuity with the live `breathing-portal` already placed there.

**Felt arrival (first 3 seconds):**
You walk in from the left mushroom-path (biome-blend, see §3). The cream light is gone; now everything is moss-sage shadow lit from the *ground* up by clusters of glow-cap mushrooms pulsing a slow sky-wash blue-green. Tall slow-bloom stems rise out of frame. At the far edge, the breathing-portal swells and shrinks — a soft inhale you can almost hear. Nectar still drips, but slower, landing in a small dark pool that ripples with faint light. Cosmo arrives mid-`look`, eyes catching the underglow. You feel: *hushed, curious, a held breath, the good kind of small.*

**PALETTE:**
- **Foreground:** moss-sage glow-cap clusters (the light source), ink-aubergine shadow-pools, a dark reflective nectar-pool.
- **Mid:** Cosmo (his faded-rose spots and saffron catchlight now the warmest things in frame — he *glows* against the cool), tall mushroom stems.
- **Background:** forest-deep canopy underside, sky-wash bleeding faintly through gaps far above; the breathing-portal at the far edge.
- **Pop-accent (≤5%):** **pop-cyan** — ONLY in the brightest core of a glow-cap pulse at its peak (a momentary cyan-hot center, ~0.5s per pulse cycle, one cap at a time) and a single cyan glint on the portal's inhale-apex. Cool counterpart to the Clearing's warm magenta. Stays well under 5%, event-peak only.

**SOUND:**
- *(a) Ambient bed — Suno prompt sketch:*
  > "Beatless low drone, ~46 bpm felt-pulse, deep bowed-double-bass harmonic + soft glass-bowl resonance + distant dripping water with reverb-tail, underground hush, cool and luminous, slightly mysterious but never tense, Moebius-calm, loopable seamless, headphone-intimate, sub-bass warmth, no melody."
  > loop: yes · LUFS: quiet · 90s seamless · ships to `public/assets/audio/music/deep-grove-loop.mp3`.
  > *Distinct from the Clearing bed:* lower, cooler, more reverb — the same forest one octave down and indoors.
- *(b) Event sounds (ElevenLabs SFX):*
  1. **Glow-cap pulse peak** → "a soft glassy *bloom-hum* rising and falling, like a wet wineglass rim swelling with light, ~900ms, cool-toned." (Fires on the brightest cap's pulse apex — the room's slow heartbeat, ~every 6–10s, one cap.)
  2. **Portal inhale** → "a deep slow organic *inhale*, breath-through-a-cave, with a faint cyan shimmer at the top of the breath, ~1.2s." (Tied to the breathing-portal inhabitant's scale-pulse apex.)
  3. **Pool-ripple** → "a single low watery *bloop* with a long luminous ring-out, ~600ms." (Fires when the slow nectar-drip lands; the Clearing's bright *plip* gone deep and round.)
- *Calm→peak→settle:* baseline = the low bed + slow cap-pulses. Peak = the **Echo-Cap interactable** (below) — when Cosmo touches a glow-cap it brightens hard (pop-cyan core), the bloom-hum swells, the neighboring caps answer in a soft cascade down the line, then all settle back to baseline over ~3s. A gentle call-and-response, never a combo, never scored.

**VIBE (pocket-escape test):** Register = *quiet wonder, intimacy, the cave you don't want to leave.* Holds the metro ride by being the *opposite* tempo of the Clearing — you come here to slow down further. There's always the slow cap-pulse to watch and the portal breathing; one thing to do (light the caps) that's hypnotic and skill-free. Drift-in: Cosmo will wander and `look` at the portal, or sit and `idle` in the glow, on his own.

**INTERACTABLES (1–2):**

1. **The Echo-Cap (glow-cap cluster)** *(NEW — Deep Grove's delight-loop, the trampoline-analog of this room).*
   - *Object:* a cluster of painted glow-cap mushrooms (moss-sage caps with luminous undersides), the nearest one being the interactable. Painted, on-brand, no placeholder. Anchored ~x-1.0 (in front of the breathing-portal's x-1.4), range 1.8.
   - *onUse → clips:* `walkTo` → `walk` → on arrival `duck` clip (Cosmo crouches to press a hand-disc to the cap's underside — suction-cup DNA in play), then `look` up as the light blooms. The touched cap flares pop-cyan; a soft cascade lights the neighbors in sequence.
   - *Calm-baseline `update`:* each cap pulses its underglow on a slow offset sine (the breathing world); pool ripples on drip.
   - *Event-peak:* the touch → bright cyan flare + bloom-hum swell + cascade down the cluster + the bed momentarily brightens. Settles over ~3s. Repeatable; each touch re-lights.
   - *Visitor feels:* the gentle magic of "I touched it and the forest answered." A *contemplative* delight-loop (vs. the Clearing's energetic one) — proving the universe spans two emotional tempos. Seed-building hook: *"a delight-loop doesn't have to be loud."*
   - *Animation request:* none new — `duck` + `look` cover the crouch-and-touch beautifully.

2. **The Breathing Portal** *(LIVE inhabitant → promoted to soft interactable, continuity-preserved).*
   - Currently a non-interactable inhabitant (scale-pulse only, `behavior.ts`). Deepen it into a *gentle* interactable: `walkTo` → on arrival `wave` clip (Cosmo greets the portal — the "hello to an inhabitant" reading), the portal's inhale-apex syncs to his wave and glints pop-cyan once. **No traversal happens** — it's a greeting, not a door (the actual universe-portal is §4; this in-world portal is decor that *acknowledges* you). Calm-baseline = the existing breathing scale-pulse. Peak = the synced inhale + cyan glint on `wave`. Visitor feels: *the world noticed me back.*
   - *Animation request:* none — `wave` is shipped.

**COSMO here (idle/dweller behavior):** Default `idle`, his catchlight the warmest point in the cool room. Autonomous micro-life (player-idle, ~25–45s timer): occasionally `walk`s to a glow-cap and `duck`s to light it himself (the dweller plays alone in the dark); occasionally `look`s slowly toward the breathing-portal and holds; occasionally `stretch`es in a pool of underglow. Slower cadence than the Clearing — he's calmer down here. He never leaves on his own.

**SUBSTRATE DATA — `rooms.json` entry (Room B, conformant, continuity-preserved):**
```json
{
  "id": "deep-grove",
  "area": "the-mushroom-stand",
  "displayName": "Deep Grove",
  "displayNameEn": "Deep Grove",
  "description": "An underglow hollow beneath the same canopy. Glow-cap mushrooms pulse from the ground; a breathing-portal swells at the far edge.",
  "anchor": { "x": -12, "y": 0, "z": 0 },
  "cameraBounds": { "panRangeX": 1.4, "panRangeY": 0.5 },
  "biomeKey": "slow-bloom",
  "exits": [
    { "to": "clearing", "via": "right-mushroom-path", "distance": 12 }
  ]
}
```
*Note on `biomeKey`:* kept as `"slow-bloom"` to preserve the live parallax/world paint and avoid a new biome registry entry this wave. The underglow mood is achieved via a **room-level moodOverride is NOT available at room scope** (moodOverrides live at the Area tier and the Forest area is `null`). Two conformant options for the dimmer mood, both inside the locked palette — recommend **Option A**:
  - **Option A (recommended, no schema change):** add the glow-cap lighting + cool tint as part of the Deep Grove `inhabitants`/`interactables` layer (additive glow-cap planes that supply the underglow), leaving the shared `slow-bloom` background intact. Cleanest; one Area; no new biome. The contrast is authored *in the room's content*, not the biome.
  - **Option B (only if the dim must be global to the room):** introduce a `slow-bloom-underglow` biome key (a re-tinted variant of the `slow-bloom` composition-spec — cooler, lit-from-below) and set `biomeKey: "slow-bloom-underglow"`. This is a heavier lift (new composition-spec + PNG layers) and is **deferred unless review wants the deeper visual split**. Per "one biome fully alive beats three half-alive," Option A ships the contrast now.

*behavior.ts hook:* extend `forestInteractables(ctx)` to return `[EchoCapCluster, BreathingPortalGreeting]` for `ctx.room.id === 'deep-grove'`. The existing `breathing-portal` inhabitant stays (its scale-pulse becomes the calm-baseline the greeting-interactable syncs to). Add glow-cap inhabitant planes (the cluster + cascade light) via `forestInhabitants` filtered to `deep-grove`.

---

## 3. INTRA-UNIVERSE TRAVERSAL (The Clearing ↔ Deep Grove)

Both rooms are in the **same Area** (`the-mushroom-stand`) → the substrate auto-runs **biome-blend** (Room↔Room, continuous, 1.5–3.0s). The Forest already overrides exactly this one path via `forestRoomToRoom` → `MushroomPathTransition` (2.0s). We keep that override (matching the "override one path, not all" ratio the bible warns about).

**What it looks/sounds like:** The player triggers the exit (`left-mushroom-path` from the Clearing). Over 2.0s the mushroom-path flavor plays: the canopy appears to *lower* and *darken* — the cream light drains down into moss-sage shadow as the two rooms' moods lerp continuously (`pathExperience.ambient` `#F5EDD8` tints the blend, `kind: "mushroom-path"`). Spore-motes drift at hip height (the documented Wave-22 TODO in the live code — recommend landing it this wave as the visible signature of the walk). Audio: the Clearing bed cross-fades down into the Deep Grove bed; the *plip* deepens into the *bloop* across the blend. At **t=0.5** Cosmo's position is set so he "lands" in the new room already wearing the new mood (per the bible's biome-blend rule). On arrival in Deep Grove he plays the `look` clip (catching the underglow). Reverse (Deep Grove → `right-mushroom-path` → Clearing): the light *rises*, the bed brightens, he arrives mid-`stretch` (waking back into the sun).

**Cosmo on arrival:** Clearing → `stretch` (waking into light) on first entry, else `idle`. Deep Grove → `look` (noticing the glow).

---

## 4. PORTAL (Universe ↔ Universe entry/exit)

The Forest is the **home universe** — the room a cold-start visitor lands in, and the place other Cosmos arrive when they visit *you*. Universe↔Universe = **portal** (ceremonial, 1.4s), within the nebula-portal precedent already shipped as `forestArrival`.

**Entry/leave identity (ceremonial look + sound):**
- *Look:* the existing **NebulaPortal** — saffron→ink-aubergine swirl with a faded-rose-tinted nebula, hue `0.62` (the calm-baseline preset). On *entry* it blooms open from a point of saffron-glow into the full Clearing; on *exit* (your Cosmo leaving to visit another universe) it collapses the Clearing inward into the same point. The portal is the literal "your Cosmo visits my world / my Cosmo visits yours" moment — so the Forest's portal should feel like *a warm door opening onto a sunlit room*: the most inviting of the three universes' portals (Ink-Ocean's will be a cold descent; U3's will be a vast threshold).
- *Sound:* a rising **saffron-shimmer swell** (ElevenLabs: "a warm ascending chord-bloom with a soft chime-cluster and a breath of wind-through-leaves, ~1.4s, welcoming, no impact-hit") into the Clearing bed. On exit, the same chord descends and the bed fades.
- *Substrate:* `forestArrival` already returns `{ kind: 'portal', duration: 1.4, hue: 0.62 }`. No change needed for entry. Leaving is the substrate's default universe-portal (no `transitions.universeToUniverse` override — keep it default; the Forest's ceremony lives in the *arrival* warmth, which is enough).

---

## 5. SUBSTRATE FILES (full proposed, conformant to §3 schema)

### `universes/forest/manifest.json`
```json
{
  "$schema": "https://cosmos-2026.dev/schemas/manifest-1.1.json",
  "version": "1.1",
  "name": "forest",
  "displayName": "The Mushroom Forest",
  "displayNameEn": "The Mushroom Forest — Cosmo's entry Universe",
  "summaryEn": "A watercolor cosmic-mushroom forest in the Hayao×Moebius idiom — Cosmo's home and the entry Universe. Two living rooms under one canopy: the sunlit Clearing with its trampoline and a warm sunbeam to rest in, and the underglow Deep Grove where glow-caps answer your touch and a portal breathes in the dark.",
  "author": "Richard Theuws",
  "license": "MIT",
  "behaviorModule": true,
  "defaultArea": "the-mushroom-stand",
  "brandDeviation": null,
  "assets": [
    { "type": "image", "path": "../../public/assets/backgrounds/biome-slow-bloom-4k.png", "preload": true },
    { "type": "image", "path": "../../public/assets/objects/eyeball-sentry.png", "preload": false },
    { "type": "image", "path": "../../public/assets/objects/breathing-portal.png", "preload": false },
    { "type": "image", "path": "../../public/assets/objects/floating-star.png", "preload": false },
    { "type": "image", "path": "../../public/assets/objects/organic-flesh-trampoline.png", "preload": false },
    { "type": "image", "path": "../../public/assets/objects/sunbeam-patch.png", "preload": false },
    { "type": "image", "path": "../../public/assets/objects/glow-cap-cluster.png", "preload": false },
    { "type": "audio", "path": "../../public/assets/audio/music/slow-bloom-loop.mp3", "preload": true },
    { "type": "audio", "path": "../../public/assets/audio/music/deep-grove-loop.mp3", "preload": false }
  ],
  "post": {
    "preset": "calm-baseline",
    "intensityCurve": { "bloom": 1.0, "kaleido": 0.85, "fluid": 0.9, "chroma": 1.0 }
  }
}
```
> Changes vs live: dropped retired `mouth-pillar-sheet.png` (inhabitant retired 2026-05-05); added `sunbeam-patch.png`, `glow-cap-cluster.png` (new interactables, lazy), and the two audio beds (Clearing bed `preload:true` → DefaultAudio loops it at 0.45; Deep Grove bed lazy, swapped on room-enter via the `audio` handle). `summaryEn` updated to describe the deepened 2-room state. All else preserved.

### `universes/forest/areas.json`
```json
{
  "$schema": "https://cosmos-2026.dev/schemas/areas-1.0.json",
  "version": "1.0",
  "entryArea": "the-mushroom-stand",
  "areas": [
    {
      "id": "the-mushroom-stand",
      "displayName": "De paddenstoelenstand",
      "displayNameEn": "The Mushroom Stand",
      "description": "The slow-bloom heart of the forest. A sunlit clearing and an underglow grove under one breathing canopy, threaded by a drifting nectar-spore path.",
      "moodOverrides": null,
      "pathExperience": {
        "kind": "mushroom-path",
        "duration": 2.4,
        "ambient": "#F5EDD8",
        "description": "Walking under a canopy that breathes; spore-motes drift at hip height; the light lowers into shadow (or rises back into sun) as the next room fades in through the leaves."
      },
      "rooms": ["clearing", "deep-grove", "the-hollow"]
    }
  ]
}
```
> Changes vs live: `description` + `pathExperience.description` updated to reflect the sunlit↔underglow light-shift across the path. `displayName` stays Dutch (allowed at this field per the language gate). One Area (per AREA-AUTHORING "when unsure, one Area" — the two moods are authored in room content, not a palette-split Area). `the-hollow` remains a member (declared-quiet stub, valid graph node).

### `universes/forest/rooms.json`
```json
{
  "$schema": "https://cosmos-2026.dev/schemas/rooms-1.1.json",
  "version": "1.1",
  "entryRoom": "clearing",
  "rooms": [
    {
      "id": "clearing",
      "area": "the-mushroom-stand",
      "displayName": "The Clearing",
      "displayNameEn": "The Clearing",
      "description": "A soft mushroom-cream open space where Cosmo arrives. The trampoline and a warm sunbeam patch live here.",
      "anchor": { "x": 0, "y": 0, "z": 0 },
      "cameraBounds": { "panRangeX": 1.6, "panRangeY": 0.6 },
      "biomeKey": "slow-bloom",
      "exits": [
        { "to": "deep-grove", "via": "left-mushroom-path", "distance": 12 },
        { "to": "the-hollow", "via": "down-burrow", "distance": 8 }
      ]
    },
    {
      "id": "deep-grove",
      "area": "the-mushroom-stand",
      "displayName": "Deep Grove",
      "displayNameEn": "Deep Grove",
      "description": "An underglow hollow beneath the same canopy. Glow-cap mushrooms pulse from the ground; a breathing-portal swells at the far edge.",
      "anchor": { "x": -12, "y": 0, "z": 0 },
      "cameraBounds": { "panRangeX": 1.4, "panRangeY": 0.5 },
      "biomeKey": "slow-bloom",
      "exits": [
        { "to": "clearing", "via": "right-mushroom-path", "distance": 12 }
      ]
    },
    {
      "id": "the-hollow",
      "area": "the-mushroom-stand",
      "displayName": "The Hollow",
      "displayNameEn": "The Hollow",
      "description": "A small burrow under the ground — intentionally quiet for now (Cosmo + parallax). Reserved for a future coherent inhabitant.",
      "anchor": { "x": 0, "y": -3, "z": 0 },
      "cameraBounds": { "panRangeX": 1.2, "panRangeY": 0.4 },
      "biomeKey": "slow-bloom",
      "exits": [
        { "to": "clearing", "via": "up-out", "distance": 8 }
      ]
    }
  ]
}
```
> Changes vs live: `clearing.description` adds the sunbeam patch; `deep-grove.description` rewritten as the underglow hollow; `the-hollow.description` made explicit about its declared-quiet status (the §1 Sims-density exception "deliberate stillness allowed only if declared"). All ids, areas, anchors, cameraBounds, biomeKeys, and exit graph **preserved** for share-link / continuity safety.

### `behavior.ts` hooks summary (no new ParallaxScene — ever)
- `forestInteractables(ctx)`: `clearing` → `[ForestTrampoline, SunbeamPatch]`; `deep-grove` → `[EchoCapCluster, BreathingPortalGreeting]`; else `[]`.
- `forestInhabitants(ctx)`: `clearing` → eyeball-sentry (+ new sentry-track in `update`) + floating-star; `deep-grove` → breathing-portal + glow-cap cluster planes; `the-hollow` → `[]` (declared quiet).
- `forestAudio`: on `enter` route Clearing bed; on room-enter to `deep-grove` swap to `deep-grove-loop` (crossfade); reverse on return. (Runtime-wirer forwards to `AudioFFTBridge`.)
- `background`: still **OMITTED** (biome-based, single shared `ctx.parallax`). Do not add a background override for the Forest.
- `transitions.roomToRoom`: keep `MushroomPathTransition`; recommend landing the spore-mote + light-lower overlay this wave (the documented TODO).

---

*Held to NORTH-STAR. No score, no win, no beat. Calm baseline; the world breathes, it does not shake. All in-game text English. No emoji, no placeholder, no stock.*
