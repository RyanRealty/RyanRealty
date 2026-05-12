# Ryan Realty Design System

> **Ryan Realty · Bend, Oregon** — real estate brokerage. Two brand voices living under one roof: a **heritage Americana mark** (Rise Wise deliverables, hand-engraved illustrations, blue lab mascot, "It's About Relationships") and a **modern web system** (shadcn/ui radix-nova, Geist, navy primary) built on top of it. **Amboqia Boriango** is the primary display face across both.
>
> Mission: **build community through authentic relationships and exceptional customer service.** Tagline: **"It's About Relationships."** Mascot: **Jax** — a blue lab. Home: **Bend, Oregon.**

---

## Sources

Everything here was drawn from two bodies of work:

| Source | What it contributed |
|---|---|
| **`Brand/` kit from Rise Wise** (uploaded) | The real identity. Amboqia Boriango OTF (primary display), Azo Sans Medium TTF (accent), the blue-dog mascot, 14 numbered logo lockups, 2 Central Oregon landmark scenes (Tower Theater, Water Pageant), yard sign, postcard magnet, email banner, Instagram highlight covers, QR code, the "Its About Relationships" lockup, and the "For Sale / Building Community / 541.213.6706 / ryan-realty.com" yard sign template with brokerage phone and URL. |
| **`RyanRealty/RyanRealty` repo** (github) | The shipped Next.js 16 + Tailwind v4 + shadcn/ui web platform. `app/globals.css` tokens (stone radix-nova base), the custom navy primary `oklch(0.270 0.058 253.912)`, the consumer homepage flow, icon libraries in use (Heroicons + HugeIcons), content voice, and the Deschutes-River hero photography. |

Both live here as one system because they already share a designer's intent: **warm stone neutrals, single brand navy, documentary Central Oregon imagery, tabular data-first market copy**. The heritage layer adds the mascot, Americana illustrations, and the Amboqia display face; the web layer turns that into an accessible, production-shipped product surface.

---

## Index

- `README.md` — this file
- `SKILL.md` — portable skill manifest
- `colors_and_type.css` — all CSS vars (brand + semantic tokens + three type families + spacing + radii + shadows)
- `fonts/` — **Amboqia_Boriango.otf** (primary display), **AzoSans-Medium.ttf** (accent)
- `assets/` — web platform essentials (favicon, hero photo, team photo, partner marks)
- `assets/brand/` — heritage brand kit (mascot, 14 numbered wordmarks, illustrations, tagline lockup, yard sign, postcard, IG highlights, scene illustrations)
- `preview/` — HTML cards for each token/concept (rendered in the Design System tab)
- `ui_kits/website/` — interactive homepage replica of the Ryan Realty consumer site

---

## Brand voice

> **Honest. Transparent. Trustworthy. Direct and kind.**
> We don't tell you we're warm — we just speak warmly. We don't tell you we're expert — we just know the neighborhoods.

We are the **local authority for real estate brokerages in Central Oregon** — a small team that has lived, worked, and closed deals across Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Madras, Prineville, Powell Butte, Terrebonne, and Crooked River Ranch.

Our mission: **building community through authentic relationships and exceptional customer service.** We live by the golden rule; we always do the right thing for our clients, even when it costs us the deal.

---

## CONTENT FUNDAMENTALS

### The voice principle — *show, don't tell*

**Let what we say create the tone. Never describe the tone overtly.** The brand is warm, trustworthy, and expert; the writing is not allowed to *claim* those qualities — it has to *demonstrate* them through specificity, restraint, and the right facts in the right order.

