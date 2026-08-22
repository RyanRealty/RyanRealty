# Market Truth — build spec (verified)

**Status:** spec · rewritten 2026-08-22 against verified facts only
**Companion:** `PLAN.md` (why) · `REGISTRY.md` (segments + stats as predicates) · `DDL.sql` (schema) · `EXECUTE.md` (how, and the live board)

## Evidence standard

Every factual sentence below was **independently re-derived by a second agent running its own
queries**, not carried over from the original forensic pass. Of 116 load-bearing claims produced by
that pass, 114 were re-checked: **9 stood as written, 104 required amendment, 2 were false.** A 91%
correction rate is why nothing here is stated on a single agent's word, and why an earlier draft of
this file — which was built before that verification — was wrong in several places that are corrected
inline and marked **[was wrong]**.

Anything the verification could not establish is absent from this document rather than softened.

---

## 0. Decisions locked by Matt (2026-08-22)

| # | Decision | Consequence |
|---|---|---|
| D1 | **"Single family" = detached only.** `PropertyType='A'` becomes "All residential". | The A bucket is 366,106 detached against 36,230 manufactured-on-land, 11,244 condominium, 10,871 townhouse, 2,006 tenancy-in-common, 318 leased-land, 53 stock-cooperative. **Supersedes CLAUDE.md §0.** |
| D2 | **Days on market = days to contract**, history restated. | See §2 — the correct basis is already computed in one place and wrong in others. |
| D3 | **Reconcile behind the scenes, then migrate surfaces.** | No public number moves before its delta and reason are reviewed. |
| D4 | **Thin cells: widen 12→24→36 months, always labeled, then refuse.** | Enforced in the layer, never per surface. |
| D5 | **MLS city text is truth for cities; polygons decide sub-city places only.** | This is also the fix for the live `/sell` defect (§1.1). |
| D6 | **Southern Oregon excluded from every published stat; rows retained.** | Scope becomes a required argument. |
| D7 | **All segments published** where the sample floor clears. | Commercial *lease* is rent and may never enter a sale median. |
| D8 | **No live fixes yet** — repairs roll in as migrations. | |
| D9 | **Agent/office analytics internal only.** | Admin and listing presentations, not the public site. |
| D10 | **Instrument view tracking through `user_events`; retire `listing_views`.** | |

---

## 1. Verified: what is wrong right now

### 1.1 `/sell` publishes a wrong market verdict

The page reads **"Bend housing market: a seller's market · 489 HOMES FOR SALE · 3.6 MONTHS OF SUPPLY."**

MLS `City` is a **postal/mailing** city; the `boundaries` city layer is TIGER/Line incorporated
places and CDPs. Of 17,608 geocoded closed Bend sales since 2021, **4,773 (27.1%)** fall outside the
Bend city-limits polygon — 4,295 inside no city polygon at all and 478 physically inside another
place (Sunriver CDP 415, Tumalo CDP 63).

`refresh_market_pulse()` computes city inventory as
`property_sub_type='Single Family Residence' AND "PropertyType"='A' AND "City"=<canonical> AND
ST_Within(point, boundaries.polygon)`. The polygon clause drops every city-addressed home outside
incorporated limits: Bend keeps **488 of 781** active detached listings (62.5%).

**[was wrong]** The earlier draft blamed the stalled `boundary_city` column job and said the shortfall
was "roughly half" against 988 homes. Both are incorrect. The 988 was the wider `PropertyType='A'`
bucket, not detached; the true shortfall is **37.5%**. And the column job is not what feeds this page
— the site reads `listing_boundary_xref_mv`, refreshed by its own cron, whose coverage is flat across
the window. **The cause is the deliberate polygon filter, and D5 is the fix.**

The truncation is **non-uniform and directionally biased**: it drops 37.5% of actives but only 20.9%
of closes, because the excluded unincorporated ring runs at **8.03 months of supply**. Removing it
does not merely shrink the number — it pushes the ratio toward "seller's market."

