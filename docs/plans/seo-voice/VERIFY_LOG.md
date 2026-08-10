# Site feature verify log

**Master:** `EXECUTION_QUEUE.md` (sole schedule)  
**Rule:** Status V | I | B | O | X. Autonomous grind.

## Data probe snapshots

| Date | Active CO | CO closed 2024 | Mart years | FP sessions | Alerts | Notes |
|------|-----------|----------------|------------|-------------|--------|-------|
| 2026-08-10 | ~3409 | **5707 / $3.931B** | **2016–2025** | sessions total ~68701 | **6** | Cascade list ~18% / buy ~19% 2024 |

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
| listing_alerts | 6 | Snapshot 2026-08-10 pre/post B1 surface ship; count unchanged at ship time |
| saved_searches | 2 | same |

## Session notes (newest first)

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
