# Cosmos Cosmic Adventure 2026 — Visual Directions

**Status**: Brainstorm / promptcraft. Geen assets gegenereerd.
**Datum**: 2026-04-30
**Brief**: 2D gameplay, 3D parallax, heavy post-FX, "Alice in Wonderland x DMT-trip"
**Bron**: Cosmo's Cosmic Adventure (Apogee, 1992)

Drie art-direction varianten. Sprites gaan na generatie door BiRefNet remove-bg (memory-regel: Flux levert nooit transparante achtergronden). Backgrounds opaque. Anti-patronen uitgesloten: emoji's, generieke cute platformer, Roblox-blokken, Among-Us silhouetten, AI-slop.

---

## Variant A — "Saturated Dream"

**Mood**: Lisa Frank x Yume Nikki op een suikerhoge bad-trip. Vrolijk-dreigend: alles glimlacht, niets is veilig.

**Palette**: `#FF2D95` Hot Magenta Scream / `#7AFF3D` Toxic Lime Pulse / `#00E5FF` Cyan Hallucination / `#FFD400` Acid Sun Yellow / `#B026FF` UV Blacklight Purple / `#FF6F00` Tangerine Burn / `#0B0030` Deep Void Indigo

### Sprite prompts (Flux Dev — `square_hd`)

**Cosmo (hero)**: `2.5D platformer hero, Cosmo small big-eyed alien with two long suction-cup feet, hot-magenta antennae glow, oversized cyan goggles reflecting acid-yellow stars, fluo toxic-lime skin gradient, chunky slightly chibi not cute-cliche, side-view facing right, crisp dark-indigo outline, neutral grey card, ultra-saturated fluo palette, NO emoji/Roblox/Among-Us`

**Enemy — Snickerblat**: `fanged cotton-candy spider-creature, hot magenta floss-fur body, six toxic-lime spindly legs with acid-yellow stiletto tips, oversized UV-purple eyes with cyan pupils, dripping sugar-saliva, smiling-too-wide, side-view battle pose, crisp indigo outline, neutral grey card, NO emoji/generic-spider/cute-mascot`

**Platform tile — Sugarstone**: `modular 128x128 platform tile of fluorescent crystallised candy-rock, hot magenta veins through toxic-lime core, glossy wet-candy top edge, cyan ooze stalactites dripping bottom, deep indigo shadow underside, tileable left-right, crisp dark outline, neutral grey card, NO real-stone/Minecraft/emoji`

**Collectible — Dreamgem**: `faceted six-sided gem core glowing acid yellow to UV-purple outer facets, hot magenta inner light pulse, six floating toxic-lime sparkle motes, soft cyan halo bloom, neutral grey card, painted edge, ultra-saturated, NO diamond/loot-crate/emoji`

**Hazard — Acid Geyser**: `vertical column of fluorescent toxic-lime acid splashing up with hot magenta foam crown, cyan and acid-yellow droplets arcing outward, deep indigo base pool with boiling bubbles, side-view single keypose, crisp painted edge, neutral grey card, NO realistic-water/emoji`

### Background prompts (Flux Pro v1.1 — `landscape_16_9`)

**Bloomroot Veld (jungle)**: alien jungle, giant translucent fluo-magenta mushroom-trees, toxic-lime vines with acid-yellow puffballs, cyan pollen mid-plane, distant UV-purple spore-clouds, indigo sky + acid-yellow double sun, three depth layers, painted edge vignette, chiaroscuro from below, Lisa Frank x Yume Nikki, no characters/UI/text.

**Glowgut Caverns (cave)**: hot magenta crystal stalactites from indigo ceiling, toxic-lime bioluminescent lichen, cyan underground river casting caustics, acid-yellow firefly swarm in depth, distant UV-purple cavern mouth, three depth layers, painted vignette, ominous-yet-cheerful, no characters/UI/text.

**Halo Spire (sky)**: floating alien sky temple at sunset, foreground UV-purple pillars with hot-magenta glowing inscriptions, levitating toxic-lime platforms in cyan cloud sea, distant acid-yellow gas-planet with ribbons on indigo horizon, three layers strong parallax, painted edge vignette, dreamlike serene, no characters/UI/text.