Published **3.52–3.54 months → "seller's market."** MLS-city basis **4.46–4.51 → balanced.**

Other cities on the same filter: Redmond 191/277 (69%), Prineville 83/183 (45%), Sisters 35/113
(31%), **Terrebonne 6/52 actives (11.5%)**.

**Terrebonne is a live divide-by-zero.** 60 detached closes carry a Terrebonne address in the trailing
year but only 6 sit inside the CDP polygon, and **zero closed inside it in the last 180 days** — so
`refresh_market_pulse` writes `months_of_supply = NULL`, and `lib/cma/market.ts` falls back to
`active/(sold365/12)` = 12.0 months, a **buyer's-market verdict that clamps the High End tier on every
Terrebonne CMA**, computed off six sales.

### 1.2 One label, several numbers — measured today on Bend

| Label | Value | What it actually measures |
|---|---|---|
| `market_stats_cache.median_dom` | **25** | list-to-**pending** — the correct industry basis |
| `market_pulse_live.median_active_dom` | **58** | age of unsold inventory — not a sold statistic |
| `listings."DaysOnMarket"` | **62** | list-to-**close**, escrow included |
| hand-computed list-to-close | **63–64** | the same measurement as the row above |

**[was wrong]** The earlier draft said "every DOM figure we publish is wrong for the entire history"
and that the cache figure's lineage was unverifiable. Both refuted. **The cache is right**; its writer
is `compute_and_cache_period_stats` using `COALESCE(days_to_pending, pending_timestamp − OnMarketDate)`,
and it reproduces exactly. The defect is the raw column and the paths that read it — the video
market-report producer and `get_beacon_metrics`.

The `DaysOnMarket` column equals `CloseDate − ListDate − 1` in 95% of rows across all 34 years, and
`DaysOnMarket` correlates with list-to-close at **r = 1.000** (within one day on 98.8% of rows).

**The signal loss is the real damage.** Escrow is acyclical — 39 days in the hottest year (2021),
31 in the slowest (2025) — so bolting it on compresses a genuine **6.4× swing** in market speed into
a fake **1.6×**. From 2021 to 2025 real time-to-contract rose **540%**; the column moved 50%.

### 1.3 Sale-to-list is published on the wrong basis, wrong statistic

`listings.sale_to_list_ratio` is **ClosePrice ÷ OriginalListPrice** (verified: matches original on
17,411/17,411 rows). The cache aggregates it as `AVG(LEAST(2.0, GREATEST(0.5, ratio)))` — a **clamped
mean against the original list price**.

Published **95.7%**. The consensus metric — median of close ÷ **final** list — is **99.3%**. A
**3.57-point understatement**, of which 1.90 points is the basis and 1.67 is mean-versus-median skew.
45.2% of sales had a price change (41.4% reduced, 3.8% increased).

`sale_to_final_list_ratio` already exists on the row and is already medianed correctly by the YouTube
report path. **Two registry entries, never one label.**

### 1.4 Months of supply disagrees across paths and crosses the verdict line

`market_pulse_live` reports 488 active / **3.54 months → "seller's market."**
`get_beacon_metrics` (the `/admin/reports` builder) reports 794 current / **4.5 → "balanced."**
A 27% delta across the §0 threshold. The repo's own cross-path tolerance is **1%**.

Three active-count definitions coexist *inside the cache layer alone*: 488 (status + subtype +
polygon), 453 (`end_of_period_inventory`, an interval reconstruction), 794 (`status LIKE '%active%'`,
which admits Active Under Contract).

### 1.5 Seasonality is unhandled and can flip a verdict

