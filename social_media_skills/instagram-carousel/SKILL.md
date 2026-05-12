---
name: instagram-carousel
description: >
  Canonical skill for building multi-slide Instagram carousel posts for Ryan Realty. Use when Matt
  asks for "carousel", "IG carousel", "swipe post", "multi-slide", "listing carousel", "market
  summary carousel", "neighborhood guide slides", or any multi-image Instagram deliverable.
  Enforces visual continuity across slides, brand typography, data accuracy, and anti-slop rules
  before any draft is surfaced. Outputs Remotion PNG sequences + optional MP4 swipe loop.
when_to_use: >
  Triggered by phrases: "make a carousel", "IG slides", "swipe post for this listing", "market
  snapshot carousel", "build slides for this neighborhood", "Instagram carousel content".
  Works for any content type — listings, market summaries, neighborhood guides, evergreen tips,
  event recaps. If the deliverable is a single static image, use flyer-design instead.
---

# Instagram Carousel

## Purpose

Produce multi-slide Instagram carousels (1–10 slides) that read as a single cohesive piece —
not a stack of disconnected images. Every slide must advance the narrative. Visual continuity
(persistent footer, consistent type hierarchy, matching color palette) signals quality and keeps
swipe-through rates high. Carousels are the highest-engagement static format on Instagram;
they must look like they came from a design studio, not a template app.

---

## Required references (load before designing)

1. **`CLAUDE.md` §0 — Data accuracy** — every number on every slide must trace to a verified
   primary source. One-line verification trace per figure before the carousel ships.
2. **`CLAUDE.md` §"Draft-First, Commit-Last"** — render to `out/`, show Matt, wait for explicit
   approval. Never commit or post a carousel before Matt signs off.
3. **`video_production_skills/ANTI_SLOP_MANIFESTO.md`** — banned-content gate. Applies to all
   static content, not just video. AI-generated property photos, generic stock, cliché copy,
   manufactured urgency — all ship-blockers.
4. **`video_production_skills/VIRAL_GUARDRAILS.md`** — cover frame must function as a scroll-stop
   within 0.5 seconds. Treat slide 1 like a video hook: specific number, place name, or claim.
5. **`/design_system/ryan-realty/SKILL.md`** — the primary brand skill. Two registers (heritage
   vs. web), type decision tree, asset cheat sheet, color rules. Load this before any layout work.
6. **`/design_system/ryan-realty/README.md`** — full brand overview: voice, color, type scale,
   imagery registers, iconography, layout rhythm.
7. **`/design_system/ryan-realty/colors_and_type.css`** — authoritative CSS vars for every color
   token, font family, radius, shadow, and spacing value. Quote directly; do not invent values.

---

## Inputs (mandatory)

Stop and request any missing input before building. Do not fabricate.

| Field | Required | Notes |
|---|---|---|
| `slug` | Yes | URL-safe identifier, e.g. `nw-crossing-may-2026` or `cascade-hills-12345-se-oak` |
| `content_type` | Yes | `listing` / `market-summary` / `neighborhood` / `evergreen` / `event` |
| `aspect_ratio` | Yes | `1080x1080` (square) or `1080x1350` (portrait — default) |
| `slides[]` | Yes | Array of slide objects — see Slide template system below |
| `verified_data` | If any numeric content | Supabase query results or named primary source with filter/row count |
| `photo_set` | If photo slides | Source-traced paths; min 4 distinct angles for listing carousels |
| `cta_copy` | For CTA slide | Phone `541.213.6706`, URL `ryan-realty.com`, or a specific link |
| `compliance_note` | If required by listing status | Oregon broker disclosure, Equal Housing, MLS# |

Write the slide content array as a `config.json` at `out/carousel/<slug>/config.json` before
starting the Remotion render.

---

## Slide template system

Every carousel is composed of two layers per slide:

### Persistent layers (identical across all slides in a batch)