| ✗ Pandering / editorializing | ✓ Letting the fact do the work |
|---|---|
| "Our team is passionate about helping you find your dream home!" | "Your local team. Thirty-seven closings in Bend last year." |
| "We pride ourselves on honest, transparent service." | "We'll tell you if the inspection found dry rot. We'll tell you if we think you're overpaying." |
| "Experience the breathtaking beauty of Central Oregon living." | "Three blocks to the Deschutes. Twenty minutes to Mt. Bachelor." |
| "Trust the experts who know the market!" | "Median sale in Northwest Crossing last month: $895k. 38 days on market." |
| "We love what we do!" | *(delete — the brand doesn't say this)* |
| "Luxurious, turnkey, beautifully-appointed home!" | "3 bd · 2 ba · 1,820 sqft. New roof, 2023. HOA $0." |

### Four rules that do most of the work

1. **Be direct.** Short sentences. Active voice. One idea per line. If a clause can be cut without losing meaning, cut it.
2. **Be specific.** Neighborhood names, not "the area." Dollar amounts, not "competitively priced." First names of brokers, not "our team of experts."
3. **Be kind.** Directness is not coldness. Acknowledge the client's situation. Use "you" and "your." Never condescend, never hedge, never pressure.
4. **Be honest, even when it's inconvenient.** If a market is soft, say so. If a listing has been sitting, say so. If we don't know, say so. **Trust is the product.**

### Tagline
**"It's About Relationships."** A signature line — used with the wordmark on heritage marketing, not a filler phrase to sprinkle into body copy. Full stop ends it.

### Extended brand promise
**"Building community through authentic relationships and exceptional customer service."** Verbatim on the yard sign and heritage marketing. Don't paraphrase.

### Brokerage facts (always these values)
- Location: **Bend, Oregon** (sometimes `BEND · OREGON` with a middle dot on signage)
- Phone: **541.213.6706** (dotted; it's how the yard sign is typeset)
- Web: **ryan-realty.com** (hyphenated; lowercase)
- Service area: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Madras, Prineville, Powell Butte, Terrebonne, Crooked River Ranch — *"Central Oregon"* covers them all

### Authority cues (use sparingly, only when true)
- **Local tenure:** "Brokers who live and work across Central Oregon neighborhoods."
- **Local knowledge:** name specific neighborhoods, schools, HOAs, builders, and market quirks when they're relevant. Never generic ("great location") — always specific ("three blocks from Pacific Crest Middle").
- **Specific numbers:** median sale, DOM, YoY change, closing count. Round, cite a source when asked.
- **Never** claim rankings, awards, or superlatives ("#1," "top-rated," "award-winning") unless you're showing the evidence in the same frame.

### Casing
- **Heritage wordmark (image):** the pre-rendered `Ryan Realty` with `BEND, OREGON` underneath lives in `assets/brand/logo-*.png`. Drop it in as an image; don't re-typeset.
- **Website headings:** sentence case, except the hero H1 which is Title Case: *"Find Your Home in Central Oregon"*.
- **Heritage signage** (yard signs, postcards, IG highlight covers): full UPPERCASE in Amboqia, tracked 0.04–0.16em.
- **Middle-dot separator** for place: `BEND · OREGON` or `QUALITY · LOCAL · SERVICE` — lifted directly from the illustrated scene.

### Person
- "You" and "your" do the work.
- "Our team" when the broker identity matters.
- Never "I".

### Numbers, facts, and units
- **Phone = dotted:** `541.213.6706`.
- **Currency = rounded:** `$895,000` not `$894,750`.
- **Days = integer + "days":** `38 days`.
- **Unavailable = em-dash:** `—` not `N/A`.
- **Percents = one decimal, signed arrow:** `↑ 2.1% YoY`.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) for every numeric surface.

### Emoji
Never. Not in marketing, not in UI, not in copy.

### Signature phrases (lift verbatim)
- *"It's About Relationships."*
- *"Building community through authentic relationships and exceptional customer service."*
- *"Love where you live."*
- *"Local Expertise."*
- *"Quality · Local · Service. Bend · Oregon."*
- *"Your local team."*
- *"Honest guidance."*
- *"Central Oregon Real Estate"*
- *"Market Snapshot"*
- *"Never miss a new listing"*
- *"Open houses this weekend"*

### Things to avoid
- Real-estate clichés: *"dream home", "luxurious", "nestled", "breathtaking", "turnkey", "stunning"*.
- Exclamation marks in body copy.
- Apostrophes mid-contraction on signage — the heritage lockup reads `ITS ABOUT RELATIONSHIPS`, not `IT'S`. On the website version, punctuate normally: *"It's About Relationships."*
- Emoji.
- Hedging: *"may", "could", "potentially"*. Be direct.

---

## VISUAL FOUNDATIONS

### Color
- **Brand primary:** Ryan Realty navy **`#102742`** (`oklch(0.270 0.058 253.912)`). The heritage illustrations ship as this exact navy; the web tokens inherit it. All CTAs, logo fills, focus intent.
- **Neutral base = warm stone.** `#faf8f4` (cream) backgrounds on heritage marketing; warm stone greys on the website. Never cool/blue grey.
- **Accents:** Fir green `#2e4a3a` (Central Oregon forest), Sky `#8fb8d4` (Deschutes).
- **Semantic:** success (green), warning (amber), destructive (red). Used only in UI contexts.
- **Chart ramp:** five-step blue from pale to brand navy. Used in the market-pulse charts.
- **No decorative gradients.** The only gradient is the navy protection overlay on the hero image.
- **Heritage illustrations are monochrome navy** on cream or white. Do not tint them another color.

### Type — **three families**
1. **Amboqia Boriango** (primary display). High-contrast swash serif with the distinctive looped `y` descender. Used for every display moment across web, print, and signage — hero H1s, pull quotes, yard-sign text, postcard headlines, IG cover titles. **Never body.**
2. **Azo Sans Medium** (accent sans). Paired with the wordmark on a handful of marketing pieces (the "Its About Relationships" ribbon on `illustration-05.png` uses this family). **Rare.**
3. **Geist** (UI, body, most of the website). Via `next/font/geist` in production; via Google Fonts here. Weights 400/500/600/700. Geist Mono for code.

**Decision tree:**
- Writing a wordmark? → **Use the pre-rendered image** from `assets/brand/` (e.g. `logo-blue.png`). Don't re-typeset.
- Writing a yard sign, postcard, IG cover, poster, section hero stamp, or hero H1? → **Amboqia Boriango**, tracking between `-0.01em` (hero H1) and `0.08em` (all-caps signage).
- Writing body, market data, forms, nav, or any UI? → **Geist**.
- Writing an arched or ribbon sub-label under the wordmark? → Azo Sans Medium, uppercase.

**Scale** (Geist unless noted): body 16 / small 14 / eyebrow 12 UPPERCASE tracked +0.12em / H3 20 / H2 24–30 / H1 hero 36–60. **Amboqia display moments** scale from 40px up to 120px on yard signs.

### Imagery — **three registers**
1. **Documentary photography.** Warm-lit aerials and landscapes of Central Oregon (`hero-poster.webp` — Deschutes River through downtown Bend). Natural color, no teal-orange grade. Ken Burns at 20s on the hero.
2. **Heritage engravings.** Navy line-art illustrations (`illustration-01…14.png`, `scene-tower.png`, `scene-water-pageant.png`). Central Oregon landmarks (Tower Theater, historic downtown, lumber carts, horse-and-wagon, Water Pageant). Use on signage, postcards, section dividers, and any time you want the brand's heritage voice.
3. **The blue dog — Jax.** A sitting black lab rendered in the same engraving style (`blue-dog.png`, `white-dog.png`). Mascot. Pair with the wordmark in balanced compositions. Never crop or recolor.

### Layout & spacing
- **Max content width:** `max-w-7xl` (1280px), centered, `px-4 sm:px-6` gutters.
- **Section rhythm:** `py-12 sm:py-14`. Hero `min-h-[60vh]`.
- **Grids:** 1 → 2 → 4 columns is the web pattern. Heritage pieces are centered vertical stacks.
- **Gap:** `gap-4` between grid cells, `gap-6` between sections.
- **Heritage moments breathe:** 25%+ padding inside any Amboqia-typeset frame.

### Corners, borders, shadows
- **Base radius 10px** with ladder to `2xl` (18px). Card = 14px · button/input = 10px · badge = pill.
- **Borders** are warm stone at 92% lightness. 1px, never heavier.
- **Shadows are navy-tinted** (`rgb(16 39 66 / 0.08)`). `shadow-sm` on resting cards, `shadow-lg` on hero search, `shadow-md` on hover.
- **Focus ring** is 3px warm stone — never navy.

### Hover, press, motion
- **Button hover:** `bg-primary/80` on primary, `bg-muted` on ghost.
- **Card hover:** `hover:border-primary/30 hover:shadow-md`.
- **Press:** `active:translate-y-px`. No scale transforms.
- **Duration ladder:** 200ms fades / 300ms entrances / 400ms fade-up / 2s loops / 20s Ken Burns.
- **Respect `prefers-reduced-motion`** on every animation.

### Card anatomy
- Resting card: `bg-card` (white), `rounded-xl`, `ring-1 ring-foreground/10` OR `border border-border`, `shadow-sm`, 16–24px padding.
- Listing card adds top image (`rounded-t-xl`), top-left badges, top-right favorite heart, bottom metadata row.
- Footer rails sit on `bg-muted/50` with a top border.

### Accessibility
- Skip link on every layout.
- 3px focus ring, visible always.
- pa11y-ci and Lighthouse a11y in CI. Target AA.
- Reduced-motion honored.

---

## ICONOGRAPHY

### Heritage iconography (illustration library)
The brand ships 14 engraving-style **navy monochrome illustrations** plus two **Central Oregon scene illustrations**. Use these as decorative elements on heritage surfaces (postcards, yard signs, IG posts, email banners, decorative section dividers). Do not redraw or recolor.

- `illustration-01.png` — primary stacked Butcher wordmark (no dog)
- `illustration-05.png` — **"Ryan Realty · Its About Relationships · BEND OREGON"** with beer-glass hand on the left and the blue lab on the right. The signature lockup.
- `illustration-08.png` — ornate scripted "Ryan Realty · BEND, OREGON"
- `illustration-12.png` — horse-and-wagon with a **"RYAN REALTY · BEND OREGON"** wheel medallion
- `illustration-02/03/04/06/07/09/10/11/13/14.png` — further wordmark and tagline compositions
- `scene-tower.png` — Tower Theater marquee with *"Ryan Realty · It's About Relationships. Love Where You Live · Local Expertise"*
- `scene-water-pageant.png` — historic downtown Bend with smokestacks, mountains, and *"Quality · Local · Service"* sub-line
- `blue-dog.png` / `white-dog.png` — Ryan the lab, sitting profile

### UI iconography (web / product)
The production site uses three icon sources, in priority:

1. **Heroicons** (`@heroicons/react`) — the default. 2px stroke, rounded caps, 24×24 grid.
2. **HugeIcons** (`@hugeicons/react`) — filled/decorative moments (feature tiles, trust bars).
3. **Inline SVG** — one-offs for the "Never miss a new listing" bell and the "Your local team" figures. Same grammar as Heroicons.

**Stroke grammar:** `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"` unless filled.

### Emoji
Never.

### Unicode glyphs in use
- `·` (middle dot) for metadata and signage separators
- `—` (em dash) for unavailable values
- `→` on CTA buttons ("Browse listings →")
- `★ / ☆` for reviews

### Logo assets
- `assets/logo.png` — the modern Amboqia-style web wordmark (navy, cream BG). Use on **web headers**, **light backgrounds**, and **digital product** surfaces.
- `assets/logo-header-white.png` — modern web wordmark reversed for navy header.
- `assets/brand/logo-blue.png` — **the heritage wordmark (pre-rendered), navy on transparent**. Use for **print**, **yard signs**, **postcards**, and any heritage moment.
- `assets/brand/logo-black.png` — heritage wordmark in black (for 1-color heritage print).
- `assets/brand/logo-white.png` — heritage wordmark reversed (for dark print backgrounds).
- `assets/brand/logo-stacked-white.png` — heritage wordmark with `BEND, OREGON` arched sub-line, reversed.
- `assets/brand/illustration-05.png` — **primary "It's About Relationships" heritage lockup with blue dog**. Use for any heritage hero moment.
- `assets/brand/blue-dog.png` / `white-dog.png` — mascot alone.

### Substitutions flagged
- **Geist** loaded via Google Fonts here mirrors `next/font/geist` in production. No visual difference.
- **Amboqia Boriango, Azo Sans** are bundled from the Rise Wise kit — no substitution.
- CSS fallbacks: Amboqia → Playfair Display / Didot / Georgia. Azo Sans → Geist. Flag any fallback to the user as a visible downgrade on print collateral.

---

## UI kits

| Kit | Path | Surface |
|---|---|---|
| **Consumer website** | `ui_kits/website/` | Homepage: hero with search, market snapshot, price-range tiles, featured listings, city grid, team section, activity feed, CTA duo, footer |

---

## Next steps

1. Open the **Design System tab** for the token gallery.
2. Open `ui_kits/website/index.html` for the interactive homepage replica.
3. Read `SKILL.md` if exporting as a Claude Code skill.
4. If generating **print/heritage collateral** (yard signs, postcards, door hangers, IG posts): reach for the `assets/brand/` library and Amboqia, not the web system.
5. If generating **web/product UI** (dashboards, search, market pages): reach for the Geist + navy web system and `colors_and_type.css`.
