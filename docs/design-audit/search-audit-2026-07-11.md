# Search System Audit — ground-up review of the property-search experience

**Date:** 2026-07-11 · **Auditor:** Claude (senior-design-lead lens, live-browser walkthrough + code trace + production cross-check) · **Build:** local `next dev` off `main` @ `d27b3732`, cross-checked against production ryan-realty.com

**The brief (Matt, verbatim intent):** search is broken — can't save searches, can't draw boundaries, clunky, and the search surface looks nothing like the rest of the site. The bar: a user should be able to find "a home with a fireplace within 5 miles of Phil's Trailhead," save that search, and get organized, visual results — on site and in email — without reading docs.

**Verdict:** the complaint is accurate, and it decomposes into five root causes, not fifty small ones. (1) The **granular-filter path is broken end-to-end** — the More-filters panel crashed the page on open, and even after that's fixed, amenity filters are silently ignored in the default view and the backing RPC times out under region-wide queries, rendering a false "No homes match." (2) **Save-search exists as a full backend but has no entry point on the flagship search page.** (3) **Boundary drawing works mechanically but fights the user** and its result is throwaway — not in the URL, not saveable. (4) **Radius/POI search does not exist anywhere** in UI or backend, so the "5 miles of Phil's Trailhead" class of query is structurally impossible today. (5) **Three different search UIs** with three filter vocabularies and three disagreeing counts ship simultaneously, and the search chrome belongs to a different visual register than the rest of the site.

Three defects were **fixed and browser-verified during this audit** (P0 crash + two draw-mode failures). The rest are ranked below with specific fixes. Screenshots in [`assets/search2/`](assets/search2/).

---

## What was exercised live

| Flow | Result |
|---|---|
| Open `/homes-for-sale` as a first-time visitor | Sign-in modal interrupts before any homes are visible; distinct portal chrome replaces the site's editorial design |
| Open More filters | **Page crash** → error boundary ("Something went wrong") — fixed this session |
| Filter: 2,000+ sq ft + Fireplace, default split view | Filters accepted, chip shows active, **fireplace silently ignored** (verified on production: 407 results in split vs 589 in list for the identical URL) |
| Same filter, list view, local | **"No homes match your current filters"** — actually a swallowed `statement timeout` (57014) from `search_listings_advanced` |
| Search "Phils Trailhead" | No suggestions, and Enter does nothing at all — no error, no fallback, no feedback |
| Draw a boundary | Works at core (polygon filters results) but pre-fix: zero instructions, clicks on pins/clusters were swallowed or **zoomed the map mid-draw**, self-crossing polygons accepted, boundary lost on refresh |
| Save a search | **No save control exists on `/homes-for-sale` in any view.** Only the SEO city pages (`/homes-for-sale/bend`) mount `SaveSearchButton` |
| Account + admin management | Wired and clean (account saved-searches page, admin Contact-360 assign, bulk assign, criteria editor) — the machinery exists, the front door doesn't |
| Alert email | `lib/crm/listing-alert-email.ts` is genuinely well-built (branded shell, photo cards, units on every number, CAN-SPAM footer, 4×/day budgeted cron) |
| Mobile (390×844) | Over a full viewport of chrome before the first home; clipped alert strip; amenity filters effectively unreachable |

---

## Fixed and verified during this audit (local working tree — not committed, per draft-first)

| Fix | File | Evidence |
|---|---|---|
| **P0 — More-filters sheet crashed the whole search page.** Four Radix `<SelectItem value="">` (sq ft, lot, garage, days-on-market "Any" options) throw on render; the route error boundary swallowed the page. Users could never reach the fireplace/pool/view/waterfront filters at all. Sentinel `'any'` mapped back to `''` in state. | [components/search/SearchFilters.tsx](../../components/search/SearchFilters.tsx) | [after](assets/search2/desktop-more-filters-sheet-fixed.png) — sheet opens, selects work, filters land in the URL and re-query |
| **P1 — cluster clicks zoomed the map mid-draw**, stranding half-drawn polygons across zoom levels. Clusters are now inert while drawing. | [components/SearchMapClustered.tsx](../../components/SearchMapClustered.tsx) | [draw mode](assets/search2/desktop-draw-mode-hint-fixed.png), [3 points](assets/search2/desktop-draw-3-points.png), [applied](assets/search2/desktop-draw-applied.png) |
| **P1 — price-pill clicks were swallowed during draw** (opened info windows instead of adding a vertex). A tap on a pill now adds the vertex at the pill's coordinates. Plus: an instruction hint ("Click the map to outline an area. N more points to go.") — draw mode previously shipped with zero guidance. | [components/SearchMapClustered.tsx](../../components/SearchMapClustered.tsx) | same screenshots — three clicks including one directly on a $6.0M pill registered as vertices, map never moved, 486-home result applied |

