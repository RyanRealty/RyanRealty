# Market Analytics Platform — Expert Canon

**Date:** 2026-08-10  
**Status:** ACTIVE — **working** analytical product vision (hypothesis until EDA/research tracks close)  
**Role:** Analytics SSOT under full-plan expert ownership (`EXPERT_OWNERSHIP_AND_RESEARCH.md`). Not “data only” — product, competitive, legal surface, and engineering are co-decided.  
**Parents:** `GOAL_10X_EXECUTABLE.md` (G9), `SALES_INTELLIGENCE_EXECUTABLE.md`, `DATA_FOUNDATION_TOP_SITE.md`, `docs/data/CACHE_TABLE_FIELD_SPEC.md`  
**Rule:** Chat examples are capability tests. **Raw warehouse EDA + domain research** revise this catalog. Do not ship public market claims that conflict with latest EDA.

---

## 0. Mission (expert framing)

**Extract the maximum truthful analytical value from the MLS warehouse and ship it as three equal pillars:**

1. **Market structure analytics** — size, composition, price, speed, geography, amenities, time (A01–A16, A18–A24).  
2. **Competitive / channel intelligence** — **brokerage and broker market share, rankings, mix, trends** (list side, buy side, dual-side; office and agent hierarchy) — **not an admin afterthought**.  
3. **Unique multi-dimensional search + report factory** — any slice queryable; templates for market and competitive reports.  
4. **Performance-safe serving** — never OLAP over 600k rows + TOAST in the request path.

We already have **~595k listing rows**, **~377k priced closes**, **~144 typed columns**, **~800+ keys in `details`**, and on 2024 closes **~100% fill** on `ListOfficeName`, `ListAgentName`, `buyer_office_name`, `buyer_agent_name`. Current product uses a thin slice (active search + SFR pulse + 2016+ monthly medians + single-broker own sales). The gap is a full **analytics + competitive intelligence platform**, not more raw sync.

**Narrow-view ban:** Treating competitor share as “one admin chart” is wrong. Competitive structure is as core as median price. This canon’s competitive section is intentionally large.

---

## 1. What a data analyst actually needs from this warehouse

Real-estate market analysis is not “median price.” It is a system of **facts, dimensions, and derived measures** that support:

| Analytical job | Business value |
|----------------|----------------|
| **Size the market** | $ volume, units, share of region by city/type |
| **Price the market** | distributions, not just medians (p10–p90, bands) |
| **Speed / power** | DOM, sale-to-list, concessions, cash share |
| **Structure the stock** | type, size, age, lot, attached vs detached |
| **Segment premiums** | amenity and location premia (fireplace is one of dozens) |
| **Geography hierarchy** | region → county → city → zip → subdivision → school |
| **Time dynamics** | seasonality, cycles, YoY, crisis years, recovery |
| **Composition shift** | how mix of types/price tiers changed over decades |
| **Liquidity & inventory** | months of supply, absorption (sales + active dual fact) |
| **Affordability** | PITI proxies, tax, HOA burden |
| **Competitive structure (P0)** | Which brokerages and brokers win volume, units, share by geo/time/type; how share shifts; who is #1–N |
| **Channel hierarchy** | Office → agent; list side vs buy side vs both; dual-agency rates |
| **Risk / quality** | thin cells, outlier sales, data completeness by year; office name alias quality |
| **Comparables engine** | feed CMA with controlled cohorts |
| **Content / AEO** | citable, methodology-stated figures for every claim |

**Expert rule:** If a field has high fill rate on closed sales and changes buyer decisions or market structure, it belongs in the **dimension catalog** or **metric catalog**. If fill rate is garbage, it stays offline until promoted or is published only with honesty labels.

---

## 2. Architecture (optimized for Supabase + Next)

```
┌─────────────────────────────────────────────────────────────┐
│ L0 FACT SOURCES                                              │
│  listings (active + closed)                                  │
│  listing_history / price_history (path-to-sale events)        │
│  activity_events (new/drop/BOM)                              │
│  market_pulse_live (point-in-time inventory — not history)   │
│  inventory_snapshots (PLANNED — fix YoY inventory % nulls)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ offline only (cron / service_role)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ L1 ANALYTIC FACT TABLES (narrow, typed, indexed)             │
│  fact_closed_sale     — one row per close + BOTH sides:      │
│     list_office_key, list_agent_key,                         │
│     buy_office_key, buy_agent_key, side flags                │
│  dim_office / dim_agent — entity-resolved brokerage/broker   │
│  fact_listing_active  — optional daily snapshot grain        │
└──────────────────────────┬──────────────────────────────────┘
                           │ rebuild RPCs
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ L2 CUBES / MARTS (pre-agg — public + reports read ONLY these)│
│  mart_market_period   — geo × period × type_scope            │
│  mart_cross_dim       — sparse multi-dim rollups             │
│  mart_feature_premium — amenity/cohort premia                │
│  mart_distribution    — price/DOM histograms by cell         │
│  mart_seasonality     — month-of-year indices                │
│  mart_geo_share       — city share of region volume          │
│  mart_office_share    — office × geo × period × side         │
│  mart_agent_share     — agent × office × geo × period × side │
│  mart_office_rank     — materialized top-N + rank columns    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ L3 QUERY LAYER                                               │
│  lib/data/analytics/*  — only entry for app + reports        │
│  query_closed_sales RPC — bounded, parameterized, no details │
│  Advanced search (active) reuses same dimension language     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ L4 PRODUCTS                                                  │
│  Unique Search · Report Factory · Public Market UI · Admin   │
│  CMA/comps · Newsletter/video · AEO Dataset pages            │
└─────────────────────────────────────────────────────────────┘
```

