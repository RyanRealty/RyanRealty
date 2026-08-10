# Sales Intelligence — Executable Architecture & Plan

**Date:** 2026-08-10  
**Status:** ACTIVE — child of `GOAL_10X_EXECUTABLE.md`  
**Owner mode:** Expert locks below are law unless Matt re-locks  
**Purpose:** Ship the **Market Analytics Platform** (queryable closed sales, unique multi-dim search, report factory) without request-path bottlenecks, TOAST scans, or §0 lies.

**Analytical scope SSOT (what to build, full domain catalog):**  
→ **`MARKET_ANALYTICS_PLATFORM.md`** — expert canon including **competitive intelligence (A17a–j, brokerage + broker share, §15)**, market structure A01–A24, unique search, report factory. Chat examples are **not** the backlog.

**Invocation:** When Matt says “sales intelligence” / “run cubes” / continue 10× **G9** → open `MARKET_ANALYTICS_PLATFORM.md` for scope + this file for ship units + `VERIFY_LOG` → next incomplete unit → ship.

---

## 0. Expert locks (do not reopen every session)

| # | Lock |
|---|------|
| S0 | **Source of truth for closes** = `public.listings` closed CTE (`StandardStatus` ILIKE `%Closed%`, `CloseDate` NOT NULL, `ClosePrice >= 1000`, `CloseDate <= CURRENT_DATE`). Spec: `docs/data/CACHE_TABLE_FIELD_SPEC.md`. |
| S1 | **Public pages never aggregate raw `listings` at request time** for market history. Read **cubes / cache only**. Raw scans = cron + admin backfill only. |
| S2 | **Never** `details->>` / project full `details` on closed-sales fan-out (G62 TOAST). Features only from **typed columns** or pre-extracted flag tables. |
| S3 | **Methodology is product:** every figure labels property-type scope (`sfr` vs `all` vs type group). Never mix SFR pulse numbers with all-type volume without labeling. |
| S4 | **First publishable year is data-driven** (region n + field fill), not marketing fantasy. Live probe 2026-08-10: **1990 = 0**; **1995 thin (111)**; **1998 thick (~8.7k)**. Floor defaults to **1998 region** until S0 map revises. |
| S5 | **Junk earliest dates (e.g. 1907) are excluded** by publish floor, not shown as history start. |
| S6 | **Median sample gate:** never publish a median when n < floor (existing `MONTHLY_VOLUME_FLOOR` / median sample gate patterns). Counts and volume OK at lower n with “limited sample” label when useful. |
| S7 | **ODS:** aggregates only on public site — no sold-address dumps in “reports.” |
| S8 | **One compute path:** new cubes call shared SQL helpers / RPCs that mirror closed CTE + geo macros. No second definition of “closed sale.” |
| S9 | **Perf budget:** any public market history page TTFB target ≤ existing city market pages; cube reads O(rows in cube) not O(listings). Cube rebuilds bounded + advisory-locked like pulse. |

---

## 1. Audit findings (fact base — 2026-08-10)

### 1.1 Warehouse depth (live)

| Metric | Value |
|--------|------:|
| Closed + dated | ~378,800 |
| Closed + priced (≥$1k) | ~377,000 |
| Max CloseDate | 2026-08-07 |
| Min CloseDate (raw) | 1907 (noise) |
| Closed+priced 1990 | 0 |
| Closed+priced 1998 | ~8,726 |
| Closed+priced 2005 | ~19,138 |
| Closed+priced 2010 | ~9,749 |
| Closed+priced 2016 | ~15,850 |
| Closed+priced 2020 | ~17,647 |
| Closed+priced 2024 | ~12,069 (all types) |
| Fireplace sold 1998 | 1,575 |
| Fireplace sold 2024 | 6,052 |
| 2024 type A / B / C / D | 9,734 / 492 / 208 / 1,355 |

**Implication:** Deep sales **intelligence is possible today**. The product does not expose it.

