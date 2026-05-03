# Lore Migration — Wave 19 plan

Status: brainstorm only. No HTML edited yet.

## A. Current state — wat is spoof-y per pagina

### `index.html` (root marketing)
- JSON-LD `description`: "psychedelische platformer-remake van Cosmo's Cosmic Adventure (Apogee, 1992)" — frames het hele project als remake.
- Footer: "Cosmo is een hommage aan Apogee's Cosmo's Cosmic Adventure uit 1992."
- Hero tagline: "Cosmo's Cosmic Adventure herboren als Tenniel-illustratie..." — leunt zwaar op IP-naam.
- Pitch noemt "alien jongetje", "planeet Zonk", "The Funplex" — directe Apogee-plot.
- Worlds-grid is gestructureerd als "10 Levels — MVP, 1 Boss" remake-frame; conflicteert met de motion-explorer + companion realiteit van v1.3.0.

### `public/lore/index.html`
- Volledige plot is een 1:1-kopie van Apogee's setup: "Funplex", "komeet", "planeet Zonk", "papa zegt: niet weglopen jongen".
- Pullquote "ik ga even de motor checken" is letterlijk Apogee-dialog-cliché.
- "Drie biomes, tien levels, één blob-cliffhanger" — die structuur staat niet meer in de game.
- Cast-grid met Brumberry/Hopper Cabbage/Eye Plant/Blob = directe naamlees van origineel.
- Footer-credit: "hommage aan Apogee's Cosmo's Cosmic Adventure (1992)".

### `public/press/index.html`
- Factsheet-rij `Inspiratie: Cosmo's Cosmic Adventure (Apogee, 1992) — hommage, geen reboot`.
- Suggested angle "Een 90s-platformer in Ghibli-aquarel" — frame is letterlijk "Apogee's 1992-original gerespecteerd in mechanics".
- Title bevat de project-naam, key-art suggesties wijzen naar oude biome-structuur.

### `public/support/index.html`
- "Hint Globe Sponsor"-tier en "Bonus Room Builder"-tier verwijzen naar Apogee-mechanics die niet meer in de game zitten (geen hint-globes, geen bonus-rooms in v1.3.0).
- FAQ-item "Is dit gerelateerd aan Apogee / 3D Realms?" expliciet.
- Hero "aquarel-droom met zuignap-handen" is nog steeds passend, maar de copy is verweven met de remake-frame.
- Mollie/iDEAL/PayPal zijn nog steeds `aria-disabled` placeholders — geen echte Stripe-link live (verifieer voor delete).

### `public/thanks/index.html`
- Vrij neutraal. Enkele referentie: "uit de grond van Zonk's mushroom-cream stronken". Klein.

### `src/*` grep
- Geen hits op "Cosmos 2026 / spoof / parody / 1992 / Apogee / cosmo's cosmic" in `src/`. De game-code zelf is al spoof-vrij. Migratie is puur HTML/marketing.

## B. Nieuwe positionering — drie taglines

1. **"Een aquarel-trip die zichzelf voortzet als jij stilzit."** (life-system + watercolor-DNA, geen drugswoorden)
2. **"Een wezentje uit een herinnering, opnieuw geschilderd in zijn eigen droom."** (1992-DNA abstract, Cosmo als wezen)
3. **"Adem mee. Hij wandelt vanzelf."** (companion + hypnotisch, kort)

**Aanbeveling: #1.** Combineert het visuele brand (aquarel), de Wave 18+ rust-baseline en de Wave 19 Life System-richting in één regel zonder "stoner" plat te benoemen. #2 is een mooie sub-tagline voor de lore-pagina; #3 werkt op `/play/` als loading-text.

## C. Per-page edit plan

### `index.html` (root) — KEEP, herframe
- DELETE: JSON-LD `description` "platformer-remake van Cosmo's Cosmic Adventure (Apogee, 1992)" + `alternateName: "Cosmos 2026"`.
- REPLACE: hero-tagline → tagline #1 (sectie B).
- DELETE: Pitch-paragraaf over "Funplex / planeet Zonk / drie hartjes" — vervang met "Hij ademt. Hij wandelt. Als jij niets doet, blijft hij niet stilstaan."
- DELETE: meta-pill "10 Levels — MVP" en "8 Sprints naar v1.0" (achterhaald sinds 1.3.0).
- ADD: meta-pill "Life System (Wave 19)" en "Motion-controlled".
- KEEP: world-grid (de drie biomes BESTAAN nog als parallax-scenes; alleen de "L1-L10" tags eraf).
- KEEP: About-strip over Richard / toolkit (nog steeds correct).
- DELETE: footer-regel "hommage aan Apogee's Cosmo's Cosmic Adventure uit 1992" + "Built op Three.js + Phaser 4" (Phaser is grotendeels weg).

### `public/lore/index.html` — REWRITE (grootste werk)
- DELETE: Het hele "verjaardagstrip ging mis / Funplex / Zonk / komeet / motorklep" verhaal.
- REPLACE: open met sectie D's snippet.
- KEEP: drie biome-secties als visueel/sfeer-beschrijving — schrap de "L1-L3 / L4-L6 / L7-L10"-tags en mechanic-pufjes ("Hint Globes", "verborgen scooter", "cheeseburger achter monument-wall").
- DELETE: Cast-grid met enemy-namen — er is geen enemy-gameplay meer in de runner-vrije versie. Vervang met "Companion"-sectie: 1 kaartje voor Cosmo, 1 voor de hallucinatie-particles, 1 voor de trampolines.
- DELETE: Final pullquote "Episode 2 — coming when ready".
- KEEP: paper-grain styling, Cormorant-italic h1, biome-imagery.

