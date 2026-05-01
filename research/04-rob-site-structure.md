# Reign of Brabant — Site Structure Audit

**Doel**: blueprint voor de Cosmos site, gebaseerd op live `https://reign-of-brabant.nl/` + lokale repo `/Users/richardtheuws/Documents/games/reign-of-brabant/public/` (1:1 met live). WebFetch op homepage bevestigde header-nav.

---

## 1. Sitemap (uit `public/sitemap.xml`)

| URL | Bestand | Priority | Doel |
|-----|---------|----------|------|
| `/` | `index.html` (1536 lines) | 1.0 | Landing / hero / showcase |
| `/play/` | `play/index.html` | 0.9 | De game zelf (canvas + UI) |
| `/het-verhaal/` | `public/het-verhaal/index.html` (1221) | 0.7 | Lore / design bible / pipeline |
| `/updates/` | `public/updates/index.html` (2713) | 0.7 | Visuele changelog / dev-log |
| `/steun/` | `public/steun/index.html` (2628) | 0.8 | Crowdfunding-pagina (lange scroll) |
| `/doneer/` | `public/doneer/index.html` (193) | 0.7 | Korte donatie-stub (placeholder Stripe/Mollie) |
| `/steun/bedankt/` | (route in sitemap, file = `thanks/`) | 0.3 | Post-donation thank you |
| `/thanks/` | `public/thanks/index.html` (102) | 0.3 | Idem (alias) |
| `/roadmap/` | `public/roadmap/index.html` (131) | 0.6 | Funding-tier milestones |
| `/community/` | `public/community/index.html` (67) | 0.5 | GitHub-hub stub |
| `/press/` | `public/press/index.html` (121) | 0.6 | Presskit (factsheet, contact, links) |
| `/deel/` | `public/deel/index.html` (536) | — (geen sitemap entry) | Sharing-pagina (8 platforms) |

**Niet in sitemap maar wel in repo**: `/voice-files/`, `/voice-preview/`, `/voices-audit-*`, `/animation-preview`, `/audio-ab-preview`, `/music-preview` — dit zijn project-specifieke recording/audit-pagina's voor RoB's voice-acting community programma. Niet relevant voor Cosmos.

---

## 2. Header navigatie (consistent over alle pagina's)

```
Logo (32×32 PNG)  |  Spelen  |  Het Verhaal  |  Steun  |  Updates
```

- Sticky-nav verschijnt na hero-section (`IntersectionObserver`, threshold 0.1)
- `/steun/` heeft een extra "Steun nu" CTA-button rechts in de nav (gold)
- `active` class op huidige pagina
- Geen language switcher (NL-only, `<html lang="nl">`)
- Geen search

---

## 3. Homepage (`/`) — sectie-volgorde

1. **Sticky nav** (zie boven)
2. **Hero** — vol-bleed bg parallax, logo met shimmer + 8 ember-particles, inline cinematic player (toggleCinematic JS, `<video>` met progress bar), 3 CTA's: "Speel Nu" / "Het Verhaal" / "Steun het Project". Scroll-hint onderaan.
3. **Showcase** ("Het Spel" — H2 "Vier facties. Een hertogdom. Nul genade.") — 4 faction-cards die linken naar `/play/`
4. **Cinematic preview** — H2 "AI-gegenereerde cinematics", narrow content
5. **Numbers grid** — H2 "In cijfers", 8 stats met `data-count` JS-counter (33559 regels code, 127 3D modellen, 525 stemmen, 4 facties, 25 missies, 206 tests, 1 persoon, AI). Tagline: *"Een proof of concept. Het beste moet nog komen."*
6. **Aangedreven** — H2, tools (Claude/Meshy/ElevenLabs/etc.) — niet visueel verwerkt op homepage maar wel als section-label
7. **Over Richard** — bio + 4 externe links (`niefokkemeebrabant.nl`, `ondernemenindekempen.nl`, `theuws.com`, `theuws.com/games`). Foto-placeholder met initialen "RT" (TODO comment in source — geen echte foto).
8. **CTA banner** — "Het Hertogdom heeft versterkingen nodig", 2 buttons (Steun + Speel)
9. **Footer** — 4 links: Spelen, Het Verhaal, Steun, GitHub. Tagline "Nie Fokke Mee Brabant", copyright.

