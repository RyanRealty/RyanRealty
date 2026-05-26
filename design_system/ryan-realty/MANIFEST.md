# Ryan Realty Design System — Repository Manifest

**Source of truth lives in the codebase at `RyanRealty/design_system/ryan-realty/`** (flipped 2026-05-14 from the old "edit here, re-export to repo" rule).

The producers in `marketing_brain_skills/producers/` mandate-load the codebase copy on every run, so whatever is in the repo IS what ships. This Claude Design project is a **visual previewer + prototyping surface**:

- **To make a change live:** edit `RyanRealty/design_system/ryan-realty/` directly in Claude Code or Cursor. Commit + push. Producers pick it up on the next run.
- **To see token cards visually:** come here, ask me to *"sync from codebase"*, and I'll mirror the latest into this project so the Design System tab reflects it.
- **To prototype a new token / card / preview:** build it here, copy it into the codebase when ready.

The pull direction is **codebase → this project**, never the reverse, unless you explicitly tell me to commit something back.

## Read order

1. **`README.md`** — full brand overview (voice, content rules, typography, layout, iconography, broker roster, content-engine integration)
2. **`SKILL.md`** — portable skill manifest (two-register model, type decision tree, asset cheat sheet, broker resolution rule)
3. **`colors_and_type.css`** — every CSS var (brand + semantic tokens + three type families + spacing + radii + shadows)
4. **`preview/`** — token gallery (open the Design System tab to see each card)

## Two registers

| Register | Use for | Color | Type |
|---|---|---|---|
| **Heritage** | Yard signs, postcards, email banners, IG posts/carousels, door hangers, print, section heroes, any "stamped" moment | Navy `#102742` monochrome on cream `#faf8f4` | **Amboqia Boriango** display |
| **Web / product** | Homepage, search, market hub, dashboards, forms, every UI surface | Navy `#102742` primary on warm stone neutrals | **Geist** sans for UI/body, **Amboqia Boriango** for display/hero H1s |

Never mix the two on the same surface (except a single cross-register hero or footer block).

## Brand colors (locked 2026-05-13)

**Two-color palette only.** Matt's directive: "I want to get rid of navy-deep, sand, fir, sky — we won't be using that in anything else, so remove those entirely."

| Token | Hex | Use |
|---|---|---|
| `--rr-navy` | `#102742` | Primary brand navy. Logo, CTAs, headlines, focus intent, end-card backgrounds. |
| `--rr-cream` | `#faf8f4` | Warm off-white — primary background for cream surfaces. |

**Retired — never reintroduce:**

- `--rr-navy-deep` (was `#0a1a2e`) → `rgba(16,39,66,0.85)` for hover/pressed
- `--rr-sand` (was `#e8e2d4`) → `rgba(16,39,66,0.08)` for borders/dividers
- `--rr-fir` (was `#2e4a3a` forest)
- `--rr-sky` (was `#8fb8d4` Deschutes)
- **Gold** (`#D4AF37` news, `#C8A864` listing reels) — both retired; new renders use navy-on-cream

Utility: `#FFFFFF` and `#000000` allowed for text-on-photo legibility and scrim layers only.

## Type families

- `--font-heritage` / `--font-display`: **Amboqia Boriango** (fallback Playfair Display, Didot, Georgia, serif)
- `--font-accent`: **Azo Sans Medium** (fallback Geist, system-ui)
- `--font-sans`: **Geist** (fallback system-ui, -apple-system, 'Segoe UI')
- `--font-mono`: **Geist Mono**

Font files in `fonts/`: `Amboqia_Boriango.otf`, `AzoSans-Medium.ttf`. Geist + Geist Mono load via Google Fonts (production uses `next/font/geist`).

## Radii · Shadows · Motion

