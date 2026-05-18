---
name: linkedin-document-carousel
description: >
  Canonical producer for Ryan Realty native LinkedIn document carousels.  8-12 slide vector
  PDFs uploaded directly to LinkedIn as a document post (not a link to Canva, not an image
  carousel). LinkedIn document posts run ~24% engagement vs ~6% for static images and reach
  exactly the $700K+ Bend buyer profile: tech relocators, remote workers, corporate
  transferees. NOT a listing brochure.  the framing is always insight-first. Slide 1 is a
  bold market claim, slides 2-8 build the case with verified Supabase + MLS + named-source
  data, slide 9 is a quiet DM-for-the-brief offer. Navy/cream monochrome, Amboqia display,
  Geist body, no gold, no emoji, no hashtags on slides. Use this whenever Matt says "build a
  linkedin carousel for <listing>", "linkedin pdf for <MLS#>", "linkedin document for
  <city>", "linkedin doc carousel about <topic>", or "market-insight carousel for linkedin".
  For multi-image IG/FB carousels use instagram-carousel. For static single posts use
  ig-single-post or flyer-design.
when_to_use: |
  Trigger when Matt says any of:
  - "build a linkedin carousel for <listing>"
  - "linkedin pdf for <MLS#>"
  - "linkedin document for <city>"
  - "linkedin doc carousel about <topic>"
  - "market-insight carousel for linkedin"
  - "linkedin doc post about <topic>"
  - "make a linkedin slide deck for <topic>"
  - "build a linkedin pdf about <neighborhood>"
action_types:
  - content:linkedin_doc_carousel
