# Chart inventory — Broker OS V1 (evidence only)

Inventoried 2026-08-12 against `main` @ `0ed60e6a`. No chart was migrated. `components/site/v3` was not edited. No browser look this session: every live chart below is **not looked-at**.

Quarry grepped on disk: `KbMarketChart`, `MarketCoreCharts`, `PriceChart`, `SalesReportCharts`, `seasonalityChartSvg`, `recharts`, `AgentActivityChart`, `analytics/_components/charts.tsx`, `sparkline`, `polyline`. Plus mounts of `V3Instrument` / `V3Ledger` that print a series or a comparison without a line.

**Rule used (D9 / A27, amended 2026-08-14):** a series or a comparison gets a chart. A singleton status stays type. Flattening a series to a figure is a defect. **One geometry:** `lib/charts/plot.ts`. Public skin `V3Chart` inside Instrument. Admin skin `AChart` (`--a-*` classes, not recharts `var()`). Packets use `lib/charts/print-svg.ts`. Same honesty.

**Barrel:** E-CHART landed `d554ba7e`. `V3Instrument` mounts `V3Chart` when the caller passes `chart`. Families may pass `chart`. Not a seventh pattern.

**E-MARKET-REFINE (2026-08-13):** rows A1, A3, A6, A8 now pass `chart` on Instrument (region year overlay on hub + central-oregon + annual live; last-12-month line on annual trailing). Leftover on this lease: A2, A4, A5, A7, A9, A10 stay type (city doors, closed-year doors, MoS by city with no MoS series). Singletons A27 unchanged.

**Not findings (on disk, no mounted public/admin/packet surface):**

Deleted 2026-08-15 (zero page imports, leftover recharts): `MarketSnapshotChart`, `GeoMarketOverview` / `LazyGeoMarketOverview`, `MarketVisuals` + `.client`. D109 fails if `app/` or `components/` imports recharts again.

| Path | Why excluded |
|---|---|
| `components/listing/PriceHistoryChart.tsx` | `MiniSparkline` polyline. Zero page imports. |
| `components/reports/MiniSparkline.tsx:25` | polyline. Only imported by the unmounted `PriceHistoryChart`. |
| `components/listing/PriceHistory.tsx` / `showcase/ShowcasePriceHistory.tsx` | type/table of listing price events. `ShowcasePriceHistory` is only in reachable-export baselines, not a page. |
| `lib/data/nav/getMegaMenuData.ts:350` | 12-point sparkline **fetched**. `lib/site-menu.ts:19` says sparklines are not rendered in the menu. |
| `video/**` line charts | Remotion, not a public/admin/packet web surface. |

---

## Counts

| Class | Rows |
|---|---|
| Series (or comparison) as type/table only | **20** (24 inventoried; A1 A3 A6 A8 now `V3Instrument.chart`) |
| Live charts, not browser-looked-at | **18** |

---

## A. Series as type / table only

Each row is a mounted surface. `path:line` is the render. `needs` is D9: public → v3 chart atom inside Instrument; admin → `--a-*` recharts (runtime-resolved); packet → honest print figure.

