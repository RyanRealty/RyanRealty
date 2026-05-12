# Ryan Realty Design System — Repository Manifest

Canonical source for the Ryan Realty brand system. Ingested 2026-05-12 from the
Claude Design project `b87a4e11-1017-4fb5-bc82-ed8fec1ec568`.

## Read order

1. **`README.md`** — full brand overview (voice, content rules, typography, layout, iconography)
2. **`SKILL.md`** — portable skill manifest (the two-register model, type decision tree, asset cheat sheet)
3. **`colors_and_type.css`** — every CSS var (brand + semantic tokens + three type families + spacing + radii + shadows)

## Two registers

| Register | Use for | Color | Type |
|---|---|---|---|
| **Heritage** | Yard signs, postcards, email banners, IG posts/carousels, door hangers, print, section heroes, any "stamped" moment | Navy `#102742` monochrome on cream `#faf8f4` | **Amboqia Boriango** display |
| **Web / product** | Homepage, search, market hub, dashboards, forms, every UI surface | Navy `#102742` primary on warm stone neutrals | **Geist** sans for UI/body, **Amboqia Boriango** for display/hero H1s |

Never mix the two on the same surface (except a single cross-register hero or footer block).

## Brand colors (hex)

| Token | Hex | Use |
|---|---|---|
| `--rr-navy` | `#102742` | Primary brand navy. Logo, CTAs, headlines, focus intent. |
| `--rr-navy-deep` | `#0a1a2e` | Hover / pressed navy. |
| `--rr-cream` | `#faf8f4` | Warm off-white background for heritage register. |
| `--rr-sand` | `#e8e2d4` | Stone neutral. |
| `--rr-fir` | `#2e4a3a` | Central Oregon forest accent (sparing). |
| `--rr-sky` | `#8fb8d4` | Deschutes sky accent (sparing). |

Semantic web tokens (cards, popovers, muted, foreground, etc.) live in `colors_and_type.css` as `oklch()` values that mirror the existing `app/globals.css` radix-nova base. The chart ramp is monochromatic blue.

## Type families

- `--font-heritage`: Amboqia Boriango (fallback Playfair Display, Didot, Georgia, serif)
- `--font-display`: Amboqia Boriango (fallback Playfair Display, Georgia, serif)
- `--font-accent`: Azo Sans (fallback Geist, system-ui)
- `--font-sans`: Geist (fallback system-ui, -apple-system, 'Segoe UI')
- `--font-mono`: Geist Mono (fallback ui-monospace, Cascadia Code, Menlo)

Font files in `fonts/`:
- `Amboqia_Boriango.otf` — primary display
- `AzoSans-Medium.ttf` — accent (paired with wordmark on certain marketing pieces)

Geist + Geist Mono are loaded via Google Fonts (production uses `next/font/geist`).

## Radii

Base `--radius: 0.625rem` (10px). Ladder:
- `sm` 6px · `md` 8px · `lg` 10px · `xl` 14px · `2xl` 18px · `3xl` 22px

Component mapping: **button/input = lg (10px)**, **card = xl (14px)**, **badge = pill**.

## Shadows (navy-tinted)

All shadows use `rgb(16 39 66 / opacity)` for the navy tint. From light to heavy:
- `--shadow-xs`, `--shadow-sm` (cards), `--shadow-md`, `--shadow-lg` (hero search), `--shadow-xl`
- `--shadow-drop` `0 2px 10px rgb(0 0 0 / 0.15)` for hero H1 drop shadow

## Motion ladder

- 200ms fades · 300ms entrances · 400ms fade-up · 2s loops · 20s Ken Burns
- ease-out entrances, ≤16px travel
- Always respect `prefers-reduced-motion`

## Layout

- Max content width `max-w-7xl` (1280px), centered, `px-4 sm:px-6` gutters
- Sections `py-12`, hero `min-h-[60vh]`
- Grids: 1 → 2 → 4 columns; `gap-4` between cells, `gap-6` between sections
- Cards padding `p-5` / `p-6`
- Heritage moments breathe: 25%+ padding inside any Amboqia-typeset frame

## Focus ring

3px **warm stone** (never navy).

## Asset directory

### `assets/` — web platform essentials

| File | Use |
|---|---|
| `favicon.ico`, `apple-touch-icon.png`, `icon-512.png` | Browser/PWA icons |
| `logo.png` | Web wordmark (navy on cream) |
| `logo-header-white.png` | Reversed wordmark (white on dark) |
| `hero-poster.webp` | Deschutes River through downtown Bend — primary site hero |
| `hero-alpine-clean.jpg`, `hero-applegate-clean.jpg`, `hero-awbrey-clean.jpg`, `hero-bend-alpine.png`, `hero-bend-desktop.png`, `hero-bend-downtown.png`, `hero-deschutes-clean.jpg` | Alternate documentary hero options |
| `team.webp` | Team photo |
| `morgan-data-shuttle-logo.svg`, `oregon-data-share-logo.svg` | Partner marks |

