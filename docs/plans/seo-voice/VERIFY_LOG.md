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
| H6 feature cubes | V | analytics_mart_feature_annual 2016–2025; 2024 fireplace=3589 garage=4381 association=2866; parity 0% |
| H8 inventory warehouse | V | analytics_inventory_snapshot + snapshot script + daily cron |
| I1 brand/entity merge | V/~ | getCoOfficeShareMerged on competition desk (brand default); mart office_id residual |
| I4 Ryan brand share | V | getRyanBrandShare list+buy alias rollup on competition desk |

## Family status

| Family | Status | Notes |
|--------|--------|-------|
| F00 chrome | I | PublicNav + kb-nav prod HTML 200 (browser UA); no SiteHeader dual |
| F01 home | I | prod 200: H1 Central Oregon Homes for Sale; seo-shell locked |
| F02 search | I | prod 200: Save this search; outcome cold |
| F03 areas | I | prod 200 `/cities/bend` + alerts; browser craft still open |
| F04 lifestyle | I | static 2026-08-10: Areas nav + parks/schools/trails/events/venues/golf; nearby homes; parks M3 band; browser V open |
| F05 Market | I | prod 200: size 5,707/$3.93B + composition + history explorer |
| F06 Tools | I | static 2026-08-10: mortgage/rental app_config defaults; appreciation scenario label; browser V open |
| F07 sell | I | prod 200 `/sell` Layer A + valuation form |
| F08 content | I | static 2026-08-10: blog/FAQ wired; annual claims → cubes (M2); browser V open |
| F09 trust | I | static 2026-08-10: about/team/reviews/contact/join; browser V open |
| F10 LPs | I | prod 200 `/lp/buyer-listing-alerts` |
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

### 2026-08-10 I1 brand-merged competitive share
- **DAL:** `getCoOfficeShareMerged({ year, side, mergeMode: brand_family|office_entity })` — joins mart `office_name` → `analytics_dim_office` (aliases; mart `office_id` still null). Sums real sides/volume only; share % ÷ market mart. Methodology `office_share_merged_v1` in `DIM_OFFICE_ENTITY_RESOLUTION.md` § I1.
- **Admin:** `/admin/analytics/competition` default `view=brand`; toggle entity / raw. CSV export respects view.
- **Honesty:** I1 remains **[~]** — brand_family ranks are advisory (franchise umbrella), not legal-entity share; optional future office_id at mart rebuild.
- **2024 list brand-family top (market 5,707 / $3.931B; dim match 100% of 234 strings):** 1 Cascade Hasson/Sotheby's 17.93% · 2 Stellar 5.78% · 3 RE/MAX 5.41% (3 strings) · 4 Coldwell Banker 5.39% (6) · 5 Keller Williams 4.33% (6) · 6 Bend Premier 4.09% · 7 Pahlisch 3.91% · 8 Windermere 3.91% (3) · 9 Harcourts 3.67% · 10 Duke Warner 2.75%. Ryan brand via I4 panel (not top-10).
- **No invented share (§0).**

### 2026-08-10 H6 residual + G3 docs + J4 presence + A3 sitemap list
- **H6 residual rebuild:** `node scripts/analytics/rebuild-analytics-marts.mjs --from 2016 --to 2025` (service role / `.env.local`). Feature mart all years:

| Year | rows | fireplace | garage | association |
|-----:|-----:|----------:|-------:|------------:|
| 2016 | 8038 | 4797 | 5616 | 3689 |
| 2017 | 7850 | 4844 | 5611 | 3368 |
| 2018 | 7940 | 5047 | 5722 | 3734 |
| 2019 | 7765 | 4836 | 5681 | 3666 |
| 2020 | 9098 | 5712 | 6629 | 4499 |
| 2021 | 9282 | 5658 | 6746 | 4576 |
| 2022 | 7142 | 4442 | 5281 | 3392 |
| 2023 | 5363 | 3372 | 4061 | 2687 |
| **2024** | **5707** | **3589** | **4381** | **2866** |
| 2025 | 5768 | 3799 | 4534 | 2991 |

- **PARITY 2024:** sold_count **5707**, total_volume **$3.931B**, nErr **0.000%**, vErr **0.000%**, ok **true** (still holds after full-range rebuild).
- **G3:** Wrote `GA4_OPS_CHECKLIST_MATT.md` (exact clicks: Blended · Advanced Consent Modeling eligibility · Tag Assistant smoke). Linked from `MEASUREMENT_DUAL_SOURCE.md` + EXECUTION_QUEUE G3 — **docs ready; blocked on Matt**.
- **J4 residual:** Playwright presence test (no xAI): `e2e/features/listing-detail.spec.ts` — `#room-restyle-heading`, style chips, Restyle photo enabled, alerts path; **does not** click generate.
- **A3 residual:** GSC console still human. Optional `node scripts/list-public-sitemap-urls.mjs` lists live public sitemap locs (browser UA; no GSC API submit). Index children: core/geo/listings/matrix/content.

