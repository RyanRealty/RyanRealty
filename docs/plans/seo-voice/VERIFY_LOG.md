# Site feature verify log

**Master:** `EXECUTION_QUEUE.md` (sole schedule)  
**Rule:** Status V | I | B | O | X. Autonomous grind.

## Data probe snapshots

| Date | Active CO | CO closed 2024 | Mart years | FP sessions | Alerts | Notes |
|------|-----------|----------------|------------|-------------|--------|-------|
| 2026-08-10 | ~3409 | **5707 / $3.931B** | **2016–2025** | total ~**68722**; 1d **1033**; 7d **24447** eng **4313** (17.6%); 30d **67190** eng **11037** (16.4%) | **6** (5 active; +2 created 30d) | A1 scoreboard-snapshot.mjs; eng=score≥2; saves=2; Cascade list ~18% |

## Analytics units

| Unit | Status | Evidence |
|------|--------|----------|
| A1–A3 foundation | V | migration applied |
| A4 dim_office | V | 404 offices; I3 multi-alias brand groups applied |
| A5–A6 marts | V | 2016–2025 rebuilt, 2024 parity 0% |
| A7 DAL | V | getCoMarketAnnual/Office/AgentShare (office filter) |
| A8 competition+agents | V | competition desk + office drill + CSV (I5) |
| A9 public size | V | CoMarketSizeStrip + series |
| A10 cron | V | rebuild-analytics-marts daily 08:15 UTC |
| H5 explorer path | V | result_cache + mart + analyze_closed_sales_co RPC; no Node listings page |
| H6 feature cubes | V | analytics_mart_feature_annual + getCoFeatureAnnual + history strip |
| H8 inventory warehouse | V | analytics_inventory_snapshot + snapshot script + daily cron |
| I4 Ryan brand share | V | getRyanBrandShare list+buy alias rollup on competition desk |

## Family status

| Family | Status | Notes |
|--------|--------|-------|
| F00 chrome | I | code: `PublicNav.client` + site-nav; prod HTML proof blocked (403 host) |
| F01 home | I | static: page + KbSell + Layer A H1 locked by ci:seo-shell |
| F02 search | I | SearchAlertCapture + SaveSearchButton wired; outcome cold |
| F03 areas | I | city + community + nbhd capture; browser V open |
| F04 lifestyle | I | static 2026-08-10: Areas nav + parks/schools/trails/events/venues/golf; nearby homes; parks M3 band; browser V open |
| F05 Market | I | size + composition + history explorer mart/RPC path |
| F06 Tools | I | static 2026-08-10: mortgage/rental app_config defaults; appreciation scenario label; browser V open |
| F07 sell | I | /sell + /sell/valuation ValuationForm present |
| F08 content | I | static 2026-08-10: blog/FAQ wired; annual claims → cubes (M2); browser V open |
| F09 trust | I | static 2026-08-10: about/team/reviews/contact/join; browser V open |
| F10 LPs | I | buyer-listing-alerts + seller LPs exist |
| F11 Account | I | portal ActivityFeed + saved searches insights exist; volume cold |
| F12 auth | I | static 2026-08-10: auth + legal public routes present; browser V open |
| F13 | X | |
| F14 analytics | V | marts, competition desk, aliases, explorer cache path |
## Conversion

| Metric | Value | Ticket |
|--------|------:|--------|
| listing_alerts | 6 | A1 re-probe 2026-08-10 (scoreboard-snapshot); 5 active; 2 created last 30d |
| saved_searches | 2 | same |
| FP sessions total | ~68722 | A1; windows in Data probe table |
| FP engaged 7d / 30d | 4313 / 11037 | engagement_score ≥ 2 |
| CO closed 2024 (mart) | 5707 / $3.931B | analytics_mart_market_annual region all |

## Session notes (newest first)

### 2026-08-10 H6 + H8 upgrade + I4
- **H6 Feature cubes:** migration `20260810150000_analytics_feature_inventory.sql` → `analytics_mart_feature_annual`. Keys: **fireplace**, **garage**, **association** (HOA) — typed high-fill only. Rebuild in `rebuild-analytics-marts.mjs`. DAL `getCoFeatureAnnual`. Public strip on `/housing-market/history`. 2024: fireplace=3589 garage=4381 association=2866; market parity 5707 / $3.931B.
- **H8 Inventory warehouse:** `analytics_inventory_snapshot` + script upsert + cron `/api/cron/snapshot-active-inventory` 08:30 UTC. First snapshot ~3376 active CO.
- **I4 Ryan buy-side truth:** `getRyanBrandShare` list+buy alias rollup on competition desk. Methodology `DIM_OFFICE_ENTITY_RESOLUTION.md` § I4. No invented shares. 2024 list ≈ 5 sides / 0.033% $; buy matched none (honest 0).
- **Commit:** `663ddab2`.

