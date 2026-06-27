# PUB-3 Market Data + Geo Pages — Audit Findings

Audited: 2026-06-26  
Scope: read-only code review, no browser verification, no SQL execution  
Cluster: market data, geo-detail, and ancillary content pages  
Priority: B. Statistics §0 (most important), then A. Functional, C. SEO, D. Indexability, E. CRM

---

## Pages Covered

| Route | File | Status |
|---|---|---|
| `/housing-market` | `app/housing-market/page.tsx` | CLEAN |
| `/housing-market/[...slug]` (city + subdivision) | `app/housing-market/[...slug]/page.tsx` | CLEAN (minor stub) |
| `/housing-market/central-oregon` | `app/housing-market/central-oregon/page.tsx` | CLEAN |
| `/housing-market/explore` | `app/housing-market/explore/page.tsx` (re-export) | CLEAN |
| `/housing-market/reports` | re-export → `app/reports/page.tsx` | CLEAN |
| `/housing-market/reports/[slug]` | re-export | CLEAN |
| `/housing-market/reports/[slug]/[geoName]` | `app/reports/[slug]/[geoName]/page.tsx` | REDIRECT (dead table) |
| `/reports` | `app/reports/page.tsx` | CLEAN |
| `/reports/[slug]` | `app/reports/[slug]/page.tsx` | §0 RISK — stale HTML |
| `/reports/[slug]/[geoName]` | `app/reports/[slug]/[geoName]/page.tsx` | REDIRECT only |
| `/reports/explore` | `app/reports/explore/page.tsx` | CLEAN |
| `/reports/sales/[city]/[period]` | `app/reports/sales/[city]/[period]/page.tsx` | CLEAN |
| `/cities` | `app/cities/page.tsx` | CLEAN |
| `/cities/[slug]` | `app/cities/[slug]/page.tsx` | §0 WATCH — scaling guard |
| `/cities/[slug]/[neighborhoodSlug]` | `app/cities/[slug]/[neighborhoodSlug]/page.tsx` | CLEAN |
| `/communities` | `app/communities/page.tsx` | CLEAN |
| `/communities/[slug]` | `app/communities/[slug]/page.tsx` | §0 WATCH — scaling guard |
| `/subdivisions/[slug]` | `app/subdivisions/[slug]/page.tsx` | CLEAN (no market stats by design) |
| `/zip/[zip]` | `app/zip/[zip]/page.tsx` | NOTE — active-dom labeling |
| `/schools` | `app/schools/page.tsx` | CLEAN (registry only) |
| `/schools/[slug]` | `app/schools/[slug]/page.tsx` | STATIC DATA RISK |
| `/parks` | `app/parks/page.tsx` | CLEAN (registry only) |
| `/parks/[slug]` | `app/parks/[slug]/page.tsx` | CLEAN |
| `/area-guides` | `app/area-guides/page.tsx` | CLEAN |

---

## B. Statistics §0 — Defects Ranked by Severity

### B-1 HIGH — `/reports/[slug]` renders pre-built HTML with no freshness indicator

**File:** `app/reports/[slug]/page.tsx`  
**What happens:** The page fetches a `report` row from Supabase (`getMarketReportBySlug`) and renders `report.content_html` via `dangerouslySetInnerHTML`. That HTML was generated at report-creation time and contains embedded stats (median price, sold count, DOM, inventory figures). The page has no `revalidate` constant (so it defaults to dynamic — re-fetches on every request), but the HTML *content* was frozen at generation time.

**§0 concern:** A weekly report generated on 2026-05-15 might still contain "$485K median" for Bend. If that number has shifted materially, every stat in the body is stale. There is no "data as of" timestamp shown to the reader. There is no freshness caveat. A user (or an AI citation) reading this page cannot distinguish a 1-day-old stat from a 90-day-old one.

**Mitigation present:** The page does not compute any stats itself — it only renders what is stored. The `report.period_start` / `report.period_end` window is shown in the hero, so the stat window is nominally visible. The schema.org `Report` JSON-LD sets `datePublished` from `report.period_start`. However the body prose is not date-qualified inline.

