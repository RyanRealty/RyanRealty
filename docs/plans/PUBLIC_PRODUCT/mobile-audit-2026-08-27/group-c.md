# Mobile audit — Group C — 2026-08-27

Routes: /housing-market, /housing-market/central-oregon, /housing-market/bend,
/housing-market/annual-review, /blog, /blog/bend-buyers-market-shift-2026 (first link off /blog).

**Capture-pipeline notes (read before trusting a "missing/overflow" finding below):**

1. **`sips --cropToHeightWidth ... --cropOffset` does not crop from the image's top-left
   origin the way the audit method assumes.** Empirically, `--cropOffset Y 0` on a tall PNG
   did NOT return the band starting at pixel row Y from the top — offset 0 returned a window
   centered mid-image, and increasing the offset moved the window *up* the image, not down.
   Confirmed by cropping a known-content viewport screenshot at offset 0 and 300 and comparing
   against the ground-truth full image: offset 0 landed mid-page, not at row 0. Group D
   separately found a related sips edge case (a crop landing exactly on the bottom edge
   silently no-ops). Given both, sips was dropped entirely. **Fix: cropped every band with a
   small PIL script (`crop_bands.py`, unambiguous top-left-origin `im.crop((0,y,w,y+1000))`)
   instead.**
2. **Raw `chrome --headless=new --screenshot` mis-renders this site's custom display font
   (Amboqia Boriango, `next/font/local`, `font-display: swap`) at 390px, reproducibly, across
   virtual-time-budgets from 4s to 9s, with and without the iPhone UA, and in both
   `--headless=new` and classic `--headless`.** The H1 and stat-tile labels rendered in a wider
   fallback face that overflowed the 390px frame and got clipped (e.g. "Central Oregon housing
   market: a balanced mar[ket]" cut off mid-word, second stat tile's label cut off). Cross-checked
   against a real interactive Chrome render (Playwright driving the full `channel: 'chrome'`
   binary, explicitly awaiting `document.fonts.ready`) and against a live DOM query
   (`getBoundingClientRect`, `scrollWidth === innerWidth === 390`, no overflow): the page wraps
   correctly and there is no clipping. This matches Group D's independent finding of headless-only
   text-rendering bugs on this environment. **Fix: replaced the raw Chrome CLI capture with a
   small Playwright script (`scratch-pw-shot.mjs`) — full Google Chrome binary via
   `channel: 'chrome'`, iPhone 390×844 viewport/UA, `await page.evaluate(() => document.fonts.ready)`
   plus an 800ms settle, then `page.screenshot({ fullPage: true })`.** This is the capture method
   for every band below. A "FIX-NOW" in this doc reflects what this verified pipeline (or a live
   DOM check) actually showed, not a raw headless artifact.
3. **Blog hero-image thumbnails were already fully wired before this audit** (Matt's addendum
   asked me to check): `blogIndexRow()` in `app/blog/_v3/blog-index-rows.ts` already builds
   `media: { src: hero_image_url }` for every row, `getPublishedBlogPosts` already selects
   `hero_image_url` and resolves it through `resolveBlogHeroImage()` (`lib/blog-hero-images.ts` —
   verified local Central Oregon photography, never a remote/stock/dead URL), and `V3Ledger`
   (`components/site/v3/V3Ledger.tsx:333-348`) already renders it as a 44×44 (`--v3-tap`),
   `object-fit: cover`, `border-radius: sm`, lazy-loaded `<img>`. Confirmed rendering correctly
   at 390px in the live browser (screenshot below). No fix needed — this shipped previously
   (git blame: `471be5b7`/earlier), not part of this pass.
4. **`page.screenshot({ fullPage: true })` intermittently shows a plain gray box for any
   `loading="lazy" decoding="async"` `<img>` that scrolled past during the stitch, even though
   the DOM reports it `complete: true` with a valid `naturalWidth`** — the network fetch and
   decode finish, but the paint/composite for that scroll segment doesn't land in the stitched
   frame. Reproduced on blog hero thumbnails, the listing-rail photos, and a broker headshot;
   in every case a follow-up `window.scrollTo` + single-viewport screenshot at that exact
   position, waited 1s, showed the real photo. Also reproduced the same "duplicate top-of-page
   content at the tail of the tall image" stitching artifact Group D did not report but is the
   same failure class — confirmed NOT real via `document.querySelectorAll('h1').length === 1`
   and a scroll-to-bottom viewport screenshot showing the true footer. **Any band below showing
   a gray box where a photo is expected, or a repeat of page-top content past the real footer,
   is this artifact, not a product bug** — noted FINE, not flagged.

---

## /housing-market

Region-level hub. Same section family as central-oregon and bend below (this route family
shares almost all its section builders, so findings repeat across the three routes below —
noted once here, referenced after).

**FIX-NOW (shared, NOT fixed — outside `components/site/v3/*` fix authority):** the "ALL-TYPE
composition" mix chart (stacked bar + legend, 8 property-type categories: All Residential,
Land, Manufactured in Park, Residential Income (2–4), Commercial Sale, Farm, Commercial Lease,
Business Opportunity) is unreadable at any size, not just 390px. `components/site/v3/V3Chart.tsx`
caps visual distinction at 3 slots — `Math.min(s.index, 2)` for the bar segments (line ~544,
`v3-chart__bar--${Math.min(s.index, 2)}`) and `Math.min(i, 2)` for the legend swatches (line
~392, non-yoy branch) — while `components/site/v3/V3Chart.css:142-151` defines only 3 distinct
fills (`.v3-chart__bar` = `--v3-ink`, `--1` = `--v3-ink-muted`, `--2` = `--v3-edge`). With 8
real categories, indices 2–7 (6 of 8) all render the identical pale `--2` fill in the bar AND
the identical swatch in the legend — "Manufactured in Park," "Commercial Sale," "Farm,"
"Commercial Lease," and "Business Opportunity" are visually indistinguishable from each other
in both the bar and its own legend. Band: `bands/b_housing-market/band_6.png`, zoomed at
`zoom_composition.png`. Caller: `app/housing-market/_v3/market-charts.ts:189`
(`buildCompositionChart`), invoked from `app/housing-market/_v3/hub-sections.ts:196` — within
my authority, but the cap is a rendering-primitive limit, not a caller-side data problem (all 8
categories are real, verified §0 data; trimming them to fit a 3-color palette would delete
information the composition claims to summarize). **Proposed fix (for the v3 owner):** either
extend the mix-chart palette beyond 3 slots (add 2–3 more fill/pattern steps sized to the real
max category count seen in production — 8, here), or route a `kind: 'mix'` series past some
category-count threshold to a ledger/list rendering instead of a stacked bar, since a bar
segment for a ~0.03% share (e.g. "2 business opportunity closes" of "5,769 closed") cannot be
made visible at any color depth. Present on `/housing-market` (`band_6`) and
`/housing-market/central-oregon` (`band_6`); absent on `/housing-market/bend` (that page has no
composition chart).