### 2026-08-10 D5 D7 D9 D10 D13 D14 + F4 M2 M3 K1
- **D5 F04 Lifestyle (I):** Areas nav: parks/schools/trails/events/venues/golf LP. Details → nearby homes `/search?city=`. Schools fair-housing safe. No high **B**.
- **D7 F06 Tools (I):** mortgage/rental `getCalculatorDefaults`; appreciation 4.5% scenario labeled. No high **B**.
- **D9 F08 Content (I):** blog/FAQ; templates no hardcoded annual volume. No high **B**.
- **D10 F09 Trust (I):** about/team/reviews/contact/join. No high **B**.
- **D13 F12 Auth (I):** login/signup/legal/unsubscribes. No high **B**.
- **D14 [~]:** No high-severity **B**; residual browser V (L1 403).
- **F4 [x]:** `ListingAlertCoach` 5s dwell soft bar → `#listing-like-alerts`.
- **M2 [x]:** `content-market-claims.mjs` (2024 5707/$3.931B) + skill gates.
- **M3 [x]:** Parks index “Homes near open space” cross-link.
- **K1 [x]:** `BUFFETT_LAYER_B_INVENTORY.md`.

### 2026-08-10 B3 B5 G4 H7 H8 M1 K2 batch
- **B3:** Code-verified ValuationForm path: `insertValuationRequest` + FUB/CRM + `trackEvent('generate_lead')` + Meta CAPI + `fireLeadGenerated`. Hero CTA → `#valuation-form` + `scroll-mt-24`; SmoothScrollProvider Lenis hash scroll; `/sell` form-first + prominent link to `/sell/valuation`. No invented numbers.
- **B5:** Buyer LP band + FAQ: same free `listing_alerts` product as `/search` and `/cities/bend`.
- **G4:** MEASUREMENT_DUAL_SOURCE §7b — FP+GSC primary permanent; GA4 supplementary; not waiting for parity.
- **H7:** `docs/plans/seo-voice/REPORT_FACTORY_REGISTRY.md` R01–R15 status table.
- **H8:** Skeleton shipped earlier; upgraded same day to warehouse table (see H6+H8+I4 note above).
- **M1:** `/housing-market` FAQ appends mart size + composition from `getCoMarketAnnual(2024)` when present.
- **K2:** SESSION_INTENT_SSOT — never re-sweep four retired shape rules (VOICE.md 2026-08-06).
- **Pointer next:** A3 or D1 (prod 403 may block browser V).

### 2026-08-10 B2 + B4 surface ship
- **B2:** Navy `SaveSearchButton` mid-browse on `/search` + `/homes-for-sale/[...slug]`; guest success panel (no silent close); trigger becomes "Search saved". Map/split keep SaveSearchButton; sticky `SearchAlertCapture` stays list-only (layout).
- **B4:** `PriceCtaStrip` → `#listing-like-alerts`; `ListingLikeThisAlerts` anchor; `RoomRestyle` next-step inline alert (`submitSearchAlertSignup`) + broker contact. No invented §0 numbers.
- **Code:** on main in `1e8cb1ec` (bundled with A1/G2/J2/J3 concurrent ship).
- **Tests:** listing-detail-a11y + map-search-contracts B2/B4 asserts green.
- **Snapshot:** listing_alerts **6**, saved_searches **2** (volume exit open).
- **Pointer next:** B3 valuation/CMA friction.