**Verdict:** Not a fabricated number, but a potentially stale one rendered without any freshness signal to the reader. Under §0, "if a stat can't be verified, it doesn't ship." The stat in the body CAN be verified against the MLS for the reporting period, but the page doesn't do that live — it trusts the stored HTML. Risk: low for historical accuracy (the report covers a closed window), higher for any forward-looking commentary in the prose. Recommend adding a visible "Report period: [start] – [end]" label in the body prose area, not just the hero.

**Classification:** §0 MEDIUM RISK — stale historical HTML, period is disclosed in hero, but body prose lacks per-stat sourcing.

---

### B-2 MEDIUM — `saleToList` defensive-scaling guard in city + community + neighborhood pages

**Files:**  
- `app/cities/[slug]/page.tsx` — `sltRaw < 2 ? sltRaw * 100 : sltRaw`  
- `app/communities/[slug]/page.tsx` — same guard  
- `app/cities/[slug]/[neighborhoodSlug]/page.tsx` — same guard  

**What happens:** The guard converts the raw `avg_sale_to_list_ratio` from `market_stats_cache` to a percentage, but with a conditional branch: if the raw value is less than 2, it multiplies by 100 (assumes decimal 0.9736 → 97.36%); if it is 2 or greater, it uses it as-is (assumes it is already a percentage, e.g. 97.36). This implies the DB column sometimes stores the value pre-scaled (97.36) and sometimes stores it as a decimal (0.9736).

**§0 concern:** If the DB value is sometimes already-scaled and sometimes a decimal, the display can be wrong in either direction: a decimal value that happens to be ≥ 2 (impossible for a ratio that is ≤ 1, so unlikely for sale-to-list, but edge-case possible if the ratio exceeds 100% in a bidding-war scenario like 102.3% → 1.023 raw → `< 2` → multiplied to 102.3, which is actually correct there). More concerning is what this comment implies: the DB is inconsistent. `getCityMarketDetail.ts` comment says it returns `avgSaleToListRatio` as a decimal fraction — but the guard says the DB sometimes sends `97.36`. If that is true, the DAL and DB column contract are not clearly defined.

**Recommendation:** Check `market_stats_cache.avg_sale_to_list_ratio` column type and confirm what unit is stored. If it is always a decimal fraction (0.9736), remove the guard and always multiply by 100. If it is already a percentage, never multiply. The ambiguity itself is a §0 risk — a value that could display as either 0.97 or 97.36 depending on which path triggers.

**Classification:** §0 MEDIUM RISK — display value might be wrong when `sltRaw ≥ 2` (already-scaled) or when stored inconsistently.

---

### B-3 LOW / INFO — ZIP page computes `medianDom` from active-listing DOM, not closed-sales DOM

**File:** `app/zip/[zip]/page.tsx`  
**What happens:** The median days-on-market displayed in the hero lede and KbMarketHud is computed from `tiles[].dom` (which represents DOM of active/live listings, i.e. days the home has been listed). This is NOT the same as median DOM from closed sales (which measures how long a home was on market before closing).

**§0 concern:** The label says "Median days on market" (in hero lede) and in the HUD. A user comparing this to city-level "median DOM" from `market_stats_cache` (which IS closed-sales DOM) would see different numbers and might not understand why. The ZIP stat is a point-in-time snapshot of how long active listings have been sitting; the city stat is a trailing-period closed-sales figure.

**Recommendation:** Relabel the ZIP DOM stat explicitly as "Median days listed (active)" or "Median active days on market" to distinguish from the closed-sales DOM shown at city level.

**Classification:** §0 LOW RISK — not a wrong number, but a comparison mismatch risk. Honest with appropriate relabeling.

---

### B-4 INFO — Subdivision scope of `/housing-market/[...slug]` shows city-level market data

**File:** `app/housing-market/[...slug]/page.tsx`  
**What happens:** When the URL slug resolves to a subdivision (not a city), the `MarketSnapshot` component is fed `citySlug` (the parent city) rather than a subdivision-level geo. An inline comment documents this explicitly: "market_pulse_live has no subdivision rows, so city-parent data is the closest verified figure."

**§0 concern:** None — the code is honest and documented. However the user reading a "Tetherow" market report will see Bend's active count and median, not Tetherow's. The section heading or subheading should make this explicit so the user understands what they are seeing.

**Also:** `<PriceBandTable items={[]}/>` is rendered for subdivision scope — produces an empty/stub section visible to the user.