```
┌─────────────────────────────────────────┐  ← 1080 px wide
│                                         │
│           [per-slide content area]      │
│                                         │
│─────────────────────────────────────────│  ← y = 1720 px (portrait)
│  ❰ RYAN REALTY LOGO ❱   slide 3 / 8    │  ← footer bar, 180 px tall
└─────────────────────────────────────────┘  ← y = 1900 px (portrait)
```

**Portrait (1080×1350) coordinate reference:**
- Canvas: `1080 × 1350 px`
- Content area: `y = 0 → y = 1170` (1170 px tall, full width)
- Footer bar: `y = 1170 → y = 1350` (180 px tall)
- Footer padding: `40 px` left and right

**Square (1080×1080) coordinate reference:**
- Canvas: `1080 × 1080 px`
- Content area: `y = 0 → y = 940` (940 px tall, full width)
- Footer bar: `y = 940 → y = 1080` (140 px tall)
- Footer padding: `32 px` left and right

### Footer bar spec

- **Background:** `rgba(16, 39, 66, 0.94)` — near-opaque navy, not pure black. Brand value:
  `--rr-navy: #102742`.
- **Logo:** `design_system/ryan-realty/assets/brand/logo-white.png` (heritage wordmark, reversed).
  Height: `64 px` (portrait) / `52 px` (square). Vertically centered in the footer band.
  Left-aligned at footer padding offset.
- **Slide numeral:** Geist 500, `18 px` (portrait) / `16 px` (square), color `#faf8f4` (cream
  `--rr-cream`), right-aligned at footer padding offset, vertically centered. Format: `3 / 8`
  with spaces around the slash.
- **No phone number, no URL, no agent name, no "Ryan Realty" text** in the footer band — the
  pre-rendered wordmark image carries the brand. Never re-typeset the wordmark.
- **No separator line** between content area and footer. The navy band is self-contained.

### Address / title strip (listing carousels only)

For listing carousels, slides 2 through N (all photo slides) carry a persistent address strip
immediately above the footer:

- Height: `60 px` (portrait) / `48 px` (square)
- Background: `rgba(16, 39, 66, 0.80)`
- Address: Geist 500, `22 px`, `#faf8f4`, left-aligned, `40 px` left padding
- Price (if relevant to the slide): Geist 700, `22 px`, `#faf8f4`, right-aligned, `40 px`
  right padding, `font-variant-numeric: tabular-nums`
- This strip sits at `y = 1110` for portrait or `y = 892` for square — just above the footer.

---

## Continuity rules

The following properties MUST be pixel-identical across every slide in a single carousel batch.
Drift on any item is a QA fail.

1. **Footer position and height.** Same `y` offset, same height in px, same background opacity.
   Any slide that has a different footer height breaks the visual lock-up on swipe.
2. **Logo asset and size.** Same file path, same rendered height. Never use a different logo
   variant mid-carousel (e.g. navy logo on slide 1, white logo on slide 3).
3. **Slide numeral style.** Same font, same size, same color, same alignment, same format
   (`N / total` with spaces) on every slide including the cover.
4. **Typography choices.** The same font family assigned to each role (Amboqia for slide titles,
   Geist for body and numerals, Azo Sans for accent kickers) must hold across all slides. No
   slide may introduce a fourth family.
5. **Color palette.** Navy `#102742` and cream `#faf8f4` are the primary pair. The fir green
   `#2e4a3a` and sky `#8fb8d4` from `colors_and_type.css` are available as single-use accents —
   one accent color maximum per carousel, used consistently across every slide it appears on.
6. **Safe zone margins.** All text and graphic elements (excluding the footer band) stay within
   `54 px` inset on left/right and `40 px` from the top edge. No content bleeds outside this
   zone except the full-bleed photo and the footer bar itself.
7. **Photo treatment consistency.** If photo slides use a scrim overlay, every photo slide uses
   the same scrim value. If a corner radius is applied to inset photo frames, every inset frame
   uses the same radius (14 px — `--radius-xl`).