Gates run post-fix: `tsc --noEmit` clean, `ci:brand-voice` 0 violations, eslint no new warnings.

---

## Findings register

Severity: **P0** blocks a core action or corrupts trust at scale · **P1** major friction on a main path · **P2** clear defect · **P3** polish. Dimension: which of **U**nderstanding / **T**rust / **C**onversion it damages.

### P0

| # | Finding | Dim | Fix |
|---|---|---|---|
| 1 | **More-filters crash** (above) — the only path to amenity filters killed the page since the sheet shipped | U T C | **FIXED this session** |
| 2 | **`search_listings_advanced` RPC times out (SQLSTATE 57014) and the failure renders as "No homes match your current filters."** Locally it fails on every amenity/keyword query (Bend-scoped included); production currently completes the same query (589 rows) but shares the same DB — the RPC lives at the timeout edge and any plan regression or load spike flips production into lying to buyers. An error is being presented as a fact about inventory. | T C | Two-part: (a) surface query failure as a distinct "Search took too long — try again" state with retry in `getListingsAdvanced` (`app/actions/listings.ts:939`+) and `SearchResults`; (b) kill the slow path entirely — see the rebuild plan: move amenity flags onto `listing_tile_mv` so every filter runs the fast MV path |
| 3 | **Amenity filters silently ignored in the default (split) view.** `getViewportSearch` (`app/actions/search.ts:126-149`) forwards `hasPool` but drops `hasFireplace`/`hasView`/`hasWaterfront`/`hasGolfCourse`. UI shows the filter as active ("More (2)"); production proves the gap: identical URL returns 589 (list) vs 407 (split). The fine print "View, waterfront, fireplace, and golf course apply in list view" is a bug confession shipped as UI copy. | T | Add the four booleans to `listing_tile_mv` + forward them through `getViewportSearch` → `getViewportListings`. Delete the caveat copy. Until the MV lands, at minimum grey the checkboxes in split view with an honest label |

### P1

| # | Finding | Dim | Fix |
|---|---|---|---|
| 4 | **No save-search entry point on the flagship search page** — any view, signed in or not. The entire backend exists (`createSavedSearch` server action → unified `listing_alerts` → account manage UI → FUB mirror → 4×/day alert cron). Only SEO city pages mount `SaveSearchButton` (`app/search/[...slug]/page.tsx:885`). | C | Mount `SaveSearchButton` in the `SearchFilters` bar (all three views). It must capture the FULL current state incl. polygon — see #5 |
| 5 | **Drawn boundaries are throwaway.** On `/homes-for-sale` the polygon never reaches the URL (refresh/share/back = gone) and cannot be saved. The SEO map view already has the pattern (`encodeMapPolygon` → `?poly=`, `UnifiedMapListingsView:166-175`) — the flagship `MapSearchView` just never adopted it. | C | Port the `?poly=` persistence into `MapSearchView`; include `poly` in the saved-search filter payload (`lib/search-filters.ts` normalize + hash) so alerts honor drawn areas |
| 6 | **Radius/POI search is structurally missing.** "Phils Trailhead" yields no suggestions; Enter is a dead key (no feedback whatsoever). No "within N miles" filter exists in UI or backend; polygon filtering is JS point-in-polygon over a capped bbox fetch. PostGIS is installed but unused for listings. | U C | Rebuild-plan item: POI table (trailheads/schools/landmarks from authoritative GIS sources only) + `ST_DWithin` radius search + suggestion category "Places". Interim quick win: unrecognized query → visible "We couldn't find that place — try a city, neighborhood, or zip" |
| 7 | **Sign-in modal ambushes first visit to search** before a single home is visible. Zillow earns registration after value; this demands it before. | C T | Trigger after engagement (e.g. 3rd listing open or first save action), never on first landing |
| 8 | **Three search UIs, three vocabularies, three counts.** Flagship chip-bar (split/list/map) vs SEO filter-card (Min/Max inputs + Apply + "Save this search") vs homepage natural-language bar. Bend is "1,283 homes for sale" (SEO), "1,002/817 homes in this area" (split — varies by reload), 589 vs 407 on identical URLs (view-dependent). | U T | One `SearchFilters` component + one count source (see rebuild plan). Label viewport counts honestly ("512 homes on this map") and keep city totals stable |
| 9 | **The register seam cuts through the search task.** Search chrome is a generic-portal design (different header, nav vocabulary, no account entry) while home/city/listing pages speak the editorial brand; on mobile the SAME search page wears the editorial header, so the seam runs through one page. The `ui_kits/search` mockup + parity.json define the target, but parity checks imports, not visual register. | T U | Rebuild-plan item: extend the editorial chrome (header, Amboqia display accents, warm stone surface) across search per the mockup |
| 10 | **Result counts are unstable across reloads** — same URL, same viewport intent: 1,002 → 817 → 1,002. Initial bbox is derived differently per load; users read this as the inventory (or the site) being untrustworthy. | T | Seed the initial viewport deterministically from the city boundary bbox and label the number as map-scoped |