**Meta/OG (homepage)**: title, description, og:image (`/assets/og/og-landing.jpg`, 1200×630), twitter:summary_large_image, hreflang nl, JSON-LD VideoGame + BreadcrumbList schema, canonical, theme-color `#0a0806`. Umami analytics op `analytics.reign-of-brabant.nl`.

**JS-features**: parallax scroll, IntersectionObserver voor sticky nav, `data-reveal` / `data-reveal-stagger` animations, count-up animations, cinematic toggle.

---

## 4. `/updates/` — primair referentiepunt voor Cosmos

**Hero**: kleine label "Development Log", H1 "Wat is er nieuw?", subtitel "Elke update, elke verbetering, elk nieuw model."

**Layout**: één lange `.timeline` div met `<article class="update">` items, **nieuwste boven** (top item v0.55.0–v0.56.0 → laatste item v0.17.0).

**Per-entry format** (allemaal hand-geschreven HTML, géén SSG/CMS):
```html
<article class="update">
  <div class="update__card">
    <div class="update__header">
      <span class="update__version">v0.55.0 – v0.56.0</span>
      <span class="update__date">30 april 2026</span>
      <h2 class="update__title">Easy is écht easy — en workers verzamelen op één druk op de knop</h2>
    </div>
    <div class="update__body">
      <div class="update__tags">
        <span class="tag tag--gameplay">Gameplay</span>
        <span class="tag tag--feat">Feature</span>
        <span class="tag tag--ui">UI</span>
      </div>
      <h3>EASY VOELT NU OOK ECHT EASY</h3>
      <ul class="update__highlights"><li>...</li></ul>
      <h3>TWEE NIEUWE HOTKEYS VOOR WORKERS</h3>
      <ul class="update__highlights"><li>...</li></ul>
    </div>
  </div>
</article>
```

**Tag-vocabulaire** (CSS-class-based kleuren): `tag--gameplay`, `tag--feat`, `tag--fix`, `tag--ui`, `tag--visual`, `tag--audio`, `tag--campaign`. Versie-ranges (`v0.55.0 – v0.56.0`) groeperen sprints.