### Post-FX
1. **Bloom + chromatic aberration heavy** — fluo-highlights bloeien (threshold 0.8, intensity 1.6), RGB-split op UI/hazards, BPM-pulse modulator.
2. **Kaleidoscope edge-tunnel** — bonus/power-up viewport 6-fold spiegelen rondom, midden blijft normaal. Kort (3-5s).

### Audio
Suno **hyperpop / kawaii-bass** — `bubblegum-distortion`, `pitched-up vocal chops`, `sub-bass throb 110bpm`. Sophie meets Toby Fox.

### References
Lisa Frank trapper-keepers - Yume Nikki (Kikiyama, 2004) - Hyper Light Drifter (Heart Machine, 2016).

---

## Variant B — "Cosmic Watercolor"

**Mood**: Ghibli-aquarel die te lang in een Moebius-paddenstoelbos wachtte. Zachte inkt-bleeds, organisch, mystiek zonder schreeuwen.

**Palette**: `#E8D5B7` Mushroom Cream / `#7B9E89` Moss Sage / `#4A6FA5` Sky Wash Blue / `#B85C7E` Faded Rose Bleed / `#3D2E4A` Ink Aubergine / `#F4A261` Saffron Glow / `#2D4A3E` Forest Deep

### Sprite prompts (Flux Dev — `square_hd`)

**Cosmo (hero)**: `hand-painted watercolor 2.5D platformer hero, Cosmo a soft-edged moss-sage alien with two long suction-cup feet, large gentle dark eyes with saffron catchlight, faded-rose cheek wash, ink-line underdrawing visible through transparent watercolor layers, side-view facing right, ink aubergine ragged outline that breaks, organic wet-edge bleeds, neutral cream card, Ghibli x Moebius, no Roblox/chibi/airbrush/emoji`

**Enemy — Brumberry**: `sentient overripe forest-deep berry with three faded-rose tendrils ending in ink-aubergine beaks, single sleepy eye dripping a saffron tear, moss-sage sepals as crown, soft wet-edge bleed silhouette, side-view threat pose, ink underdrawing through, Ghibli watercolor with Moebius linework, neutral cream card, no emoji/cute-mascot/airbrush`

**Platform tile — Mossbark**: `modular 128x128 watercolor platform tile, forest-deep ancient bark with moss-sage colonies on top, faded-rose lichen patches, mushroom-cream cracked underbark bottom, ink aubergine ragged outline, paper-grain texture, organic wet-edge bleed, tileable left-right, neutral cream card, Ghibli-Moebius, no photoreal-stone/Minecraft/emoji`

**Collectible — Dewdrop**: `translucent saffron-glow droplet with inner sky-wash-blue swirl, faded-rose halo bleed, soft ink aubergine broken-line on lower edge only, four floating dust-motes, paper grain, neutral cream card, hand-painted not airbrush, no emoji/diamond/loot-icon`

**Hazard — Choke-Spore**: `billowing cloud of ink-aubergine spore-mist rising from a forest-deep cracked vent, faded-rose particles drifting outward, saffron warning glow at source, ragged ink underdrawing through wet bleeds, side-view, neutral cream card, Ghibli-Moebius, no realistic-smoke/cartoon-poof/emoji`

### Background prompts (Flux Pro v1.1 — `landscape_16_9`)

**Slow Bloom (jungle)**: mystical alien mushroom forest, translucent moss-sage canopy mushrooms foreground, mushroom-cream trunks with faded-rose lichen, sky-wash-blue mist mid-plane, distant ink-aubergine ridge silhouette, saffron sunbeams diagonally, three depth layers, paper grain + wet-edge bleeds, ink underdrawing through, Ghibli x Moebius x Yokoo Tadanori, contemplative, no characters/UI/text.

