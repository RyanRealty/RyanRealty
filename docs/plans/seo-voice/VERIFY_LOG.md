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
| A4 dim_office | V | 280 offices seeded |
| A5–A6 marts | V | 2016–2025 rebuilt, 2024 parity 0% |
| A7 DAL | V | getCoMarketAnnual/Office/AgentShare |
| A8 competition+agents | V | /admin/analytics/competition |
| A9 public size | V | CoMarketSizeStrip + series |
| A10 cron | V | rebuild-analytics-marts daily 08:15 UTC |

## Family status

| Family | Status | Notes |
|--------|--------|-------|
| F00 chrome | I | agent host cannot fetch prod (network); code path PublicNav shipped earlier |
| F14 analytics | V | marts 2016–2025, admin competition+agents, public size, cron |
| F01–F04 | O | |
| F05 Market | I | size strip shipped; composition next |
| F06–F09 | O | |
| F10 LPs | O | alerts LP exists |
| F11 Account | O | saved_searches=2 |
| F12 | O | |
| F13 | X | |
## Conversion

| Metric | Value | Ticket |
|--------|------:|--------|
| listing_alerts | 6 | A1 re-probe 2026-08-10 (scoreboard-snapshot); 5 active; 2 created last 30d |
| saved_searches | 2 | same |
| FP sessions total | ~68722 | A1; windows in Data probe table |
| FP engaged 7d / 30d | 4313 / 11037 | engagement_score ≥ 2 |
| CO closed 2024 (mart) | 5707 / $3.931B | analytics_mart_market_annual region all |

## Session notes (newest first)

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
