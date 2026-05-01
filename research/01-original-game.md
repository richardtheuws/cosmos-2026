# Cosmo's Cosmic Adventure (1992) — Original Game Reconstruction

**Bron**: Apogee / 3D Realms — March 1992, MS-DOS shareware.
**Credits**: Todd Replogle (programmer), Stephen Hornback (art), Bobby Prince (music).
**Engine**: voorloper Duke Nukem II — deelt VOL/STN/MNI formats.

---

## 1. Core Mechanics

### Suction-Cup Hands (signature)
Cosmo's handen zijn zuignappen — hij blijft aan **elke vertical wall** hangen door tegen het oppervlak te drukken. Spring + cling + opnieuw springen = verticale wallclimb. Werkt op walls, **niet op ceilings**. Onthult verborgen gebieden boven schermrand. Onderscheidt Cosmo van Commander Keen / Mario.

### Movement
- Run + jump (single jump, geen double jump).
- Spring/trampolines verhogen jump height drastisch (beat-jumps over kloven).
- Hovercraft (rocket/scooter) geeft tijdelijk vlieg-vermogen (E1 L3 heeft een verborgen scooter).
- Geen acceleration physics zoals Sonic — strakke arcade-feel met constante run speed.
- Pijltjes omhoog/omlaag = camera **pannen** (kijken naar boven/beneden) — cruciaal want sterren liggen vaak boven schermrand.

### Damage Model
- **3 health units** (hartjes/power modules) als startwaarde.
- Elke enemy/hazard contact = -1 health.
- Power-Up Modules herstellen +1.
- **2 verborgen cheeseburgers per episode** verhogen max HP naar 5 (permanent voor die episode).
- **Vallen in chasm = direct level restart** (instant death, geen HP-verlies).
- Geen invincibility frames in klassieke zin — wel kortstondige invincibility cubes/spheres als pickup.

### Lives, Continues, Save
- **Onbeperkt levens** — geen "Game Over" door HP-verlies.
- **Geen checkpoints binnen levels** — bij dood verlies je alle stars/collectibles van dat level.
- Save-anywhere via 9 save slots (`COSMO*.SV1` – `COSMO*.SV9`).
- Cheat: `[C][0][F10]` simultaan = full health + 9 bombs (eenmalig per game).

### Combat
- **Stomp**: spring op enemies om ze te killen (Mario-stijl). Sommige vereisen 2 stomps (Blue Ball met parachute).
- **Bombs**: max 9 dragen; Alt/Option-key plaatst bom; vertraagde explosie van paar seconden; kan walls (Monuments — 3 bombs nodig), Eye Plants en enemies vernietigen. Kan Cosmo zelf raken bij te dichtbij staan. Bom-rij werkt als lont (vuurbal-trigger van beide kanten).

---

## 2. Levels & Wereld

### Structuur
- **3 episodes × 10 levels = 30 levels totaal** + bonus rooms.
- **Lineair**: één level na ander; per level horizontaal scrollend met verticale exploratie.
- **3-layer parallax scrolling** (background, midground, foreground).
- 8×8 pixel tiles; 16-color EGA op 320×200.

### Episode-thema's
- **Episode 1 — Forbidden Planet**: alien tropics (jungle), haunted forest met creepy trees + ghosts (L4), green-tube teleporters (L5), industrial machinery (L7-L8), crashed ship omgeving. Eindigt met Cosmo opgeslokt door blob-creature.
- **Episode 2 — Inside the Creature**: organische binnenkant (vlees-tunnels, zuren, slijm), met machine-elementen (L5, L7-8). Geen bosses; pure platforming. Duke Nukem cameo in L7. Eindigt: Cosmo ontsnapt + bereikt city.
- **Episode 3 — The City**: industriële alien-stad — fabrieken, conveyors, mechanische adversaries. Alle levels na L2 zijn machine-zwaar. Final boss (zelfde sprite als E1 boss). Ending: ouders waren nooit in gevaar; familie naar Disneyland.

### Bonus Rooms
- 25 stars verzameld → toegang tot **bonus level 1**.
- 50 stars → toegang tot **bonus level 2** (betere prijzen).
- Bonus rooms gevuld met scoring items, geen vijanden.