**Inkpool Hollow (cave)**: vast underground hollow, ink-aubergine pool reflecting saffron bioluminescent moss on forest-deep walls, mushroom-cream stalactites dripping rose pigment, sky-wash-blue mist on water, distant opening with soft saffron daylight, three depth layers, paper grain + wet bleed edges + ink linework, Moebius-Ghibli, no characters/UI/text.

**Cloud Cathedral (sky)**: weathered alien sky temple in pastel cloud layers, mushroom-cream stone arches with faded-rose mineral streaks foreground, mid-plane sky-wash-blue clouds with saffron-edge from below, distant ink-aubergine spire silhouettes, three depth layers, paper grain, wet-edge bleeds at horizon, Castle in the Sky x Moebius Arzach, dreamy-still, no characters/UI/text.

### Post-FX
1. **Paper-grain dither + soft bloom** — fixed paper-grain noise (intensity 0.15) + zachte bloom op hooglichten. Aquarel-textuur consistent in motion.
2. **Fluid distortion lite** — wet-edge ink-bleed shader op moving sprites en parallax-lagen. Amplitude 1-2px, trage frequency.

### Audio
Suno **acoustic-folktronica / ambient-koto** — `field-recording crickets`, `wooden flute high register`, `analog tape hiss`. Hisaishi x Boards of Canada.

### References
Studio Ghibli Mononoke / Spirited Away - Moebius Arzach - Hollow Knight (Team Cherry, 2017).

---

## Variant C — "Glitchwave Synth"

**Mood**: VHS-tape die in een 1989 Casio brandt terwijl een Beeple-render uitlekt. Vaporwave, scan-lines, retro-futurisme dat constant kapotgaat.

**Palette**: `#FF006E` Hot Synth Pink / `#8338EC` Synthwave Purple / `#3A86FF` CRT Cyan / `#06FFA5` Phosphor Green / `#FFBE0B` VHS Amber / `#1A0033` CRT Black / `#F0F0F0` VCR Grey

### Sprite prompts (Flux Dev — `square_hd`)

**Cosmo (hero)**: `low-poly retro-futurist 2.5D platformer hero, Cosmo a small alien with phosphor-green skin and CRT-cyan suction-cup feet, hot synth pink antennae glow, VHS amber visor, faceted polygonal shading 1996 PS1 era, soft chromatic aberration edges, fine scan-line overlay, synthwave-purple rim light, side-view facing right, neutral VCR-grey card, NO emoji/Roblox/Among-Us, NO photoreal`

**Enemy — Static Wraith**: `humanoid silhouette of synthwave-purple broken-CRT static with hot-synth-pink scan-line tear through chest, two phosphor-green pinprick eyes, VHS amber edge-bleed, fragmented chromatic aberration, side-view threat pose, analog tape distortion, neutral VCR-grey card, low-poly silhouette + glitch overlay, NO realistic-ghost/emoji/horror-cliche`

**Platform tile — DataBlock**: `modular 128x128 synthwave platform tile, CRT-black volumetric grid-cube with hot-synth-pink wireframe edges, phosphor-green dot-matrix top face, synthwave-purple internal glow through cracks, fine scan-lines overlay, slight chromatic aberration, tileable left-right, neutral VCR-grey card, retro-futurist Tron, NO Minecraft/photoreal/emoji`

**Collectible — Bytegem**: `faceted low-poly crystal gem, hot-synth-pink core with phosphor-green facets to CRT-cyan tips, animated glitch-flicker via duplicate-offset color channels, VHS amber sparkle motes, scan-line overlay, neutral VCR-grey card, retro PS1-era polycount, NO realistic-gem/loot-crate/emoji`

**Hazard — Killscreen Beam**: `vertical hot-synth-pink laser column with phosphor-green particle scatter, synthwave-purple glow halo, hard CRT-cyan core, scan-line tearing across beam, VHS amber edge-distortion, side-view, neutral VCR-grey card, retro arcade-death-screen, NO realistic-laser/Star-Wars-saber/emoji`

### Background prompts (Flux Pro v1.1 — `landscape_16_9`)