### Performance locks (non-negotiable)

| Lock | Why |
|------|-----|
| **No public/request path over raw `listings` for multi-dim stats** | 377k+ rows, timeouts, wrong under load |
| **No `details` projection in scan paths** | G62 TOAST outages |
| **Partial indexes on closed CTE predicates** | Rebuild + rare interactive queries |
| **`fact_closed_sale` denormalized flags** | Amenity filters without JSONB |
| **Cube grain chosen by cardinality** | Annual deep history; monthly modern; avoid year×city×every_flag full cross-product as dense table — use **sparse mart** or on-demand RPC with strict limits |
| **Query budget** | Interactive: ≤500ms p95 on marts; rebuild: batch by year, advisory lock |
| **Median sample gates** | Never publish individual-ish “medians” |

### Sparse multi-dim strategy (expert choice)

**Do not** materialize every combination of 20 binary amenities × city × year (combinatorial explosion + empty cells).

**Do:**

1. **Dense marts** for core: `geo × time × type_scope` with full metric set (extend cache).  
2. **Feature flag columns on `fact_closed_sale`** for interactive unique search.  
3. **On-demand aggregation RPC** for arbitrary filter sets:  
   `analyze_closed_sales(filters jsonb) → metrics`  
   - Service path: query **fact table or indexed typed columns only**  
   - Hard caps: max date span, max geos, require ≥N results for median  
   - Result cache table keyed by filter hash (TTL 6–24h)  
4. **Precompute only high-traffic cells** (region/city × year × top amenities) into `mart_feature_premium`.

This gives **unique searches** without a million empty cube rows.

---

## 3. Dimensional model

### 3.1 Fact: closed sale (primary)

**Grain:** one MLS closed transaction (ListingKey at close).  
**Universal filter:** CACHE_TABLE closed CTE (status closed, price ≥ 1000, date valid).

**Core measures (always computable when not null):**

| Measure | Source / formula |
|---------|------------------|
| `close_price` | ClosePrice |
| `volume` | ClosePrice (for SUM) |
| `living_sqft` | TotalLivingAreaSqFt |
| `ppsf` | close / sqft (sqft > 200) |
| `list_price_final` | ListPrice / OriginalListPrice context |
| `sale_to_list` | sale_to_list_ratio or Close/OriginalList |
| `sale_to_final_list` | sale_to_final_list_ratio |
| `concessions` | concessions_amount |
| `dom_list` | DaysOnMarket / CumulativeDaysOnMarket (label which) |
| `days_to_pending` | days_to_pending (preferred liquidity) |
| `days_pending_to_close` | days_pending_to_close |
| `tax_annual` | tax_annual_amount |
| `tax_rate` | tax_rate |
| `hoa_monthly` | hoa_monthly / association_fee normalized |
| `lot_acres` | lot_size_acres |
| `year_built` | year_built |
| `property_age_at_sale` | year(CloseDate) − year_built |

### 3.2 Fact: inventory snapshot (secondary — required for true MoS history)

**Gap today:** YoY inventory % in cache is NULL without point-in-time snapshots.  
**Expert requirement:** daily or weekly `inventory_snapshots (geo, date, type_scope, active_count, median_list, …)` written by existing pulse cron.  
Without this, “market analysis” over time is **sales-only** (still powerful) but incomplete for supply-side narratives.

### 3.3 Dimension groups (complete catalog)

#### D-TIME
| Attribute | Notes |
|-----------|--------|
| close_date | continuous |
| year, quarter, month, ISO week | derived |
| season (DJF/MAM/JJA/SON) | seasonality |
| era tags | expert labels: pre-GFC, GFC, recovery, pandemic, rate-shock — **derived rules**, not MLS fields |

#### D-GEO
| Attribute | Fill (closed 2020+, ~93.5k base) | Priority |
|-----------|----------------------------------|----------|
| region (Central Oregon) | constructed | P0 |
| City | high | P0 |
| county | typed | P0 |
| PostalCode | high | P1 |
| SubdivisionName | ~90k nn | P1 |
| elementary / middle / high / school_district | ~90k el | P1 |
| neighborhood / community (resolved) | thinner | P2 |
| lat/lng → grid / H3 optional | for heatmaps | P2 |