### Iconische Level-Momenten
- E1 L3 verborgen **scooter/hover** voor flight section.
- E1 L4 haunted forest met Boo-achtige Ghosts die alleen bewegen als je wegkijkt.
- E2 L7 **Frozen Duke Nukem** in ijsblok — bom hem vrij, hij geeft cheeseburger en zegt "watch out for Duke Nukem II".
- Hint Globes (groene zwevende bollen) — geven tip-text bij contact, of 12.800 punten als je ze opblaast.

---

## 3. Vijanden & Hazards

### Enemy Types (uit Cosmodoc actor-database)
**Klassiekers**: Red Chomper (1 stomp), Blue Ball/Parachute Creature (2 stomps), Hopping Cabbage Creature, Red Jumper, Suction Feet Creature, Pink Worm, Dragonfly, Flying Wisp, Flying Roamer Slug, Spitting Turret, Spitting Wall Plant, Eye Plant (+1 bom als je hem opblaast), Clam Plant, Tulip Launcher, Red Heart Plant.

**Spook/Ghost-familie**: Ghost (Boo-expy: beweegt naar Cosmo als hij wegkijkt), Jumping Baby Ghost, Baby Ghost Egg.

**Mechanisch (E3)**: Sharp Spike Robot, Electric Beam Robot, Jump Pad Robot, Bouncy Robot, Octo Gunner, Stone Head Crusher, "Two Tons" Crusher, Large Circular Saw Blade.

**Boss**: één unieke boss-sprite, hergebruikt in E1 én E3 als final boss.

### Environmental Hazards
Floor Spikes (statisch + retracting), Bent Floor Spikes, Wall Spikes, Pyramid Spikes, Bear Trap, Falling Floor Block, Force Field Beam, Spark, Small/Intermittent Flame, Green/Red Liquid Leak, Mystery Wall Block, Floating Moon, Flashing Ball Projectile, Fireball Projectile, Armed Bomb, Idle Bomb, Exit Monster.

---

## 4. Items & Power-Ups

### Pickups
- **Stars** — primaire collectible (25/50 thresholds voor bonus rooms).
- **Power-Up Module** — +1 HP (bij full HP = bonuspunten).
- **Bombs** — combat/wall-breaking item.
- **Fruits/Veg**: Green Tomato, Red Tomato, Pear, Brown Pear, Onion, Grapes, Gourds, Three Bananas, Red Leafy Vegetable, Candy Corn, Headdress, Orange Bottled Drink. Allemaal score-prizes.
- **Gems**: Green Emerald, Transparent/Cyan Diamond, Red Berry Diamond, Gray Octahedron, Blue Emerald, Yellow Diamond — hoge score.
- **Cheeseburger**: 2x verborgen per episode → +max-HP. Ook beloning bij Duke-rescue.

### Power-Ups
- **Invincibility Cube / Sphere** — kortstondige onkwetsbaarheid.
- **Shield Cube** — variant.
- **Headphones** — vermoedelijk audio/Easter-egg.

### Score Bonuses (geheim)
- Stomp 10 enemies zonder grond te raken = **50.000**.
- Blow up 15 Eye Plants in één level = **50.000**.
- Stomp alle barrels + baskets in een level = **50.000**.
- Hint Globe opblazen = **12.800**.
- Power-up oppakken op full HP = bonus.
- Stompen op parachute creatures = bonus.

---

## 5. Story & Karakters

### Plot
Cosmo is een klein alien-jongetje dat met zijn ouders op weg is naar **Walt Disney World** voor zijn verjaardag. Een komeet raakt hun ruimteschip — ze maken noodlanding op planeet **"Zonk"** voor reparaties. Cosmo gaat verkennen; bij terugkeer zijn zijn ouders weg. Hij denkt dat ze gevangen zijn door een **gevaarlijke blob-creature** in de diepten. **E1**: jacht over Zonk-oppervlakte. **E2**: opgeslokt door reuzenmonster, ontsnapping van binnenuit. **E3**: industriële stad — vindt ouders, die nooit in gevaar waren. Familie viert verjaardag bij Disney World. Toon: kind-vriendelijk, sci-fi cuteness, lichte humor.

### Cosmo Design
Klein groen alien-jongetje, **rode vlekken/spots** op huid, **antenne** op hoofd, **Bart-Simpson-achtige overbite**. Twee uitstekende handen met **zuignappen** als signature silhouet. Geen schoenen — kleine voetjes. Korte, gedrongen lichaamsverhouding (kid-proportions: groot hoofd, klein lijf — chibi-style).