Closed volume swings **1.75×** across the calendar year (Aug 607.0 avg vs Jan 346.6, 2019–2025;
1.74× detrended). The trailing-6-month MoS denominator therefore swings **1.32×** purely by which
month the window ends — enough to move months of supply 32% on flat supply and cross both the 4.0 and
6.0 thresholds. No seasonal adjustment exists anywhere in the codebase; the only seasonal code
(`computeSeasonality` in `lib/cma/extras.ts`) is descriptive and adjusts no figure.

The median-price seasonal index runs 0.950 (Jan) to 1.037 (Aug), and single-month seasonal steps reach
**+3.3%** and **−3.4%** — larger than the month-over-month deltas the CRM report actually emails.

### 1.6 Mix is uncontrolled, and at small-city grain it flips signs

**37% of Bend's published −3.7% year-over-year move is composition, not price.** At smaller grain the
sign inverts: La Pine publishes **−2.6%** where constant-mix is **+1.5%**; **75%** of Prineville's
published +6.0% is mix. No computation path applies any mix control.

Partial disclosure does exist and the spec must not claim otherwise — median $/sqft is published
beside the median, the `/housing-market` hub publishes a composition chart, and a mix-immune
repeat-sales read runs on one landing page.

### 1.7 Geography: overlap, coverage, and a fix that already exists

`listing_boundary_xref_mv_src` is a bare `JOIN boundaries ON ST_Within(point, polygon)` with **no
tie-break** — one listing emits one row per containing polygon. Of 36,536 service-area closed sales
since 2021 with coordinates: **19.5% fall inside 2+ subdivision polygons** (max 8) and **17.3% inside
2+ neighborhood polygons** (max 5). Cities never overlap. Summing across polygons inflates totals
**1.33×** at subdivision grain and **1.50×** at neighborhood grain. Coverage fails the other way too:
26.1% sit in no subdivision polygon, 49.5% in no neighborhood polygon.

**The fix already exists and only needs porting.** Smallest-polygon-wins
(`ORDER BY ST_Area(polygon) ASC LIMIT 1`) is used by the CRM person geo resolver
(`fub_person_geo_and_lookup_rpc`, `crm_geo_backfill_candidates`). It was never applied to the listing
layer. `listings.boundary_subdivision` is populated on **0.34%** of those sales.

**The 28 neighborhood polygons are not a partition.** They mix three registers — 14 City of Bend GIS
districts (one literally `bend-undesignated`), 12 resort/HOA communities derived from Spark alias
name-matching, 2 county-plat unions. **57 pairs overlap** (broken-top ∩ northwest-crossing = 4,044
acres). The discovery-derived polygons are grossly oversized — **broken-top 11,496 acres,
brasada-ranch 16,126, three-rivers 15,703**. `bend-southeast-bend` **fails `ST_IsValid`**. Two slugs
collide across tiers (eagle-crest, sunriver). **32.5% of active listings inside any neighborhood
polygon fall inside two or more.**

Polygon coverage is Deschutes-only: all 3,213 subdivision polygons come from Deschutes County GIS;
Crook is 12.6% attributable, Jefferson 0.02%, Klamath 0%.

**[was wrong]** The "two slug alphabets, six never join" claim is substantially incorrect. Eleven of
twenty cache city slugs fail an exact join, but **only two** are caused by the space-vs-hyphen split
— the other **nine have no `boundaries` row under any spelling**, which is missing geometry, not a
spelling mismatch. The alphabets are already reconciled in code by `lib/market/city-cache-slug.ts`
across ~18 call sites, pinned by a test and by the `ci:city-cache-slug` gate. No code path joins the
two directly.

### 1.8 The analytics cube has never been refreshed by its cron

All 1,985 rows of `analytics_mart_market_annual` carry one of four `computed_at` stamps from two
ad-hoc backfills (2026-08-10, 2026-08-15). `analytics_inventory_snapshot` has a single stamp and 24
rows. The crons have been registered in `vercel.json` since 2026-08-10 and have **never written a row**.
The cube stops at 2025 while **3,464 Central Oregon sales have already closed in 2026**.