#### D-STRUCTURE
| Attribute | Priority |
|-----------|----------|
| PropertyType (A–H) | P0 |
| property_sub_type | P0 |
| type_scope (all/sfr/multi/land/other) | P0 derived |
| BedroomsTotal, BathroomsTotal, rooms_total | P0 |
| TotalLivingAreaSqFt bands | P0 |
| lot_size_acres bands | P0 |
| year_built / decade / age band | P0 |
| levels / stories_total | P1 |
| property_attached_yn | P1 |
| architectural_style | P2 (normalize free text) |
| new_construction_yn | P0 |
| senior_community_yn | P1 |

#### D-AMENITY / LIFESTYLE (typed first)

Probe **closed ≥2020** counts (order-of-magnitude leverage):

| Flag / attr | ~n (2020+) | Analytical use | Priority |
|-------------|------------|----------------|----------|
| garage_yn | 64k | Standard premium | P0 |
| fireplace_yn | 46k | Lifestyle / winter | P0 |
| association_yn (HOA) | 30k | Fee burden + community | P0 |
| buyer_financing Cash | 32k | Liquidity / investor | P0 |
| concessions > 0 | 26k | Seller power | P0 |
| view_description nn | 71k | View premium (normalize tokens) | P1 |
| new_construction_yn | 9k | New vs resale | P0 |
| horse_yn | 7.8k | Rural / acreage lifestyle | P1 |
| senior_community_yn | 2.6k | Segment | P1 |
| waterfront_yn | 268 | Luxury thin | P2 + floor |
| pool_yn | 577 | Thin — publish carefully | P2 |
| basement_yn | 218 | Thin | P2 |
| spa_yn | ~0 typed | Mine details or drop | P3 |
| carport_yn / spaces | typed | P1 |
| cooling_yn / heating_yn | typed | P2 climate |

**Details JSONB (~806 keys sampled):** promotion candidates for **extract-to-typed** offline (never live scan):  
`BuilderName`, `View` tokens, `WaterSource`, `Sewer`, `Heating`, `Cooling`, `Roof`, `Flooring`, `CommunityFeatures`, `AccessibilityFeatures`, `GreenEnergy*`, `GarageSpaces` variants, ADU/guest patterns if present, `OccupantType`, lease fields for investor analysis.

**Promotion pipeline:**  
`scripts/analytics/promote-details-keys.mjs` → fill-rate report → Matt lock only for **public labels** → migration adds typed column + backfill batch → fact table gains column. Default: **analyst decides which keys promote**; Matt does not need to invent the list.

#### D-TRANSACTION / FINANCE
buyer_financing, concessions, cash %, sale-to-list, price change counts, back_on_market, was_relisted, days_* measures.

#### D-COMPETITIVE CHANNEL (P0 — full platform, not a footnote)

**Live fill (closed 2024, ~12,069):** ListOfficeName, ListAgentName, buyer_office_name, buyer_agent_name ≈ **100%**.  
This is one of the richest competitive datasets in the warehouse. **We underuse it.**

| Raw field | Role |
|-----------|------|
| `ListOfficeName` | List-side brokerage (MLS office string) |
| `ListAgentName` | List-side broker/agent display name |
| `list_agent_mls_id` / `list_agent_email` | Stable list-agent identity (prefer over name) |
| `buyer_office_name` | Buy-side brokerage |
| `buyer_agent_name` | Buy-side agent display name |
| `buyer_agent_mls_id` | Stable buy-agent identity |
| Co-list / co-buy fields in `details` | Optional later (promote if needed) |

**Entity resolution (required for truthful share):**

| Problem | Expert fix |
|---------|------------|
| Same brokerage many string variants | `dim_office`: canonical_id, display_name, aliases[], brand_family (e.g. RE/MAX), is_active |
| Agent name typos / rebrands | `dim_agent`: preferred key = MLS id; aliases for names; office_id FK (current + history) |
| Name-only match overcounts | **Ban ILIKE name as primary join for share** (same rule as `getBrokerSales` — email/MLS id) |
| Agents change offices | Agent–office membership by CloseDate window (slowly changing dim) |
| Dual agency (same office both sides) | Flag `is_dual_office`, `is_dual_agent`; count sides per methodology |

**Side semantics (lock — every share report states which):**

| `side` | Counts when | Use |
|--------|-------------|-----|
| `list` | List office/agent on the close | “Who listed the most / $ volume listed” |
| `buy` | Buyer office/agent on the close | “Who represented the most buyers” |
| `either` | List OR buy (dedupe per close per entity once) | “Who touched the most transactions” |
| `both_sides_credit` | List counts 1 + buy counts 1 (same close can count 2 for one office if dual) | Industry “sides” / GCI proxy style rankings |

Default public/internal leaderboard: **`list` and `buy` separately**, plus optional **`both_sides_credit`** labeled “sides.”

**Hierarchy:**

```
dim_office (brokerage / office)
  └── dim_agent (broker)  many agents per office
        └── fact_closed_sale roles: list_* / buy_*
```