8. **Address strip (listing carousels).** Same height, same background, same font spec, same
   vertical position on every photo slide.

---

## Slide type catalog

### 1. Cover slide

The scroll-stop. Must work as a standalone image.

- **Background:** cream `#faf8f4` OR full-bleed hero photo with `rgba(16,39,66,0.52)` scrim.
- **Eyebrow kicker** (Azo Sans Medium, `13 px`, `--rr-navy`, UPPERCASE, `letter-spacing: 0.12em`,
  `margin-bottom: 12 px`): content category or neighborhood name. E.g. `NORTHWEST CROSSING`.
- **Headline** (Amboqia Boriango, `72–88 px` portrait / `60–72 px` square, `--rr-navy` on cream
  or `#faf8f4` on photo, `letter-spacing: -0.01em`, `line-height: 1.05`): 3–6 words max.
  On cream, headline is navy. On photo, headline is cream with the scrim behind it.
- **Deck / sub-head** (Geist 400, `22 px`, `--rr-navy` or `#faf8f4`, `line-height: 1.5`):
  one sentence or a 2–3 item stat summary. If stats: `font-variant-numeric: tabular-nums`.
- **Heritage element** (optional): one illustration from `assets/brand/` — monochrome navy,
  never recolored. Good choices: `scene-tower.png` for Bend content, `blue-dog.png` for
  relationship-register covers. Max width `280 px`; never crop or resize non-proportionally.
- Cover has no address strip; footer is persistent.

### 2. Photo slide

Full-bleed listing or location photo.

- **Photo:** fills the entire content area (above footer). `object-fit: cover`.
- **Scrim:** `rgba(16, 39, 66, 0.40)` overlay — covers only the bottom 200 px of the photo
  area (gradient from transparent to scrim). If text is placed mid-frame, expand the scrim to
  cover only the text zone with a hard rectangle at `rgba(16,39,66,0.40)` — no feathering.
- **Caption / label** (Geist 600, `26 px`, `#faf8f4`, placed 24 px above the address strip or
  24 px above the footer if no address strip): short room description or feature callout. 4 words
  max. `font-variant-numeric: tabular-nums` if numeric.
- Address strip: present for listing carousels.

### 3. Data slide

Stat card. One primary metric and one supporting figure per slide.

- **Background:** cream `#faf8f4`.
- **Category kicker** (Azo Sans Medium, `13 px`, `--rr-navy`, UPPERCASE, `letter-spacing: 0.12em`):
  e.g. `MEDIAN SALE PRICE`.
- **Primary stat** (Amboqia Boriango, `96–120 px` portrait / `80–96 px` square, `--rr-navy`,
  `font-variant-numeric: tabular-nums`): the lead number with units. E.g. `$895K` or `38 days`.
- **YoY / supporting figure** (Geist 500, `28 px`, `--rr-navy`, `tabular-nums`): e.g. `↑ 4.2%
  year over year`. Use the actual Unicode arrow `↑` or `↓`, not an emoji or graphic arrow.
- **Source line** (Geist 400, `14 px`, `--muted-foreground` ≈ `oklch(0.46 0.013 58.071)`,
  bottom of content area, 40 px from footer): e.g. `Source: ORMLS · May 2026`. Required when
  any number is present.
- **No decorative rules, no gradient fills, no drop shadows on type.** The data speaks; chrome
  does not.
- Verified source must appear in `citations.json` for every figure on this slide.

### 4. Text slide

Pull quote, key fact, or neighborhood claim. One idea only.

- **Background:** navy `#102742` OR cream `#faf8f4`. Alternate with adjacent slides to create
  rhythm (never two consecutive same-background text slides).
- **Quote / fact** (Amboqia Boriango, `48–64 px` portrait, `line-height: 1.15`):
  - On navy background: `#faf8f4`.
  - On cream background: `--rr-navy`.
  - 12 words maximum. Single thought. No semicolons. No em-dashes.