| # | path:line | plane | series vs singleton | current rendering | needs |
|---|---|---|---|---|---|
| 1 | `app/housing-market/page.tsx` | public | region monthly median (year overlay) | **done** `V3Instrument.chart` (E-MARKET-REFINE) | looked: caller-formatted labels |
| 2 | `app/housing-market/page.tsx` | public | comparison (cities × current median / count) | type/table (`V3Ledger`) | leftover: each city is a door |
| 3 | `app/housing-market/central-oregon/page.tsx` | public | region monthly median (year overlay) | **done** `V3Instrument.chart` (E-MARKET-REFINE) | looked: caller-formatted labels |
| 4 | `app/housing-market/central-oregon/page.tsx` | public | comparison (cities × live inventory) | type/table (`V3Ledger`) | leftover: each city is a door |
| 5 | `app/housing-market/central-oregon/page.tsx` | public | series (closed volume/units by calendar year) | type/table (`V3Ledger`) | leftover: year doors; Instrument would sit next to pace |
| 6 | `app/housing-market/annual-review/page.tsx` | public | region monthly median (year overlay) | **done** `V3Instrument.chart` id `region-median` | looked: caller-formatted labels |
| 7 | `app/housing-market/annual-review/page.tsx` | public | comparison (active inventory by city) | type/table (`V3Ledger`) | leftover: each city is a door |
| 8 | `app/housing-market/annual-review/page.tsx` | public | last 12 completed months (one line) | **done** `V3Instrument.chart` id `trailing-median` | looked: caller-formatted labels |
| 9 | `app/housing-market/annual-review/page.tsx` | public | comparison (closed sales by city, year over year) | type/table (`V3Ledger`) | leftover: each city is a door |
| 10 | `app/months-of-supply/page.tsx` | public | comparison (MoS by city) | type/table (`V3Ledger`) | leftover: `getPriceHistory` has no MoS series |
| 11 | `app/pulse/page.tsx:384` | public | series flattened to singleton live snapshot | type-only (`V3Instrument`) | v3 atom |
| 12 | `app/cities/[slug]/page.tsx:449` | public | series flattened to singleton place figures | type-only (`V3Instrument`) | v3 atom |
| 13 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx:467` | public | series flattened to singleton place figures | type-only (`V3Instrument`) | v3 atom |
| 14 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx` sold Instrument | public | region year composition (neighborhood grain is not in the mart) | **done** `V3Instrument.chart={placeMartCompositionChart(regionMart)}` | looked: labeled as Central Oregon, not this neighborhood |
| 15 | `app/communities/[slug]/page.tsx:574` | public | series flattened to singleton place figures | type-only (`V3Instrument`) | v3 atom |
| 16 | `app/communities/[slug]/page.tsx:677` | public | series flattened to trailing-12m sold figures | type-only (`V3Instrument`) | v3 atom |
| 17 | `app/subdivisions/[slug]/page.tsx:538` | public | series flattened to period sales figures (`:552` is the parent-market fallback in the same slot) | type-only (`V3Instrument`) | v3 atom |
| 18 | `app/subdivisions/[slug]/SubdivisionSalesHistory.tsx:103` | public | series (closed count + median by year) | type/table (`V3Ledger`) | v3 atom |
| 19 | `components/reports/CityArchiveSection.tsx:76` mounted at `app/housing-market/reports/archive/[city]/page.tsx:142` | public | series (homes sold + monthly-median range by year) | type/table (`<table>`) | v3 atom |
| 20 | `app/housing-market/history/page.tsx:263` | public | comparison (amenity share cards for one year) | type-only (display figures, no line) | v3 atom |
| 21 | `app/admin/(protected)/reports/custom/CustomReportBuilder.tsx` | admin | series (monthly sold count) | **done** `AChart` via `ReportTimeSeriesChart` (median stays on the grid, different Y) | looked: sold-count line only |
| 22 | `components/admin/prospecting/ProspectPriceHistory.client.tsx:143` | admin | series (prior MLS list/close cycles) | type/table (`ReportGrid`; phone cards above) | admin `--a-*` recharts |
| 23 | `app/admin/(protected)/financials/page.tsx` | admin | series (net by year) | **done** `AChart` line + `ReportGrid` | looked: labels use page `money()` |
| 24 | `lib/cma/render.ts:720` | packet | series (subdivision closed sales by year) | type/table (`<table class="comp-table">`) | packet print figure (same honesty) |

**Singletons left as type on purpose (A27), not counted above:** `app/months-of-supply/page.tsx:458` (the term + current region MoS) and `:527` (the worked identity of two current numbers); `app/pulse/page.tsx:461` (event counts); `app/zip/[zip]/page.tsx:417` and `app/oregon/[city]/page.tsx:339` (current inventory snapshots); `app/subdivisions/[slug]/page.tsx:472` (active count); `app/housing-market/page.tsx:492` (one closed calendar year); `app/housing-market/history/page.tsx:223` (one query’s KPI plate); `app/tools/appreciation` (`AppreciationCalculator` prints one future value, not a year path).

---

## B. Live charts, not browser-looked-at