Drill path: **Region → City → Office ranking → Office detail → Agents in office → Agent detail → closed cohort metrics**.

---

## 4. Metric catalog (what we compute)

### 4.1 Base metrics (every cell)

| Metric | Definition |
|--------|------------|
| sold_count | COUNT(*) |
| total_volume | SUM(close_price) |
| mean_price | AVG |
| median_price | percentile_cont(0.5) |
| p10, p25, p75, p90 price | distribution |
| median_ppsf / p25–p75 ppsf | quality of stock |
| median_dom / days_to_pending | speed |
| mean sale_to_list | power |
| cash_pct | financing mix |
| concession_rate | % with concessions > 0 |
| median_concession \| concessions > 0 | severity |
| median_lot_acres, median_year_built | stock character |
| mean_beds, mean_sqft | structure |

### 4.2 Derived / comparative metrics

| Metric | Definition | Use |
|--------|------------|-----|
| volume_share_of_region | city volume / region volume | composition |
| unit_share_of_region | city units / region units | composition |
| yoy_volume_pct, yoy_median_pct, yoy_units_pct | vs prior year same grain | reports |
| cagr_n | compound annual growth over N years | long arcs |
| seasonality_index | month mean / annual mean | when to list |
| amenity_premium_pct | median(with) / median(without) − 1 | unique insights |
| size_premium curve | ppsf by sqft band | builder/buyer |
| age_premium curve | price by decade built | stock aging |
| concentration_top_decile | % volume from top 10% prices | inequality of market |
| thin_flag | sold_count < floor | suppress medians |
| data_quality_score | % non-null critical fields in cell | honesty |

### 4.3 Competitive / market-share metrics (P0)

Computed per **entity** (office or agent) × **geo** × **period** × **type_scope** × **side**:

| Metric | Definition |
|--------|------------|
| `sides_count` | Count of side-credits under chosen side methodology |
| `tx_count` | Distinct closes touched (either-side deduped) |
| `volume` | SUM(ClosePrice) of credited sides (list or buy credit uses that close’s price) |
| `volume_share_pct` | entity volume / market volume in same cell × 100 |
| `unit_share_pct` | entity tx or sides / market × 100 |
| `rank_volume` / `rank_units` | dense rank in cell |
| `rank_delta_yoy` | rank change vs prior year |
| `share_delta_yoy_pp` | percentage-point change in share |
| `median_close` / `mean_close` | price point of their book |
| `median_ppsf` | quality/positioning of their book |
| `avg_dom` / median days_to_pending | speed of their listings (list-side) |
| `pct_of_office` | agent volume / parent office volume (agent rows only) |
| `agent_count_active` | distinct agents with ≥1 side in period (office rows) |
| `hhi` / top10_concentration | market concentration among offices in cell |
| `dual_office_rate` | % of closes where list_office = buy_office |
| `self_deal_rate` | % where list_agent = buy_agent |
| `new_construction_share` | mix of their book |
| `luxury_share` | % of their volume in top price decile of market |
| `geo_mix` | jsonb breakdown of their volume by city |
| `type_mix` | jsonb by property type |

**Ryan Realty lens (first-class, not vanity):**  
Same metrics with `office_key = Ryan Realty (canonical)` and each Ryan agent — vs market and vs named peer set (top N competitor offices). Competitive dashboard always answers: **our share, our rank, who we lost share to, by city and type**.

### 4.4 Dual-fact metrics (need inventory snapshots)

| Metric | Formula |
|--------|---------|
| months_of_supply | active / (closed_N / N * 30) — **same type_scope both sides** |
| absorption_rate | closed / active |
| list_to_sale_spread | median list (active) vs median close (period) |

---

## 5. Analysis domains (productized analyses — expert backlog)

Each domain = **metric set + default dimensions + report template + public surface priority**.