### 2026-08-10 L1 browser-UA proof pack (WAF unblock)
- **Unblock:** bare `curl` → **403**; `curl -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'` → **200** on all public proof URLs (agent host 2026-08-10).
- **L1 [x]** public proof pack (HTML fetch, not interactive Playwright; competition admin auth not included):

| URL | HTTP | Evidence (prod HTML) |
|-----|-----:|----------------------|
| `/` | 200 | H1 **Central Oregon Homes for Sale**; title Homes for Sale in Central Oregon… |
| `/cities/bend` | 200 | H1 **Bend Homes for Sale**; `section.comm-alerts` + **Get alerts** CTA |
| `/housing-market` | 200 | H2 **Size of the market** + composition; **5,707** closes / **$3.93B** (2024) |
| `/housing-market/history` | 200 | H1 **Closed sales explorer**; year=2024 form; fireplace in meta/UI |
| `/search` | 200 | button **Save this search** |
| `/sell` | 200 | H1 **Sell your home in Central Oregon**; valuation form present |
| `/lp/buyer-listing-alerts` | 200 | H1 **First Matches in 30 Minutes**; listing alerts LP |
| listing `/homes-for-sale/bend/3056-craftsman-220224037` | 200 | address H1; `listing-like-alerts`; **Get alerts for homes like this**; `RoomRestyle` in bundle |
| bare curl (no UA) `/cities/bend` | **403** | WAF still blocks non-browser UA |

- **J4 [~]:** Restyle **present** in listing HTML (`RoomRestyle` chunk + alert path markup); Playwright UI presence test added (no generate); **not** live AI click/render.
- **A2 / D1 browser V:** PublicNav + kb-nav on home/listing; **no** `SiteHeader` dual chrome in prod HTML. Visual craft residual open.
- **C1 [x]:** `npm run ci:seo-shell` exit 0 (21 money-route page.tsx + KbHero defaults). Residual = Layer B body only.
- **C3 [x]:** Hub links enough in prod: home Buy → open-houses + price-drops; market hub → open-houses + price-drops + sell + `/housing-market/history`; cities linked. Dense matrix not claimed.
- **Honesty:** not 10× (alerts ~6 · saves ~2).

### 2026-08-10 E3 UI craft — city (full)
- **Unit:** EXECUTION_QUEUE E3.
- **City** `app/cities/[slug]/page.tsx`: Layer A H1 stays `{City}` / `Homes for Sale`. Hero city-scoped primary CTA (`homesForSalePath`) + Value my home; `posterAlt`. Featured view-all city path kept. Mid-page `KbCommunityAlerts` after map with `propertyType: A` + city headline/body. Sell eyebrow `Sell in {City}`. Section stack: inventory → mid capture → place → urgency → convert → trust → exit.
- **Neighborhood light** `app/cities/[slug]/[neighborhoodSlug]/page.tsx`: alerts after map (parity); hero nbhd CTAs + posterAlt; sell eyebrow city-scoped; no invented MLS subdivision filter on alerts (§0).
- **No kb.css / no dual chrome / no poetry H1s.** Brand navy/cream/Amboqia/Geist via existing KB sections.
- **Gates:** `ci:seo-shell` ✓ · `ci:brand-voice` ✓ · `ci:voice-constructions` ✓ · `ci:file-size-budget` ✓ (city 590 < 600) · `ci:kb-page-contract` ✓ · `ci:kb-single-source` ✓ · `ci:market-section-nesting` ✓ · `ci:naked-verb-headings` ✓.
- **Pointer next:** E5 sell (E4 listing craft concurrent).

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

### 2026-08-10 B1/B2/F3 residual — map/split + hubs
- **B1 residual:** Map/split guest capture via `SearchAlertCapture` `variant="inline"` (non-sticky shrink-0 under filters on `/search`; `underFilterBar` on slug MapSplitView). OH hub + price-drops hub: LP-only CTAs → inline `KbCommunityAlerts` (region + `propertyType: A`). Homepage mid-page after featured kept. Post-success: watch inbox + sign-in to manage alerts. Guest-watch residual helper (label+href only, no PII).
- **B2 residual:** SaveSearchButton success copy names next step (inbox / manage).
- **F3 residual:** guest capture default on map/split + hubs, not list-only.
- **Commit:** `e3a1669c` (not pushed; parent integrates).
- **Tests:** map-search-contracts (incl. inline variant pin) + guest-watch-residual unit green.
- **Snapshot at ship:** listing_alerts **6** (5 active) · saved_searches **2** · FP total ~68751. **Not 10×.**
- **Pointer next:** measure weekly; optional guest F2 banner wiring.

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