Its labels are wrong: `type_scope='sfr'` is `PropertyType='A'` verbatim — Bend 2025 counts 2,535 as
single-family where 2,182 are detached, the rest being 152 townhouse, 99 manufactured-on-land, 86
condominium, 9 tenancy-in-common and one timeshare. `type_scope='multi'` collapses B+C, and B
(manufactured in park / on leased land) is **42.1%** of that bucket.

Cube and cache disagree by **+49.9% to +52.1%** on Bend sold count because they count different
universes and different geographies, and **neither matches the repo's declared SFR convention**.

**[was wrong]** "Two live surfaces give different answers to how many homes sold this year" —
refuted as a numeric conflict. Where both can answer they agree exactly (mart 2024 = RPC 2024 =
5,707). The hub is pinned to 2024, and on a mart miss it renders an explicit "did not return"
state rather than a wrong number. The real defect is narrower: the explorer can report 2026 and the
hub structurally cannot reach it.

The feature cube publishes **fireplace prevalence as a measured share when no explicit negative
exists anywhere** — `fireplace_yn` is true 175,832 / NULL 419,547 / **false 0**, and `fireplaces_total`
is 100% NULL. The published 62.89% is a floor. The site's own search flags mark **74.6%** of the same
cohort as having a fireplace — a 663-row gap published as "no fireplace."

The office dimension is joined **by name, not key**: `office_id` is NULL on all 12,035 rows despite
the FK. Name matching resolves 416 of 898 strings (46.3%) but **90.4% of sides**. The MLS sentinel
**"No Office" has its own dim row and is never suppressed** — it ranks #2 in one year and #3 in 2025
buy-side on 356 sides.

### 1.9 Field traps

- **`"TotalLivingAreaSqFt"` is a misnomer** — no such RETS key; populated from `BuildingAreaTotal`,
  omitting finished below-grade area. Lands on the CMA as a valuation error on a named address.
- **Fractional interests sit inside `PropertyType='A'`** — Tenancy in Common (2,006 rows, median list
  $35,000). Sunriver's class-A median reads **$65,000 (8.8%) low**; Camp Sherman is 17.16% of its
  detached closings.
- **`PropertyType='G'` is commercial LEASE** — 4,335 rows whose price is rent; median list **$1.25**,
  98.2% under $10,000; remarks confirm ("3,200 sqft @ $3,200/mo" with ClosePrice=3200). **595 already
  clear the repo's `>= 1000` closed-sale filter.**
- **`E` is Farm, not commercial.** `lib/property-type.ts` maps E–H to "Commercial", hiding ~1,000
  genuine house-on-acreage sales from every residential statistic.
- **The market-report property-type filter is inert** — `getPropertyTypeSegmentKey` substring-matches
  human words while the caller feeds it a single MLS letter, so **A through H all pass** a filter
  whose docstring promises to exclude land and manufactured homes.
- **Mean sale-to-list is unusable** — $1 auction lists produce ratios in the millions of percent.
- **Order-of-magnitude ClosePrice typos survive `>= 1000`.**
- **Price-per-sqft has four defensible methods spreading 17.9% on Bend** (median-of-ratios $391,
  aggregate $432, mean-of-ratios $428, median-over-median $366). Bend is the worst case; other cities
  spread 5.2–10.2%. The stored `close_price_per_sqft` column **is** the per-home ratio.
- **Concessions**: no flag column exists — the Yes/No lives only in `details->>'Concessions'`, so
  every consumer infers incidence from a NULL. Published copy calls the cache's
  `median_concessions_amount` "the median seller concession" when it is the median **among sales that
  had one**.
- **April 2026 ingest incident**: 29.7% of that month's closings lost the concessions flag, 32.8% lost
  `buyer_financing`. The format flip happened **in our own mapper, not at the MLS** — the raw feed
  value in `details` is format-invariant and is the correct source of truth.