| # | path:line | plane | series vs singleton | current rendering | needs |
|---|---|---|---|---|---|
| 1 | `app/page.tsx:231` → `components/site/kb/KbMarketHud.client.tsx:253` → `KbMarketChart.client.tsx:318` | public | series (multi-year median overlay) | KbMarketChart (SVG `<path>`, not recharts). By-town CSS bars at Hud `:266` | v3 atom (D9: not a leftover KB chart on a later v3 home) |
| 2 | `app/housing-market/[...slug]/page.tsx:604` | public | series (city `yearSeries` into KbMarketHud) | KbMarketChart | v3 atom |
| 3 | `app/housing-market/[...slug]/page.tsx:792` | public | series (12-month median sale) | PriceChart / recharts `AreaChart` (`PriceChart.client.tsx:92`) | v3 atom |
| 4 | `components/site/listing-detail/NeighborhoodMarketContext.tsx` | public | series (tabbed city trends) | **done** MarketCoreCharts / `V3Chart` | looked: cream card, navy stroke |
| 5 | `app/reports/sales/[city]/[period]/page.tsx` → `SalesReportCharts.tsx` | public | series (sales by day, price band, DOM) | **done** `V3Chart` line + bars | looked: hyphens in band labels |
| 6 | `components/tools/RentalCalculator.tsx` → `EquityProjectionChart.client.tsx` | public | series (value/equity over the hold) | **done** `V3Chart` line | looked: two series, no recharts |
| 7 | `app/lp/tetherow/heath/_components/HeathAssetPerformance.tsx:110` | public | comparison (recent resales, annualized %) | CSS bars (`width` %) | v3 atom if the LP stays; else leave as LP craft |
| 8 | `app/admin/(protected)/crm/reporting/agent-activity/page.tsx` → `AgentActivityChart.tsx` | admin | series (daily/weekly/monthly activity) | **done** `AChart` line, toolbar kept | looked: straight segments, no `getComputedStyle` |
| 9 | `app/admin/(protected)/crm/reporting/lead-sources/page.tsx` | admin | series (same `AgentActivityChart`) | **done** `AChart` | same as #8 |
| 10 | `app/admin/(protected)/analytics/page.tsx` | admin | comparison (leads by source) | **done** `AChart` horizontal bars | looked: `--a-*` classes |
| 11 | `app/admin/(protected)/analytics/page.tsx` | admin | comparison (broker split) | **done** `AChart` bars (was pie) | looked: `--a-*` classes |
| 12 | `app/admin/(protected)/analytics/page.tsx` | admin | comparison (classification mix) | **done** `AChart` mix | looked: `--a-*` classes |
| 13 | `app/admin/(protected)/analytics/page.tsx` | admin | series (sessions + leads by day) | **done** `AChart` line | looked: `--a-*` classes |
| 14 | `app/admin/(protected)/crm/reporting/overview/page.tsx:160` → `OverviewKpiStrip.tsx:89` → `ReportGrid.tsx:185` | admin | series (per-day spark under each KPI) | polyline SVG (`ReportGrid` `Sparkline`) | admin `--a-*` recharts (polyline is the 11C stand-in) |
| 15 | `app/admin/(protected)/crm/reporting/agent-activity/page.tsx:355` → `AgentActivityKpiStrip.tsx:163` | admin | series (KPI sparks) | polyline | admin `--a-*` recharts |
| 16 | `app/admin/(protected)/crm/reporting/lead-sources/page.tsx:240` → `LeadSourcesKpiStrip.tsx:144` | admin | series (KPI sparks) | polyline | admin `--a-*` recharts |
| 17 | `lib/cma/render.ts` via `lib/cma/seasonality-chart.ts` | packet | series (median days-to-pending by close month) | **done** shared `seasonalityChartSvg` | looked: same plot as immersive |
| 18 | `lib/cma/immersive.ts` (`seasonalityScene`) | packet | series (same seasonality) | **done** `seasonalityChartSvg` (shared with print) | looked: same plot as CMA print |

---

## Top 5 public surfaces that need the v3 atom

1. **`app/cities/[slug]/page.tsx`** — Place market. The city node that used to carry `KbMarketHud` now prints the latest pulse as type.
2. **`app/communities/[slug]/page.tsx`** — Community place + trailing-12m sold. Two flattened series on the same page.
3. **`app/page.tsx`** — Homepage still mounts leftover `KbMarketHud` / `KbMarketChart`. D9: public charts are the v3 atom inside Instrument, not a KB chart that survives a later home migration.
4. **`app/subdivisions/[slug]/page.tsx`** plus `SubdivisionSalesHistory` year ledger.
5. **`app/pulse/page.tsx`** — live snapshot flattened to type.

Hub / central-oregon / annual-review overlays are E-MARKET-REFINE. Do not flatten any further series. Do not add pattern 7.
