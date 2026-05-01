# RoB Local Repo: Site & Content Structure Analysis

**Date**: 2026-04-30  
**Scope**: Reign of Brabant (`/Users/richardtheuws/Documents/games/reign-of-brabant/`)  
**Goal**: Extract exact structure for Cosmos replication

---

## 1. Folder Organization

### Root Structure
```
reign-of-brabant/
├── index.html                 # Root landing page (entry 1)
├── play/index.html            # Game play page (entry 2)
├── public/
│   ├── steun/index.html       # Donation/support page
│   ├── updates/index.html     # Changelog/updates page
│   ├── het-verhaal/           # Story/about page
│   ├── assets/                # Static assets (images, models, audio)
│   └── [other pages]/         # Press, roadmap, community, etc.
├── src/                       # TypeScript game engine code
├── docs/                      # Internal documentation (PRDs, scripts)
├── package.json               # Build config
├── vite.config.ts             # Vite bundler config
└── CHANGELOG.md               # Master changelog (209KB, manually updated)
```

**Key insight**: Game files (`src/`, `main.ts`) and site pages (`public/`) are **colocated in same repo** but served separately. Root HTML + play HTML are separate entry points in Vite.

---

## 2. Build & Routing

**Build tool**: Vite 6.3.5 (ES2022 target)  
**Package.json scripts**:
- `npm run dev` → Vite dev server (with --host for network access)
- `npm run build` → TypeScript + Vite production build
- `npm run test` → Vitest unit tests
- `npm run test:uat` → Playwright browser tests
- `npm run predeploy` → Runs all tests before deploy

**Vite config** (`vite.config.ts`):
- Multiple HTML entry points: `main` (index.html) + `play` (play/index.html)
- Aliases for TS paths (`@core`, `@systems`, `@ui`, etc.)
- Asset includes: `.glb`, `.gltf`, `.ogg`, `.mp3`, `.wasm`
- Dev proxy for voice-uploads (port 3110)
- CORS headers: `Cross-Origin-Opener-Policy: same-origin`

**Routing**: Static file-based (no SPA router on marketing pages). Each HTML is built/served independently.

---

## 3. PRD & Documentation

**PRD locations**:
- `/PRD.md` (56KB, main spec)
- `/PRD-v1.0.md` (25KB, versioned)
- `docs/SUB-PRD-*.md` (11 detailed sub-specs, 50-140KB each)
  - SUB-PRD-CAMPAIGN, AUDIO, UI-UX, TECHNICAL, etc.
- `docs/POC-*.md` (proof-of-concept docs for architecture, UI, testplan)

**Rendering**: Plain markdown files. No HTML generation pipeline detected. These are **reference docs**, not web pages.

---

## 4. Updates/Changelog Page

**Location**: `/public/updates/index.html` (230KB static HTML)

**Format**: Hand-maintained HTML page with semantic structure:
- Hero section (title, description)
- Timeline of version entries
- Each entry includes:
  - Version number (v0.52.0, v0.51.3, etc.)
  - Release date
  - Markdown-like bullet lists of features/fixes
  - Optional: 3D model viewers (using `<model-viewer>` web component)
  - Optional: Hero portraits (WebP images)
  - Optional: Cinematic images

**Model viewers**: Uses Google's `model-viewer` library (v4.0.0):
```html
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>
<model-viewer src="/assets/models/unit.glb" auto-rotate camera-controls></model-viewer>
```

**Source of truth**: `CHANGELOG.md` is the master changelog (269KB). Updates page is manually synced via commits like "docs: updates-page bijgewerkt met v0.52.0-v0.56.0".

---

## 5. Donation/Support Flow

**Page**: `/public/steun/index.html` (125KB, ~2500 lines)

**Payment methods supported**:
1. **iDEAL** (primary button, pre-selected)
2. **Credit card** (Visa/Mastercard)
3. **Bancontact** (BE)
4. **PayPal**
5. **Bitcoin** (QR code via qrcodejs library)
6. **Ethereum** (QR code)

**Implementation details**:
- QR codes generated client-side via `https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js`
- BTC address: `3AFxMwiymJwdrm31ef5NCBtCuDYUjPR47s` (hardcoded)
- ETH address: `0x6A2EF0e9DFd8d952881dDeEA95bd6857eca73517` (hardcoded)
- Donation amounts: Pre-set tiers (cumulative "broodjes" = worstenbroodjes units)
- No actual payment gateway integration detected (iDEAL/PayPal buttons exist but likely redirect externally)

**Tracking**: Umami analytics (self-hosted at `analytics.reign-of-brabant.nl`)
- Event: `donate_click` with params: method, amount, broodjes
- Event: `steun_page_visit` with referrer

**Thank you flow**: Separate `/steun/bedankt/` folder (thank you page)

---

## 6. Site Structure & Pages

**Public pages** (in `/public/`):
- `steun/index.html` — Donation/support page
- `updates/index.html` — Changelog with 3D viewers
- `het-verhaal/index.html` — Story/about Richard's journey
- `roadmap/index.html` — Future plans & features
- `press/index.html` — Press kit
- `community/index.html` — Community links
- `deel/index.html` — Share/social page (Dutch variant)
- `doneer/index.html` — Donation redirect (Dutch variant)
- `thanks/index.html` — Thank you post-donation
- Plus audit/preview pages (voice-cast, animation, music, voices audit)