**Sortering**: nieuwste boven, hand-geordend in HTML. Geen filter-UI, geen tag-filter, geen pagination, geen "load more", **geen RSS/Atom feed** (gegrep'd: 0 hits op `feed`, `rss`, `atom`).

**Onderaan**: link naar GitHub voor "volledige changelog" + footer. Geen newsletter-CTA op deze pagina.

**Cosmos-implicatie**: dezelfde structuur 1:1 herbruikbaar. Voor Cosmos kunnen we de `<article>`-template scripten (read CHANGELOG.md → emit HTML) zodat we niet hand-coderen.

---

## 5. Donatie-flow

Twee parallelle pagina's:

### `/steun/` — full crowdfunding-experience (2628 lines)
11 secties:
1. **Hero** — typewriter ("Het Gouden Worstenbroodje is gestolen…"), parallax bg, logo, stats-bar, 2 CTA's
2. **Het verhaal** — split layout, world-map image
3. **Facties** — "Kies je kant"
4. **AI Pipeline** — "Hoe bouw je een koninkrijk met AI?"
5. **Cinematics**
6. **Stemmen** — "Ze praten. In dialect."
7. **Visie** — "Stel je voor…"
8. **Donate widget** (`#steun`) — *de echte donatie-flow*:
   - Worstenbroodje-counter (gamified): klik 1 / 5 / 10 / 25 / 50 / "anders…" → `EUR-amount` (worstenbroodje × €2)
   - 4 betaalmethoden: **iDEAL** (primary) / Creditcard / Bancontact / PayPal — alle via **Mollie hosted checkout**
   - 2 crypto-opties: **Bitcoin** + **Ethereum** met QR + adres + copy-to-clipboard
   - Notice: *"Betaling via Mollie — veilig en vertrouwd"*
9. **Milestones** — "Zes systemen die jouw steun mogelijk maakt": Aftiteling / Voice Studio / Custom Hero (25+) / Building Adoption (50+) / Factie Sponsoring (contact) / Cinematics (contact)
10. **FAQ** — 7 vragen (Is dit een echte game?, Waar gaat het geld naartoe?, WarCraft-kloon?, Crypto?, Stopt project?, Geld goed besteed?, Meebouwen?)
11. **Share section** — 8 platform-knoppen (WhatsApp / Facebook / LinkedIn / Telegram / X / Discord / Reddit / Copy-link)
12. **Footer**: 4 links + disclaimer "Eventuele gelijkenis met bestaande consultancy firms is volkomen bedoeld."

**Sticky floating CTA** rechtsonder ("Doe mee" → `#steun`).

### `/doneer/` — minimale stub (193 lines)
- 3 vaste bedragen (€5 Koffie / €10 Support / €25 Boost) — alle 3 momenteel `aria-disabled="true"` met "Binnenkort"
- "Waar gaat het naartoe?" lijstje
- Privacy-card + nieuwsbrief opt-in **via mailto-link** (geen embedded form)
- Comment in source: *"Zet de echte links erin zodra ze live staan."* — Stripe/Mollie hosted checkout placeholders

**Trigger-paden naar donatie**:
- Homepage hero CTA "Steun het Project" → `/steun/`
- Homepage CTA banner → `/steun/`
- Homepage footer-link → `/steun/`
- Sticky-nav (overal) → `/steun/`
- Roadmap nav → `/doneer/`
- `/steun/` zelf gebruikt anchor `#steun` (sticky floating button)

---

## 6. Content-strategie elementen

| Element | Aanwezig? | Locatie |
|---------|-----------|---------|
| Press/media kit | Ja | `/press/` — One-liner, Factsheet, Links, Contact, Suggested angle (regional), Notes |
| Roadmap | Ja | `/roadmap/` — 5 funding-milestones (€1k → €50k) met deliverables + transparantie-blok |
| About/dev-team | Ja | Inline op homepage ("Over Richard"), géén aparte pagina |
| Crowdfunding-status | Ja | Inline op `/steun/` (milestones-section), geen live-progress-bar |
| Legal (privacy/terms/cookies) | **Niet als aparte pagina** | Korte privacy-blurb inline op `/doneer/`. Geen `/privacy/`, `/terms/`, `/cookies/` |
| Newsletter signup | **Mailto-link only** | `/doneer/` heeft `mailto:richard@theuws.com?subject=…opt-in` link. Geen Mailchimp/ConvertKit/embedded form |
| Social links | Discord (placeholder `discord.gg/`), GitHub | Footer + share-section |
| Share-flow | Ja, twee niveaus | Volledige `/deel/` pagina (8 platforms) + share-section onderaan `/steun/` |
| Community | Stub | `/community/` (67 lines) — verwijst alleen door naar GitHub |
| OG/Twitter meta | Ja, per-pagina unieke OG-images | `/assets/og/og-landing.jpg`, `og-steun.jpg`, `og-press.jpg`, `og-community.jpg`, `og-bedankt.jpg` |
| JSON-LD schema | Homepage only | VideoGame + BreadcrumbList |
| Analytics | Umami self-hosted | `analytics.reign-of-brabant.nl/script.js` op alle pagina's |
| Music player / language switcher / embedded video | Music nee, language nee, video alleen via `<video>` element in hero | — |

---

## 7. Niet bereikbaar / niet bestaand (expliciet)

- **Geen RSS/Atom feed** voor `/updates/` (statische HTML)
- **Geen Patreon, Buy Me A Coffee, Ko-fi, Liberapay** — alleen Mollie (iDEAL/CC/Bancontact/PayPal) + crypto + de mailto-newsletter
- **Geen tier-system met recurring subscriptions** — alleen one-time donations gegamificeerd via worstenbroodje-counter
- **Geen `/privacy/` of `/terms/` aparte pagina**
- **Geen live-funding-progress-bar** (zoals Kickstarter/IndieGoGo widgets)
- **Geen comments / forum / login** — community = "ga naar GitHub"
- **Geen real photo van Richard** (placeholder met "RT" initialen, TODO-comment)
- **Discord-link is placeholder** (`https://discord.gg/` zonder slug)

---

## 8. Adoption Plan voor Cosmos

### 1:1 overnemen (template-clone)
- **Sitemap-skeleton**: `/`, `/play/`, `/updates/`, `/het-verhaal/` (→ rename naar `/about/` of `/lore/`), `/steun/` of `/support/`, `/press/`, `/deel/` (→ `/share/`), `/thanks/`
- **Sticky-nav patroon** (5 links + brand logo, IntersectionObserver toggle)
- **Updates-template** (`<article class="update">` met header/version/date/title/tags/highlights). Sterk advies: schrijf `scripts/changelog-to-html.mjs` die `CHANGELOG.md` parseert → `public/updates/index.html` genereert. RoB doet dit nog hand-matig en dat is niet schaalbaar.
- **CSS-design-tokens**: vervang RoB's `--gold/--brabant/--randstad/etc.` met Cosmos-kleuren maar houd het tokens-stelsel + Cinzel/Inter/JetBrains Mono fonts
- **`data-reveal` / `data-reveal-stagger` scroll-animations** + parallax hero
- **Numbers-grid** sectie met count-up JS (asset-counts/mission-counts/etc.)
- **Footer-pattern** (4 links + tagline + copyright)
- **OG/Twitter meta + JSON-LD VideoGame schema** per-pagina, 1200×630 OG-images
- **Umami analytics-loader** (zelfde Umami instance hergebruiken)
- **Sitemap.xml + robots.txt + structured-data.json** patronen

### Aanpassen voor single-game-site
- **Geen "4 facties"-showcase** — Cosmos is single-protagonist (pak een ander hook: "1 cosmonaut, 7 werelden, 0 mercy" of vergelijkbaar)
- **Donatie-flow**: behoud Mollie-integratie + worstenbroodje-equivalent (bv. "stardust"/"fuel-cells" als gamified currency-counter), maar drop crypto voor MVP — niet de target-audience. Eén echte Stripe Payment Link genereren via `mcp__MCP_DOCKER__create_payment_link` is sneller dan Mollie-account opzetten als die er nog niet is.
- **Het Verhaal**: hernoemen naar `/lore/` of `/about/`, behoud de pipeline-section ("Hoe het werkt") — uitstekende showcase voor AI-tooling
- **Press**: factsheet-velden aanpassen (genre = adventure i.p.v. RTS, platform, key features)
- **Updates-tags**: vervang `tag--campaign` met Cosmos-relevante tags (`tag--puzzle`, `tag--exploration`, `tag--narrative`, etc.)
- **About-pagina als losse route** in plaats van inline-section — geeft meer ruimte voor Richard's verhaal + foto (eindelijk een echte foto invoegen, niet de RT-placeholder herhalen)

### Skip voor MVP
- `/community/` — 67-line stub zonder echte content. Skip totdat er Discord/forum is.
- `/voice-files/`, `/voices-audit-*` — RoB-specifiek voice-recording programma, niet relevant
- Crypto donaties (BTC/ETH met QR + copy) — nice-to-have maar veel UI-werk voor weinig conversie
- Aparte `/doneer/` naast `/steun/` — RoB heeft nu een onverklaarde dubbeling. Cosmos: één donate-pagina (`/support/`), klaar.
- Sticky-floating "Doe mee" CTA — eerst kijken of de gewone nav-button volstaat
- 8-platform share-section + aparte `/deel/` pagina — start met 4 (WhatsApp / X / LinkedIn / Copy-link) inline op `/support/`, breid uit als share-traffic dat rechtvaardigt
- Newsletter via mailto — vervang óf met echte Mailchimp/Buttondown form, óf laat helemaal weg voor MVP. Mailto is half-baked.

### Concrete eerste-sprint deliverable
Bouw 4 pagina's in deze volgorde, allemaal op basis van de RoB-templates:
1. `/` — hero + showcase + numbers + about + CTA (kopieer `index.html`-skelet)
2. `/play/` — game-canvas wrapper (kopieer nav + minimale styling)
3. `/updates/` — timeline-template + autogenerator-script vanuit `CHANGELOG.md`
4. `/support/` — Mollie-of-Stripe single-bedrag (dan later tier-uitbreiding)

Daarna pas `/lore/`, `/press/`, `/share/`, `/thanks/`.

---

## Bronnen

- Live homepage via WebFetch; lokale repo bevat alle 12 sub-pages
- `/Users/richardtheuws/Documents/games/reign-of-brabant/public/sitemap.xml`
- `/Users/richardtheuws/Documents/games/reign-of-brabant/public/updates/index.html` (2713 regels, hand-coded, geen RSS)
- `/Users/richardtheuws/Documents/games/reign-of-brabant/public/steun/index.html` (Mollie + BTC/ETH) + `/doneer/index.html` (placeholder)