- **Base radius** `--radius: 0.625rem` (10px). Ladder: sm 6 · md 8 · lg 10 · xl 14 · 2xl 18 · 3xl 22. Button/input = lg, card = xl, badge = pill.
- **Shadows navy-tinted** (`rgb(16 39 66 / opacity)`). `--shadow-sm` cards · `--shadow-md` hover · `--shadow-lg` hero search.
- **Focus ring:** 3px **warm stone** — never navy.
- **Motion ladder:** 200ms fades · 300ms entrances · 400ms fade-up · 2s loops · 20s Ken Burns. Respect `prefers-reduced-motion`.

## Brokers — three active

Source-of-truth headshots in `assets/team/`. Each broker has `.png` (transparent, default) and `.jpg` (white bg, legacy). All 800×1200, 552px head height, 20px top whitespace, face centered. Web mirror at `public/images/brokers/`.

| Slug | Name | Title | Phone | Email |
|---|---|---|---|---|
| `matt-ryan` | Matt Ryan | Owner & Principal Broker | `541.703.3095` (FUB) | matt@ryan-realty.com |
| `paul-stevenson` | Paul Stevenson | Broker | `541.977.6841` | — |
| `rebecca-ryser-peterson` | Rebecca Ryser Peterson | Broker | `415.308.9087` | — |

**Brand-voice phone:** `541.213.6706` (Matt direct — the yard-sign number). Use on signage, video VO, signature heritage moments.

**Listing-agent rule.** Per-listing deliverables include the listing agent's headshot — resolve via Supabase `listings.ListAgentEmail / ListAgentFullName`. Brand-led content uses Jax (`assets/brand/blue-dog.png`) instead.

**Composite rule.** Never fake a rectangular frame behind the transparent portrait.

## Brand facts (the values producers pull verbatim)

- **Location:** Bend, Oregon (signage: `BEND · OREGON` with middle dot U+00B7)
- **Web:** `ryan-realty.com` (hyphenated, lowercase, no www)
- **Social handles** (locked 2026-05-13): `@ryanrealtybend` on IG, TikTok, Threads, YouTube, X, Pinterest. `/ryanrealtybend` on FB and LinkedIn.
- **Hashtag rule** (locked 2026-05-14): every caption on every hashtag-supporting platform includes `#RyanRealtyBend` as the first hashtag in the trailing block. Email + SMS + on-site blog body are exempt.
- **Place separator:** middle dot · — e.g. `BEND · OREGON`, `QUALITY · LOCAL · SERVICE`
- **Tagline:** "It's About Relationships." — used with the wordmark on heritage marketing, not as filler.

## Voice + content rules (binding on every surface)

- **Honest. Transparent. Trustworthy. Direct and kind.**
- **Show, don't tell.** Let the fact do the work.
- **Four rules:** Direct. Specific. Kind. Honest, even when inconvenient.
- **"You/your"** is the subject. **"We/our team"** for broker identity. **Never "I"** (except first-person Matt content).
- **Sentence case** web headings (Title Case only for hero H1).
- **Tabular numerals** for every price, count, day range.
- **Currency rounded** to nearest thousand: `$895,000` not `$894,750`.
- **Days = integer + "days":** `38 days`.
- **Unavailable → em-dash `—`** (em-dash banned as punctuation, allowed as data placeholder).
- **Percents:** one decimal, signed arrow: `↑ 2.1% YoY`.
- **No emoji.** Anywhere. Ever.
- **No exclamation marks** in body. **No pressure / scarcity framing.**

Full banned vocabulary — clichés, AI filler, meta-tone words, vague qualifiers, banned phrases, banned tropes — lives in the `voice-banned.html` preview card and in `marketing_brain_skills/brand-voice/voice_guidelines.md` §6.

## Content engine integration

This kit is the **mandate-load** for every producer in `marketing_brain_skills/producers/`. When a producer picks up an action row from `marketing_brain_actions`, it loads:

1. **`SKILL.md`** (this kit) — visual brand spec
2. **`marketing_brain_skills/brand-voice/voice_guidelines.md`** — voice + banned vocabulary
3. **`social_media_skills/platform-best-practices/SKILL.md`** — 2026 platform rule layer

Edit a swatch or banned word here and every listing reel + flyer + IG carousel + GBP reply + email blast picks it up on the next run. See the *Content engine map* preview card for the per-action-type pull list.