| ID | Domain | Question it answers | Default dims | Public? |
|----|--------|---------------------|--------------|---------|
| A01 | **Market size & growth** | How big is CO housing in $ and units over time? | year, type_scope, geo | P0 public |
| A02 | **Market composition** | What is the market *made of*? | type, sub_type, price tier, beds | P0 |
| A03 | **Geographic structure** | Which cities carry the volume? Share shifts? | city, county, year | P0 |
| A04 | **Price distribution** | Not just median — full shape of market | bands, percentiles | P0 |
| A05 | **Liquidity & power** | How fast? Who wins? | DOM, STL, concessions, cash | P0 |
| A06 | **Seasonality** | Best months to list/buy historically | month, city | P1 |
| A07 | **Cycle & regime** | GFC / pandemic / rate shock behavior | era, year | P1 content |
| A08 | **Amenity & lifestyle premia** | What do fireplaces/views/HOA/horse property trade at? | feature × geo × year | P0 search + reports |
| A09 | **Size & lot economics** | PPSF by size; acreage premium | sqft/lot bands | P1 |
| A10 | **Age of stock** | New vs 70s vs pre-war | year_built decade | P1 |
| A11 | **School-zone markets** | Pricing by elementary/high (aggregate only) | school | P1 |
| A12 | **Subdivision / resort micro** | Caldera vs Tetherow-class cells | subdivision/community | P1 curated |
| A13 | **New construction vs resale** | Share and pricing of new | new_construction_yn | P1 |
| A14 | **Affordability** | PITI, tax, HOA burden at medians | geo, year | P1 |
| A15 | **Inventory vs sales (supply)** | MoS history, absorption | needs snapshots | P0 once snapshots exist |
| A16 | **Path-to-sale** | Price cuts, BOM, relist → close | history tables | P2 |
| A17 | **Competitive intelligence (brokerage + broker)** | Full market share system — see §15 | office, agent, side, geo, time | **Admin P0; public only if ODS/policy allows aggregates** |
| A17a | **Office leaderboard** | Top brokerages by volume/units/share | office × side | Admin P0 |
| A17b | **Agent leaderboard** | Top brokers market-wide | agent × side | Admin P0 |
| A17c | **Office → agent drilldown** | Who produces inside a brokerage | agent within office | Admin P0 |
| A17d | **Share over time** | Rank and share trajectories | year/month | Admin P0 |
| A17e | **Competitive set** | Us vs named peers | office set | Admin P0 |
| A17f | **City battlefield** | Share by city for each office | office × city | Admin P0 |
| A17g | **Segment share** | Luxury / new / horse / price band share by office | office × segment | Admin P1 |
| A17h | **Concentration** | Is market consolidating? HHI, top-5 share | market cell | Admin P1 |
| A17i | **Dual agency / in-house** | Same-office both sides rates by office | office | Admin P1 |
| A17j | **Recruiting / capacity** | Agents active, volume per agent | office | Admin P1 |
| A18 | **Investor / cash** | Cash share, multi, concessions | financing, type | P1 |
| A19 | **Outlier & luxury desk** | Top 5% volume, thin waterfront | price p90+ | P2 labeled |
| A20 | **Data quality & coverage** | What years/fields are trustworthy? | year × field fill | Internal P0; footnotes public |
| A21 | **Repeat-sale / appreciation** | Same-property if keys allow | parcel/cluster | P2 if data supports |
| A22 | **Comparative markets** | Bend vs Redmond vs Sisters side-by-side | multi-geo | P0 reports |
| A23 | **Segment playbooks** | “Westside under 800k with garage” style cohorts | multi-filter | Unique search P0 |
| A24 | **Content auto-insights** | Ranked surprising YoY moves for blog/video | all marts | G8 feed |

**Fireplace 1998** is a single cell of **A08 × A01**. The platform is A01–A24.

---

## 6. Unique multi-dimensional search (product)

### 6.1 Two search modes, one dimension language

| Mode | Status set | Purpose |
|------|------------|---------|
| **Inventory search** | Active / pending / coming soon | Buy product (exists; extend filters to full D-* language) |
| **Closed-market search** | Closed + date range | Analysis, comps, “what sold like this” |

**Expert requirement:** Same filter chips and query AST for both. User learns one language.

### 6.2 Query AST (conceptual)

```text
{
  status: "closed" | "active" | ...,
  close_date?: { from, to },
  geo?: { cities[], zips[], subdivision?, school?, polygon? },
  type_scope?: "sfr" | "all" | ...,
  structure?: { beds, baths, sqft, lot, year_built, sub_types[] },
  amenities?: { fireplace, garage, hoa, horse, waterfront, ... },
  economics?: { price, ppsf, cash_only, max_dom, concessions },
  output: "listings" | "metrics" | "both"
}
```

- `output: listings` → paginated cards (ODS: closed may be limited / aggregate-first on public).  
- `output: metrics` → **analyze_closed_sales** → full metric catalog for the slice.  
- Public default for thin closed slices: **metrics only** (no address dump).

### 6.3 “Unique search” examples the system must support (not a backlog from Matt — capability tests)

1. SFR closed in Bend 2021–2023, 3+ bed, garage, under $750k → count, median, ppsf, DOM.  
2. Horse property closes Deschutes County last 5 years → volume + median acres.  
3. Cash purchases share by city 2019 vs 2024.  
4. New construction % of volume region by year since 2010.  
5. Subdivisions with ≥20 closes/year and median DOM &lt; 14.  
6. Elementary school zones with highest median ppsf (n ≥ floor).  
7. YoY median change for Sisters SFR vs Bend SFR.  
8. Price band mix shift 2005 → 2015 → 2025 region.  
9. Concessions rate in rate-shock years vs 2021.  
10. Active inventory today matching a closed cohort (buy-side “what’s left like what sold”).

### 6.4 Saved analyses & alerts

- Save AST → account (mirrors saved searches).  
- Alert when **metrics** cross thresholds (e.g. “Bend MoS &lt; 3”) or when **new closes** match filter.  
- Feeds G4/G10 engagement with **analysis product**, not only listing alerts.