### 1.10 Pricing engine

- **The comp pool is hard-capped at 800 rows** ordered by close date (`lib/pricing/select.ts` →
  `facts.ts:145`, the only caller). For a median Bend detached subject, 2,411 sales are eligible
  across the nominal 18-month window — the ladder sees the most recent 800.
- **Two time-adjustment models are live on the same subjects, plus a silent third.** The CMA walks
  the monthly index only when `usePath` is true; every broker-curated CMA falls back to the
  straight-line YoY smear, and the **BPO never uses the index at all**. The third case: a city can
  return index rows while having **zero months at n ≥ 8**, so every comp gets factor 1.0 while the
  document still prints "Time adjustment follows the monthly path." For a 12-month-old Redmond comp
  the two models differ by **7.9 points and opposite signs** (+6.4% index vs −1.5% smear) — about
  $40,000 on a $500,000 comp. `render-market-page.ts:124` tells the seller the YoY rate "is the time
  adjustment on every sale in the grid," which is false whenever the index path is active.
- **The close-to-list conversion is one month's citywide median sale-to-original**, unweighted. It is
  gated at n ≥ 8, which blocks the worst case but still admits 8–10-sale months producing **+10.6% to
  +11.8%** list markups.
- **The current month is always partially ingested and read as complete.**
- **`sale_pricing_facts` has no recency lane** — a pure keyset sweep, and the cron drains only
  8 × 200 rows per run against 149,535 qualifying rows.
- **Metolius is a genuine recoverable gap**: a live service-area city with **324 detached closes**
  sitting in `listings`, absent from both `sale_pricing_facts` and `pricing_market_index`. Tumalo and
  Crooked River Ranch are a different case — they never occur as MLS city values.
- **For a listed subject the headline close is `lastAsk × 0.98`**, hard-overriding comps.
  **[was wrong]** "The comp engine is decoration" is overstated — comps still drive the public
  over/under stamp, the conservative and high-end list rails, seller net and days-to-offer.

### 1.11 Small-sample suppression exists but its floor is too low

**[was wrong]** An earlier draft said suppression is "violated at scale." It is **implemented and
holding** — no row at n ≤ 2 publishes a median, and every row at n < 5 suppresses DOM, $/sqft and
sale-to-list. The real finding is that the floor is set at **n ≥ 3**, so the 1,286 thin medians are
exactly n=3 (708 rows) and n=4 (578 rows), never n=2. That is a threshold disagreement with the
industry convention (n ≥ 10), not an absent guard.

The thinness itself is real: **57.6% of neighborhood rows (4,253/7,390) and 88.1% of subdivision rows
(89/101)** sit on fewer than 10 closed sales.

**515 of 680 Bend subdivisions (75.7%) never reach 10 detached sales even over 36 months.**

---

## 2. What is computable, and from when

| Metric family | Earliest | Gate |
|---|---|---|
| Median/mean close, volume, sold count | **1997** | service-area scope required; CO history starts 1997 (1993–96 is Southern Oregon) |
| Sale-to-**final**-list (median) | **1997** | median only; outlier rule |
| Price per square foot | **1997** | sqft > 0; one declared method; below-grade caveat |
| Days to contract | **2006** | `purchase_contract_date` copies CloseDate pre-2003; 2003–05 has negative escrow |
| Sale-to-**original**-list, price-cut rate, relist rate | **2002–03** | OLP = LP through the 1990s |
| Buyer-financing mix | **2004** (near-complete 2020) | April-2026 format break normalised from `details` |
| Concessions | **2013**, as a *reported* rate | denominator must be stated |
| Subtype segmentation | **2003** townhome, **2020** land subtypes | pre-2003 townhomes were filed as **Condominium**, not SFR — condo share halves exactly as townhouse ramps, while SFR share stays flat |
| Active inventory / MoS, current | **now** | membership must be live |
| Active inventory, historical | **1995** | point estimate where history recovers the span, band otherwise (§3.2) |