### 1.2 What already exists (do not rebuild blindly)

| Asset | Role | Gap |
|-------|------|-----|
| `compute_and_cache_period_stats` | Full metric row into `market_stats_cache` | **SFR-oriented** product use; monthly depth from **2016-07**; has `total_volume`, type/band/bedroom breakdowns underused on site |
| `refresh_market_pulse` | Live inventory HUD | Not historical sales size |
| `/api/cron/refresh-market-stats` | Rolling 30/90/365 + current month/quarter/ytd | Does not build multi-decade annual all-type cubes |
| `/api/cron/refresh-market-stats-monthly-recompute` | Late closes into past months | Good pattern to extend |
| `scripts/backfill-market-history.mjs` | Monthly cache → 2016-07 | Floor is 2016, not 1998; type-scoped like RPC |
| `market_history_weekly` | Weekly inventory snapshots | Not closed $ volume history |
| City archive + annual-review + charts | Public consumers of cache | Medians / sold counts / YoY — **not market-size narrative or type mix as hero** |
| Typed flags | `fireplace_yn`, `pool_yn`, `fireplaces_total`, beds, sqft, `PropertyType`, … | No feature×year×geo cube |
| G62 + bound details RPCs | Prevent TOAST outages | Must govern any new feature extraction |

### 1.3 Workflow map (current)

```
Spark sync (delta/full)
  → listings (+ history tables)
  → post-sync / pulse refresh (10–15m)
  → refresh-market-stats (rolling + current periods)
  → monthly recompute (late closes)
  → optional backfill script (historical months ≥ 2016-07)
  → DAL getMarket* / getPriceHistory / getCityArchive
  → public /housing-market/* pages

MISSING BRANCH:
  listings closed ──cron/RPC──► sales cubes (annual / feature / type)
                              → getSalesCube DAL
                              → size/composition/explorer surfaces
```

### 1.4 Bottlenecks to design out

| Bottleneck | Failure mode | Mitigation (locked) |
|------------|--------------|---------------------|
| Request-time `COUNT/SUM` over 377k closes | Timeout, CPU, wrong under load | Cubes only |
| `details` JSONB feature mining live | TOAST detoast disaster (G62) | Typed columns + offline extract |
| One giant unscoped RPC | Statement timeout | Partition rebuild by year or geo; `statement_timeout` raised only on service role job; advisory lock |
| Dual methodology (pulse SFR vs all-type volume) | Trust death | Explicit `type_scope` on every row + UI toggle |
| Median of thin years | Fake “market” from 1–2 sales | Sample floors |
| Expanding monthly cache to 1998 × all geos × all metrics | Row explosion + recompute cost | **Annual** cubes for deep history; keep monthly for ≥2016 (or rolling modern) |
| Reading 13k+ cache rows in SSR | Slow pages | Series endpoints with year grain + select columns; Next cache tags |

---

## 2. Target architecture (optimized)

### 2.1 Layers

```
L0 FACT
  listings (closed CTE) + typed attributes
  indexes: closed partials on (CloseDate), (City, CloseDate), (PropertyType, CloseDate), feature flags

L1 CUBES (new + extended)
  A. sales_cube_annual     — year × geo × type_scope → count, volume, median*, ppsf*, bands jsonb
  B. sales_cube_feature    — year × geo × type_scope × feature_key → count, volume, median*
  C. market_stats_cache    — KEEP for modern monthly/rolling (2016+) — surface total_volume + breakdowns harder

L2 COMPUTE
  RPC: rebuild_sales_cube_annual(p_from_year, p_to_year)   — service role only
  RPC: rebuild_sales_cube_feature(p_features[], …)
  Cron: nightly incremental (last 2 years only) + weekly full from floor
  Backfill script: one-shot historical years (same RPC as cron)

L3 DAL (@/lib/data only)
  getSalesCubeAnnual / getSalesCubeFeature / getMarketSizeSeries
  Zod inputs; resilient cache; never supabase-js on listings for public market history

L4 PRODUCT
  Market size story · composition · constrained explorer · embeds on city/sell/listing · Dataset JSON-LD
```