output_type: image
target_platforms: ["ig_feed", "ig_carousel", "fb_feed"]
asset_destination: Supabase asset-library bucket + public/list-kits/<address>/
auto_inputs: ["listing photos from Spark", "brand tokens", "design system v2"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["aspect_ratio_overrides", "color_palette_override"]
estimated_runtime_min: 5
cost_usd_estimate: $0.05-$0.50 per image
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.png
example_outputs: []
    label: "past approved renders"
    surface: "ig_carousel"
---

# LinkedIn Document Carousel.  Native PDF Insight Deck

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Render one native LinkedIn document carousel (8-12 slide PDF, 1080×1080 per slide,
vector with embedded fonts) plus the LinkedIn-native caption that ships with it. Framed as a
McKinsey-Insights-grade market analysis, not a listing brochure.  even when a specific listing
is the trigger, that listing is a proof point inside a larger market thesis. Companion to
`instagram-carousel` (multi-slide IG/FB) and `ig-single-post` (single IG/FB image). Owns the
LinkedIn document-post format end-to-end: PDF render, caption draft, slide-by-slide citation
trace, QA gate, and review surfacing.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer (per
`marketing_brain_skills/producers/REGISTRY.md`).

**Exemplar output:** `out/linkedin-doc/<slug>/`

---

## 1. Required references.  load before doing any work

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every figure on every slide traces to a verified primary source. Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/`, surface, wait for explicit approval. Outranks every other rule. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | The trailing block of the caption MUST be `#RyanRealtyBend` followed by 3-6 topical tags. LinkedIn honors hashtags; do not strip them. |
| `CLAUDE.md` "Supabase listings Schema" | Mixed-case column names require double quotes. Re-read before any SQL. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy/cream-only palette, Amboqia/Geist/Azo Sans Medium type tiers, asset cheat sheet. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes; LinkedIn voice register. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint reference. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 LinkedIn rule layer.  document-post format, cadence, hashtag use. |
| `social_media_skills/instagram-carousel/SKILL.md` | Persistent-footer + continuity conventions inherited here (footer position, logo discipline, tabular numerals). |
| `automation_skills/content_engine/SKILL.md` | Content routing bus.  every `content:*` action routes through here. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row entry. |

---

## 2. Scope

### In scope

- One native LinkedIn document carousel per call: 8-12 slides, 1080×1080 px each (preferred) or
  1080×1350 px each (acceptable secondary aspect), exported as a single vector PDF.
- The accompanying LinkedIn caption (3-5 sentences + trailing hashtag block).
- A per-figure `citations.json` for every numeric or sourced claim on every slide.
- A `provenance.json` for any photo asset used inside the PDF.
- A `design_scorecard.json` recording QA gate results.
- Topic types: `listing` (a specific MLS# anchors the thesis), `market_brief` (city or region
  level claim), `neighborhood_insight` (subdivision or neighborhood-level claim).

### Out of scope

- Image-based LinkedIn carousels (those are uploaded as multi-image posts, not as documents.  use
  `instagram-carousel` with `aspect_ratio: 1080x1080` and cross-post to LinkedIn).
- Long-form LinkedIn articles (handled by `social_media_skills/blog-post/SKILL.md` with a
  LinkedIn variant).
- Sponsored / paid LinkedIn ads (handled by `social_media_skills/facebook-lead-gen-ad/SKILL.md`
  with a LinkedIn-ads sibling, not this producer).
- Cross-posting to other platforms (the caption is LinkedIn-native; the PDF is not the right
  format for IG / FB / Threads / TikTok / X).
- Listing brochures dressed as a market post. If the deliverable is fundamentally a listing
  brochure, route to `flyer-design` instead.

---

## 3. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:linkedin_doc_carousel` | `topic_type` + topic-keyed fields (see §4) + `market_insight_thesis` | One call → one PDF + one caption |

---

## 4. Brief payload schema

```typescript
type LinkedinDocTopicType = 'listing' | 'market_brief' | 'neighborhood_insight'

interface LinkedinDocCarouselPayload {
  topic_type: LinkedinDocTopicType

  // Required only when topic_type === 'listing'
  mls_id?: string

  // Required when topic_type !== 'listing'.
  // For market_brief: pass `city`. For neighborhood_insight: pass `neighborhood`.
  city?: string
  neighborhood?: string

  // The bold claim of slide 1.  the entire deck is built to support this thesis.
  // 6-12 words. No clichés. No hedging.
  // Example: "Tumalo rural is undervalued by 8%."
  market_insight_thesis: string

  // Total slide count including cover and CTA. Default 9. Range 8-12.
  slide_count?: number

  // Aspect ratio. Default '1080x1080'. '1080x1350' also acceptable.
  aspect_ratio?: '1080x1080' | '1080x1350'

  // Optional list_agent override for the CTA slide. Defaults to the listing agent
  // (when topic_type === 'listing') or matt-ryan (when brand-led).
  list_agent_slug?: 'matt-ryan' | 'paul-stevenson' | 'rebecca-peterson'
}

interface LinkedinDocCarouselActionRow {
  id: string
  action_type: 'content:linkedin_doc_carousel'
  target: string                            // 'mls:220189422' | 'city:Bend' | 'neighborhood:Tumalo'
  assigned_producer: string                 // path to this SKILL.md's directory
  payload: LinkedinDocCarouselPayload
  data_evidence: {
    audit_source?: string
    opportunity_area?: string
    signal_evidence?: string
  }
  generation_reason: string
  status: 'pending'
}
```

Validation rules before the producer renders anything:

1. `market_insight_thesis` is present, non-empty, 6-12 words, contains zero banned vocab.
2. `topic_type` resolves to exactly one of the three values.
3. If `topic_type === 'listing'`: `mls_id` is present and the listing row exists in Supabase.
4. If `topic_type !== 'listing'`: at least one of `city` or `neighborhood` is present.
5. `slide_count` (if provided) is integer in `[8, 12]`. Default to `9` if missing.

Missing or invalid field → surface to caller, do not render.

---

## 5. The recipe

**Step 1.  Read the action row**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Validate the payload
against §4. Immediately:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

**Step 2.  Load mandatory references**

Per §1. Do not proceed without loading `CLAUDE.md` §0, `CLAUDE.md` §0.5, the design system
SKILL.md, and the brand-voice guidelines.

**Step 3.  Resolve the listing or topic context**

If `topic_type === 'listing'`:

```sql
SELECT
  "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice", "StandardStatus", "PhotoURL", "PublicRemarks",
  "ListAgentFullName", "ListAgentEmail", "SubdivisionName",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "Latitude", "Longitude", "CumulativeDaysOnMarket",
  year_built, price_per_sqft
FROM listings
WHERE "MlsId" = '<mls_id>';
```

Resolve the listing agent from `"ListAgentFullName"` / `"ListAgentEmail"` to one of
`matt-ryan`, `paul-stevenson`, `rebecca-peterson`. If unresolvable, surface to caller.  do not
guess.

If `topic_type !== 'listing'`: pull the relevant market_stats_cache / market_pulse_live row(s)
for the geography in the payload. Print the raw row(s) for the verification trace.

**Step 4.  Build the per-slide content plan**

Produce a `config.json` at `out/linkedin-doc/<slug>/config.json` BEFORE running any render. The
config enumerates every slide, every figure on every slide, and the source query that produced
the figure. The build pipeline only renders from this config.

```json
{
  "slug": "<slug>",
  "topic_type": "<listing|market_brief|neighborhood_insight>",
  "aspect_ratio": "1080x1080",
  "slide_count": 9,
  "market_insight_thesis": "Tumalo rural is undervalued by 8%.",
  "list_agent_slug": "matt-ryan",
  "slides": [
    {
      "index": 1,
      "type": "cover",
      "thesis": "Tumalo rural is undervalued by 8%."
    },
    {
      "index": 2,
      "type": "data_primary",
      "kicker": "MEDIAN $/SQFT · TUMALO RURAL · LAST 12 MONTHS",
      "primary_stat": "$362",
      "supporting": "↓ 8.0% vs Bend SFR median $/sqft of $393",
      "source": "Supabase market_pulse_live · 2026-05-14T14:00:00Z"
    }
    //... index 3 through slide_count
  ]
}
```

Per CLAUDE.md §0, every figure in the config must trace to a live source pull in this session.  no inheriting numbers from prior chats, payloads, or web articles.

**Step 5.  Pull and verify every figure**

For every slide that contains a number, percentage, day count, or other claim:

- Identify the source: live Supabase (`listings`, `market_pulse_live`, `market_stats_cache`),
  Spark MLS API (`SPARK_API_BASE_URL` + `SPARK_API_KEY`), or a named primary source (NAR,
  ORMLS, Case-Shiller, Census, BLS, FRED, OHCS, Redfin Data Center, AEI, NAHB).
- Re-run the query fresh in this session.
- Print the raw result (row count, date window, filter).
- Cross-check derived stats (months of supply = active / (closed_last_6_months / 6); YoY%;
  median; price/sqft) and show the computation.
- Reconcile the figure to the slide's claim. A "seller's market" verdict next to 4.3 MoS is a
  fail.

If a stat can't be verified, cut the slide or rephrase to a qualitative claim that doesn't
require the number. Never approximate.

**Step 6.  Validate the thesis against the data**

Re-read `market_insight_thesis` against the supporting figures. If the supporting data does
not actually back the thesis, surface to Matt with the specific gap.  the thesis changes, not
the data.

**Step 7.  Render the PDF**

```bash
# Compositor lives at lib/render-linkedin-doc-carousel.mjs (build if absent.  uses the same
# canvas + fonts + brand assets pipeline as lib/render-ig-single-post.mjs).
#
# Two render paths are acceptable; pick one and hold it:
#   1) Playwright/Puppeteer HTML -> PDF with @font-face local() to design_system fonts.
#   2) Remotion composition rendered as PNG-per-slide, stitched to PDF via PDFKit /
#      sharp + hummus / pdf-lib. Slower but matches the Remotion stack already used for
#      video and IG carousels.
#
# Default: option (1).  Playwright HTML -> PDF. Faster, smaller files, vector-clean.
node lib/render-linkedin-doc-carousel.mjs \
  --config out/linkedin-doc/<slug>/config.json \
  --out out/linkedin-doc/<slug>/carousel.pdf
```

Pre-render asset audit:

- Fonts on disk:
  - `design_system/ryan-realty/fonts/Amboqia_Boriango.otf`
  - `design_system/ryan-realty/fonts/AzoSans-Medium.ttf`
  - Geist (404/500/600/700).  load via local `@font-face` referencing the next/font/geist
    package, or bundled from `design_system/ryan-realty/fonts/` if a fallback file is staged.
- Logos on disk:
  - `design_system/ryan-realty/assets/brand/logo-blue.png` (heritage navy on cream.  footer)
  - `design_system/ryan-realty/assets/brand/logo-white.png` (reversed.  CTA slide if used)
- Broker headshot on disk: `design_system/ryan-realty/assets/team/<list_agent_slug>.png`.
- Jax mascot (brand-led variants): `design_system/ryan-realty/assets/brand/blue-dog.png`.
- Hero photo on disk (listing variant) or pulled from Supabase `"PhotoURL"` / Spark.

If any asset is missing: stop, surface to caller, do not fall back to system fonts or substitute
images.

**Step 8.  Embed fonts in the PDF**

Verify in the rendered PDF that Amboqia Boriango, Geist (each weight used), and Azo Sans Medium
(if used) are embedded.  not just referenced. A PDF that ships without embedded fonts will
re-flow on a viewer's machine, breaking the design lock-up.

Validation: `pdffonts out/linkedin-doc/<slug>/carousel.pdf` must list every used family with
the "emb" column set to `yes`. Any `no` is a non-ship.

**Step 9.  Draft the LinkedIn caption**

Write `out/linkedin-doc/<slug>/caption.md`. Format (see §7 for full spec):

- 3-5 sentence intro. Bold the headline claim (`**...**`). Reference the document below.
- One CTA at the end: a single short sentence directing readers to comment / DM / save.
- Trailing hashtag block: `#RyanRealtyBend` first, then 3-6 topical tags. Each hashtag on its
  own line OR space-separated.  both work on LinkedIn; pick one style and hold it across the
  caption.
- Zero emoji. Zero exclamation marks. Zero em-dashes in body. Zero semicolons.
- No links inside the caption body (LinkedIn deprioritizes posts with outbound links). Document
  posts work because the PDF IS the artifact.

**Step 10.  Write citations.json**

One entry per figure shown anywhere on any slide. Required for the QA gate.

```json
{
  "figures": [
    {
      "slide": 2,
      "figure": "$362",
      "label": "Median $/sqft.  Tumalo rural.  last 12 months",
      "source": "Supabase market_pulse_live",
      "filter": "geography='tumalo_rural', period='last_12_months', property_type='A'",
      "column": "median_price_per_sqft",
      "value": 362,
      "fetched_at": "2026-05-14T14:00:00Z",
      "query": "SELECT median_price_per_sqft FROM market_pulse_live WHERE geography='tumalo_rural' AND period='last_12_months' AND property_type='A';"
    }
  ]
}
```

For any photo on a slide, write a `provenance.json` entry: source (MLS / approved photographer),
file path, license.

**Step 11.  Run the QA gate**

See §9. Write results to `out/linkedin-doc/<slug>/design_scorecard.json`. Any fail is a non-ship
until resolved.

**Step 12.  UPDATE the action row to ready**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=jsonb_build_object(
      'draft_path', 'out/linkedin-doc/<slug>/carousel.pdf',
      'caption_path', 'out/linkedin-doc/<slug>/caption.md',
      'citations_path', 'out/linkedin-doc/<slug>/citations.json',
      'scorecard_path', 'out/linkedin-doc/<slug>/design_scorecard.json',
      'slide_count', <n>,
      'aspect_ratio', '1080x1080'
    )
WHERE id='<id>';
```

**Step 13.  Surface to Matt**

Per §8 surface format. Then stop. Do not commit. Do not push. Wait for explicit approval.

---

## 6. Canvas, persistent elements, and slide composition

**Canvas.** 1080 × 1080 px per slide (preferred). 1080 × 1350 px also acceptable when payload
specifies it.

**Color register.** Heritage. Navy `#102742` on cream `#faf8f4`. Monochrome only. No gold. No
fir green. No sky blue. Two-color palette per CLAUDE.md (locked 2026-05-13).

**Persistent footer band** (every slide, byte-identical across the deck):

- Height: `120 px` (square 1080×1080) / `150 px` (portrait 1080×1350).
- Background: cream `#faf8f4` (deck is monochrome; the footer is a separator strip, not a navy
  band like the IG carousels). Thin top border: `1 px solid rgba(16,39,66,0.12)`.
- Left: `design_system/ryan-realty/assets/brand/logo-blue.png`, height `48 px` (square) / `56 px`
  (portrait), vertically centered, `40 px` from left edge.
- Right: slide numeral. Geist 500, `14 px` (square) / `16 px` (portrait), `rgba(16,39,66,0.65)`,
  right-aligned, `40 px` from right edge, vertically centered. Format: `3 / 9` with spaces
  around the slash.
- No phone number, no URL, no agent name, no "Ryan Realty" text.  the wordmark image carries
  the brand. Never re-typeset the wordmark.

**Content safe zone.** All slide content within `56 px` inset on left/right and `56 px` from
top. Content area terminates `16 px` above the footer band's top edge.

**Tabular numerals.** `font-variant-numeric: tabular-nums` on every price, count, percentage,
ratio, day figure. Non-negotiable.

---

## 7. Per-slide-type recipes

The default 9-slide composition. For an 8-slide deck, drop slide 5. For 10-12 slides, expand
the data-context block (slides 6-7) with additional comparison stats.

### 7.1 Slide 1.  Cover (market claim)

The scroll-stop. Must work as a standalone image.

- **Background:** cream `#faf8f4`. No photo. The thesis is the hero.
- **Eyebrow** (Azo Sans Medium, 14 px, navy `#102742`, UPPERCASE, letter-spacing `0.16em`,
  `y = 80, x = 56`):
  - For `listing` topic: `<NEIGHBORHOOD> · <CITY>, OREGON` (e.g. `TUMALO · BEND, OREGON`).
  - For `market_brief`: `<CITY>, OREGON · MARKET INSIGHT`.
  - For `neighborhood_insight`: `<NEIGHBORHOOD> · <CITY>, OREGON`.
- **Thesis** (Amboqia Boriango, 60 px, navy, line-height `1.10`, max 2 lines, centered
  vertically in the content area):
  The `market_insight_thesis` verbatim. E.g. `Tumalo rural is undervalued by 8%.` Title case
  is fine here.  this is the hero. Sentence ends with a period.
- **Document indicator** (Geist 500, 13 px, `rgba(16,39,66,0.55)`, UPPERCASE, letter-spacing
  `0.12em`, `y = content_area_bottom - 40`):
  `SWIPE → <slide_count - 1> SLIDES`. The arrow is the actual `→` Unicode glyph.

NOT a "Just Listed" cover. Even when `topic_type === 'listing'`, the thesis is a market claim,
not a listing announcement.

### 7.2 Slides 2-3.  Data chart slides

The headline data points that prove the thesis. One primary stat per slide.

- **Background:** cream `#faf8f4`.
- **Category kicker** (Azo Sans Medium, 14 px, navy, UPPERCASE, letter-spacing `0.12em`,
  `y = 80, x = 56`): the stat label with period and geography baked in. E.g.
  `MEDIAN $/SQFT · TUMALO RURAL · LAST 12 MONTHS`.
- **Primary stat** (Amboqia Boriango, 96-120 px square / 112-144 px portrait, navy,
  tabular-nums, centered horizontally, vertically `y = 280` for square / `y = 360` for
  portrait): the lead number with units. E.g. `$362`, `38 days`, `4.2 months`.
- **Supporting figure** (Geist 500, 28 px square / 30 px portrait, navy, tabular-nums, centered,
  `40 px` below primary stat):
  Comparison or delta with Unicode arrow: `↓ 8.0% vs Bend SFR median $/sqft of $393`. Always a
  signed arrow when the figure is a delta.
- **Source line** (Geist 400, 14 px, `rgba(16,39,66,0.55)`, centered, `48 px` above footer):
  `Source: <source_label> · <period>`. E.g. `Source: Supabase market_pulse_live · 2026-05-14`.

No chart graphics on these slides. The number IS the visual. Charts (if used at all) belong on
the dedicated chart slide (§7.4).

### 7.3 Slides 4-5.  Proof slides (context photo + 2-3 specific data points)

Bridge from headline stat to lived context. One interior, context, or location photo plus
overlaid data points.

- **Background:** cream `#faf8f4` for the bottom band; photo for the upper portion.
- **Photo** (top of content area, full content width, height ~ 55% of content height,
  `object-fit: cover`, 14 px corner radius applied across the photo's bottom edge only):
  - For `listing` topic: a listing photo from `"PhotoURL"` (MLS-traced, never AI).
  - For `market_brief` / `neighborhood_insight`: documentary Central Oregon photography (warm-
    lit landscape, downtown streetscape, Deschutes River, Smith Rock, etc.). Source-traced in
    `provenance.json`.
- **Caption** (Geist 600, 22 px, navy, `y = photo_bottom + 32, x = 56`, max 1 line):
  Short specific anchor. E.g. `12 acres on the western edge of Tumalo.` 8 words max.
- **Data point list** (3 rows, `y = photo_bottom + 80`, vertical stack with `24 px` gap
  between rows):
  - Row format: `<Label>` (Geist 500, 16 px, navy, left-aligned, x = 56) on the left,
    `<value>` (Geist 600, 22 px, navy, tabular-nums, right-aligned, x = content_width - 56)
    on the right.
  - Examples: `Lot size  ·  12.04 acres`, `Year built  ·  2018`, `Comparable median $/sqft  ·  $394`.
- **Source line** (Geist 400, 12 px, `rgba(16,39,66,0.55)`, bottom-right of content area, `40 px`
  above footer): `Source: <source>`.

Every data point on the slide must have a `citations.json` entry.

### 7.4 Slides 6-7.  Market context (comparison or trend)

The wider market frame that makes the thesis defensible. Comparison stats with verified primary
sources.

- **Background:** cream `#faf8f4`.
- **Category kicker** (Azo Sans Medium, 14 px, navy, UPPERCASE, letter-spacing `0.12em`,
  `y = 80, x = 56`): the comparison frame. E.g. `TUMALO RURAL VS BEND SFR · 2024 → 2026`.
- **Comparison table** (3-4 rows max, `y = 220`, content width with `56 px` gutter):
  - Header row (Geist 500, 14 px, navy `rgba(16,39,66,0.75)`, UPPERCASE, letter-spacing
    `0.08em`, bottom border `1 px solid rgba(16,39,66,0.18)`).
  - Body rows: label column (Geist 500, 20 px, navy, left), value columns (Geist 600, 28 px,
    navy, tabular-nums, right-aligned). Row separator `1 px solid rgba(16,39,66,0.10)` between
    body rows.
  - Each column gets a clear period or geography header.  never "2024" alone; always "2024 H1
    · Tumalo" or similar.
- **OR.  single-metric trend line** (one Recharts/SVG-style line plot, 800 px wide × 320 px
  tall, centered):
  - Line stroke: navy `#102742`, 2.5 px.
  - Plot area: cream background, axis lines `rgba(16,39,66,0.18)`, grid lines
    `rgba(16,39,66,0.06)`.
  - Axis labels: Geist 400, 12 px, `rgba(16,39,66,0.65)`, tabular-nums on numeric axes.
  - Data labels at min and max points only: Geist 500, 14 px, navy, tabular-nums.
- **Caption** (Geist 400, 18 px, navy, `y = data_block_bottom + 32, x = 56`, max 2 lines): one
  sentence that names the comparison and the takeaway. E.g.
  `Tumalo rural $/sqft has tracked 6-10% below Bend SFR for eight straight quarters.`
- **Source line** (Geist 400, 14 px, `rgba(16,39,66,0.55)`, centered, `48 px` above footer):
  `Source: <source> · <period>`.

### 7.5 Slide 8.  Implication ("what this means")

The pull quote slide. One idea that ties the data back to a buyer or seller decision.

- **Background:** cream `#faf8f4` (or navy `#102742` for emphasis.  pick one rhythm and hold
  it; never alternate). Default cream.
- **Category kicker** (Azo Sans Medium, 14 px, navy, UPPERCASE, letter-spacing `0.16em`,
  `y = 80, x = 56`): `WHAT THIS MEANS`.
- **Pull quote** (Amboqia Boriango, 48 px, navy if cream bg / cream if navy bg, line-height
  `1.20`, max 4 lines, centered vertically in content area):
  E.g. `A buyer with $1.1M can step into Tumalo rural at 8% less per square foot than the Bend
  median.` 24 words max. Sentence ends with a period.
- **Attribution line** (Geist 400, 14 px, `rgba(16,39,66,0.55)` on cream / `rgba(250,248,244,0.65)`
  on navy, centered, `40 px` above footer):
  `Ryan Realty market analysis · <month YYYY>`.

No exclamation marks. No "Don't miss out." No hype.

### 7.6 Slide 9.  CTA (DM-for-the-brief offer)

Always the last slide. A quiet, specific offer.  not a hard sell.

- **Background:** navy `#102742` full bleed (footer band switches to navy on this slide only,
  with `logo-white.png` instead of `logo-blue.png`).
- **Eyebrow** (Azo Sans Medium, 14 px, cream `#faf8f4`, UPPERCASE, letter-spacing `0.16em`,
  centered, `y = 200`): `THE FULL BRIEF`.
- **Offer headline** (Amboqia Boriango, 48 px, cream, line-height `1.10`, centered, max 2
  lines, `y = 260`):
  - For `listing`: `Comment GUIDE for the full <neighborhood> brief.`
  - For `market_brief`: `Comment GUIDE for the full <city> market brief.`
  - For `neighborhood_insight`: `Comment GUIDE for the full <neighborhood> brief.`
  - Alternate: `DM us for the full brief.` if the post is below 500 comments and Matt prefers
    the DM route. Default to the comment route.  it produces visible engagement signal.
- **Broker block** (centered, `y = 520`):
  - Headshot (`design_system/ryan-realty/assets/team/<list_agent_slug>.png`, transparent),
    `160 px` wide, centered, `border-radius: 50%` crop.
  - Name (Geist 500, 22 px, cream, centered, `24 px` below headshot): the broker's full name.
  - Role (Geist 400, 16 px, `rgba(250,248,244,0.75)`, centered, `8 px` below name): the broker's
    title.  `Owner / Principal Broker` (Matt) or `Broker` (Paul, Rebecca).
- **Contact line** (Geist 400, 18 px, cream, tabular-nums on phone, centered, `48 px` above
  footer):
  `541.703.3095 · ryan-realty.com`
- **NO hashtags on the slide.** Hashtags belong in the caption, never on the canvas.
- **NO QR codes** in the standard layout. (LinkedIn document viewer is mobile-first; QR codes
  on slide 9 are redundant when the contact line is right there.)

The CTA slide carries the only navy background in the deck and the only `logo-white.png`. The
rest of the deck is cream-on-cream-on-cream.  restraint is the brand register here.

---

## 8. Output and surface format

**Draft lands at:** `out/linkedin-doc/<slug>/`

**Files produced:**

```
out/linkedin-doc/<slug>/
├── config.json              ← slide content plan (data + layout map)
├── carousel.pdf             ← the deliverable.  vector PDF, embedded fonts
├── caption.md               ← the LinkedIn-native caption that ships with the PDF
├── citations.json           ← one entry per figure shown
├── provenance.json          ← photo source + license per photo
├── fonts_used.json          ← exact font files embedded (cross-check pdffonts output)
└── design_scorecard.json    ← QA gate results
```

`<slug>` format:

- `listing` topic: `<mls_id>-<topic_slug>` (e.g. `220189422-tumalo-rural-undervaluation`).
- `market_brief` / `neighborhood_insight`: `<geography_slug>-<topic_slug>-<yyyy-mm>` (e.g.
  `tumalo-rural-undervaluation-2026-05`).

### Surface format (present to Matt exactly like this)

```
LinkedIn document carousel ready for review.  <topic_type> · <slug>

  PDF
    Path: out/linkedin-doc/<slug>/carousel.pdf
    Slides: <n> · <aspect_ratio>
    Fonts embedded: Amboqia Boriango, Geist 400/500/600/700, Azo Sans Medium (if used)
    File size: <X.X MB>

  CAPTION
    Path: out/linkedin-doc/<slug>/caption.md
    Word count: <n>
    Hashtag block: #RyanRealtyBend + <n> topical tags

  MARKET INSIGHT THESIS
    "<the verbatim thesis from slide 1>"

  VERIFICATION TRACE
    - <figure>.  <source>, <filter>, fetched <iso>
    [one line per figure across all slides]

  citations.json: out/linkedin-doc/<slug>/citations.json
  design_scorecard.json: out/linkedin-doc/<slug>/design_scorecard.json

Reply "ship it" / "approved" / "go" to commit + push.
```

Then stop. Do not commit. Do not push. Wait for Matt's explicit approval.

---

## 9. QA gate

Run before surfacing. Write to `design_scorecard.json`. Any `fail` = non-ship until resolved.

| # | Check | Pass condition |
|---|---|---|
| 1 | Slide count | 8 ≤ n ≤ 12; cover is slide 1; CTA is slide n |
| 2 | Canvas dimensions | Every slide exactly 1080 × 1080 (preferred) or 1080 × 1350; aspect held across the deck |
| 3 | Vector PDF | Output is a single PDF; `file out/<slug>/carousel.pdf` reports PDF; no rasterized full-page bitmaps |
| 4 | Fonts embedded | `pdffonts` output lists Amboqia Boriango, Geist (every weight used), Azo Sans Medium (if used), all with `emb=yes` |
| 5 | Footer continuity | Footer height, logo path, slide numeral style, footer background identical across slides 1 through n-1; CTA slide (n) is the only exception (navy variant) |
| 6 | Slide numeral format | Every slide shows `<index> / <slide_count>` with spaces around the slash |
| 7 | Tabular numerals | Every price, percentage, day count, ratio renders with `font-variant-numeric: tabular-nums` |
| 8 | Data verified | Every figure on every slide traces to `citations.json` with `source`, `filter`, `column`, `value`, `fetched_at` |
| 9 | Thesis backed by data | The supporting figures on slides 2-7 substantiate the slide-1 thesis; the QA agent re-reads the thesis against the data and confirms |
| 10 | Photo integrity | If any slide has a photo: source traced in `provenance.json`; no watermarks; no AI fakes |
| 11 | Safe zone | No critical content within 56 px of left/right or 56 px of top; nothing within 16 px of footer top edge |
| 12 | Color compliance | Navy `#102742` + cream `#faf8f4` only on slides 1-(n-1); navy + cream on CTA slide. Zero gold (`#D4AF37`, `#C8A864`). Zero fir, zero sky. No off-brand hex |
| 13 | Banned vocab clean | Grep every on-slide text element AND `caption.md` against the banned vocab union.  zero hits |
| 14 | No emoji | Grep canvas + caption for emoji code points.  zero hits |
| 15 | No exclamation marks | Grep canvas + caption.  zero `!` characters in body copy (allowed only inside a verbatim quote attributed to a third-party source) |
| 16 | No em-dashes / semicolons | Grep canvas + caption.  zero `. ` or `;` in body copy (em-dash allowed only as a "no data" placeholder on a data slide) |
| 17 | Hashtag rule | `caption.md` trailing hashtag block leads with `#RyanRealtyBend`; 4-7 hashtags total |
| 18 | No links in caption | `caption.md` body contains zero `http://` / `https://` / `www.` URLs (LinkedIn deprioritizes link posts; document IS the artifact) |
| 19 | Broker resolution | List agent / list_agent_slug resolves to one of three brokers; headshot file exists |
| 20 | File size | `carousel.pdf` < 10 MB (LinkedIn document upload soft limit; 100 MB hard limit, but stay well under) |
| 21 | CTA route | Slide n contact line uses `541.703.3095` (FUB-tracked bio phone).  NOT `541.213.6706` (direct line). Per CLAUDE.md voice rules: bio phone for inbound lead capture |

Photo slides may be downgraded to cream-only if no MLS-traced or documentary photo is available.
NEVER stand in an AI-generated photo.

---

## 10. The LinkedIn caption (caption.md)

LinkedIn document posts pair the PDF with a short native caption. The caption draws attention
to the PDF; the PDF does the work.

**Format:**

```
**<Headline claim.  bold first sentence, verbatim the slide-1 thesis or a tighter restatement>**

<Sentence 2.  the specific data point that makes the claim defensible. One figure with its
unit. No hedging.>

<Sentence 3.  the implication for a buyer or seller. One sentence. Active voice.>

<Optional sentence 4.  a second data point or comparison if it strengthens the case without
repeating slide content.>

<CTA sentence.  one short imperative. "Comment GUIDE for the full brief." or "DM for the
data behind this." Never "Reach out!", never "Don't miss out!", never exclamation marks.>

#RyanRealtyBend
#BendOregonRealEstate
#CentralOregon
#<TopicTag1>
#<TopicTag2>
#<OptionalTopicTag3>
```

**Constraints:**

- 3-5 body sentences. Word count target: 80-150 words.
- Bold the headline claim with markdown `**...**` (LinkedIn renders this as bold in the post
  preview).
- No emoji. No exclamation marks. No em-dashes in body. No semicolons in body. No "delve,"
  "leverage," "tapestry," "navigate," "robust," "seamless," "comprehensive," "elevate,"
  "unlock."
- No outbound URLs in the body (LinkedIn deprioritizes link posts).
- Hashtag block at the end. `#RyanRealtyBend` first, mandatory per CLAUDE.md "Voice + content"
  HARD RULE (locked 2026-05-14). 4-7 hashtags total. Topical tags must be specific to the
  thesis.  never generic `#realestate`, `#realtor`, `#dreamhome`.
- "You / your" is the subject. "Our team" for broker identity. Never "I."
- One CTA only. Never two competing calls to action.

**Example caption:**

```
**Tumalo rural is undervalued by 8% per square foot vs the Bend SFR median.**

Last 12 months: Tumalo rural closed at $362/sqft median, Bend SFR closed at $393. The gap has
held for eight straight quarters across 247 closed sales.

A buyer with $1.1M can step into Tumalo rural at meaningfully less per square foot than the
Bend median.  same school district, fewer neighbors, faster trail access.

Comment GUIDE for the full Tumalo brief.

#RyanRealtyBend
#BendOregonRealEstate
#CentralOregon
#TumaloOregon
#PricePerSquareFoot
```

---

## 11. Voice register

LinkedIn carries gravitas. Match the tone of a McKinsey Insights piece.  short paragraphs,
declarative claims, every claim cited. Reference: `marketing_brain_skills/brand-voice/voice_guidelines.md`.

**Apply:**

- Short sentences. Active voice. One idea per slide.
- Specific facts over qualitative claims. "$362/sqft median" not "competitive pricing."
- Neighborhood names over "the area." "Tumalo rural" not "rural acreage near Bend."
- Currency rounded to the nearest thousand for consumer-facing display; the exact figure is
  in `citations.json`.
- Percentages: one decimal, signed arrow: `↑ 2.1% YoY` / `↓ 8.0% vs Bend SFR`.
- Days: integer + "days": `38 days`.
- Unavailable data: em-dash `. ` placeholder (the only allowed em-dash usage).
- Phone (CTA slide): `541.703.3095` (dotted, FUB-tracked bio phone).
- Web: `ryan-realty.com` (hyphenated lowercase).

**Banned vocab (zero tolerance.  see voice_guidelines.md §6 for the full union):**

Real-estate clichés: `stunning`, `nestled`, `boasts`, `charming`, `pristine`, `gorgeous`,
`breathtaking`, `must-see`, `dream home`, `meticulously maintained`, `entertainer's dream`,
`tucked away`, `hidden gem`, `truly`, `spacious`, `cozy`, `luxurious`, `updated throughout`,
`turnkey`, `immaculate`, `captivating`, `exquisite`, `premier`, `luxury`, `boutique`,
`concierge`, `white-glove`, `passionate`, `dedicated`.

AI filler: `delve`, `leverage`, `tapestry`, `navigate`, `robust`, `seamless`, `comprehensive`,
`elevate`, `unlock`, `holistic`, `dynamic`, `vibrant`, `bustling`, `eclectic`, `curated`,
`bespoke`, `foster`.

Hedging: `approximately`, `roughly`, `about`, `around`, `fairly`, `somewhat`, `may`, `could`,
`potentially`.

Marketing exhortations: `Don't miss out`, `Act now`, `Limited time`, `won't last`,
`Your real estate journey`.

Punctuation in body: em-dashes, semicolons, dramatic colons. (Em-dash allowed only as a "no
data" placeholder.)

---

## 12. Approval gate

`matt-review-draft`.  Matt sees the rendered PDF + caption + citations + scorecard, then says
"ship it" / "approved" / "go" before any commit or LinkedIn upload.

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the draft and says "ship it" / "approved" / "go" | Matt only |

Per CLAUDE.md §0.5, silence is never approval. A passing QA gate is never approval. A
successful PDF render is never approval. Wait for the words.

---

## 13. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ PDF rendered, caption drafted, QA passed
        ▼
      ready        ← executor_response populated with draft_path + caption_path + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ publish step completes (commit + push to repo; LinkedIn upload is manual per
        │ CLAUDE.md §0.5.  LinkedIn document upload is not an automated API path)
        ▼
    executed       ← terminal success
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes LinkedIn impressions / comments / DMs to
                     content_performance

    killed         ← terminal failure; Matt cancels, or QA fails after 2 auto-iterations
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=jsonb_build_object(
      'draft_path', 'out/linkedin-doc/<slug>/carousel.pdf',
      'caption_path', 'out/linkedin-doc/<slug>/caption.md',
      'citations_path', 'out/linkedin-doc/<slug>/citations.json',
      'scorecard_path', 'out/linkedin-doc/<slug>/design_scorecard.json',
      'slide_count', 9,
      'aspect_ratio', '1080x1080'
    )
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 14. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull + market data + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, project `dwvlophlbvvygjfxcrhm` |
| Spark MLS API | reconciliation gate for active inventory + DOM | `SPARK_API_BASE_URL`, `SPARK_API_KEY` |
| Playwright (HTML → PDF) | default render pipeline | `lib/render-linkedin-doc-carousel.mjs` |
| pdf-lib / PDFKit | alt render pipeline (Remotion PNG → PDF stitch) | `lib/render-linkedin-doc-carousel.mjs` |
| pdffonts | font-embedding verification in QA gate | `brew install poppler` |
| Fonts on disk | Amboqia Boriango, Azo Sans Medium | `design_system/ryan-realty/fonts/` |
| Geist | body / UI / data font | local `@font-face` or next/font/geist |
| Brand assets | logos, mascot, headshots | `design_system/ryan-realty/assets/` |
| Asset library CLI | post-approval registration | `node lib/asset-library.mjs register...` |

---

## 15. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Missing `market_insight_thesis` | Payload validation fails at §4.1 | Surface to caller with the specific missing field. Do not render. Do not fabricate a thesis from the topic. |
| Thesis fails banned-vocab check | Banned word inside the thesis | Surface to caller with the offending word and the voice_guidelines.md rule. Do not silently rewrite Matt's claim. |
| Listing row not found | `topic_type === 'listing'` and Supabase returns 0 rows for `mls_id` | Surface to caller with the query and the empty result. Suggest verifying the MLS# or switching `topic_type` to `market_brief`. |
| Source data unavailable for thesis | Market query returns 0 rows or the supporting stat doesn't exist for the geography / period | Surface to Matt with the exact query, the row count, and a suggestion to broaden the geography (e.g. "Tumalo rural" → "Tumalo CCD") or tighten the period. Do not render with placeholder numbers. |
| Thesis not backed by data | QA gate check #9 fails.  supporting figures don't substantiate the slide-1 claim | Surface to Matt with the gap: the thesis, the supporting figure values, and why the data doesn't carry the thesis. Offer to rewrite the thesis to match the data, or pause for Matt's call. |
| PDF font embedding fails | `pdffonts` output shows `emb=no` for any used family | Stop. Verify font files are on disk and reachable to the render pipeline. Re-render. Never ship without embedded fonts. |
| Photo source untraced | Photo on a proof slide doesn't appear in `provenance.json` | Stop. Pull source from MLS / approved photographer. If no source available, drop the photo and convert the slide to a cream-only data layout. Never use untraced or AI-generated photos. |
| Broker not resolved | `list_agent_slug` doesn't map to one of three brokers, or listing agent on the row isn't a Ryan Realty broker | Surface to Matt; offer fallback to `matt-ryan` for brand-led variants or pause to disambiguate. |
| Banned vocab on canvas | Grep hits in any slide text element | Stop. Rewrite the offending line. Re-validate. If the violation is in the thesis itself, escalate to Matt for a rewrite.  do not silently swap words. |
| Em-dash or semicolon in caption | Grep hits in `caption.md` body | Rewrite to a period or line break. Re-validate. (Em-dashes allowed only as a "no data" placeholder on data slides.) |
| Caption missing `#RyanRealtyBend` | Hashtag block doesn't lead with the brand tag | Stop. Add `#RyanRealtyBend` as the first hashtag. The rule is HARD per CLAUDE.md "Voice + content" (locked 2026-05-14). |
| Caption contains an outbound URL | Grep finds `http://`, `https://`, or `www.` in caption body | Strip the URL. LinkedIn deprioritizes link posts. The PDF IS the artifact. If the URL is genuinely necessary, surface to Matt for a call. |
| File size > 10 MB | LinkedIn document soft limit exceeded | Run a PDF compression pass (`gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook...`) or downsample any embedded photos to 1080 px max width before re-render. Hard limit is 100 MB; the deliverable should be well below 10 MB. |
| Render timeout | Playwright / Remotion process hangs > 10 min | Kill the process. Report to Matt with the last successful slide index and the error log. Do not present a partial deck. |
| Missing env var | Supabase / Spark / asset path not in env | Report to Matt with the specific variable, the tool that needs it, and what to set. Do not guess or hard-code. |

**Open spec questions** (resolved best-call, document for future revision):

- **Default aspect:** chose `1080x1080` because LinkedIn's document viewer is mobile-first and
  square slides minimize scroll within a single slide. Matt may prefer `1080x1350` for parity
  with IG carousels.  overridable via payload `aspect_ratio`.
- **Default slide count:** 9. Matches the 1 cover + 2 data + 2 proof + 2 context + 1 implication
  + 1 CTA structure cleanly. 8 collapses the proof block; 10-12 expand context.
- **CTA route.  comment vs DM:** defaulted to comment ("Comment GUIDE") because comments are
  visible engagement signal that lifts the post's organic reach on LinkedIn. DM-only routes
  hide the signal. Matt can override via a payload field in a future revision.
- **Hashtag count:** defaulted to 5 (one brand tag + 3-4 topical tags). LinkedIn's algorithm
  doesn't penalize hashtags but doesn't reward stuffing past 5-7 either. Stay tight.

---

## 16. What not to do

1. **Do not write a listing brochure.** Even when `topic_type === 'listing'`, the framing is
   "what this $1.1M sale in Tumalo tells us about the Central Oregon market".  not "tour this
   beautiful home." If the deliverable reads as a brochure, restructure or route to `flyer-design`
   instead.
2. **Do not fabricate numbers.** Every figure on every slide traces. No "approximately," no
   round-fill, no LLM recall.
3. **Do not substitute fonts.** If Amboqia Boriango, Geist, or Azo Sans Medium fail to embed,
   the render fails. No Playfair, no Georgia, no system fallback shipped as final.
4. **Do not use AI-generated photos.** Hard fail per ANTI_SLOP_MANIFESTO. Listing photos must be
   MLS-traced. Brand photos must be documentary and `provenance.json`-traced.
5. **Do not use gold, fir, or sky in the deck.** The v2 palette is two-color: navy `#102742` and
   cream `#faf8f4`. Gold tokens (`#D4AF37`, `#C8A864`) belong to the legacy video system and are
   banned here.
6. **Do not re-typeset the wordmark.** Use `logo-blue.png` (footer) and `logo-white.png` (CTA
   slide footer). Typing "Ryan Realty" in Amboqia is not the wordmark.
7. **Do not exceed 12 slides.** LinkedIn document posts perform best in the 8-12 range. More
   slides reduce completion rate and dilute the thesis.
8. **Do not put a hashtag on the slide canvas.** Hashtags go in the caption only. Slides are
   clean.
9. **Do not put a URL in the caption body.** LinkedIn deprioritizes link posts. The PDF IS the
   artifact. The CTA slide already shows `ryan-realty.com`.
10. **Do not use exclamation marks.** Anywhere. The brand voice is direct and kind, not
    exclamatory.
11. **Do not commit or upload before Matt explicitly approves.** Render to `out/linkedin-doc/<slug>/`,
    show paths, wait for "ship it." Per CLAUDE.md §0.5.  draft-first, commit-last.
12. **Do not skip the citations.json.** A deck without citations is a deck that can't be defended
    when a viewer asks "where did you get that number?" The citations exist so the answer is
    one click away for Matt and one paragraph away for the producer next session.

---

## 17. See also

- `social_media_skills/instagram-carousel/SKILL.md`.  multi-slide IG/FB companion (Patterns A/B/C/D)
- `social_media_skills/ig-single-post/SKILL.md`.  single IG/FB image post (S1-S10 templates)
- `social_media_skills/flyer-design/SKILL.md`.  static print/digital flyers
- `social_media_skills/blog-post/SKILL.md`.  long-form blog posts (LinkedIn article variant
  candidate)
- `social_media_skills/list-kit/SKILL.md`.  at-Active orchestrator (may dispatch a LinkedIn doc
  carousel as one fan-out deliverable in a future revision)
- `social_media_skills/platform-best-practices/SKILL.md`.  2026 LinkedIn rule layer
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md`.  Section B row entry
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab union, voice attributes
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint
- `automation_skills/content_engine/SKILL.md`.  content routing bus
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content gate
- `design_system/ryan-realty/SKILL.md`.  brand system (authoritative)
- `design_system/ryan-realty/colors_and_type.css`.  color + type tokens

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