- **Attribution or source** (Geist 400, `16 px`, `--muted-foreground` on cream / `rgba(250,248,244,0.65)` on navy):
  neighborhood name, date, or data source. Required for any factual claim.
- **Heritage illustration** (optional): one illustration, navy, placed opposite the text block.
  Max `200 px` wide. Never on the same side as the primary text.

### 5. CTA slide

Always the last slide. No exceptions.

- **Background:** navy `#102742` (full slide, including content area behind footer).
- **Logo:** `design_system/ryan-realty/assets/brand/logo-white.png`, `200 px` wide, centered,
  `y = 200 px` from top of content area.
- **Tagline** (Amboqia Boriango, `40–48 px`, `#faf8f4`, centered, `line-height: 1.1`):
  `It's About Relationships.` — verbatim, with apostrophe, with period.
- **Contact block** (Geist 400, `22 px`, `#faf8f4`, centered, `line-height: 1.8`):
  Phone: `541.213.6706` · Web: `ryan-realty.com`
  Each on its own line. `font-variant-numeric: tabular-nums` for the phone.
- **CTA line** (Azo Sans Medium, `14 px`, `#faf8f4`, UPPERCASE, `letter-spacing: 0.12em`,
  centered, above contact block): one short imperative. E.g. `REACH OUT. WE ANSWER.` or
  `YOUR LOCAL TEAM IS READY.` No exclamation marks. No hype.
- Slide numeral in footer still appears (e.g. `8 / 8`).
- **No photo on the CTA slide.** Navy-only.

---

## Typography

All sizes given for portrait (1080×1350). For square (1080×1080), multiply by `0.85` and round
to the nearest even integer.

| Role | Family | Size (portrait) | Weight | Color (default) | Notes |
|---|---|---|---|---|---|
| Slide title / primary stat | Amboqia Boriango | 72–120 px | 400 | `#102742` or `#faf8f4` | Never for body; 3–6 words |
| Pull quote | Amboqia Boriango | 48–64 px | 400 | `#102742` or `#faf8f4` | 12 words max |
| Category kicker / ribbon | Azo Sans Medium | 13 px | 500 | `#102742` | UPPERCASE, tracking 0.12em |
| CTA label | Azo Sans Medium | 14 px | 500 | `#faf8f4` | UPPERCASE, tracking 0.12em |
| Body / deck | Geist | 22 px | 400 | `#102742` | line-height 1.5 |
| Supporting stat | Geist | 28 px | 500 | `#102742` | tabular-nums |
| Caption / room label | Geist | 26 px | 600 | `#faf8f4` | over photo scrim |
| Slide numeral | Geist | 18 px | 500 | `#faf8f4` | format `N / total` |
| Address strip | Geist | 22 px | 500 | `#faf8f4` | tabular-nums for price |
| Source / attribution | Geist | 14 px | 400 | muted (`oklch(0.46 0.013 58.071)`) | required with every data claim |

**Font files:**
- `design_system/ryan-realty/fonts/Amboqia_Boriango.otf` — primary display
- `design_system/ryan-realty/fonts/AzoSans-Medium.ttf` — accent
- Geist via `@import url('https://fonts.googleapis.com/css2?family=Geist...')` or
  `next/font/geist` in Remotion

**Tabular numerals:** `font-variant-numeric: tabular-nums` on every price, count, percentage,
and day figure across all slide types. Non-negotiable — columns of numbers must align.

**Fallback chain** (from `colors_and_type.css`):
- `--font-heritage: 'Amboqia Boriango', 'Playfair Display', 'Didot', Georgia, serif`
- `--font-accent: 'Azo Sans', 'Geist', system-ui, sans-serif`
- `--font-sans: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif`

If Amboqia fails to load at render time, stop. A Playfair fallback carousel does not ship.

---

## Color usage