---

## 3. Architecture

### 3.1 Foundation

Extend **`sale_pricing_facts`** — already one row per closed Central Oregon residential sale, 1996+,
carrying city/slug, postal code, county, subdivision + normalised subdivision, lat/lng, type, subtype,
beds, baths, sqft, year built, lot acres, and normalised product/lot/story/water/sewer/HOA classes.
Do **not** extend `analytics_mart_market_annual` (§1.8).

Build `market_fact_sale` (all segments per D7, scope as a column, exclusions applied and *counted*,
`complete_through` stamped, plus a recency refresh lane) and `market_fact_listing_span`.

### 3.2 `place_membership`

One row per (listing, place), covering listed and sold alike:
`listing_key · geo_type · geo_slug · method (city_text|polygon|alias) · confidence · effective_from ·
effective_to · is_primary`.

- Cities resolve by **MLS city text** (D5). Sub-city by polygon, then alias.
- **`is_primary` = smallest containing polygon**, porting the rule that already exists in the CRM geo
  resolver. Only primary rows may be summed (§1.7).
- Polygons that fail `ST_IsValid` or are unverified are marked and cannot back a published ratio.
- One canonical hyphen slug alphabet.

**Span reconstruction reads `listing_history`.** On all 112,892 relisted listings the `listings` row
resets `OnMarketDate` and `ListDate` to the back-on-market date — correct MLS behaviour, not a defect
— but the pre-gap interval survives: `listing_history` covers **99.5%** of them and **73.0%** carry
events dated before `OnMarketDate` (median **102 days** earlier), including explicit `NewListing`
events (37.1%) and Active→Expired→Active transitions (29.7%). Emit `span_source` and
`first_on_market_confidence`.

Never read `status_change_timestamp` (bulk migration stamps: 51,506 rows on 2020-02-28 alone).

### 3.3 Metric registry

Each stat declared once: `stat_id · label · formula · population predicate · required inputs ·
min_n · allowed grains · earliest_year · window policy · rounding · outlier rule`. Vocabulary defined
once — `detached`, `active` (Active only, never Coming Soon, never Active Under Contract),
`closed` (§3.4), `service_area`.

### 3.4 Mandatory exclusions

Non-service-area rows · `PropertyType='G'` (lease) from every sale statistic · fractional interests
from residential medians · order-of-magnitude price typos · $1-class auction lists from every ratio ·
retroactive off-market entries (flagged, excluded from speed, retained for volume) · duplicate
parcel+date events · `sqft <= 0` from $/sqft only, with the exclusion counted and published.

### 3.5 Compute and read

One job writes value **plus provenance** (rows counted, method, definition id, window used,
`computed_at`, confidence, publishable, reason). One `getMetric({stat, geoType, geoSlug, segment,
window})` is the only read path.

### 3.6 Sample and window policy (D4)

Range **n ≥ 5** · median **n ≥ 10** · delta or verdict **n ≥ 30**. Ladder 12 → 24 → 36 months,
**window printed on the figure**, then refuse with a reason.

**Subdivision is the comp/CMA grain, not the published-statistic grain** (§1.11). Subdivision pages
show counts and individual sales; price statistics publish at neighborhood and city.

Seasonality (§1.5): publish months of supply with its window stated, store the 12-month variant
alongside, and seasonally adjust count metrics only — never price, DOM or sale-to-list.

### 3.7 Gates

1. No writer computes geography inline.
2. No consumer reads a market store directly.
3. Every rendered figure carries provenance.
4. Mixed-method or non-primary membership ⇒ non-publishable.
5. `min_n` and window policy live only in the registry.
6. Dead-column gate: `CumulativeDaysOnMarket` (500 non-null of 595,379), consumer-surface
   `"DaysOnMarket"`, and any `mls_source='central_oregon'` filter (a constant on 100% of rows).