---

## 7. Market report factory (templates)

Reports are **parameterized analyses**, not bespoke pages each time.

| Template ID | Name | Inputs | Sections (metrics) | Consumers |
|-------------|------|--------|--------------------|-----------|
| R01 | Region annual review | year, type_scope | A01–A05, A03 share, A04 | `/housing-market/annual-review`, press |
| R02 | City deep dive | city, trailing 12m + 5y | size, speed, composition, seasonality | city market pages |
| R03 | Then vs now | year_a, year_b, geo | volume, units, median, mix | hero storytelling |
| R04 | Composition deck | year, geo | type, price tier, beds | public + PDF |
| R05 | Lifestyle premium | feature, geo, years | A08 premium table | unique content |
| R06 | School market brief | school or district | A11 | school pages |
| R07 | Subdivision card | subdivision | micro A12 | community/subdivision |
| R08 | Seasonality guide | geo | A06 | blog / sell |
| R09 | Liquidity stress | geo, window | A05 + concessions + cash | broker internal + market |
| R10 | Comparative cities | cities[] | A22 matrix | reports hub |
| R11 | New vs resale | geo, years | A13 | builder/buyer content |
| R12 | Affordability | geo | A14 | sell/buy tools |
| R13 | Weekly pulse narrative | geo | pulse + 7d closes | newsletter / video |
| R14 | **Competitive market share (full)** | period, geo, type_scope, side | A17a–j leaderboards + HHI + us-vs-peers | **admin competitive desk** |
| R14b | Office dossier | office_id, period | rank, share, agents, geo mix, yoy | admin |
| R14c | Agent dossier | agent_id, period | rank, office, book metrics, yoy | admin |
| R14d | City competitive map | city, period | office share stacked | admin |
| R14e | Quarterly competitive brief | quarter | share movers, new entrants, drop-offs | admin + optional internal PDF |
| R15 | Auto-insights digest | period | A24 + **share movers (A17d)** | content engine (careful claims) |

**Implementation:** each template = pure function  
`buildReport(templateId, params) → ReportDocument`  
from marts/RPC only. UI and PDF/email are renderers.

**Existing assets to absorb (do not fork methodology):**  
`market_stats_cache`, annual-review page, city archive, generate-market-report paths, newsletter closed-sales rules, YouTube market report data stories — **all must call the same query layer** over time.

---

## 8. Attribute intelligence (extrapolating the database)

### 8.1 Coverage classes

| Class | Definition | Serving rule |
|-------|------------|--------------|
| **A — Typed, high fill** | e.g. city, beds, fireplace 2020+ | full public analysis |
| **B — Typed, medium fill** | horse, new construction | public with n labels |
| **C — Typed, sparse** | pool, waterfront, basement | public only n ≥ floor; often “specialty desk” |
| **D — Details-only** | 800 keys | offline promote → then B/C |
| **E — Unreliable by year** | early 90s sparse years | suppress or count-only |

### 8.2 Continuous discovery loop (expert ops)

Monthly job:

1. Sample closed sales; inventory details keys + fill rates by year.  
2. Rank keys by: fill rate × cardinality usefulness × buyer intent.  
3. Auto-open “promote candidate” list in admin.  
4. After typed backfill, add to dimension language + search chips + A08.

**This is how we “extrapolate everything” without boiling the ocean on day one.**

### 8.3 Normalization dictionaries (required for unique search quality)

Free-text fields destroy analysis if left raw:

- `view_description` → tokens: mountain, cascade, river, golf, territorial, …  
- `architectural_style` → style enum  
- `buyer_financing` → Cash / Conventional / FHA / VA / Other  
- `SubdivisionName` → slug + alias map (known messiness)

Store normalized enums on `fact_closed_sale`.

---

## 9. Public vs admin vs content

| Surface | What ships | Constraint |
|---------|------------|------------|
| **Public market UI** | R01–R04, R10; explorer for A01–A08; Dataset JSON-LD | Aggregates; floors; type_scope labels |
| **Public unique search** | Closed metrics + optional limited listing cards | ODS; no bulk sold address scraping |
| **Listing / city / sell embeds** | Contextual “in this slice” stats | Same query layer |
| **Admin competitive desk** | Full A17a–j, R14–R14e, exports, us-vs-peers | Auth brokers; default home for “competition” |
| **Admin market analytics** | Full A01–A24, exports | Service role; broker auth |
| **Content engine / video / newsletter** | R13, R15, A24 | Must use DAL — ban hand SQL in skills long-term |
| **CMA** | Cohort metrics from same filters | Align comps with analyze_closed_sales |

---

## 10. Relationship to prior “sales intelligence” plan