### P2

| # | Finding | Dim | Fix |
|---|---|---|---|
| 11 | Guest alert-capture strip renders clipped under the sticky filter bar on all three views + mobile ("We will email you new homes matching Bend." sliced mid-line; input/button cut). Layout collision between the sticky bar (`app/search/page.tsx:294-300`) and the strip in app-frame mode. | T C | Reserve the strip's height in the app-frame flex column (it's `shrink-0` but the sticky bar overlaps it); simplest is rendering the strip above the sticky wrapper or giving the frame `padding-top` equal to bar height |
| 12 | Mobile: a full viewport of chrome (logo header + breadcrumb + search box + sort row + chip row + clipped strip + view toggle + count) before the first home; filter chips overflow with no scroll affordance; "More" (all amenity filters) practically undiscoverable. | C | Collapse to a single compact bar (location + "Filters (N)" + view toggle); one bottom-sheet for all filters on mobile |
| 13 | SEO page pagination defaults to 9 per page ("Page 1 of 143") and exposes a developer-grade "Columns 1/2/3/4" control; per-page choices 6/12/24/48. | U | Default 24, drop the columns control, infinite scroll or simple pagination |
| 14 | Map basemap intermittently renders flat grey for seconds while pins float on void (observed repeatedly on load). | T | Investigate map init: vector Map ID vs raster fallback, tile fetch stalls; show a map skeleton until tiles paint |
| 15 | "Remove boundary" button is always visible even when the user drew nothing (it refers to the implicit city boundary) — alongside "Draw area" and the post-draw red "Clear area" chip, three boundary vocabularies coexist. | U | One vocabulary: "City outline" toggle + "Draw area"/"Clear drawing"; hide "Remove boundary" unless a boundary is actually active |
| 16 | Intermittent missing card photos (a $5,995,000 listing rendered a grey placeholder on first paint, photo present on later loads). | T | Add explicit image error/retry + skeleton; audit `_next/image` upstream timeouts on Spark CDN |
| 17 | Save-this-search popover on SEO pages anchors half off-viewport at the bottom; guest email field renders clipped. | C | Flip placement to `top` when below-fold space is short (Radix `collisionPadding`) |
| 18 | Sort control placement is inconsistent (standalone combobox in flagship toolbar row; inside the filter card on SEO pages; inside toolbar on list view). | U | One toolbar pattern across surfaces |

### P3

| # | Finding | Dim | Fix |
|---|---|---|---|
| 19 | Card address truncation ("18880 Baker Road, …") at default column width while the meta line has room. | U | Two-line address clamp |
| 20 | Split view shows "More (2)" but not the removable chips that list view renders — active-filter state is invisible where it matters most. | U | Render the chip row in split view too |
| 21 | The visible page title on search is just the count line; the h1 is sr-only. Fine for SEO, weak for orientation. | U | Show the location as a visible compact title ("Bend · homes for sale") |
| 22 | Upstash rate-limiter is over quota (500K/mo) and failing open on every request (`[middleware] rate-limiter unavailable`), log-spamming and leaving the site unthrottled. | T (ops) | Raise the plan cap or fix the request-count blowout (every middleware hit = a Redis command; the alert cron + crawlers burn it) |

---

## The five issues hurting conversion most