### NPC's
- **Cosmo's ouders** — alleen in cutscenes, zelfde alien-design.
- **Duke Nukem** — cameo in E2 L7 (frozen).
- **Hint Globes** — sprekende objecten met tips.

---

## 6. Art Direction

- **EGA 16-kleuren palette** @ 320×200, 8×8 tiles.
- **Sfeer per episode**:
  - E1: warm + organisch — groens, browns, paars (alien jungle), donkere blauwen (haunted forest), grijs metaal (industrieel).
  - E2: vlezig + viscous — roze, rood, paars, slijmgroen.
  - E3: koud industrieel — staalblauw, oranje hot lights, mechanische sprites.
- **3-layer parallax** geeft diepte-illusie zonder echte 3D.
- Sprites cartoonish, ronde silhouetten, vriendelijke expressies.
- Achtergronden bevatten alien-flora (organic plants, eye-stalks), kristallen, hi-tech panelen, glowing tubes.

---

## 7. Audio

- **Componist**: Bobby Prince (ook Doom, Duke Nukem, Wolfenstein 3D).
- **Hardware**: AdLib music auto-detect; PC Speaker SFX. Originele MIDI in Sequencer Plus Gold → IMF.
- **19 tracks**: Tush (titelthema, ZZ Top cover), Just About Going Wacky, Drums, Run Away, Teck 4, Caves, Devo, Easy 2, Da Do Da, Scarry, Bells, Tek World, Cosmo's Foggy Cosmic Breakdown, Rock It, Easy Level, Teck 2, Teck 3, Circus, Boss.
- **Stijl**: rock/funk fusion, banjo-touches, carefree/zany. Bobby Prince had volledige creative freedom.
- **Iconische SFX**: zuignap-pop bij wallcling, sproing bij jump, ploink bij pickup, splat bij stomp, fizz bij bom.

---

## 8. Speciale Features

- **Hint Book** = Hint Globes in-game (geen losse handleiding-puzzles); fysieke hint sheet was apart product van 3D Realms.
- **Save-anywhere** via 9 slots, maar **geen mid-level checkpoint** — perfectionisme afgestraft.
- **Difficulty curve**: E1 introduceert mechanics rustig; E2 escaleert verticaal platformen + claustrofobische tunnels; E3 vereist precision + bomb-management. Bonus rooms blijven optional.
- **Replayability**: secret 50K bonuses + 2x cheeseburger zoektocht + bonus rooms drijven herhaalspeel.

---

## Iconic Moments to Preserve (must-have voor 2026 remake)

1. **Suction-cup wallclimb** — moet de signature feel houden: tegen muur drukken → "plop" SFX → klimmen via spring+cling+spring. Dit is Cosmo's identiteit.
2. **Look-up/down camera pan** — sterren boven het scherm verstoppen blijft de exploratie-beloning.
3. **Hint Globes** — sprekende bollen die tips geven (of bonus geven bij vernietiging). Moderniseren met voice-lines.
4. **Frozen Duke Nukem cameo** — als Easter egg in een industriële level. Vervang eventueel door iconisch karakter uit eigen portfolio (cross-over met Reign of Brabant?).
5. **Hidden cheeseburgers** voor max-HP upgrade — perfecte completionist-beloning, makkelijk te moderniseren.
6. **Bonus rooms via star-thresholds** (25/50) — geen tijdslimiet, pure score-paradijs. Houdt arcade-DNA intact.
7. **Bobby Prince soundtrack-stijl** — funky rock + banjo + AdLib-character. Remake moet remixen, niet vervangen. Tush-cover als titelthema is niet-onderhandelbaar.
8. **Final-boss-as-blob** met de plot-twist: ouders waren nooit in gevaar. Komische ontknoping naar Disney-trip.

**Ontwerprisico**: in 2.5D (3D parallax + 2D plane) moet de wallcling tactiel blijven. Three.js camera moet nooit zo "draaien" dat de 2D collision-plane verbroken wordt. Behoud strakke 8×8-grid feel onder Meshy-3D-achtergronden — zoals New Super Mario Bros U doet.

---

**Update**: 2026-04-30 — **Bronnen**: Wikipedia, Cosmodoc, ModdingWiki, VGMPF, StrategyWiki, 3D Realms hint sheet, TV Tropes, Duke Nukem Wiki, MobyGames.
