# Cosmos 2026 — Canonical Style Stem

**Locked**: 2026-05-01 op basis van `_LOCKED-REFERENCE.png` (v4 keyframe — hybrid van v1 cosmic-saturated palette + v3 Moebius woodcut linework)

Deze prompt-prefix wordt LETTERLIJK gebruikt in elke fal.ai-prompt voor in-game assets (sprites, tiles, pickups, enemies, boss). Niet aanpassen tussen assets — consistency is non-negotiable.

## De stem (v4 hybrid — locked)

```
Moebius Arzach woodcut illustration crossed with Tenniel Alice in Wonderland
and Hayao Miyazaki, HEAVY INK LINEWORK with visible ink-aubergine underdrawing
and ragged outlines, BUT filled with SATURATED LUSH WATERCOLOR — cosmic dreamy
luminous palette with glowing magenta-pink fluo-lime electric sky-wash and
saffron-glow accents, paper-grain texture, slightly uncanny psychedelic
illustration, cosmic-adventure mood, NOT dusk NOT dark NOT moody, full
daylight luminous, NOT kawaii NOT chibi NOT pixar NOT cute NOT children-book
NOT roblox NOT digital NOT 3D NOT photoreal, INK LINEWORK COMPULSORY
```

## Per-asset-rider (achter de stem)

Per type asset hangt er een korte rider achter:

### Sprite (character, enemy)
```
[STEM], side-view facing right, neutral grey paper card background, character
fills 70% of frame, full ink-line woodcut definition, wet-edge watercolor
bleeds inside silhouette, NOT centered overlay
```

### Tile / platform / wall (32x32 or 64x64 atlas-tile)
```
[STEM], single isolated tile element on neutral grey card, organic painted
edges that tile flush left+right (no full outline on sides), top edge
prominent ink-line, designed to read as part of larger landscape when
arrayed
```

### Pickup (star, gem, power-up, cheeseburger)
```
[STEM], single floating object on neutral grey card, faint micro-halo,
fluo-pop magenta+lime ring around object only (max 5% of pixels), painted
illustration not icon
```

### Background layer (parallax — per layer, NOT a single composite)
We genereren PER LAGE een eigen image. Vier lagen per biome zodat parallax echt diepte voelt:

**bg-sky.png** (parallax 0.10 — slowest):
```
[STEM], pure cosmic alien sky composition NO foreground NO ground, layered
nebula clouds in cosmic luminous palette, distant glowing planet/moon with
subtle nebula corona, faint star-field, watercolor wet-edge bleeds, paper
grain, 16:9 landscape, NOT moody NOT dusk full luminous daylight, NO
mountains NO trees NO mushrooms NO characters
```

**bg-far.png** (parallax 0.25 — distant horizon, with alpha for sky to show through):
```
[STEM], distant horizon silhouette composition, ink-aubergine mountain
ranges with saffron-glow rim-light, far translucent moss-sage mushroom
canopy hints, atmospheric haze fading to transparent at top, transparent
upper half so cosmic sky shows through, watercolor wet-edge bleeds, paper
grain, 16:9 landscape, NO characters NO foreground flora
```

**bg-mid.png** (parallax 0.50 — mid-distance objects, transparent center):
```
[STEM], mid-distance painted alien forest composition, fluo-lime moss-sage
and faded-rose mushroom-trees scattered, mushroom-cream stems with visible
ink linework, mostly mid-frame and edges (transparent center for gameplay
clarity), watercolor wet-edge bleeds, paper grain, 16:9 landscape, NO
characters
```

**bg-near.png** (parallax 0.85 — foreground frame elements, transparent center):
```
[STEM], foreground frame composition for parallax depth: ink-aubergine
drooping vines and hanging branches at top of frame, bright magenta-pink
glowing mushrooms left-right edges only with fluo-lime moss patches at
bottom-corners, transparent center 70% so gameplay reads clearly, paper
grain heavy outline, NO characters NO sky
```

## Wat we niet meer doen

- Geen "luminous bright pastel" — leverde Pixar-children-book op
- Geen "soft chromatic shimmer" in de prompt — laat post-FX-stack die toevoegen, niet in source-image bakken
- Geen "cute alien" / "friendly creature" — kawaii drift is onze grootste vijand
- Geen "8-fold kaleidoscope" in source — leverde overload op, doen we ook in post-FX

## Validatie-protocol per asset

Na generatie: zet asset in-engine + screenshot + vergelijk met `_LOCKED-REFERENCE.png`. Pass als:

1. ☐ Aesthetic-match: ink linework + ragged outline + paper grain herkenbaar
2. ☐ Palette-match: alleen de locked 7 + (waar relevant) pop-accents max 5%
3. ☐ Style-coherentie: niet duidelijk uit een ander generations-batch
4. ☐ Werkt onder bloom + chroma + grain post-FX (geen oversaturation, geen weggeblazen detail)

3 van 4 = acceptable. 4 van 4 = ship. <3 = regenerate met sterkere stem-emphasis.