### 2.2 Type scope enum (canonical)

| `type_scope` | Definition (SQL must match exactly) |
|--------------|-------------------------------------|
| `all` | All property types in closed CTE |
| `sfr` | PropertyType = `A` **and** (if used) SFR subtype rules aligned with pulse/video guards — document in cube DDL comments |
| `multi` | Types treated as multi-unit (B/C or sub_type map — lock in S0) |
| `land` | Type D (confirm against RESO map in S0) |
| `other` | Remainder |

Public default for “homes” copy = **`sfr`**.  
Public default for “size of the market ($)” hero = **`all`** with SFR comparison series.

### 2.3 Geo grain (v1)

| geo_type | geo_slug | v1 |
|----------|----------|----|
| `region` | `central-oregon` | Required |
| `city` | space-form lower(City) canon | REPORT_CITIES + pulse cities |
| `neighborhood` / `community` | — | v2 after city stable |

### 2.4 Feature allowlist (v1)

Only columns that are **typed + indexed-capable**:

| feature_key | Source column |
|-------------|---------------|
| `fireplace` | `fireplace_yn IS TRUE` OR `fireplaces_total > 0` (one rule, lock in S0) |
| `pool` | `pool_yn IS TRUE` |
| `garage` | `garage_spaces > 0` (if column reliable) |
| `new_construction` | `new_construction_yn IS TRUE` |

No free-text feature explorer in v1.

### 2.5 Indexes (performance — add if missing)

```sql
-- Partial indexes for closed-sales cube rebuilds (names illustrative; implement in migration)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_closed_close_date
  ON public.listings ("CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%' AND "ClosePrice" >= 1000 AND "CloseDate" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_closed_city_date
  ON public.listings (lower("City"), "CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%' AND "ClosePrice" >= 1000;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_closed_type_date
  ON public.listings ("PropertyType", "CloseDate")
  WHERE "StandardStatus" ILIKE '%Closed%' AND "ClosePrice" >= 1000;
```

Verify with `EXPLAIN (ANALYZE, BUFFERS)` on rebuild queries before shipping public.

### 2.6 Cube table sketch (authoritative shape — implement in migration)

```text
sales_cube_annual (
  geo_type text,
  geo_slug text,
  year int,
  type_scope text,           -- all|sfr|multi|land|other
  sold_count int not null,
  total_volume numeric not null,  -- sum ClosePrice
  median_close numeric,           -- null if n < floor
  median_ppsf numeric,
  price_band_counts jsonb not null default '{}',
  bedroom_breakdown jsonb not null default '{}',
  property_type_breakdown jsonb not null default '{}',  -- only meaningful when type_scope=all
  methodology text not null,      -- short machine string / version
  computed_at timestamptz not null,
  PRIMARY KEY (geo_type, geo_slug, year, type_scope)
)

sales_cube_feature (
  geo_type, geo_slug, year, type_scope, feature_key,
  sold_count, total_volume, median_close, computed_at,
  PRIMARY KEY (...)
)
```

### 2.7 What we do **not** do

- Real-time OLAP over PostgREST on `listings`
- Replacing `market_stats_cache` monthly series (still used for modern charts)
- Publishing 1907–1994 as continuous history
- AI-generated market numbers
- Feature mining from remarks text in v1

---

## 3. Product surfaces (applications of the cubes)