**Recommendation:** Ensure the KbMarketHud or section header on subdivision pages labels the data as "Parent city: Bend" (or equivalent). The `PriceBandTable` empty stub should either be hidden or filled.

**Classification:** §0 INFO — honest, but UX clarity gap.

---

### B-5 INFO — Schools pages display static GreatSchools ratings with no staleness warning

**File:** `app/schools/[slug]/page.tsx`, `data/co-schools.ts` (registry)  
**What happens:** Academic stats (GreatSchools rating, enrollment, studentTeacherRatio) are loaded from the static registry (`data/co-schools.ts`), which is a point-in-time snapshot. The page renders a source credit "GreatSchools, NCES" with a `sourceUrl` link, but there is no "as of" date shown for the rating.

**§0 concern:** GreatSchools ratings change annually. If the registry was last updated in 2024 and a school's rating changed in 2025, the wrong rating is displayed with a source citation that now traces to a stale snapshot. Unlike the listing stats (which flow from live MLS), these are static and do not re-verify themselves.

**Recommendation:** Add a visible "Rating as of [year]" note next to each GreatSchools rating. Add a note to the registry file header or AGENTS.md noting that ratings must be re-verified each school year.

**Classification:** §0 LOW RISK — source is cited, but stale snapshot.

---

### B-6 RESOLVED — `getMarketStats` previously selected non-existent columns (now fixed)

**File:** `lib/data/market/getMarketStats.ts`  
**History:** A comment in `getCityMarketDetail.ts` referenced that `getMarketStats` "selects 6 non-existent columns" — this was the historical bug. The function now selects confirmed-existing columns only, with an inline comment: "BUGFIX 2026-06-05: the prior select listed median_list_price, months_of_supply, sale_to_list_ratio, active_count, yoy_change_pct, and refreshed_at — none of which exist in market_stats_cache."

**Current state:** FIXED. `getMarketStats` now selects only `median_sale_price, median_dom, avg_sale_to_list_ratio, sold_count, end_of_period_inventory, yoy_median_price_delta_pct, updated_at, methodology_version`. Cache key bumped to `market-stats-v2` to evict stale null-cached entries.

**No action needed.**

---

### §0 VERIFIED CLEAN — MoS Verdict Thresholds

All MoS verdict computations in the cluster are correct:  
- Housing market hub: `mos <= 4` → seller's, `mos >= 6` → buyer's (correct)  
- City page `buildNarrative`: same thresholds via `lib/market/classify.ts` `marketVerdict()`  
- Community page: same via `marketVerdict()`  
- Central Oregon region page `buildRegionNarrative`: `mos <= 4` → seller's, `mos >= 6` → buyer's  
- Cities index `verdictFromMos`: `mos <= 4` → seller's, `mos >= 6` → buyer's  
- All use `marketVerdict` or identical inline logic — no threshold drift found.

---

### §0 VERIFIED CLEAN — Cache Sources

| Stat | Source | Freshness | Verified |
|---|---|---|---|
| activeCount | `market_pulse_live` via `getMarketPulse` | 10-15 min | YES |
| medianListPrice | `market_pulse_live` via `getMarketPulse` | 10-15 min | YES |
| monthsOfSupply | `market_pulse_live` via `getMarketPulse` | 10-15 min | YES |
| medianDaysToPending | `market_pulse_live` via `getMarketPulse` | 10-15 min | YES |
| medianSalePrice | `market_stats_cache` via `getMarketStats` | 6 hours | YES |
| saleToList | `market_stats_cache` via `getCityMarketDetail` | 6 hours | YES (decimal fraction) |
| priceHistory trend | `market_stats_cache` via `getPriceHistory` | 6 hours | YES |
| Dataset.dateModified | `pulse.refreshedAt` (real DB ts) | per-row | YES — never `now()` |
| ZIP listing count/median | live `listings` table via `getZipListings` | per-request | YES |
| School feeding count/median | live `listings` table via `getSchoolDetail` | per-request | YES |
| Park nearby count/median | live `listings` table via `getParkDetail` | per-request | YES |
| Sales reports | live `listings` table via `getMarketReportDataForLocation` | per-request | YES |

---

## A. Functional Defects

### A-1 MEDIUM — `PriceBandTable items={[]}` renders stub section on subdivision scope