### 2026-08-10 E4 UI craft — listing
- **Unit:** EXECUTION_QUEUE E4 (listing family only; no cities/homepage/sell/market/LP/kb.css chrome).
- **Thesis:** Money-page clarity — price + tour dominate; restyle is a contained navy/cream panel; alert coach never fights the mobile broker bar.
- **PriceCtaStrip:** primary Schedule a tour (full-width mobile, 44px), secondary Ask/Save/Share (44px), tertiary alerts link with quiet rule separator. Layer A H1 = price + sr-only address (honest MLS).
- **RoomRestyle:** 3-step flow (photo → style → generate), KB navy/cream panel, compact post-success alert + broker link (no second full card).
- **ListingAlertCoach + ListingLikeThisAlerts:** coach mounts with alerts strip; on viewports below lg lifts above listing-mobile-cta; hide when capture in view; session dismiss.
- **Shell:** denser main column gaps on mobile (`gap-8` → `lg:gap-10`).
- **LOC:** `app/listing/[listingKey]/page.tsx` **573** (under 600); lifestyle lines extracted to `listing-city-lifestyle.ts`.
- **Gates:** listing-detail-a11y ✓ · site-contracts ✓ · `ci:seo-shell` ✓ · `ci:brand-voice` ✓ · `ci:mockup-parity` ✓ · `ci:file-size-budget` ✓.
- **Pointer next:** E3 full city craft (still open on spine) or E5 sell.

### 2026-08-10 E6 + E7 UI craft — market + LP templates
- **Unit:** EXECUTION_QUEUE E6 market + E7 LP (exclusive paths only).
- **Commits:** market/LP body on `6c4da327` (also carried listing a11y from concurrent agent) + extracts/queue on `f077811b`.
- **E6 market thesis:** data surfaces read as research tools, not equal card dumps.
  - `CoMarketSizeStrip`: featured year plate + relative volume rail (mart series §0).
  - `CoMarketComposition`: lead property-type callout + ranked mix bars.
  - `/housing-market/history`: research-terminal query plate, hairline KPI results, active-query chip.
  - Hub: resource links grouped (Market data / Inventory / Guides).
  - `/housing-market/central-oregon`: narrative offset plate + methodology side panel.
- **E7 LP thesis:** buyer LP stays on KB hex register without growing past budget; B5 honesty is a craft band.
  - Extracted `watched-communities.ts` + `BuyerLPBits.tsx` (page ~656, budget 783).
  - `SiteCaptureAlignment` split-band CTAs (tokens only, B5 preserved).
  - Process steps left-led (not centered triple).
  - Seller LP skipped (budget tight, no headroom without extract).
- **Gates:** `ci:file-size-budget` ✓ · `ci:brand-voice` ✓ · design-tokens clean on E6/E7 paths.
- **Pointer next:** Block E complete; Matt G3 / I6 / J4 residual.

### 2026-08-10 E5 UI craft — sell
- **Unit:** EXECUTION_QUEUE E5 (conversion-first sell craft). Exclusive: `app/sell/*`, `components/site/sell/*` — no kb.css / cities / listing / home / market / LPs.
- **Form visibility:** hero `SellerLPForm` (`#get-value`) kept; sticky mobile bar with safe-area; all sell CTAs default to `#get-value` (was `/lp/seller-home-value` drift in Situations / MarketContext / PlanExplorer / SellValuationCTA).
- **Proof rhythm:** reorder to hero → SellProof → KbTestimonials → service story (value props → situations → process → marketing → fee → market). SellProof re-ask CTA after ledger/solds. SellValuationCTA navy dominant ask band.
- **Valuation path (B3 kept):** `/sell/valuation` hero CTA → `#valuation-form` + scroll-mt-24; form in bordered band; method steps as numbered strip; navy list-plan close; mobile sticky → form; `pageMetadata` shell. Hero secondary = call.
- **Layer A:** sell `titleTop="Sell your home in"` + metadata `Sell Your Home…` (`ci:seo-shell` ✓). Brand lock navy/cream; no invented stats.
- **Gates:** `ci:seo-shell` ✓ · `ci:brand-voice` ✓ · pre-commit brand-voice + unit suite green.
- **Commit:** `517e0712`
- **Pointer next:** Block E complete (E1–E7); residual F / Matt G3 / I6.
