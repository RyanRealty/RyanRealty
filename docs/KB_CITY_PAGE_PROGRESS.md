# KB City-Page Build — progress log

Live build log for the Phase-9 wave-1 city-page work (see
[`docs/KB_CONVERGENCE_ROADMAP.md`](KB_CONVERGENCE_ROADMAP.md) for the program + the
page contract). Append an entry per verified increment. The city-page route swap
(`app/cities/[slug]/page.tsx` + `ui_kits/city/parity.json`) is held out of `main`
until its sections are rebuilt, so live `/cities/*` pages don't lose content mid-build.

## Spec (Matt, 2026-06-17)
1. Market section rebuilt informative + brutalist (no slop). ✅
2. Map zooms into the city + shows the city's neighborhood polygons. (zoom ✅ · polygons ☐ next)
3. Neighborhoods listed out, homepage-cities-style. ✅ (KbExploreTowns reused)
4. KB breadcrumb — City › Neighborhood › Community/Subdivision › Listing. ✅ (KbBreadcrumb)
5. Rename Towns → Cities (nav + everywhere). ✅
6. Rebuild every existing city-page section in KB style + add them (open houses, blog, activity, nearby cities, about). ✅ (KbAbout, KbOpenHouses, KbActivity, KbArticles, KbExploreTowns nearby/golf)
7. Page contract on every page: KB design ✅ + SEO (Google + LLM) ✅ + full tracking (CityPageTracker ✅ · per-section events ☐ next) · gates ☐ next.
8. URL scheme `/bend`, `/bend/tetherow` — DEFERRED by Matt ("disregard urls for now").

### 2 — Full KB city page (all sections) ✅ committed
Rebuilt app/cities/[slug]/page.tsx with the complete KB section stack: breadcrumb,
hero (cityHero + labeled regional fallback), about (KbAbout), featured, map (zoomed),
ticker, market, neighborhoods ledger, communities, golf/master-planned ledger, open
houses (KbOpenHouses), activity (KbActivity), explore-other-cities, guides (KbArticles),
testimonials, team, sell, FAQ. New reusable KB sections built (KbBreadcrumb, KbAbout,
KbOpenHouses, KbActivity, KbArticles); KbExploreTowns parameterized to drive the
neighborhoods / golf / nearby ledgers (no fork). Towns→Cities renamed (nav + copy).
KbHero gained a mediaCaption (labeled regional fallback). All 13 city contract tests
pass (D78–D87); tsc + build clean. Verified each section in the browser.

### 3 — Map neighborhood polygons ✅ committed
KbListingMap `polygons` prop draws the 23 Bend neighborhood boundaries (fill + hard
outline + labels) under the pins; the city map fits to the neighborhood extent.

### 4 — Page-contract tracking + gate ✅ committed
KbSectionTracker (section_view + scroll, GA4 + internal store) on the homepage + city
page. New gate G52 ci:kb-page-contract enforces SEO metadata + tracking on every KB page.

### 5 — Final adversarial review + fix pass ✅ committed
15-agent review across bugs / regression / §0 data / brand-voice / a11y / page-contract.
Found + fixed 3 blockers (multi-word cities were stat-dead from a hyphen/space slug
mismatch -> La Pine now renders stats; mislabeled period delta -> "median sale"; no
keyboard focus indicator) + 6 high (KbCommunities empty guard, mkt-fine semicolon,
navy small-text contrast, map role, duplicate scroll_depth). Verified on Bend + La Pine.

## Remaining (low / follow-up, non-blocking)
- Data hygiene: purge the stale hyphenated city rows in market_stats_cache (e.g. "la-pine"
  8 partial rows) now that reads use the space form. Render is already correct.
- Minor a11y: KbNav overlay focus-trap; non-Bend hero alt text; #faq is a div not a section.
- Then Phase 9 waves 2+: community → neighborhood → listing-detail → … page-classes.

## Increments

### 1 — Market section rebuilt (shared `KbMarketHud`) ✅ committed
Verdict stamp (seller/balanced/buyer from MoS, §0 thresholds) + median headline with
period change (↑/↓ % over N months from the price series) + a six-stat KPI grid
(active, closed-30, new-30, sale-to-list, days-to-pending, months-supply) + a drawn
median-close chart with high/low annotations and the latest value called out + the
by-town / by-neighborhood ladder. Live + §0-traced. Verified on the homepage (region,
"Buyer's market", by-town ladder) and the Bend city page (city, "Balanced market").