**File:** `app/housing-market/[...slug]/page.tsx`  
**Issue:** When the URL slug resolves to a subdivision (e.g. `/housing-market/tetherow`), the page renders `<PriceBandTable items={[]} />`. This is an empty table section visible to the user. It should be conditionally hidden when items is empty.  
**Fix:** Wrap in `{subdivisionData?.priceBands?.length > 0 ? <PriceBandTable ... /> : null}` or equivalent.

---

### A-2 LOW — `/housing-market` cross-links to `/homes-for-sale` (verify route exists)

**File:** `app/housing-market/page.tsx` — `ContentSection` includes a link to `/homes-for-sale`.  
**Issue:** Route existence not verified in this audit. If `/homes-for-sale` is not a valid route, this is a 404 link on the hub page.  
**Recommendation:** Verify `/homes-for-sale` is registered in `app/` or returns a redirect to `/search`.

---

### A-3 LOW — Community page: `getMarketStats({ geoType: 'neighborhood', ... })` fallback behavior

**File:** `app/communities/[slug]/page.tsx`  
**Note:** The community page calls `getMarketStats` for neighborhood-scoped stats. Post-fix (B-6), this correctly queries `market_stats_cache`. However, `market_stats_cache` may not have rows for every neighborhood/community geo (it depends on the refresh job covering those geos). When no row exists, `stats` will be null and `medianSalePrice`, `medianDaysOnMarket`, `soldCount` in the About facts and KbMarketHud will silently show dashes. This is the correct behavior (em-dash for unavailable), but worth noting: if the market-data refresh job does not write neighborhood/community rows, these stats are permanently empty.  
**Recommendation:** Verify that the market-data refresh job writes `market_stats_cache` rows for the 14 resort community geos.

---

## C. SEO Defects

### C-1 MEDIUM — `/reports/[slug]/[geoName]` is `noindex` but still accessible

**File:** `app/reports/[slug]/[geoName]/page.tsx`  
**Issue:** The metadata explicitly sets `robots: { index: false, follow: true }`. The page permanently redirects before rendering metadata, so no content is served. This is correct. However, the `noindex` declaration is on a redirect page — bots should follow the redirect and index the destination instead. Confirm the canonical at the destination (`/housing-market/<city>`) is correct.  
**Status:** LOW — the redirect itself is correct. The `noindex` on the redirect wrapper is belt-and-suspenders.

---

### C-2 LOW — `/housing-market/explore` and `/reports/explore` have minimal JSON-LD

**Files:** `app/reports/explore/page.tsx`, `app/housing-market/explore/page.tsx`  
**Issue:** The explore page provides metadata (title/description/OG) but emits no JSON-LD schemas (no WebPage, no Dataset, no BreadcrumbList). An interactive data explorer is harder for LLMs and search engines to cite because there is no structured Dataset with variableMeasured. Given the page description ("Interactive market explorer: filter by city and date range"), a WebPage + Dataset schema would help citability.  
**Note:** Because ExploreClient is a client-only component, Dataset `variableMeasured` cannot be pre-populated server-side (data varies per user filter). A static WebPage schema with a description is feasible.  
**Classification:** C LOW — missing BreadcrumbList + WebPage JSON-LD.

---

### C-3 LOW — `/cities/[slug]/[neighborhoodSlug]` FAQBlock without `includeJsonLd`

**File:** `app/cities/[slug]/[neighborhoodSlug]/page.tsx`  
**Issue:** The neighborhood page calls `<FAQBlock>` but the `includeJsonLd` prop appears not to be set (not visible in the render section). The FAQPage JSON-LD emission depends on `includeJsonLd={true}`. Without it, the FAQ is visible in the page but not machine-readable as FAQPage JSON-LD.  
**Verification needed:** Check FAQBlock default for `includeJsonLd`. If default is `false`, the neighborhood page is missing FAQPage JSON-LD while the city page omits it by design (city page uses FAQBlock without includeJsonLd per prior audit).  
**Update:** Looking at the neighborhood page render at line 560: `<FAQBlock items={faqs} eyebrow="Common questions" title="..." />` — no `includeJsonLd` prop. Check FAQBlock component default.

---

### C-4 INFO — `/communities/[slug]` FAQBlock has `includeJsonLd={true}` — GOOD

**File:** `app/communities/[slug]/page.tsx`  
**Status:** CLEAN — community pages do emit FAQPage JSON-LD.