**Wireframe Veld (jungle)**: alien jungle as retro-futurist wireframe vista, hot-synth-pink low-poly fern silhouettes foreground, synthwave-purple wireframe palm canopy with phosphor-green leaf polygons mid-plane, distant CRT-cyan grid horizon under VHS-amber twin-sun, scan-line overlay, chromatic aberration edges, three depth layers, vaporwave + Beeple-lite, no characters/UI/text.

**Phosphor Crypt (cave)**: alien cave as retro arcade neon corridor, CRT-black volumetric pillars with hot-synth-pink neon trim foreground, synthwave-purple stalactites with phosphor-green underglow mid-plane, distant VHS-amber lava pool reflecting on cyan ceiling, scan-line overlay, chromatic edge-bleed, three depth layers, Tron x vaporwave, no characters/UI/text.

**Grid Spire (sky)**: alien sky temple as retro-futurist floating wireframe ziggurat above infinite grid horizon, synthwave-purple pillars with hot-synth-pink data-trace inscriptions foreground, phosphor-green levitating geometric platforms mid-plane, distant VHS-amber halftone sun over CRT-cyan grid, scan-lines, chromatic aberration, three depth layers, vaporwave x Beeple clean, no characters/UI/text.

### Post-FX
1. **CRT scan-line + chromatic aberration permanent** — full-screen rolling scan-line + RGB channel-split op high-contrast edges. Grammatica van de stijl. Lage intensity (split 1px, scan opacity 0.18).
2. **Datamosh / glitch-tear on damage** — bij schade frame freeze + datamosh-tears verschuiven horizontale stroken 200ms. Diëgetisch: het universum is een kapotte tape.

### Audio
Suno **synthwave / vaporwave-arcade** — `analog Juno-pad swell`, `slap-bass + LinnDrum claps`, `pitched-down VHS sample`. Carpenter Brut x Macintosh Plus, 100-120 BPM.

### References
Hotline Miami (Dennaton, 2012) - Beeple (Mike Winkelmann, 2007-) - Macintosh Plus / Floral Shoppe (Vektroid, 2011).

---

## Director's Note — Aanbeveling

Kies **Variant B "Cosmic Watercolor"** als basis, met geselecteerde A+C-elementen als hybride.

**Waarom B**: portfolio leunt al zwaar op neon (RoB, Last Call, Snowboard Rush) en CRT-glitch (3D landing, Wolfenstein). A en C geven direct brand-bleed — Cosmos wordt niet onderscheidbaar. Aquarel-Ghibli-Moebius is zeldzaam in browser-platformers en geeft Cosmos een eigen handtekening. Past beter bij Alice in Wonderland: Tenniel's illustraties zijn ink-line, niet neon. We maken geen DMT-trip — we maken een DMT-droom.

**DMT-component blijft**: puur Ghibli zonder hallucinaire druk wordt gezellig. Importeer uit A: (1) **kaleidoscope edge-tunnel** bij power-ups/boss-intro's (max 5s), (2) **fluo pop-accent** voor collectibles + HUD (`#FF2D95` + `#7AFF3D`), max 5% pixel-budget. Wereld is zacht-aquarel tot hij dat niet meer wil — daar leeft de trip, in de scheur tussen rust en hallucinatie. Uit C: alleen **datamosh-tear (200ms)** bij damage. Geen permanente scan-lines — die slaan de aquarel dood.

**Hybride brief voor de PRD**:
- Base: B voor sprites, backgrounds, UI
- Collectibles + HUD: A fluo-pop-accent (max 5%)
- Power-up state: A kaleidoscope (max 5s)
- Damage: C datamosh-tear (200ms)
- Audio: B hoofdscore. Boss-intro's krijgen 8-bar A hyperpop-stinger in dezelfde toonsoort — contrastieve textuur, niet compositie.

Dit vermijdt vierde neon-game in portfolio, zet vakwerk vooraan (aquarel + ink linework doen AI-image-models in 2026 nog steeds slecht, dus onderscheidend wanneer goed gedaan), dient bronmateriaal eerlijker dan een fluo-explosie.

Bij afkeuring hybride: kies B puur. A+C samen wordt visuele soep. B is de enige variant die zelfstandig draagt.