## Asset directory

### `assets/team/` — broker headshots
Three transparent PNGs + JPG fallbacks. See "Brokers" section above for the resolution rule.

### `assets/` — web platform essentials
`logo.png` (web wordmark, navy on cream) · `logo-header-white.png` (reversed) · `hero-poster.webp` (Deschutes aerial) · `team.webp` · partner SVGs · favicon/apple-touch/icon-512 · alternate hero crops.

### `assets/brand/` — heritage brand kit
- **Wordmarks:** `logo-blue.png` (heritage navy on transparent — print/signage primary), `logo-black.png` (1-color), `logo-white.png` + `logo-stacked-white.png` (reversed for dark)
- **Mascot:** `blue-dog.png` (Jax full color) · `white-dog.png` (reversed)
- **Signature lockup:** `illustration-05.png` (wordmark + beer-glass + dog + tagline ribbon)
- **14 numbered heritage variations:** `illustration-01.png` through `illustration-14.png`
- **Scene illustrations:** `scene-tower.png` (Tower Theater) · `scene-water-pageant.png` (historic downtown)
- **Standalone tagline:** `tagline-its-about-relationships.jpg`
- **Print collateral:** `yard-sign.png` · `postcard-magnet.png` · `email-banner.png`
- **Social:** `ig-highlight-community.png` · `ig-highlight-swan.png` · `qr-code.png`

## Preview cards (open the Design System tab)

| Card | What's on it |
|---|---|
| `colors-brand.html` | Two-color palette + retired tokens with strike marks |
| `colors-semantic.html` · `colors-neutrals.html` · `colors-chart.html` | Semantic UI tokens, warm-stone neutrals, blue chart ramp |
| `type-families.html` · `type-display.html` · `type-headings.html` · `type-body.html` · `type-heritage.html` · `type-tabular.html` | Three type families across every weight/size |
| `spacing-scale.html` · `spacing-radii.html` · `spacing-shadows.html` | Spacing tokens, radius ladder, navy-tinted shadows |
| `components-buttons.html` · `components-input.html` · `components-badges.html` · `components-cta.html` · `components-listing-card.html` · `components-stat-card.html` | shadcn-aligned UI primitives |
| `brand-logo.html` · `brand-logo-reversed.html` · `brand-wordmarks.html` · `brand-lockup.html` · `brand-mascot.html` · `brand-scenes.html` · `brand-iconography.html` · `brand-collateral.html` · `brand-hero.html` | Heritage kit gallery |
| **`team-brokers.html`** | **3 broker cards with headshots + contact + listing-agent rule** |
| **`brand-facts.html`** | **Phones · handles · #RyanRealtyBend · glyphs** |
| **`voice-rules.html`** | **4 rules · 5 attributes · show vs tell · grammar** |
| **`voice-banned.html`** | **Hard-fail words · phrases · punctuation · tropes** |
| **`voice-canonical.html`** | **Lift-verbatim templates from Matt's GBP corpus** |
| **`content-engine.html`** | **Producer ↔ design-system map (which action_type pulls what)** |

## Editing / updating (flipped 2026-05-14)

**The codebase is the source of truth.** Hand-edit `RyanRealty/design_system/ryan-realty/colors_and_type.css`, `README.md`, `SKILL.md`, `preview/*.html`, `assets/team/*` etc directly in Claude Code / Cursor. Commit + push.

To refresh this Claude Design project from the codebase, ask the design agent: *"sync from codebase"*. The agent will mirror these paths from the mounted `RyanRealty/design_system/ryan-realty/` folder into this project:

- `colors_and_type.css`
- `README.md` · `SKILL.md` · `MANIFEST.md`
- `preview/*.html` (all preview cards)
- `assets/team/*.{png,jpg}` (broker headshots)
- `assets/brand/*` (heritage kit) — only if changed
- `assets/hero/*` (canonical hero) — only if changed
- `fonts/*` — only if changed

The agent will register any new/changed preview cards in the Design System tab automatically.