**Primary pair: navy on cream.** Every carousel defaults to this register.

| Token | Hex | oklch | Use |
|---|---|---|---|
| `--rr-navy` | `#102742` | `oklch(0.270 0.058 253.912)` | All text on cream, all fills on dark slides, footer band |
| `--rr-cream` | `#faf8f4` | — | Slide backgrounds, text on navy |
| `--rr-sand` | `#e8e2d4` | — | Dividers, secondary surface tints, never as text |
| `--rr-fir` | `#2e4a3a` | — | Single-use accent (neighborhood/nature content); one carousel maximum |
| `--rr-sky` | `#8fb8d4` | — | Single-use accent (aerial/water content); one carousel maximum |

**Rules:**
- Heritage illustrations are navy monochrome. Never tint `assets/brand/` illustrations another
  color. Not fir, not sky, not gold — only `#102742`.
- The design system is **monochrome navy** for print/heritage carousels. Do not import gold
  from the video brand (`#D4AF37`, `#C8A864`) into carousel slides. Those tokens belong to
  the Remotion news/listing video system, not to static social content.
- No decorative gradients. The only gradient allowed is a bottom-edge photo scrim
  (`transparent → rgba(16,39,66,0.40)`) on photo slides.
- No accent color on the cover slide — the Amboqia headline carries the register.
- Never use `--rr-fir` and `--rr-sky` in the same carousel. Pick one accent or none.
- Minimum contrast ratio 4.5:1 for all body text. Navy on cream passes; navy on sand is
  borderline — verify if used for body text.

---

## Photo rules

1. **No AI-generated property photos.** Per `ANTI_SLOP_MANIFESTO.md`: AI fakes are a ship-blocker.
   Photos must come from the verified listing photo set (Spark/MLS) or Matt-approved media.
2. **Listing carousels: minimum 4 distinct hero shots.** Hero exterior + interior alternates
   (kitchen, living, primary suite, rear/patio). Never fill slides by duplicating a photo.
3. **Never repeat a photo across slides.** Each photo slide must use a unique image from
   the approved set. If the photo set has fewer images than photo slides, collapse the slide
   count — do not pad with duplicates.
4. **Photo provenance** must be recorded in `provenance.json` (source, file name, MLS system or
   photographer, license). If a photo cannot be traced, do not use it.
5. **Crop for subject.** The listing structure or location landmark must fill the frame.
   Avoid distant subject, excessive sky, or empty foreground. Apply `object-fit: cover` with
   a `1.10–1.30` zoom scale on the source image, centered on the subject.
6. **No watermarks, no MLS overlay bugs from screen captures.** Source photos must be clean.
7. **Market/neighborhood carousels:** use documentary Central Oregon photography (warm-lit
   landscapes, Deschutes River aerials, downtown Bend streetscapes). No generic stock
   cityscape photos from other markets.

---

## Remotion build procedure

Carousels are built as Remotion compositions so they can be regenerated programmatically.

### Composition

```
listing_video_v4/src/carousel/<ContentType>Carousel.tsx
```

Each slide type is a sub-component. The root composition renders all slides in sequence at
`30 fps`, `1 frame per slide` for PNG export, or `30 frames per slide` for the MP4 swipe loop.

### Render commands

**PNG sequence (primary deliverable):**
```bash
cd listing_video_v4
npx remotion render src/index.ts CarouselStills out/carousel/<slug>/slide-%02d.png \
  --codec=png --concurrency=1
```

**MP4 swipe loop (optional — for IG Story re-use, 3 s per slide at 30 fps):**
```bash
cd listing_video_v4
npx remotion render src/index.ts CarouselSwipe out/carousel/<slug>/swipe-loop.mp4 \
  --codec h264 --concurrency=1 --crf 22 --image-format=jpeg --jpeg-quality=92
```

The MP4 is a secondary deliverable. The PNG sequence is what ships to Instagram.

### Output structure