7. **Freshness gate** — a metric whose `complete_through` predates its window fails rather than
   serving stale data. This catches the dead cube cron and any future stall.
8. **Overlap gate** — a sum over polygons that does not filter `is_primary` fails.

---

## 4. Registry v1

**Price** median_close · median_ppsf (median of per-home ratios, method declared) · median_list_active ·
total_volume · price_band_distribution
**Speed** median_days_to_contract · median_days_to_close (labelled) · median_age_active_inventory
**Negotiation** median_sale_to_final_list · median_sale_to_original_list · pct_with_price_cut ·
median_price_cut_pct · median_concession_reported (denominator stated)
**Supply** active_count · new_listings (relist-excluded) · pending_count · closed_count ·
months_of_supply (6-month base, threshold sentence and window mandatory) · months_of_supply_12mo ·
absorption_rate
**Mix** segment_share · bedroom_distribution · cash_share · financing_mix (2004+)
**Movement** yoy_median_price · mom_median_price · yoy_sold_count · yoy_days_to_contract

Each entry carries its earliest year (§2), `min_n` (§3.6) and exclusions (§3.4). **§5 of `EXECUTE.md`
step 4 is where these get written as real predicates — that work is not yet done.**

Industry alignment, verified: DOM is list-to-contract; months of supply is inventory over a monthly
sales pace; medians beat means for price and sale-to-list; $/sqft is the median of per-home ratios;
count metrics get seasonally adjusted, price/DOM/sale-to-list do not; thin samples are suppressed or
widened. Our thresholds (≤4 seller's · 4–6 balanced · ≥6 buyer's) are stricter than NAR's six-month
balance point — **keep them**, but print the threshold sentence and window on every verdict.

---

## 5. Buildable — the three gaps are closed

1. **Registry predicates** → `REGISTRY.md` §3 — every stat as SQL, with population, floor, grain and
   earliest year.
2. **DDL** → `DDL.sql` — `market_service_area`, `place_membership`, `market_fact_sale`,
   `market_fact_listing_span`, `market_metric`.
3. **Segment predicates** → `REGISTRY.md` §1 — all twelve of D7's segments as predicates.

Two further decisions locked while writing them:

| # | Decision | Consequence |
|---|---|---|
| D11 | **Historical inventory: point estimate where `listing_history` recovers the span, labeled band where it does not.** | ~73% of relisted listings recover; the rest publish as a range with a stated reason. |
| D12 | **Feature prevalence publishes as a floor, labeled "at least".** | No explicit negative exists — `fireplace_yn` is true 175,832 / NULL 419,547 / **false 0**. `garage_yn` is genuinely three-state and publishes as a true share. |

And one definition settled that all three depend on: **the service area is a city list, not a county
filter.** County is unusable — Bend rows carry Deschutes, NULL and even Crook; Terrebonne spans three
counties. `market_service_area` in `DDL.sql` replaces the three disagreeing definitions
(`is_central_oregon_city` 16 names, `pricing_is_central_oregon_city` 14, `analytics_service_area_cities`
24) and adds **Metolius**, a real city with 14 closes and 17 actives that the pricing corpus omits.

## 6. Canon corrections this forces

- CLAUDE.md §0 — "SFR convention is `PropertyType='A'`" is wrong per D1.
- CLAUDE.md §7 — the quoted-column list names `CumulativeDaysOnMarket`, a dead column.
- `docs/DATABASE_FOR_AI_AGENTS.md` — CDOM dead, `mls_source` a constant, `listings` two markets.
- `lib/property-type.ts` and `lib/data/analytics/property-type-labels.ts` — E is Farm, G is Lease,
  and the two files contradict each other and the docs.

## 7. Open for Matt

1. Pre-2016 inventory where history does not recover the span — publish the band, or refuse?
2. Publish the "no fireplace" class at all, given no explicit negative exists (§1.8)?