### `public/press/index.html` — KILL
- Aanbeveling: **deleten**. Reden: een press-kit voor een solo-passieproject zonder release-datum is een onnodige aanvalsvector voor "wat is dit nou eigenlijk"-vragen, en de huidige factsheet bevat 6 regels die niet meer kloppen (Engine, Status, Inspiratie, Genre, Levels, Sprint-count).
- Als Richard hem wil houden: schrappen tot factsheet + contact, geen "suggested angles", geen "remake"-framing. Maar mijn aanbeveling is delete + redirect naar `/lore/`.

### `public/support/index.html` — KEEP, opschonen
- VERIFY FIRST: zijn Mollie-links live? (Ik zag alleen `aria-disabled="true"` placeholders + e-mail-fallback. Geen Stripe-secret-key in de HTML. Veilig om te bewerken.)
- DELETE: Tier "Hint Globe Sponsor" — vervang met "Vibe Sponsor" (sponsor van een Suno-track of biome-particle-set).
- DELETE: Tier "Bonus Room Builder" → "Hallucination Patron" (sponsor een seasonal hallucination-event-pack).
- DELETE: FAQ-item over Apogee/3D Realms.
- ADD: FAQ-item "Is dit een drugsspel?" → eerlijk antwoord: nee, het is een rustig wezen dat zichzelf vermaakt; jij kijkt mee.
- KEEP: stardust-counter, hero-image, "where gaat je geld heen"-strip (klopt nog).

### `public/thanks/index.html` — minor edit
- REPLACE: "uit de grond van Zonk's mushroom-cream stronken" → "uit de aquarel-grond zelf".
- KEEP: alle layout, bouncer-animatie, CTA's.

## D. Backstory snippet (<150 woorden, voor /lore/ open)

> Er was een nacht in een jaar dat we niet meer hoeven noemen waarin iemand een wezentje zag dat er nooit echt was. Klein. Groen. Plakkerige handen. Eén antenne met een knop eraan, alsof het ding aan stond.
>
> Het wezen had geen verhaal. Het was er gewoon, en bleef. Het wandelde door dingen die geen muren waren. Het keek af en toe naar je alsof het wist dat jij ook keek.
>
> Dertig jaar later staat het opnieuw geschilderd, ditmaal in aquarel, op een planeet die niet bestaat behalve op het moment dat je hem aanzet. Hij heet Cosmo. Hij heeft niets nodig van je. Hij wandelt vanzelf. Als je hem aait blost hij. Als je hem laat slapen droomt hij dingen die jij ziet.
>
> Adem mee. Hij blijft niet stil.

(146 woorden. Cormorant-italic in `.pullquote` of `.lore-section p`.)

## E. Open vragen voor Richard

1. **Press-kit**: weg of dunner? (Mijn voorkeur: weg, redirect naar /lore/.)
2. **Stripe / Mollie status**: zijn die links nog steeds placeholder? Zo ja, mogen we de hele iDEAL/CC/PayPal-rij vervangen door één "binnenkort"-block?
3. **Tier-namen**: oké met "Vibe Sponsor / Hallucination Patron" of liever neutraler ("Watcher / Dreamer / Patron")?
4. **Wil je een quote / fragment uit 1992 expliciet meegeven** dat ik mag verweven in de backstory? (Nu is het bewust abstract — "een nacht in een jaar".)
5. **Apogee-credit weghalen**: juridisch is het niet vereist (we waren zelfs zonder hommage al safe), maar wil je een korte "with respect to the original sprite-aliens of the early '90s"-regel ergens onderaan houden, of helemaal niets?
6. **`Cosmos Cosmic Adventure 2026` als naam**: blijft die staan, of wil je ook de title rebranden? (Ik raad aan: laat de URL-slug en titel staan, herframe alleen de copy. SEO + bookmarks blijven heel.)

## F. Risks / dependencies

- **`/updates/`** is auto-gegenereerd uit `CHANGELOG.md` via `npm run updates:build` — NIET handmatig editen. CHANGELOG-tekst is wel safe (technische sprint-notes, geen Apogee-frame).
- **`/support/` payment-links**: Mollie/Stripe niet live (allemaal `aria-disabled`). E-mail-fallback `mailto:richard@theuws.com` blijft werken. Veilig om copy te wijzigen.
- **SEO**: H1 / `<title>` / canonical wijzigen tankt rankings 2-6 weken. Voor een pre-launch passieproject is dat niet erg — flag dit alleen als Richard de huidige rankings wil houden.
- **OG-images**: blijven valide (de biome-renders dekken de nieuwe positionering ook).
- **`alternateName: "Cosmos 2026"`** in JSON-LD: weghalen breekt geen externe links want geen ander systeem leest dat veld actief uit.
- **Logo / favicon**: `cosmo-hero-cleaned.png` is pre-LoRA. Bij rebrand: vervang met `cosmo-hero-lora.png` (Sprint 16A canonical) — buiten scope van migratie maar logisch om in dezelfde wave mee te nemen.