### 1b — Map zoom + city copy + Tour badges + shared featured resolver ✅ committed
`KbListingMap` parameterized (`fitToFeatures` zooms to the city's listing cluster,
`showRegionMarkers`, eyebrow/title/subtitle) — no fork. New `lib/kb/resolve-featured-items.ts`
is the single source for the homepage + city featured grids: classifies each home's MLS
media into a clean autoplay background video (Vimeo/YouTube/Cloudflare/mp4) OR a "▶ Tour"
badge (Aryeo watch-page, Zillow 3D, Matterport, iGuide — can't autoplay chrome-less).
Verified: La Pine map zooms in; the $21M Aryeo home shows a Tour badge.

## Held in the working tree (commit when sections are complete)
- `app/cities/[slug]/page.tsx` — KB rebuild (hero/featured/map/ticker/market/communities/
  testimonials/team/sell/FAQ + JSON-LD). Missing the rebuilt sections (3–6) before it can
  replace the live Experience page without a content/SEO regression.
- `design_system/ryan-realty/ui_kits/city/parity.json` — rewritten to the KB set (coupled).

---

## Session 2026-06-17 — refinement batch + dedicated review pass ✅ shipped (live on prod)

The held working-tree items above ARE now committed + pushed; the KB city page is live on
prod (ryan-realty.com/cities/bend + /la-pine). This session closed Matt's refinement batch
and ran a final review pass.

### Refinement batch (Matt's punch list) — all done + Playwright-verified
- Section headers were too large → `.sec-title` reduced to `clamp(1.9rem,5.4vw,3.6rem)` (was 6rem), mobile 9vw.
- Market chart plots up to 5 calendar years as differently-colored overlay lines on a shared
  Jan–Dec axis (`buildYearSeries`, `YEAR_PALETTE`); verified 5 lines + 2022–2026 legend.
- Open houses redesigned off-grid (editorial lead + date-stamped scroll rail).
- Testimonials get animated 5-stars + curly-quote language.
- Menu is comprehensive (20 links, 4 grouped columns); logo is horizontal + not chopped
  (5:1 aspect preserved); the legacy white top breadcrumb is gone (KB overlay breadcrumb only).
- **Item B — communities rail shows EVERY community in the city that has a banner photo**
  (was a curated 3), marquee video cards floated first, then by active count. 18 cards on Bend.
- **Item C — neighborhoods + golf/master-planned ledgers get hover-reveal photos**: a curated
  community banner on name-match, else a real home INSIDE the neighborhood boundary (highest-
  priced active listing, `lib/kb/neighborhood-photos.ts` point-in-polygon). 13/13 Bend
  neighborhoods resolve a photo (was 1). Locked by a 4-case unit test.

### Dedicated review pass (2 adversarial agents) — findings fixed
- Resort communities (Tetherow, Broken Top, NW Crossing) showed two different active counts
  across the rail and the golf ledger → unified via `commActiveBySlug` (rail count canonical,
  golf falls back to SFR snapshot). [D90]
- Market Dataset/FAQPage JSON-LD silently vanished if `getMarketPulse` timed out → snapshot
  fallback (`pulse ?? { activeSfrCount, medianListPrice, refreshedAt }`) so structured data
  always emits. [D91]
- G52 gate was weaker than the contract → hardened: tracker must be RENDERED (not just imported),
  and data pages must EMIT their market JSON-LD (`<MetadataBlock>`) WITH the pulse-timeout
  fallback. Homepage correctly exempt (global JSON-LD, no buildMarketFaq).
- Point-in-polygon horizontal-edge divide-by-zero is guarded by operand order; documented so a
  future refactor can't reintroduce NaN.
- FAQ `id="faq"` moved from a wrapper `<div>` to a `<section>` so KbSectionTracker observes it.

Contract tests D88–D91 lock these. Verified: prod build + 51 gates + 618 tests green.

---

## Session 2026-06-17 (cont.) — Matt punch list #2 ✅ shipped

Investigated via a 5-agent workflow, then implemented + browser-verified each.

### Open houses — interactive (Matt: "scrollable list + main image changes")
KbOpenHouses is now stateful: the right rail is a CAPPED vertical scroll container
(max-height 440px, thin navy/cream scrollbar) of every open house as a selectable
button; click/hover promotes that card into the big lead panel (active card full
opacity, others dimmed). The lead anchor stays the navigation target. Reveal animates
TRANSFORM only — opacity is CSS-owned so cards are never hidden if the ScrollTrigger
doesn't fire (caught + fixed: cards were stuck at opacity:0).

### Master-planned hover backgrounds (Matt: "no backgrounds on hover")
The golf ledger img lookups missed for resorts (banner rows are tagged under alias
subdivisions). Added RESORT_IMG, a curated slug->photo map (verified files under
public/images/kb + public/lp/central-oregon-golf/img). All 7 Bend resorts now have a
hover photo. Same name fallback applied so it degrades gracefully.

### Widgi Creek count wrong → ALL resort counts fixed (§0, DATA ACCURACY)
Root cause: a resort's homes are MLS-tagged under MANY subdivision names (Widgi Creek
= "Inn Of The 7th"/"Elkai Woods"/... — almost nothing literally "Widgi Creek"), so the
geo_snapshot + index (literal-name) counts were 0/undercounts. THREE compounding bugs
fixed: (1) count alias-aware from the registry subdivision_aliases; (2) source from a
PAGINATED uncapped fetch (Bend has 1044 active SFR, past PostgREST's 1000-row cap, so a
single fetch dropped 44 older listings); (3) filter the ledger to is_resort=true
(drops Three Rivers, is_resort:false, whose generic aliases "Oww"/"Sun Dance" matched
31 unrelated homes). Same alias-aware count now feeds BOTH the rail and the ledger.

§0 verification trace (listing_tile_mv, city_lower='bend', property_type='A',
standard_status IN Active/Coming Soon/Active Under Contract, alias-prefix, 2026-06-17):
Widgi 48 · Tetherow 43 · NorthWest Crossing 28 · Broken Top 21 · Pronghorn 14 ·
Awbrey Glen 10 · Vandevert 0 (hidden). Rendered page matches each exactly.

### Activity + articles
"What is happening in Bend" -> "Latest market activity"; added a per-row listing
thumbnail (a.PhotoURL, already in the feed data — no DAL change). Articles already
rendered thumbnails (verified live); added alt text + width/height for CLS.

Locked by contract tests D90/D92 (alias-aware/uncapped/is_resort), D93 (activity
heading + thumbnails), D94 (open-house interactive rail) + the resort-active-counts
unit suite. Verified: prod build + 51 gates + 626 tests green; Playwright confirms the
exact counts, hover photos, activity thumbnails, and the interactive scrollable rail.