| Prior SI unit | Maps to this platform |
|---------------|----------------------|
| SI-0 truth map | **A20** + dimension fill audit + type_scope map |
| SI-1 annual cube | **mart_market_period** annual grain (A01–A04) |
| SI-2 DAL | **lib/data/analytics** query layer start |
| SI-3 size/composition UI | R01/R03/R04 public |
| SI-4 cache volume | Bridge while marts build — still valid |
| SI-5 feature cube | **A08** + sparse mart + analyze RPC |
| SI-6 embeds | contextual metrics |
| SI-7 ops | rebuild + promote loop + heartbeat |

**SALES_INTELLIGENCE_EXECUTABLE.md** remains the **build checklist**.  
**This file** remains the **what/why/how far** expert canon. If they conflict, **this file wins on scope**; SI wins on ship sequencing only when narrower.

---

## 11. Phased delivery (expert priority — value × feasibility)

### Wave MA-0 — Analytical foundation (must first)
1. Closed-sale fact projection (view or table) **without details**.  
2. Dimension fill report by year (A20).  
3. type_scope + PropertyType map locked.  
4. Partial indexes.  
5. `analyze_closed_sales` RPC v1 (core filters + base metrics).  
6. inventory_snapshots design (even if write comes next).

### Wave MA-1 — Market size & structure product
1. mart_market_period annual + monthly modern (absorb cache).  
2. Public R01/R03/R04.  
3. Geo share (A03).  
4. Distributions (A04) in reports.

### Wave MA-2 — Unique search (closed + inventory parity)
1. Query AST + UI chips shared.  
2. Closed metrics search.  
3. Saved analyses.  
4. Amenity filters class A/B.

### Wave MA-3 — Premium & lifestyle analytics
1. Normalization dictionaries.  
2. A08 premia tables.  
3. R05 lifestyle reports.  
4. Promote top 10 details keys.

### Wave MA-4 — Supply side + path-to-sale
1. inventory_snapshots live.  
2. Historical MoS (A15).  
3. Path-to-sale (A16) light.

### Wave MA-5 — Automation
1. Report factory for all R-templates.  
2. A24 auto-insights → content engine.  
3. Continuous promote loop.

### Wave MA-C — Competitive intelligence (parallel with MA-1, not deferred)

**Do not park this behind “later admin.”** Fill rates support building early.

1. `dim_office` / `dim_agent` bootstrap from distinct list+buy strings + MLS ids.  
2. Alias merge UI (admin) for top string variants of major Bend offices.  
3. `mart_office_share` + `mart_agent_share` (period × geo × type_scope × side).  
4. Admin routes: leaderboard, office drilldown, agent drilldown, Ryan vs peers.  
5. Indexes: list_agent_mls_id, buyer_agent_mls_id, normalized office keys on fact.  
6. R14 / R14b–e templates.  
7. Export CSV of rankings for any filter set.  
8. Policy note: public publication of competitor names = Matt/legal lock; **platform builds full fidelity for authenticated competitive desk regardless**.

---

## 12. Success metrics (for the analytics platform itself)

| Metric | Target |
|--------|--------|
| % of public market claims traceable to analytics DAL | 100% |
| Interactive analyze_closed_sales p95 | ≤ 500ms for cached/mart; ≤ 2s uncached bounded |
| Report templates automated | ≥ 10 of R01–R15 + R14 family |
| Dimension chips in unique search | All class A + B amenities |
| Zero G62 violations in analytics paths | Gate |
| Years with published size series | first_publish_year → current |
| Content pieces using hand-rolled SQL | → 0 |
| **Office share ranks for Bend T12** | Live, side-labeled, entity-resolved |
| **Agent-within-office drilldown** | Works for top 20 offices by volume |
| **Ryan Realty share + rank by city** | Dashboard tile always current |
| **Name-only share joins** | Zero (MLS id / resolved keys only) |

---

## 13. Anti-patterns (expert bans)

| Ban | Reason |
|-----|--------|
| Building only what was mentioned in chat | Leaves 95% of value on the table |
| One-off SQL in page.tsx | Methodology drift |
| Median without n | Fake precision |
| Unlabeled SFR vs all | Trust death |
| Full cross-join amenity cubes | Explodes storage/empty cells |
| Live details->> analytics | TOAST outage class |
| Publishing sparse pool/waterfront medians without floors | Misleading luxury stats |
| “1990 market” without rows | Fiction |
| Competitive share only as “our team page sales” | Ignores full MLS channel data |
| Ranking by raw `ListOfficeName` string without dim_office | Fragments RE/MAX, Cascade, etc. into fake share |
| Counting only list side without labeling | Misstates “who does the most deals” |
| Double-counting dual agency without methodology | Inflates favorites |

---

## 14. Immediate expert decisions (locked until data falsifies)