```
out/carousel/<slug>/
  config.json               ← slide content array, aspect ratio, content_type
  slide-01.png … slide-10.png
  swipe-loop.mp4            ← optional
  manifest.json             ← see Asset library registration below
  citations.json            ← one entry per figure (required for data carousels)
  provenance.json           ← photo source per slide (required for photo slides)
  fonts_used.json           ← exact font files embedded
  design_scorecard.json     ← QA gate results
```

---

## QA gate (pre-publish checklist)

Run before surfacing to Matt. Write results to `design_scorecard.json`. Any `fail` is a
non-ship until resolved.

| # | Check | Pass condition |
|---|---|---|
| 1 | **Visual continuity** | Footer position, logo, numeral style identical across all slides |
| 2 | **Font integrity** | Amboqia and Geist loaded from disk; no Playfair/Georgia/system fallback in render |
| 3 | **Tabular numerals** | Every numeric surface has `font-variant-numeric: tabular-nums` confirmed in render |
| 4 | **Data verified** | Every figure on every data slide traces to `citations.json` with source, filter, row count |
| 5 | **Photo integrity** | No duplicate photos; all photos source-traced in `provenance.json`; no watermarks |
| 6 | **Safe zone** | No critical content within 54 px of left/right edges or 40 px of top; nothing bleeds into footer band |
| 7 | **Color compliance** | No gold (`#D4AF37`, `#C8A864`) anywhere; no cool grey; no off-brand hex |
| 8 | **Banned words clean** | Grep slide copy for banned word list — zero hits |
| 9 | **Slide count** | 2–10 slides; CTA slide is last; cover is first |
| 10 | **Cover scroll-stop** | Slide 1 contains a specific number, place name, or concrete claim in the headline |
| 11 | **File sizes** | Each PNG < 3 MB; MP4 (if produced) < 100 MB |
| 12 | **Compliance copy** | MLS#, Equal Housing, and Oregon broker disclosure present on CTA or cover if required |

---

## Anti-slop / banned content

Full authority: `video_production_skills/ANTI_SLOP_MANIFESTO.md`. The following apply to all
carousel copy — captions, slide text, kickers, attribution lines:

**Banned words (zero tolerance — any hit is a non-ship):**
`stunning`, `nestled`, `boasts`, `charming`, `pristine`, `gorgeous`, `breathtaking`, `must-see`,
`dream home`, `meticulously maintained`, `entertainer's dream`, `tucked away`, `hidden gem`,
`truly`, `spacious`, `cozy`, `luxurious`, `updated throughout`

**Also banned:**
- AI filler: `delve`, `leverage`, `tapestry`, `navigate`, `robust`, `seamless`,
  `comprehensive`, `elevate`, `unlock`
- Exclamation marks in body copy on any slide
- Emoji (never — per `design_system/ryan-realty/README.md` §Emoji)
- Em-dashes (`—`) in slide body copy; use a period or line break instead
- Semicolons in slide body copy
- Hedging: `approximately`, `roughly`, `about` as a substitute for the real number
- Generic superlatives: `#1`, `top-rated`, `award-winning`, `best-in-class` without evidence
  cited in the same slide
- Pressure/scarcity framing: `Act now`, `Don't miss out`, `Limited time`
- Sentences that claim a quality instead of demonstrating it:
  `"Our team is passionate about helping you"` — no. `"38 closings in Bend last year."` — yes.

**Copy register:**
- Short sentences. Active voice. One idea per slide.
- Neighborhood names, not "the area." Dollar amounts with units, not "competitively priced."
- `$895,000` not `$894,750` (round to nearest $1,000 for consumer-facing display); cite the
  actual figure in `citations.json`.
- Phone always dotted: `541.213.6706`. URL always hyphenated lowercase: `ryan-realty.com`.

---

## Asset library registration

After every completed carousel batch, register each output PNG (and the MP4 if produced) with
the asset library CLI:

```bash
node /Users/matthewryan/RyanRealty/lib/asset-library.mjs register \
  --file "out/carousel/<slug>/slide-01.png" \
  --type "carousel-slide" \
  --slide-index 1 \
  --total-slides 8 \
  --content-type "listing" \
  --slug "<slug>" \
  --subject-tags "bend,northwest-crossing,listing,carousel" \
  --status "draft"
```

Repeat for each slide. After Matt approves, update `--status "approved"` for each registered
asset. The manifest at `data/asset-library/manifest.json` is the registry of record.

Write `out/carousel/<slug>/manifest.json` with:
```json
{
  "slug": "<slug>",
  "content_type": "<listing|market-summary|neighborhood|evergreen|event>",
  "aspect_ratio": "1080x1350",
  "slide_count": 8,
  "slides": [
    { "index": 1, "type": "cover", "file": "slide-01.png", "asset_library_id": "<id>" }
  ],
  "status": "draft",
  "created_at": "<ISO timestamp>",
  "approved_at": null
}
```

---

## What not to do

1. **Do not invent colors.** Every hex must trace to `colors_and_type.css` or the explicit brand
   values in `design_system/ryan-realty/SKILL.md`. No gold from the video system. No cool greys.
   No "close enough" blues that are not `#102742`.

2. **Do not re-typeset the Ryan Realty wordmark.** Always use the pre-rendered PNG from
   `design_system/ryan-realty/assets/brand/logo-white.png` (on dark) or `logo-blue.png` (on cream).
   Typing "Ryan Realty" in Amboqia is not the wordmark. The mark has specific proportions,
   spacing, and the `BEND, OREGON` sub-line that cannot be reproduced freehand.

3. **Do not pad a thin photo set with duplicates.** If you have 3 approved photos and the
   template has 5 photo slides, collapse to 3 photo slides (or fewer). Never reuse a photo
   across slides to fill a slot.

4. **Do not import gold.** The video system uses `#D4AF37` (news) and `#C8A864` (listing reels)
   for accent. Those tokens do not exist in the carousel design system. Navy on cream is the
   monochrome brand for static social content.

5. **Do not design before data is verified.** For market-data carousels, run the Supabase query,
   print the result, compute the derived stat, and confirm it before writing the slide copy. A
   pretty carousel with a wrong median price does not ship — not even to Matt for review.

6. **Do not commit or publish before Matt explicitly approves the specific slide set.** Render to
   `out/carousel/<slug>/`. Show the file paths. Wait for "ship it" or equivalent. This is the
   draft-first rule from `CLAUDE.md` §"Draft-First, Commit-Last."

7. **Do not use more than one accent color per carousel.** Fir `#2e4a3a` and sky `#8fb8d4` are
   available — pick one or neither. A carousel that uses navy, fir, sky, and a photo treatment
   reads as undesigned.

8. **Do not let any text element overlap the footer band.** The footer is a reserved layer.
   Set `z-index` and positional constraints so slide content always terminates above `y = 1170`
   (portrait) or `y = 940` (square).

9. **Do not use system font fallbacks as a ship state.** If Amboqia fails to load, the render
   fails. Fix the font path. Do not ship a Playfair or Georgia substitution and call it "close."

10. **Do not use exclamation marks.** Not in headlines, not in kickers, not in CTA copy, not
    in captions. The brand voice is direct and kind, not exclamatory. Period. Full stop.

---

## See also

- `social_media_skills/flyer-design/SKILL.md` — single-image static flyers
- `video_production_skills/listing-tour-video/SKILL.md` — full listing video production
- `video_production_skills/news-video/SKILL.md` — news clip format
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — content quality gate (authoritative)
- `video_production_skills/VIRAL_GUARDRAILS.md` — cover frame virality spec
- `automation_skills/content_engine/SKILL.md` — content scheduling and publishing pipeline
- `design_system/ryan-realty/SKILL.md` — brand system (authoritative)