**IMPROVE (shared, NOT fixed):** the 5-series YoY overlay chart ("Fourth year in the 6s," 30-yr
mortgage rate by year) is legible for its main point (current year vs. history) but 4 of the 5
context lines (2023–2026) cluster tightly in a ~1pp band and are hard to individually trace at
390px — distinguishing "which muted line is 2024 vs 2025" is a stretch. `components/site/v3/V3Chart.tsx`
lines ~112 (`V3_CHART_CATEGORY_SLOTS = 5`), ~393 (yoy legend keys), CSS palette for
`v3-chart__key--cat0..4`. Band: `zoom_yoy5.png`. Lower priority than the mix-chart bug — the
primary story still reads.

**FIXED (mine):** the by-property-type stat tiles (condos, townhomes, manufactured homes on
land/in parks, 2–4 unit buildings, lots, farms, commercial) each ran all ~9
`publicSegmentDisplayBits()` stats into one gray run-on paragraph under the count — e.g. "118
CONDOS FOR SALE · $362,000 · 14.2 MONTHS · BUYER'S · 9 PENDING · NOW · 109 CLOSED · 12 MONTHS ·
51 DAYS TO CONTRACT · 12 MONTHS · 93.3% SALE TO ORIGINAL · 12 MONTHS · -9.7% YOY MEDIAN CLOSE ·
12 MONTHS · 50.5% CLOSED WITH A PRICE CUT · 12 MONTHS" — a wall of text with "12 MONTHS" bare
as a separator label twice per tile, no hierarchy, 8+ lines per tile at 390px. Bands:
`b_housing-market/band_0-1.png`, `b_central-oregon/band_0.png`, `b_bend/band_0-1.png`.
**Fix:** `app/housing-market/page.tsx` (line ~265) and
`app/housing-market/central-oregon/page.tsx` (line ~269) now slice `publicSegmentDisplayBits(row)`
to its first 3 entries (price, months of supply, buyer's/seller's verdict — the segment's
headline read) before joining. Nothing is deleted from the site: the full 9-stat detail is one
tap away behind the tile's existing `href` to the segment's browse/explorer page. Verified
after-state: `housing-market_after.png` — tile now reads "118 CONDOS FOR SALE · $362,000 · 14.2
MONTHS · BUYER'S" in 3-4 lines. `/housing-market/bend` shows the identical pattern but its
figures come from `app/housing-market/[...slug]/_v3/geo-figures.ts`, a file also imported by
`app/communities/[slug]/page.tsx`, `app/zip/[zip]/page.tsx`, and `app/cities/[slug]/page.tsx`
(other audit groups' routes) — **not fixed**, recorded for the orchestrator to coordinate across
groups rather than risk a change outside my route ownership.

**FINE:** monochrome line charts (3-year median-close overlay, Case-Shiller index comparison,
mortgage-minus-treasury spread), bar charts (concessions by quarter), the "Market by city" and
"Closed sales by city" ledgers, FAQ, "Ask a broker" form, footer. All wrap and reflow correctly
at 390px once verified against the real Chrome render.

**Minor, not flagged as a fix:** `/housing-market` states median list price as `$749,900`;
`/housing-market/annual-review` FAQ states `$750,000` for the same underlying figure (both
"as of August 2026"). $100 apart, almost certainly two legitimate roundings of the same live
figure (hub shows the exact count, annual-review's FAQ prose rounds it) rather than a stale-cache
bug, but flagging since CLAUDE.md flags two-generation-path divergence as a known failure class —
worth a quick trace if it recurs elsewhere.

**Position-only (not mine to fix, per instructions):** the floating "N" chat/help button sits
bottom-left and overlaps the last stat tile's text at the bottom of the first viewport
(`band_0.png`, obscuring part of "...12 MONTHS · +0.3%..."), and again overlaps the fixed cookie-
consent banner at the true page end (`hm_scrollend.png`).

## /housing-market/central-oregon

Same section family as `/housing-market` above (median-list hero, property-type stat tiles,
composition chart, closed-sales-by-year ledger back to 1998, FAQ, broker form, footer) — same
findings apply: composition-chart FIX-NOW (band_6), stat-tile wall-of-text FIXED (see above).
Rest FINE: 27-year closed-sales ledger (`band_8-10.png`) reads as a clean two-line-per-row list,
no squish, no horizontal scroll needed. Same "N" button position over the last tile
(`band_0.png`) and over the cookie banner at page end.

## /housing-market/bend

Same stat-tile family, same FIXED-elsewhere pattern (not fixed here — shared `[...slug]/_v3/geo-figures.ts`,
see above). No composition chart on this route. New section not on the hub: "How Bend homes get
bought" (financing-mix tiles: conventional/cash/FHA/VA share) — clean single-stat tiles, FINE.
5-series rate/price line charts, 2-series Case-Shiller-style charts — FINE, legible. Footer
clean, page ends within its real content height (no stitching artifact observed on this route).
"N" button position: bottom-left over the first stat tile (`band_0.png`) and over the cookie
banner at page end (`band_10.png`).

## /housing-market/annual-review

Different, cleaner section design from the hub family — tiles here are already single-stat
(`"14.2 · CONDOS · MONTHS OF SUPPLY"`), not the wall-of-text pattern, so no fix needed on this
route's tiles. **No `<table>` elements anywhere in `app/housing-market/**` or `app/blog/**`**
(confirmed by grep) — every tabular-looking dataset (active inventory by city, closed sales by
city YoY, 27-year closed-sales-by-year history) is a `V3Ledger` list, which reflows to one
stacked row per record at 390px rather than squishing a wide grid. Verified visually across
every ledger on this page (`band_2-5.png`, `band_8-10.png`): no squish, no clipped columns, no
horizontal scroll container needed — this is the right pattern for mobile and needs no change.

**FIXED (mine, §0):** the methodology copy at `app/housing-market/annual-review/page.tsx:422`
read `"Single-family homes only (MLS PropertyType 'A')."` — CLAUDE.md §7 documents bare MLS
PropertyType `'A'` as a **mixed bucket** (condos, townhomes, manufactured homes included), the
opposite of what the parenthetical claimed, and the actual page copy contradicted the codebase's
own documented ground truth (MARKET_TRUTH D1). Per §0 ("if a stat/claim can't be verified, it
doesn't ship — cut it"), removed the unverifiable technical aside rather than guess at the
correct filter description; "Single-family homes only" is the verified, accurate claim and
stands alone. Also split a pre-existing semicolon in the same string into two sentences — the
brand-voice write-gate (`check-brand-voice.mjs`) blocked the file save on it once touched, so it
came along with this fix. Verified: `curl` of the rendered page shows the corrected string;
`node scripts/check-brand-voice.mjs` still reports "2 violations (= baseline)" — did not grow.

**FINE:** every other section — the "sold at a median of $650,000" hero, all ledgers (see
above), the two-line-per-year closed-sales-by-city rows, the FAQ, footer. Page ends cleanly at
its real content height, no stitching artifact.

## /blog

Index page, already reviewed in depth for Matt's addendum (see capture-pipeline note 3 above —
hero thumbnails already wired, rendering correctly). Rest of the page: category chips (`V3Quiet`,
`band_2-3.png`), popular-posts list, pagination ("Page 1 of 5," Next page), footer — all FINE,
no overflow, no squish. Share button has a real tap target (icon + label). No FIX-NOW or IMPROVE
found on this route.

## /blog/bend-buyers-market-shift-2026 (first link off /blog)

Long-form post, hero photo full-bleed, byline, then body copy with 7 embedded charts (single-
and dual-series line/area/bar, all monochrome navy, all legible at 390px — value labels sit
directly on the chart, e.g. "3.3 mo," "43%," "$10K," bars in the concession-by-price-band chart
show inline percent labels). Pull-quote card ("Why a $10,000 credit can beat a $10,000 price
cut") reads cleanly. Listing rail ("Bend homes"), related-posts list, tags, footer — all FINE.

**FIX-NOW (content, not a file — outside my file-based fix authority):** live heading text reads
**"For for buyers"** (duplicated word; should read "For buyers"). Confirmed via DOM query
(`document.querySelectorAll('h2,h3')` on the live render — not a capture artifact) at
`app/blog` band `b_blogpost/band_8.png`. This post's body lives in Supabase `blog_posts.content`
(slug `bend-buyers-market-shift-2026`), a CMS-managed content column, not an `app/blog/**` file —
per the "Blog seed vs DB divergence" memory note, a raw SQL edit risks fighting whatever
generation/voice-canon pass produced this row, so I did not UPDATE it directly. Flagging with
the exact slug and exact string so it's a one-line fix wherever blog content edits are supposed
to land.

**Verified, not a bug:** body text states months-of-supply as "roughly 3.6 months as of August
2026" while an embedded chart's final point reads "3.3 mo" — the article itself explains the gap
in the very next sentence ("The chart above plots month-end readings, so its final bar sits
slightly below that"), so this is an intentional, self-documented reconciliation, not a
discrepancy.

**Position-only:** the "N" button overlaps the first paragraph of body text on this post,
obscuring part of the word "report" in "...on every market rep[ort] hides it" (`band_0.png`) —
worse here than on the hub pages, since it sits over prose, not a stat tile. Also overlaps the
cookie banner at page end, same as every other route in this group.

---

## Summary for the orchestrator

**Fixed (3 edits, all `app/housing-market/**`, tests green, gates green):**
- `app/housing-market/page.tsx` — stat-tile bits trimmed to top 3.
- `app/housing-market/central-oregon/page.tsx` — same.
- `app/housing-market/annual-review/page.tsx` — removed inaccurate "(MLS PropertyType 'A')" §0
  claim, fixed an incidental semicolon the brand-voice gate caught on touch.

**Not fixed, flagged for the shared-chart owner (`components/site/v3/V3Chart.tsx` /
`.css`):**
- FIX-NOW: mix-chart 3-category color/legend cap vs. 8 real categories (housing-market,
  central-oregon).
- IMPROVE: YoY 5-series line clustering.

**Not fixed, flagged for whoever owns cross-route shared figure builders:**
- `app/housing-market/[...slug]/_v3/geo-figures.ts` has the same wall-of-text stat-tile bug as
  the two routes I fixed, but is shared with `/communities`, `/zip`, and `/cities` (other
  groups' routes) — same 3-bit-slice fix applies, needs orchestrator sign-off before touching a
  file outside this group's route ownership.

**Not fixed, flagged as content (not code):**
- FIX-NOW: `blog_posts.content` for slug `bend-buyers-market-shift-2026` has "For for buyers"
  (duplicate word) in a live heading.

**Position-only (per instructions, not mine to fix):** floating "N" button — bottom-left,
overlapping a stat tile or (on the blog post) body prose on first view, and the fixed cookie-
consent banner at every page's true end. Cookies button: bottom of viewport, part of the same
fixed banner, no additional overlap beyond the N button collision already noted.
