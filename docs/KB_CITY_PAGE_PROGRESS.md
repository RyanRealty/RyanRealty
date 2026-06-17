# KB City-Page Build — progress log

Live build log for the Phase-9 wave-1 city-page work (see
[`docs/KB_CONVERGENCE_ROADMAP.md`](KB_CONVERGENCE_ROADMAP.md) for the program + the
page contract). Append an entry per verified increment. The city-page route swap
(`app/cities/[slug]/page.tsx` + `ui_kits/city/parity.json`) is held out of `main`
until its sections are rebuilt, so live `/cities/*` pages don't lose content mid-build.

## Spec (Matt, 2026-06-17)
1. Market section rebuilt informative + brutalist (no slop). ✅
2. Map zooms into the city + shows the city's neighborhood polygons. (zoom ✅ · polygons ☐)
3. Neighborhoods listed out, homepage-cities-style. ☐
4. KB breadcrumb — City › Neighborhood › Community/Subdivision › Listing. ☐
5. Rename Towns → Cities (nav + everywhere). ☐
6. Rebuild every existing city-page section in KB style + add them (open houses, blog, activity, nearby cities, about). ☐
7. Page contract on every page: KB design + SEO (Google + LLM) + full tracking, all hardcoded/gated. (SEO partial ✅ · tracking ☐ · gates ☐)
8. URL scheme `/bend`, `/bend/tetherow` — DEFERRED by Matt ("disregard urls for now").

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