| Priority | Surface | Reads | 10× role |
|----------|---------|-------|----------|
| P0 | Region **Market size** module on `/housing-market` + `/housing-market/central-oregon` | annual cube `all` + `sfr` | Authority + dwell + AEO |
| P0 | **Composition** (type mix % of sales and of $) for selected year | annual cube | “What the market is made of” |
| P1 | City archive upgrade — volume + mix, not only median range | annual cube city | Archive product complete |
| P1 | Annual review — multi-year volume + composition | annual cube | Citable reference |
| P2 | Constrained explorer `/housing-market/history` (year, city, type, feature chips) | annual + feature cubes | Unique local tool |
| P2 | Embeds: sell page, city hero strip, optional listing “in this city last year $X closed” | cube cells | Conversion context |
| P3 | Admin broker Q&A export (aggregates CSV) | same DAL | Internal leverage |
| P3 | Newsletter / video / blog **must** call same DAL | — | One methodology |

---

## 4. Executable phases (units)

Each unit: **inputs · work · exit · ship · verify**.

### Phase SI-0 — Truth map & inventory (session 1) = MA-0 + MA-C seed

| | |
|--|--|
| **Inputs** | Live Supabase; `MARKET_ANALYTICS_PLATFORM.md`; CACHE_TABLE_FIELD_SPEC; PropertyType map |
| **Work** | (1) Annual closed count + volume region 1995–2025. (2) Full dimension fill matrix by year (class A/B). (3) **Competitive fill:** list/buy office+agent by year; top raw office strings by volume (pre-resolution). (4) Lock first publish year. (5) RPC/cron inventory. (6) Index inventory **including** list_agent_mls_id / buyer_agent_mls_id. (7) Draft `analyze_closed_sales` + `analyze_competitive` filter surfaces. (8) details promote top 20. |
| **Exit** | VERIFY_LOG SI-0 complete; type_scope + side methodology locked; rough top offices list exists |
| **Ship** | `scripts/analytics/probe-market-analytics.mjs` |
| **Verify** | Known market cells ±1%; 2024 list-office fill ~100% confirmed |

### Phase SI-C — Competitive intelligence (MA-C) — parallel with SI-1

| | |
|--|--|
| **Inputs** | SI-0; platform §15 |
| **Work** | dim_office + dim_agent bootstrap; alias merge for top brokerages; fact side FKs; mart_office_share + mart_agent_share; indexes on agent MLS ids; admin competition leaderboard + office → agent drilldown + Ryan vs peers; R14 family |
| **Exit** | Bend T12 office ranks by list/buy/sides; agent drilldown for top offices; Ryan share tile |
| **Ship** | Migrations + DAL + admin UI |
| **Verify** | Share sums ≈ 100% within cell; dual-office methodology documented; no name-ILIKE primary join |

### Phase SI-1 — Indexes + annual cube schema + rebuild RPC

| | |
|--|--|
| **Inputs** | SI-0 locks |
| **Work** | Migration: indexes CONCURRENTLY; `sales_cube_annual`; RPC rebuild with advisory lock; service_role execute only; revoke anon. Backfill region + REPORT_CITIES from first_year→current for all type_scopes. |
| **Exit** | Cube rows exist; sample year volume matches raw SQL ±0.1%; EXPLAIN uses closed indexes |
| **Ship** | Migration + RPC + `scripts/backfill-sales-cube-annual.mjs` |
| **Verify** | Integration test: Bend 2024 `sfr` sold_count vs raw |

### Phase SI-2 — DAL + gate

| | |
|--|--|
| **Inputs** | SI-1 |
| **Work** | `lib/data/market/getSalesCubeAnnual.ts` (+ types); resilient cache tags; no listings touch. Optional `ci:sales-cube-methodology` or vitest parity. |
| **Exit** | Only `@/lib/data` path for public reads |
| **Ship** | Code + tests |
| **Verify** | Unit + int test green in push |

### Phase SI-3 — Public Market Size + Composition (P0)

| | |
|--|--|
| **Inputs** | SI-2; frontend-design skill; brand lock |
| **Work** | Modules on market hub + central-oregon: multi-year $ volume + units; type composition for selected year; methodology + MarketSources; Dataset JSON-LD fields if applicable. |
| **Exit** | Live URLs show cube numbers; LCP not regressed vs baseline market page |
| **Ship** | Pages + components |
| **Verify** | Manual + route smoke; §0 trace in page comments |