**Root pages** (static HTML):
- `/index.html` — Landing page (56KB)
- `/play/index.html` — Game launcher (121KB)

---

## 7. Shared Components & Styling

**Typography** (Google Fonts):
- **Heading**: Cinzel (serif, weights: 400, 700, 900)
- **Body**: Inter (sans-serif, weights: 300-700)
- **Monospace**: JetBrains Mono (for code/addresses)

**Design tokens** (CSS custom properties):
All pages use consistent `:root` tokens:
```css
--bg-abyss: #060504;
--bg-dark: #0a0806;
--gold: #d4a853;
--text-primary: #e8e6e3;
--font-heading: 'Cinzel', serif;
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

**Faction colors** (hardcoded in each page):
- Brabant: #E07020 (orange)
- Randstad: #3498DB (blue)
- Limburg: #27AE60 (green)
- Belgen: #E74C3C (red)

**Sticky navigation**: All pages have `.sticky-nav` component with logo + links. Navigation links are hardcoded per page (no shared component library).

**Scroll reveal animations**: Data attributes (`[data-reveal]`, `[data-reveal-stagger]`) with CSS transitions. JavaScript minimal (only for Umami tracking, payment buttons, QR generation).

---

## 8. Assets Organization

**Static assets** (`/public/assets/`):
```
├── audio/          # Background music, SFX
├── factions/       # Faction-specific imagery
├── models/         # 3D GLB/GLTF files for viewers
├── og/             # OpenGraph meta images
├── portraits/      # Character/unit portraits
├── steun/          # Donation page images (cinematic, faction, hero-banner)
├── ui/             # Logo, icons
└── concepts/       # Concept art
```

**Assets per page**:
- `steun/`: Hero banner video, faction images, cinematic previews
- `updates/`: 3D model files (GLB), hero portraits
- `het-verhaal/`: Faction headers, images

---

## 9. Deployment

**No CI/CD config detected** (no `.github/workflows/`, no `vercel.json`, no `.toml`).

**Assumptions**:
- Manual git push to production
- Server-side build: `npm run build` outputs to `dist/`
- Static files from `public/` are copied during build
- Vite generates optimized bundles in `dist/`

---

## Files to Mirror for Cosmos

| Path | Type | Classification | Notes |
|------|------|-----------------|-------|
| `/index.html` | HTML | **As-is** | Landing page structure + CSS tokens. Change branding/colors. |
| `/play/index.html` | HTML | **Rewrite** | Game launcher. Replace game ID, OG meta. Keep loading screen structure. |
| `/public/steun/index.html` | HTML | **Adapt** | Donation page. Keep payment methods. Replace crypto addresses, QR logic. Add Stripe/Mollie if needed. |
| `/public/updates/index.html` | HTML | **Adapt** | Changelog page. Keep structure + model-viewer integration. Auto-generate from CHANGELOG.md or maintain manually. |
| `/public/het-verhaal/index.html` | HTML | **Rewrite** | About/story page. Replace with Cosmos backstory. Reuse CSS structure. |
| `vite.config.ts` | Config | **Adapt** | Adjust entry points, aliases, asset includes. Keep CORS headers. |
| `package.json` | Config | **Adapt** | Keep build/test/deploy scripts. Keep Vite/TypeScript/Vitest. Add new game-specific dependencies. |
| **Design tokens** | CSS | **As-is** | Copy `:root` token definitions. Adjust faction colors if needed. |
| **Fonts (Google Fonts)** | External | **As-is** | Cinzel + Inter + JetBrains Mono. Same CDN URLs work everywhere. |
| **Sticky nav** | Component | **Adapt** | Reuse `.sticky-nav` HTML + CSS structure. Update nav links per page. |
| **Scroll reveal** | JS/CSS | **As-is** | Copy `[data-reveal]` and transition CSS. No framework needed. |
| **Analytics** | JS | **Adapt** | Replace Umami ID with Cosmos ID. Keep `trackEvent()` pattern. |
| **Favicon** | Asset | **Rewrite** | Create Cosmos logo. Update `<link rel="icon">` on all pages. |

---

## Summary

**Cosmos should adopt**:
1. **Multi-entry Vite build** (root + play landing pages)
2. **Static HTML pages** per route (no SPA overhead on marketing)
3. **Colocated repo** (game engine + website together)
4. **CSS design tokens** for consistency across pages
5. **Hand-maintained CHANGELOG.md** synced to updates page
6. **Payment options** (iDEAL, CC, Bancontact, PayPal + crypto)
7. **Umami self-hosted analytics** for tracking
8. **model-viewer web component** for 3D asset showcases

**Cosmos can skip**:
- Separate deployment config (if same hosting)
- React/Vue components (RoB uses plain HTML)
- Dynamic page generation (templates = extra complexity)
- Multi-language support (RoB Dutch-only; Cosmos can be language-agnostic via separate builds)