### 2026-08-10 I3 + I5 competitive intelligence
- **I3:** `data/analytics/office-brand-aliases.json` (30 curated groups); `bootstrap-dim-office.mjs` merges true aliases + `brand_family`; methodology `DIM_OFFICE_ENTITY_RESOLUTION.md`. Hosted dim multi-alias (Cascade SIR↔Sotheby's, KW C.O., RE/MAX Out West LLC, BHHS, John L Scott Bend+Redmond, Ryan variants). **No brand-level share invented** — mart ranks stay string-level until `office_id` join.
- **I5:** `/admin/analytics/competition?office=` drills agents; office column links; CSV at `/admin/analytics/competition/export?kind=offices|agents`. Admin-only; I6 public naming locked.
- **Code on main:** `1e8cb1ec` (bundled with A1/G2/J2/J3 in concurrent ship).

### 2026-08-10 H5 History explorer — zero Node closed scans
- **Unit:** EXECUTION_QUEUE H5.
- **Architecture (Option A + C):** request path = `analytics_result_cache` → `analytics_mart_market_annual` (region + city grain) → `analyze_closed_sales_co` RPC (metrics only) → write cache. **Never pages `listings` from Node.**
- **Migrations applied:** `20260810140000_analytics_result_cache_analyze_rpc.sql`, `20260810141000_analyze_closed_sales_co_fast.sql`.
- **Rebuild:** 2024 city grain marts (71 region+city rows); 2024 parity 5707 / $3.931B.
- **Smoke:** default 2024 → mart 5707; Bend → mart 2709; Bend SFR fireplace → RPC 1930 then cache hit; type B price band → RPC 28.
- **Residual risk:** cache-miss still runs bounded SQL aggregate over closed rows (≤~700ms full year); not full row fan-out. City marts only rebuilt for 2024 so far (other years use RPC until next full rebuild). Property types B/C never use multi mart (exact letter only via RPC).
- **Pointer next:** H6 feature cubes or rebuild city grain 2016–2025 on cron.

### 2026-08-10 A1 + G2 + J2/J3
- **A1:** Live probe via service role → VERIFY_LOG Data probe row refreshed (FP 1d/7d/30d + eng + alerts + mart). Script: `scripts/analytics/scoreboard-snapshot.mjs` (`--json`, `--append-verify-log`).
- **G2:** Weekly ritual agent-runnable: `docs/plans/seo-voice/SCOREBOARD_RITUAL.md` + MEASUREMENT_DUAL_SOURCE §3 points at script. Not Matt-click dependent.
- **J2:** `RoomRestyle` interior default (`pickDefaultInteriorPhotoIndex`) + photo picker; rate-limit copy; API rate/cost header notes (`strict` ~10/min).
- **J3:** After successful restyle — city listing alert via `submitSearchAlertSignup` + contact link (`intent=restyle`).

### 2026-08-10 C2 `ci:seo-shell` forever-gate
- **Shipped:** `scripts/check-seo-shell.mjs` + `npm run ci:seo-shell` wired into `ci:gates` (after `ci:seo-routes`).
- **Checks:** banned poetry in Layer A shells on money routes; required exact-match H1/title contracts (home, city, market, sell, OH, price-drops, search); KbHero defaults locked to `Central Oregon` / `Homes for Sale`.
- **Fix:** removed poetry defaults from `KbHero.client.tsx` (was "The MLS list," / "and what it sold for.").
- **C3 partial:** Buy hero + open houses; market hub + open-houses / price-drops / sell.
- **Gate:** `npm run ci:seo-shell` exit 0.
- **Commit:** see main after this unit.

### 2026-08-10 L1 blocked (host 403)
- curl `https://ryan-realty.com/cities/bend` → **403** from agent host (WAF/bot). Prod browser proof needs Matt or alternate egress. Queue advances past L1 without abandoning the unit.

### 2026-08-10 B1 capture surface ship (grind start)
- **Unit:** EXECUTION_QUEUE B1 (partial — surfaces, not enrollment volume).
- **Shipped:** Inline `KbCommunityAlerts` on listing detail (city + price band + beds), neighborhood pages (city-scoped), open-houses/[city], price-drops/[city]; city page alerts moved earlier (after open houses); `extraFilters` + `alert_create` event; `lib/search/price-band.ts` + unit test.
- **Already present:** sticky SearchAlertCapture on /search; city/community KB capture; buyer LP.
- **Snapshot:** listing_alerts still **6** at ship (expect lift only after prod traffic).
- **Pointer next:** L1 prod browser proof, then B2 / outcome watch on B1.

### 2026-08-10 /endtoend complete (analytics MVP)
- **Shipped main:** `e0e15833` (stack from `d876b9a9`).
- Surfaces: `/housing-market`, `/housing-market/central-oregon`, `/admin/analytics/competition`.
- Gates: design-tokens, migration-drift, admin-ui, admin-responsive, file-size, eslint, full push green.
- Stretch remains: family grind B2–B7, alert conversion lift, engagement/AI.

### 2026-08-10 autonomous continue (2)
- Marts **2016–2025**; dim_office **280**; agents; A10 cron; B1.

### 2026-08-10 E1 + E2 (+ E3 light) UI craft
- **Unit:** EXECUTION_QUEUE E1 chrome polish, E2 homepage, E3 city light.
- **E1 chrome:** `kb.css` topbar/menu — safe-area insets, z-index 100/200 stack, 44px hit targets, cream focus rings on logo/links/CTAs/menu, menu hover + reduced-motion, sticky CTA row spacing. `KbNav` — `role=dialog` + `aria-modal` when open, Close type/label, logo closes overlay. No dual chrome / no SiteHeader remount.
- **E2 homepage:** mid-page `KbCommunityAlerts` (Central Oregon, `propertyType: A` SFR narrowing); hero sub max-width 42ch; search/sell focus craft. Layer A H1 still `Central Oregon` / `Homes for Sale`.
- **E3 light:** city `KbCommunityAlerts` moved to after map (inventory), not under open houses.
- **Gates:** `ci:seo-shell` ✓ · `ci:brand-voice` ✓ · `ci:kb-a11y-static` ✓ · `ci:kb-overlay-hidden` ✓ · `ci:css-layers` ✓ (baseline line-shift refresh) · `ci:default-chrome-footer` ✓ · `ci:kb-page-contract` ✓ · `ci:kb-single-source` ✓.
- **Pointer next:** E3 full city craft or E4 listing.