1. **Primary fact** = closed sales; inventory snapshots are second fact for supply.  
2. **Serving pattern** = dense core marts + sparse/on-demand analyze RPC + result cache.  
3. **Search** = one dimension language for active and closed.  
4. **Reports** = template factory over the same layer.  
5. **Attribute expansion** = continuous promote-from-details loop, ranked by fill × utility.  
6. **Public default type_scope** for “homes” narrative = `sfr`; for “market size $” = `all` with comparison.  
7. **Publish floor** for long series = data-driven (CO closed mass from **~1998**; 1990 empty).  
8. **First ship value** = MA-0 + MA-1 (size/composition/distributions) **and MA-C competitive marts in parallel** — competitive is not “phase 5 nice-to-have.”  
9. **Competitive identity** = MLS ids + dim_office aliases; never name ILIKE as primary.  
10. **Competitive UI default** = admin competitive desk; public competitor naming needs explicit Matt/legal lock.  
11. **Geo for “Central Oregon” stats** = `SERVICE_AREA` / `CENTRAL_OREGON_CITY_SLUGS` only (EDA 2026-08-10: feed-wide 2024 ~$6.5B vs CO ~$3.93B).  
12. **2024 CO baseline (all types, closed CTE):** **5,707** closes, **~$3.93B** volume, median **$570k** — use as methodology check for marts.

---

## 15. Competitive intelligence — full product (A17 expanded)

### 15.1 Questions the system must answer (capability tests)

1. Which **brokerages** had the highest **list-side $ volume** in Central Oregon SFR in 2024? Share %?  
2. Same for **buy-side**. Same for **sides (list+buy credit)**.  
3. Rank brokerages in **Bend only** vs **Redmond only** — who wins which battlefield?  
4. For **RE/MAX Key Properties** (canonical), who are the **top 20 agents** by volume and units?  
5. What **% of Bend closes** did Ryan Realty touch (list, buy, either)? Rank vs top 10 peers.  
6. How did office X’s **share change 2021 → 2025** (pp and rank)?  
7. Which offices gained the most **share of luxury** (top decile) last 12 months?  
8. Dual-agency rate by office — who keeps both sides?  
9. Volume per active agent by office (capacity / productivity).  
10. Filter: horse properties 2020–2025 — which offices dominate that segment?  
11. New construction list-side share by office.  
12. Export full office ranking CSV for any period/geo for broker strategy.

### 15.2 Data model

```
dim_office (
  office_id uuid PK,
  canonical_name text,
  brand_family text null,      -- e.g. "RE/MAX", "Coldwell Banker"
  aliases text[] ,             -- raw ListOfficeName / buyer_office_name forms
  is_ryan_realty boolean,
  meta jsonb
)

dim_agent (
  agent_id uuid PK,
  primary_mls_id text unique null,
  primary_email text unique null,
  display_name text,
  aliases text[],
  -- current office optional; history in agent_office_span
)

agent_office_span (
  agent_id, office_id, valid_from, valid_to null
)

fact_closed_sale (
  ...,
  list_office_id, list_agent_id,
  buy_office_id, buy_agent_id,
  is_dual_office, is_dual_agent
)

mart_office_share (
  geo_type, geo_slug, period_type, period_start, type_scope, side,
  office_id,
  sides_count, tx_count, volume, volume_share_pct, unit_share_pct,
  rank_volume, rank_units, median_close, ...
  PRIMARY KEY (..., office_id)
)

mart_agent_share ( same grain + agent_id + office_id )
```

### 15.3 Rebuild & query

- Nightly rebuild share marts from fact for rolling + monthly/annual periods.  
- Interactive: `analyze_competitive({ geo, period, type_scope, side, entity: office|agent, parent_office? })`.  
- Top-N queries always **pre-ranked in mart** (no sort 12k offices live without limit).

### 15.4 UI surfaces (admin competitive desk)

| Route (illustrative) | Function |
|----------------------|----------|
| `/admin/analytics/competition` | Leaderboard + side toggle + geo + period |
| `.../competition/offices/[id]` | Office dossier + agent table + geo mix + yoy |
| `.../competition/agents/[id]` | Agent dossier |
| `.../competition/ryan` | Us vs peers fixed set |
| `.../competition/cities/[city]` | Stacked share / battlefield |

### 15.5 Existing code to absorb

| Asset | Use |
|-------|-----|
| `getBrokerSales` | Own-agent closed tiles — keep for profile; **do not** use as market share engine |
| `list_agent_email` index | List-side identity |
| `buyer_agent_mls_id` | Buy-side identity; **add index** (known seq-scan risk) |
| BROKER_MLS_ID_BY_EMAIL map | Seed dim_agent for Ryan team only |

### 15.6 Legal / product policy

- MLS data may restrict public advertising of competitor production — **build full analytics for authenticated use first**.  
- Public site: prefer aggregate market claims without naming competitors unless Matt locks otherwise.  
- Never invent GCI; we have **close prices and sides**, which are honest proxies if labeled.

---

## 16. One-line canon

**We are building the Central Oregon residential market and competitive analytics platform: every trustworthy market slice and every brokerage/broker share of that slice — queryable, ranked, reportable, and methodology-identical — not a thin median dashboard and not a single-feature demo.**

---

*Execution: `SALES_INTELLIGENCE_EXECUTABLE.md` + MA-C wave. Competitive share is parallel to market size, not a later footnote. Do not wait for more examples.*