### `assets/brand/` — heritage brand kit

| File | Use |
|---|---|
| `logo-blue.png` | Heritage wordmark — primary navy (print + signage) |
| `logo-black.png` | Heritage wordmark — 1-color print |
| `logo-white.png`, `logo-stacked-white.png` | Heritage wordmark — reversed for dark backgrounds |
| `ryan-realty-stacked-logo-blue.png`, `ryan-realty-stacked-logo-white.png` | Stacked variants |
| `illustration-01.png` | Primary stacked wordmark (no dog) |
| `illustration-02.png` – `illustration-04.png` | Numbered heritage wordmark variations |
| **`illustration-05.png`** | **Signature lockup**: "Ryan Realty · It's About Relationships · BEND OREGON" with beer-glass hand on left and blue lab on right |
| `illustration-06.png` – `illustration-14.png` | Additional heritage variations (9 more) |
| **`blue-dog.png`** | **Jax** the blue lab mascot, full color |
| `white-dog.png`, `white-dog-trans.png` | Mascot — white variant for dark backgrounds |
| `lab.png` | Larger / hi-res mascot |
| `scene-tower.png` | Tower Theater marquee scene (heritage decorative) |
| `scene-water-pageant.png` | Historic downtown scene (heritage decorative) |
| `tagline-its-about-relationships.jpg` | Tagline lockup standalone |
| `email-banner.png` | Email header banner |
| `ig-highlight-community.png`, `ig-highlight-swan.png` | Instagram highlight covers |
| `yard-sign.png` | Yard sign artwork |
| `postcard-magnet.png` | Postcard / magnet artwork |
| `qr-code.png` | Brand QR code |

### `assets/brand/navy-cream/` — element-level cutouts (for compositing)

`element-beer-stein.png`, `element-running-horse.png`, `element-seated-dog.png`, `element-swan-arch.png`, `element-swan.png`, `element-tagline-relationships.png`, `element-wheel-log-medallion.png` (each with `-trans.png` transparent variants where applicable).

Use these to compose custom heritage layouts when the pre-rendered wordmarks don't fit the surface.

## Preview cards (token visuals)

`preview/` contains a self-rendering HTML card per token concept (colors, typography, spacing, radii, shadows, components). Open any HTML file in a browser to see the token applied with the official font/color stack.

## UI kit

`ui_kits/website/index.html` — interactive homepage replica of the Ryan Realty consumer site.

## Voice + content rules (binding)

See `SKILL.md` and `README.md` for the full voice spec. Highlights enforced across **every** Ryan Realty content surface (website, video, print, social, email):

- **Honest. Transparent. Trustworthy. Direct and kind.**
- **Show, don't tell** — let the fact do the work
- **Phone:** `541.213.6706` (dotted)
- **Web:** `ryan-realty.com` (hyphenated, lowercase)
- **Place separator:** middle dot · — e.g. `BEND · OREGON`
- **"You/your"** is the subject. **"We/our team"** for broker identity. **Never "I".**
- **Sentence case** for web headings; Title Case only for hero H1
- **Tabular numerals** for every price, count, day range
- **Unavailable** → em-dash `—` (not `N/A`)
- **No emoji.** Anywhere. Ever.
- **No exclamation marks** in body
- **No pressure / scarcity framing**

### Banned vocabulary (verbatim from SKILL.md)

- Meta-tone: *passionate, dedicated, premier, luxury, boutique, concierge, white-glove*
- Real-estate clichés: *dream home, nestled, breathtaking, turnkey, must-see*
- Marketing exhortations: *Don't miss out! Act now!*
- Hedging: *may, could, potentially*

## Source provenance

This kit merges two prior bodies of work:

1. **Brand kit from Rise Wise** — heritage Americana identity (Amboqia Boriango, blue lab mascot, 14 numbered wordmarks, scene illustrations, signage, postcards)
2. **`RyanRealty/RyanRealty` repo** — shipped Next.js 16 + Tailwind v4 + shadcn/ui platform (radix-nova stone neutrals, custom nav, listing cards)

Both share a designer's intent: warm stone neutrals, single brand navy, documentary Central Oregon imagery, tabular data-first UI.

## Editing / updating

Changes to this kit are made in the Claude Design project, then re-exported here. Do not hand-edit `colors_and_type.css` in this repo — update the source, re-export, replace.