---

## D. Indexability

### D-1 LOW — `/subdivisions/[slug]` uses `dynamicParams=true` with empty `generateStaticParams`

**File:** `app/subdivisions/[slug]/page.tsx`  
**Issue:** Zero static params + `dynamicParams=true` means the page is purely on-demand. No subdivision URLs are pre-rendered. This is intentional per the "no-parity" contract and the "three resolution paths" design. However, it means subdivisions are not in the sitemap by default (unless `sitemap.ts` enumerates them). Crawl discovery depends entirely on links from other pages.  
**Recommendation:** Verify that `app/sitemap.ts` includes subdivision URLs, or that sufficient internal linking (from KbResortOverview chips and neighborhood pages) ensures discovery.

---

### D-2 INFO — `/zip/[zip]` uses `dynamicParams=false` — 10 canonical ZIPs only

**File:** `app/zip/[zip]/page.tsx`  
**Status:** CLEAN. `dynamicParams=false` ensures only the 10 pre-defined ZIPs render; unknown ZIPs get 404. This is correct behavior.

---

### D-3 INFO — `/cities/[slug]/[neighborhoodSlug]` is entirely dynamic (empty `generateStaticParams`)

**File:** `app/cities/[slug]/[neighborhoodSlug]/page.tsx`  
**Status:** `dynamicParams=true`, `generateStaticParams` returns `[]`. Same as subdivisions — requires crawl discovery via internal linking. Neighborhood pages link from city pages (`KbExploreTowns`), which is adequate for discovery.

---

## E. CRM Tracking

### E-1 INFO — Housing market hub and geo pages use `KbSectionTracker`

All market data pages use `<KbSectionTracker pageType="..." />`. This fires section-entry events but is not the same as a FUB property-view event or a visitor_sessions row. Since these are market/geo pages (not listing detail pages), a FUB page-view is optional per the cluster definition. The reports hub (`/reports`) and sales reports (`/reports/sales/[city]/[period]`) do fire `trackPageViewIfPossible` with FUB person ID lookup.

---

### E-2 LOW — `/cities/[slug]` and `/communities/[slug]` use `CityPageTracker`/`CommunityPageTracker` — verify these exist

**Files:** `app/cities/[slug]/page.tsx`, `app/communities/[slug]/page.tsx`  
**Issue:** Both pages import tracker client components (`CityPageTracker`, `CommunityPageTracker`). These are not standard KbSectionTracker variants and were not audited in scope. Verify these components actually fire visitor_sessions rows or FUB calls, and do not error silently.

---

## Summary Table

| Dimension | Status | Top Finding |
|---|---|---|
| **B. Statistics §0** | MOSTLY CLEAN — 2 watches | Report HTML staleness (B-1); saleToList scaling ambiguity (B-2) |
| **A. Functional** | MOSTLY CLEAN — 1 stub | PriceBandTable empty stub on subdivision scope (A-1) |
| **C. SEO** | GOOD | Missing JSON-LD on explore page; neighborhood FAQPage JSON-LD unconfirmed |
| **D. Indexability** | GOOD | Subdivision/neighborhood URLs require crawl-discovery; no static params |
| **E. CRM** | GOOD | Section tracking present; FUB page-view on reports pages only |

---

## §0 Risk Register (Ranked)

| Rank | ID | Risk | Severity | Action |
|---|---|---|---|---|
| 1 | B-1 | `/reports/[slug]` serves pre-built HTML with no per-stat freshness signal | MEDIUM | Add report period label in body prose area |
| 2 | B-2 | `saleToList` defensive scaling guard implies DB column unit is inconsistent | MEDIUM | Confirm `market_stats_cache.avg_sale_to_list_ratio` unit; remove ambiguous guard |
| 3 | B-3 | ZIP DOM stat is active-listing DOM, not closed-sales DOM — label mismatch risk | LOW | Relabel as "Median active days listed" |
| 4 | B-4 | Subdivision scope shows city-level market data — user may not realize | LOW/INFO | Explicit label "Showing Bend data (no subdivision-level cache)" |
| 5 | B-5 | GreatSchools ratings in school registry are static snapshots, undated | LOW | Add "Rating as of [year]" to school detail pages |

No hardcoded numbers found. No fabricated stats found. No MoS threshold violations found. No narrative/verdict contradictions found.