1. **The granular-search promise fails at every layer** (P0 #1–#3 combined): the panel crashed, the default view ignores the filters, and the fallback path times out into a false "no homes." A buyer who wants a fireplace either can't ask, gets silently unfiltered results, or is told inventory doesn't exist. This is the single biggest lead-leak in the funnel — buyers who don't find don't register.
2. **Save-search has no front door** (P1 #4–#5). The alert emails are built and the cron runs, but the flagship page never offers the one action that turns an anonymous browser into a nurture-loop lead. Every session that ends without a saved search is a lead FUB never sees.
3. **The sign-in ambush** (P1 #7) taxes every first visit at the moment of least demonstrated value.
4. **Trust-corroding numbers** (P1 #8/#10): three counts for the same city, counts that change on reload, and views that disagree with each other on identical URLs. For a brand positioned on "real numbers, direct from brokers," the search surface is the counter-evidence.
5. **Mobile burying** (P2 #12): most traffic is mobile; a full screen of chrome plus unreachable filters means mobile users effectively get a dumber product.

## Five quick wins (shippable today)

1. ~~Fix the More-filters crash~~ — **done this session** (components/search/SearchFilters.tsx).
2. ~~Draw-mode guidance + inert clusters/pills-as-vertices~~ — **done this session** (components/SearchMapClustered.tsx).
3. Mount `SaveSearchButton` in the flagship `SearchFilters` bar — the component and its server action already exist; this is an import + a slot (~20 lines) and it unlocks the whole nurture loop.
4. Distinguish "query failed" from "zero results" in `getListingsAdvanced` → `SearchResults`: return an `errored` flag instead of `[]` and render "Search took too long — try again" with a retry button.
5. Dead-end feedback in the location box: unrecognized Enter → "We couldn't find that place — try a city, neighborhood, or zip" under the input (state exists; it's a conditional render).

---

## The rebuild plan (recommendations — the "ground-up" part)

Ordered so each step de-risks the next. These are architecture changes; none were applied.

1. **One data path.** Add the amenity booleans (`fireplace_yn`, view, waterfront, golf, pool) + `fireplaces_total` to `listing_tile_mv` (zero-downtime `_v2` + atomic rename per the established MV pattern). Every filter then runs the fast, indexed MV path in every view. Delete the advanced-RPC fallback for amenities, the "applies in list view" caveat, and finding #2's timeout class entirely.
2. **Radius + POI search.** New `search_pois` table (name, type, geog) sourced ONLY from authoritative GIS (USFS/Deschutes County trailheads, NCES schools, city parks — per the GIS-authoritative rule), a "Places" section in suggestions, and `ST_DWithin(geog, poi, miles)` in the MV query. This is what makes "fireplace within 5 miles of Phil's Trailhead" a first-class query — Phil's Trailhead is literally a label on the basemap already; the system just can't hear it.
3. **One search state.** Every filter, the polygon (`?poly=`), the radius, and the view live in the URL on every surface. A saved search is a named URL state + cadence in `listing_alerts` — identical object for consumer, guest, and admin-assigned searches. Draw → save → email all speak the same filter schema (`lib/search-filters.ts` stays the single normalizer).
4. **One surface.** The SEO `[...slug]` pages and `/search` render the same `SearchFilters` + map + results components (SEO pages keep their server-rendered content shell below). One count source, honestly labeled. Kill the second filter card, the columns control, and the third vocabulary.
5. **One register.** Re-skin the search chrome to the editorial system per `design_system/ryan-realty/ui_kits/search/index.html` — editorial header with account entry, Amboqia display accents, warm stone surfaces, consistent toolbar. Extend `parity.json` so the gate also pins the header component (today parity passes while the page wears the wrong chrome).
6. **Registration earns its moment.** Sign-in prompt moves behind engagement triggers (save action, Nth listing view) and the saved-search CTA becomes the primary conversion surface of search.

## Evidence index

All in [`assets/search2/`](assets/search2/): `desktop-search-split-default.png` (default view, clipped strip, grey tiles), `desktop-search-list.png`, `desktop-search-map.png`, `desktop-search-city-seo-bend(-full).png` (third UI + 143-page pagination), `desktop-search-fireplace-list.png` (false zero-state), `desktop-more-filters-sheet-fixed.png`, `desktop-draw-mode-hint-fixed.png` / `desktop-draw-3-points.png` / `desktop-draw-applied.png` (post-fix draw flow), `desktop-login.png`, `desktop-lp-buyer-listing-alerts.png`, `desktop-account-saved-searches.png` (auth gate), `mobile-home.png`, `mobile-search-split-default.png` (chrome burial + clip), `mobile-search-list.png`, `mobile-search-city-seo-bend.png`, `desktop-home(-full).png` (the register the search surface should belong to).

Related: the 2026-07-07 full-site audit in [README.md](README.md) (themes 2 and 3 — stat contradictions and the register seam — both land hardest on search and are quantified here).