### Phase SI-4 — Modern cache exposure (quick win parallel)

| | |
|--|--|
| **Inputs** | Existing `market_stats_cache.total_volume` + breakdowns |
| **Work** | Surface **already-computed** monthly/rolling volume and property_type_breakdown on annual-review / city market where missing — **label SFR if cache is SFR-only**. |
| **Exit** | No new table required for modern strip |
| **Ship** | Small PRs; can ship before SI-1 completes |
| **Verify** | Numbers match cache row for same period |

### Phase SI-5 — Feature cube + explorer (P2)

| | |
|--|--|
| **Inputs** | SI-1 pattern |
| **Work** | `sales_cube_feature` + rebuild; explorer UI constrained; min-n empty states; SEO only for thick cells |
| **Exit** | Fireplace-class queries answered from cube in &lt;100ms read |
| **Ship** | Migration + DAL + `/housing-market/history` |
| **Verify** | 1998 fireplace region count matches probe |

### Phase SI-6 — Embeds + distribution

| | |
|--|--|
| **Inputs** | SI-3 |
| **Work** | Sell / city / optional listing aggregate strips; newsletter/video skill docs point at getSalesCubeAnnual |
| **Exit** | One methodology across channels |
| **Ship** | Components + doc pointers |
| **Verify** | Spot-check sell page figure = cube |

### Phase SI-7 — Ops forever

| | |
|--|--|
| **Inputs** | All cubes |
| **Work** | Cron incremental; pipeline-heartbeat for cube freshness; VERIFY_LOG weekly cell; alert if rebuild fails |
| **Exit** | Cubes lag ≤ 36h on modern years |
| **Ship** | vercel.json cron + heartbeat |
| **Verify** | Heartbeat green |

---

## 5. Order relative to 10× program

| Relationship | Rule |
|--------------|------|
| **Does not block** G0–G1 chrome / measurement honesty | Run SI-0 in parallel early |
| **Amplifies G5/G8** discovery + authority | Market size content is money SERP + AEO |
| **Amplifies engagement** | Explorer + multi-year story = dwell (not feed dopamine — expert local tool) |
| **F05 verify** must include SI surfaces once shipped | Expand F05 rubric |
| **SI-4** (expose existing volume) can ship during G2 F05 grind | Quick win |
| **SI-1–3** = Phase **G9** in GOAL_10X | Primary sales-intelligence delivery |

---

## 6. Definition of done (sales intelligence leveraged)

- [ ] Region page answers: **dollar volume and unit sales by year** from first publish year → now (`all` + `sfr`)  
- [ ] Composition answers: **what share is SFR / multi / land** for a chosen year  
- [ ] At least one feature historical answer (fireplace-class) from **cube**, not ad-hoc SQL  
- [ ] Zero public request paths full-scan closed listings for those figures  
- [ ] Methodology + sources on every surface  
- [ ] Rebuild path documented; cron + backfill; heartbeat  
- [ ] F05 / VERIFY_LOG mark SI units V  

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Rebuild kills primary DB | Off-peak cron; year-batch; advisory lock; timeout caps |
| SFR vs all confusion | type_scope on every cell + UI |
| Thin early years | Publish floor + sample gates |
| Scope creep (every MLS field) | Allowlist features v1 only |
| Dual sources disagree | Parity tests cube vs raw; cache vs cube labeled differently |

---

## 8. Appendix — PropertyType label map (fill in SI-0)

| Code | Public label | type_scope bucket |
|------|--------------|-------------------|
| A | _(confirm)_ | sfr / … |
| B | | |
| C | | |
| D | | land? |
| E–H | | other |

_Fill from RESO/Spark map in repo during SI-0; do not invent on pages until filled._

---

*Execute SI-0 next. Do not design new chart libraries until cubes exist (except SI-4 quick win on existing cache volume).*
