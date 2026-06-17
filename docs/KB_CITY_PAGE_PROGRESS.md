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

## Remaining (next increments)
- Map neighborhood polygons (KbListingMap polygons layer + Bend boundaries).
- Per-section view + interaction tracking wired into every KB section (page contract).
- The SEO/JSON-LD presence + tracking-instrumentation gates (Phase 3).
- Then waves 2+: community → neighborhood → listing-detail → … page-classes.

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
