# Market Truth — build spec

**Status:** spec · 2026-08-22 · plan of record for the market-data plane
**Evidence:** 36 agents, 1,088 live queries, 106 findings; every load-bearing claim independently
re-derived by a second agent. Corrections from that second pass are marked **[corrected]**.
**Companion:** `PLAN.md` (why) · this file (what to build).

---

## 0. Decisions locked by Matt (2026-08-22)

| # | Decision | Consequence |
|---|---|---|
| D1 | **"Single family" = detached only.** The `PropertyType='A'` bucket becomes "All residential". | Fixes a 20.8% overstatement of SFR count and a $35,000 understatement of the SFR median. **Supersedes CLAUDE.md §0's "SFR convention is `PropertyType='A'`".** |
| D2 | **Days on market = days to contract**, history restated. | Published DOM drops ~40 days and finally measures time to an accepted offer. |
| D3 | **Reconcile behind the scenes, then migrate surfaces.** | No public number moves until the delta and its reason have been shown to Matt. |
| D4 | **Thin cells: widen the window, then refuse — always labeled.** | 12mo → 24mo → 36mo to reach the floor; the window is printed on the figure. If 36mo still fails, publish the refusal and offer the parent place. |
| D5 | **MLS city text is truth for cities; polygons decide sub-city places only.** | Matches how the market talks. 24.4% of homes sold as "Bend" sit outside city limits (La Pine 71.6%, Terrebonne 85.0%) and stay counted as Bend. |
| D6 | **Southern Oregon excluded from every published stat; rows retained.** | Service-area scope becomes a required argument, not an optional filter. |
| D7 | **All segments published** wherever the sample floor is cleared: detached, condo, townhome, manufactured-on-land, manufactured-in-park, multifamily 2–4, land, farm, commercial sale, commercial lease, business. | Commercial *lease* prices are rent — they may never enter a sale median. |
| D8 | **No live fixes yet.** The `/sell` defect and the rest roll in with this plan. | Recorded in §7 as the first migration, not a hotfix. |

---

## 1. What is actually true about this data

### 1.1 The table is two markets

`public.listings` is not a Central Oregon table. Closed `PropertyType='A'` rows by county:
Deschutes 129,292 · **Jackson 93,233** · **Josephine 25,106** · Klamath 17,306 · Crook 11,880 ·
Jefferson 9,540 · null 7,923. `mls_source` reads `central_oregon` on **100% of rows including all
93,233 Jackson ones**, so it is a constant, not a source tag — and it invites filters that do nothing.

**Central Oregon history begins 1997.** The 127 closed rows dated 1993–1995 and 98.3% of 1996 are
Southern Oregon; Deschutes has exactly 3 closed A sales before 1997.

**Klamath switches on in 2010–2011** (37 closes in 2009 → 700 in 2011) at roughly a third of
Deschutes prices, manufacturing a fake −7.3% YoY in any unscoped series where the county-scoped
series moved −1.8%. **[corrected]** the causal attribution and price-gap magnitude were overstated;
the coverage break itself reproduces exactly.

### 1.2 Days on market has never meant what we published

`"DaysOnMarket"` equals `CloseDate − ListDate − 1` in **95.0%** of closed rows, in **every year
1996–2026** — it is list-to-**close**, escrow included. Median gap is exactly 1 in all 34 years.

| Year | Published DOM | True days to contract |
|---|---|---|
| 2021 | 51 | 6 |
| 2022 | 53 | 11 |
| 2024 | 63 | 25 |
| 2025 | 69 | 29 |

Because escrow length is near-constant, this does not merely inflate the level — it **erases the
signal**, compressing a 6.4× real swing in market speed into a fake 1.6×. The raw MLS payload carries
no `DaysOnMarket` key at all, so this is our own ingest synthesising it: **we own the bug.**

`"CumulativeDaysOnMarket"` is dead — 500 non-null of 594,650 rows (0.084%), zero in every non-Closed
status. **CLAUDE.md's own quoted-column list names it**, steering code at a dead column. One
client-facing consequence: `lib/cma/subdivision-story.ts` computes its subdivision speed figure from
CDOM with no fallback, so it operates on an all-NaN array — **that statistic can never render.**

### 1.3 One label, many numbers

**38 distinct market statistics render across the estate from 9 independent computation engines.
No stat has a single owner.** Measured today, on Bend:

- **"Days on market"** is four different measurements: **25, 58, 62, 64**.
- **"Months of supply"**: the site says **3.56 / seller's market**; the admin report builder says
  **4.5 / balanced**. A 26% delta and an opposite verdict.
- **"Sale to list"**: **98.2%** on the seller landing page, **95.7%** on the city market page *and
  inside the client's CMA* — median on one plane, clamped average on the other.
- **"Bend"** itself is two populations — polygon vs MLS city text — moving the published median from
  **$720,000 to $760,000**.
- The client-facing **CMA** computes its market-area chapters over the whole A bucket while every
  cache figure on the same document is SFR-only: **382 non-SFR sales, 15.0%**, inside one document.

### 1.4 Live defects (fixed as migrations, per D8)

| Defect | Evidence | Effect |
|---|---|---|
| **`/sell` publishes a wrong verdict** | Page reads "a seller's market · 489 HOMES FOR SALE · 3.6 MONTHS OF SUPPLY". Truth: **988** active Bend SFR → **4.52 months → balanced**. | Sellers are told to list on a false signal. §0 violation. |
| **Boundary assignment stopped ~2026-04-30** | Of Actives on market since 2026-05-01, **184 of 4,328 (4.3%)** have `boundary_city`. Overall 3,441 of 7,628. | Root cause of the halved inventory. Widens daily. |
| **The cube's cron has never run** | All 1,985 rows carry four `computed_at` stamps from two manual runs (2026-08-10, 2026-08-15). **Calendar 2026 has 0 rows** — 3,462 closed CO sales missing. | `/housing-market` frozen at 2025. |
| **April-2026 ingest regression** | 883 structurally bare rows (no sqft/beds/year_built/county/subtype) incl. **124 Actives**; `buyer_financing` flipped format and emitted 26 `[object Object]`; 400 rows with unrecoverable NULL subtype. **[corrected]** the "fake 5.3pp SFR-share drop" was overstated. | Current-window data damaged. |
| **Two live geographies with permanent zero sample** | `market_stats_cache` holds 449 rows for `tumalo` and 446 for `crooked river ranch`, `sold_count = 0` in every period, because two slug alphabets (`la pine` vs `la-pine`) never join. | Published places that can never have a number. |
| **`close_price_per_sqft` = 0 instead of NULL** on 65,577 closed rows | Legacy backfill stopped April 2026, never remediated. | One row encodes "unknown" two different ways. |

### 1.5 Field traps that silently corrupt medians

- **`"TotalLivingAreaSqFt"` is a misnomer.** The RETS payload has no such key (0 of 3,000 sampled);
  the mapper falls back to `BuildingAreaTotal`, which omits finished below-grade area on 2–5% of
  closes a year by a median 624 sq ft. Those homes' $/sqft is overstated ~32% — and this lands on the
  **CMA**, where it becomes a valuation error on a named address.
- **Fractional interests sit inside `PropertyType='A'`** — Tenancy in Common, timeshare, deeded weeks
  — pairing a per-share price with whole-unit square footage. Median $/sqft **$19.01**. Sunriver's
  active median list reads **$649,000 against $780,500 clean (−16.8%)**; Camp Sherman is 17.16% of
  SFR closings.
- **`PropertyType='G'` is commercial LEASE.** `ClosePrice` holds a rent or $/sf rate, median **$2.01**;
  **595 already clear the repo's `>= 1000` floor.** `E` is **Farm**, not commercial —
  `lib/property-type.ts` maps E–H to "Commercial" and is wrong.
- **Mean sale-to-list is unusable** — $1 auction list prices give Central Oregon SFR 2022 a mean of
  **6,927%**. Median only, with an outlier rule.
- **Order-of-magnitude ClosePrice typos survive `>= 1000`** — 18 since 2015; one makes Sunriver's 2026
  average SFR sale $894,790 instead of $817,718 and its top sale $7.6M instead of $3.55M.
- **Price-per-sqft has three defensible definitions spreading 18%** on the same Bend data.
- **`OriginalListPrice` is a copy of `ListPrice` for the whole 1990s** — sale-to-original and
  price-cut metrics cannot start before 2002/2003. Sale-to-**final**-list is safe from 1997.
- **Concessions do not exist before 2013**, and after 2013 the computable rate is a reporting-rate
  curve, not a market signal (two defensible formulas give 44.9%→99.9% and 3.2%→38.3%).
- **Subtypes appear over time.** Townhouse does not exist before 2003 — all 7,772 townhouse sales are
  2003+, so pre-2003 townhomes are filed inside SFR. Land subtypes (Agriculture/Recreational/
  Rangeland) begin 2020.
- **1990s duplicate closed sales: ~0.5–1%** **[corrected]** — the original 6% was 6–12× overstated.

### 1.6 Geography mechanics

- **`City` text is clean** — 309 distinct values, no case or whitespace collisions.
- **Coordinates are clean and near-complete from 2016** (872 nulls in 77,250 closed service-area
  sales); polygon hit rate is flat across the decade (93.6% 2016–20 vs 93.7% 2021+), so **one
  membership rule can cover the modern era — membership need not be era-dependent.**
- **Polygon coverage is Deschutes-only.** All 3,213 subdivision polygons come from Deschutes County
  GIS. Crook is 12.6% attributable, Jefferson 0.02%, Klamath 0%.
- **No tie-break rule exists and 1 in 5 sales is inside more than one polygon** — 19.5% inside 2+
  subdivisions (max 8), 17.3% inside 2+ neighborhoods (max 5). Summing over polygons double-counts.
- **`listing_boundary_xref_mv` hard-filters to Active/Coming Soon/Pending**, so the neighborhood
  *sold* side has always run on subdivision text. **[corrected]** a second, all-status polygon path
  exists and already carries **67,179 closed sales** — the membership job builds on that, not a new one.
- **`SubdivisionName` is a weak key** — only 23.1% of closed rows slug-match a county plat and 26.5%
  match the curated registry.
- **The 28 "neighborhood" polygons mix three registers** — City of Bend official districts, resort/HOA
  communities, and county-plat unions — and one is literally named `bend-undesignated`.

### 1.7 Inventory history

Active inventory **can** be reconstructed: `OnMarketDate → off_market_date` is ~99.8% populated back
to 1995, and reconstructing 2026-08-10 returns 3,362 against a stored 3,376 (**0.4% error**). But it
is a **band, not a point**: on all 112,892 relisted listings `OnMarketDate` was overwritten with the
back-on-market date (median 164 days of hidden earlier market time). Bend SFR in March 2015 is
**747–960**, a band spanning months-of-supply **3.32 to 4.27** — which straddles the verdict line.

`status_change_timestamp` is corrupted by bulk platform-migration stamps and must never be used for
historical timing; `off_market_date` survived intact. 28,169 listings (4.7%) have `off_market_date`
before their on-market date. 150 Actives (1.97%) are zombies whose own payload says otherwise.

### 1.8 The pricing engine's exposure

The valuation engine consumes five market inputs and **four are currently unsafe**:

- The comp pool is **hard-capped at 800 rows ordered by close_date DESC**, so Bend's 18-month ladder
  can only see the most recent **~6.4 months**; the rural statewide pool sees **2.9 months** — exactly
  the segment the wide rungs exist for.
- `pricing_market_index` is a **single all-product median** mixing detached, townhome/condo,
  manufactured and leased-land $/sqft (up to an 18.5 $/sqft gap that itself moves monthly).
- The **current month is always partially ingested** and is read as complete — it is the "to" end of
  every time factor.
- `sale_pricing_facts` is refreshed by a full-table sweep taking **~23 days**, so recent sales enter
  the corpus weeks late.
- **Three service-area places have no pricing corpus at all** — `tumalo`, `crooked-river-ranch`,
  `metolius`.
- For a subject that is currently listed, the whole comp engine is decoration: the close estimate is
  **last ask × 0.98**, a constant that is measurably mis-calibrated.

---

## 2. What is computable, and from when

| Metric family | Earliest trustworthy | Gate |
|---|---|---|
| Median / mean close price, volume, sold count | **1997** | service-area scope required |
| Sale-to-**final**-list ratio | **1997** | median only; outlier rule |
| Price per square foot | **1997** | sqft > 0; below-grade caveat; one definition |
| Days to contract | **2006** | `purchase_contract_date` is a copy of CloseDate pre-2003; 2003–05 carries negative escrow |
| Sale-to-**original**-list, price-cut rate, relist rate | **2002–03** | OLP=LP through the 1990s |
| Buyer-financing mix | **2004** (near-complete **2020**) | April-2026 format break must be normalised |
| Concessions | **2013**, as a *reported* rate only | never as a market signal without the denominator stated |
| Subtype segmentation | **2003** (townhome), **2020** (land subtypes) | pre-dates filed inside parent |
| Active inventory / months of supply — current | **now** | membership must be live |
| Active inventory — historical | **1995 as a band** | relist overwrite; publish band or refuse |

---

## 3. Architecture

### 3.1 Foundation: extend `sale_pricing_facts`, do not build a new cube

`sale_pricing_facts` is already "the pricing moat SoR — one row per closed Central Oregon residential
sale, every year we have (1996+), no close-date floor," carrying city + slug, postal code, county,
subdivision and a normalised subdivision, lat/lng, type and subtype, beds, baths, sqft, year built,
lot acres, plus normalised **product / lot / story / water / sewer / HOA classes**. That is the atomic
fact grain, already indexed for city-by-date, subdivision-by-date and an "apples" composite.

`analytics_mart_market_annual` is **not** the thing to extend: two geo grains, five type buckets,
annual only, `type_scope='sfr'` is 17.5% non-SFR and `type_scope='multi'` is mostly manufactured homes.

**Build:**
- `market_fact_sale` — generalise `sale_pricing_facts`: all segments (D7), service-area scope as a
  column, cleaning predicates applied and *recorded*, `complete_through` stamped.
- `market_fact_listing_span` — one row per on-market interval from `OnMarketDate`/`off_market_date`,
  so active inventory is derivable as of any date, carrying a `relist_gap_unknown` flag (§1.7).

### 3.2 `place_membership` — one answer to "is this home in this place"

One row per (listing, place), covering **on-market and closed alike**:
`listing_key · geo_type · geo_slug · method (city_text | polygon | alias) · confidence
(verified | unverified) · effective_from · effective_to · is_primary`.

Rules:
- **Cities resolve by MLS city text** (D5). Sub-city places resolve by polygon, falling back to alias.
- **`is_primary` resolves the 19.5% multi-polygon overlap** — smallest containing polygon wins, and
  only primary rows may be summed. No metric may double-count.
- Actives and closes resolve through the **same** rows, so a mixed-method ratio is impossible.
- A place whose members were resolved by more than one method is **non-publishable for ratio metrics**,
  set by the layer, not remembered by a reviewer.
- Slugs are canonical hyphen-form; one alphabet, enforced.

### 3.3 The metric registry — declared once, in code

Each metric is one entry: `stat_id · label · formula · population predicate · required inputs ·
min_n · allowed grains · earliest_year · window policy · rounding · outlier rule`.
Adding a metric is adding an entry; it inherits membership, windowing, sample floors, provenance and
publishability automatically.

**Vocabulary defined once here, not per writer:**
- `detached` = `PropertyType='A' AND property_sub_type='Single Family Residence'` (D1)
- `active` = `StandardStatus='Active'` only — never Coming Soon, never Active Under Contract
- `closed` = `StandardStatus ILIKE '%Closed%' AND ClosePrice >= 1000` **plus** the exclusions of §3.4
- `service_area` = one county/city set, defined once (D6)

### 3.4 Mandatory exclusions before any median or ratio

1. Non-service-area rows (D6).
2. `PropertyType='G'` (commercial lease) from every sale statistic.
3. Fractional interests — Tenancy in Common, timeshare, deeded week — from residential medians.
4. Order-of-magnitude ClosePrice typos (ratio test against list price and against segment median).
5. `$1`-class auction list prices from any ratio.
6. Retroactive off-market entries (`DaysOnMarket = 0` and same-day contract) — flagged, excluded from
   speed metrics, retained for volume.
7. Duplicate closed events on the same parcel and date (~0.5–1%).
8. Rows with `sqft <= 0` from $/sqft only — counted and the exclusion published.

### 3.5 One compute job, one read function

The job evaluates the registry per (geo, window, segment, metric) and writes one row per figure with
**provenance**: rows counted, method, definition id, window actually used, `computed_at`, confidence,
publishable, and the reason when not.

`getMetric({ stat, geoType, geoSlug, segment, window })` → `{ value, provenance, publishable, reason }`.
Every consumer calls this: place pages, charts, market reports, CMA, BPO, newsletter, video producers,
the JSON feed, admin. The 18 DAL paths and 9 engines collapse into one.

### 3.6 Sample-size and window policy (D4)

| Statistic class | min_n |
|---|---|
| A range (low–high) | 5 |
| A median (price, $/sqft, sale-to-list, days to contract) | 10 |
| A YoY / MoM delta, or a market verdict | 30 |

Window ladder: 12mo → 24mo → 36mo, stopping at the first that clears `min_n`. **The window used is
printed on the figure.** If 36mo fails, the layer returns `publishable: false` with a reason, and the
surface shows the refusal plus the parent place.

**Subdivision is the CMA / comp grain, not the published-statistic grain.** 515 of 680 Bend
subdivisions (75.7%) never reach 10 closed detached sales even over 36 months. Subdivision pages show
counts and individual recent sales; price *statistics* publish at neighborhood and city.

Today's cache violates this at scale: **57.6% of neighborhood rows and 88.1% of subdivision rows are
built on fewer than 10 closed sales.**

### 3.7 Gates

1. **No writer computes geography inline** — fails any market-metric SQL resolving membership from
   `boundaries`, `SubdivisionName` or `"City"` instead of `place_membership`.
2. **No consumer reads a market store directly** — extends the DAL-boundary gate to
   `market_stats_cache`, `market_pulse_live`, `market_history_weekly`, `analytics_mart_*`.
3. **Every rendered figure carries provenance** — a figure without a trace fails the build.
4. **Mixed-method membership ⇒ non-publishable**, enforced in the layer. Retires
   `geo-grain-trust.ts` as a compensating control.
5. **`min_n` and window policy live in the registry**, never per surface.
6. **Dead-column gate** — fails any read of `CumulativeDaysOnMarket` or `"DaysOnMarket"` on a
   consumer surface, and any `mls_source = 'central_oregon'` filter (it is a constant).
7. **Freshness gate** — a metric whose `complete_through` is older than its window fails rather than
   silently serving stale data. This is what would have caught the dead cube cron and the stalled
   boundary job on day one.

---

## 4. The stat registry, v1

Seeded from the 38 statistics found rendering today, deduplicated to one definition each. Names are
chosen so two different things can never share a label.

**Price** — median_close · mean_close (internal only) · median_ppsf (median of per-home
ClosePrice/sqft, sqft>0) · median_list_active · total_volume · price_band_distribution
**Speed** — median_days_to_contract (D2) · median_days_to_close (labelled as such) ·
median_age_active_inventory · pct_under_contract_in_30d
**Negotiation** — median_sale_to_final_list · median_sale_to_original_list · pct_with_price_cut ·
median_price_cut_pct · median_concession_reported (with denominator stated)
**Supply** — active_count · new_listings (relist-excluded, 90-day window; 17.6% of raw new listings
are relists) · pending_count · closed_count · months_of_supply (6-month denominator, house
convention, threshold sentence mandatory) · months_of_supply_12mo (stored alongside) ·
absorption_rate · pct_price_reduced_active
**Mix** — segment_share · bedroom_distribution · cash_share · financing_mix (2004+)
**Movement** — yoy_median_price · mom_median_price · yoy_sold_count · yoy_days_to_contract

Each entry carries its earliest year (§2), its min_n (§3.6), its exclusions (§3.4), and — where the
industry has a genuine dispute (supply denominator, balance point) — the choice made and why.

Industry alignment, verified: days on market is measured **list-to-contract** (Redfin/NAR/Altos);
months of supply is inventory over a monthly sales pace; **medians beat means** for price and
sale-to-list; price-per-sqft is the **median of per-home ratios**; count metrics get seasonally
adjusted while price/DOM/sale-to-list do not; thin samples are **suppressed or widened, never
published raw**. Our verdict thresholds (≤4 seller's · 4–6 balanced · ≥6 buyer's) are stricter than
NAR's six-month balance point — **keep them** (they are gated and internally consistent) but print the
threshold sentence and the window on every verdict.

---

## 5. Granularity — the moat, honestly

Every metric is computable at: **region · county · city · neighborhood/district · planned community ·
subdivision (counts and sales only) · zip**, crossed with **segment** (D7) and **window**.

Leaderboards become a query against the layer, not a new pipeline: best performing (YoY median),
most expensive (median), biggest movers, fastest to contract, most price cuts, most new inventory.
Verified available today at neighborhood grain over 27 places — Orchard District **+8.8%** YoY through
Tetherow **−26.1%**, sold_count ≥ 8.

`activity_events` backs motion sections now — 11,024 price drops, 10,483 new listings, 6,179 pendings,
5,172 closings, fresh daily. **"Most viewed" is not backed** — `listing_views` is empty and
`user_events.listing_view` holds 192 events; instrument before promising it.

---

## 6. Pricing-engine requirements

The layer must guarantee the valuation engine: comp selection **paged in SQL, never a 800-row
truncated pool**; a **product-class-keyed** index (`city_slug × product_class × month`); a
**staleness bound** so a missing index month returns null instead of a silent factor of 1.0; a
`complete_through` stamp so a half-ingested month is never the "to" end of a time factor; a **recency
lane** so recent closes enter within a day rather than 23; **pricing geography resolved by
membership** so Tumalo, Crooked River Ranch and Metolius stop having no corpus; and a **served
close-to-last-ask ratio** replacing the hard-coded 0.98.

---

## 7. Sequence (D3)

1. **`place_membership` + `market_fact_*` built and backfilled alongside today's writers.** No reads
   switched. Every disagreement with current attribution recorded.
2. **Registry + compute job write to a shadow store.** Reconcile every live figure; each difference is
   either a defect found or a definition recorded. Matt reviews the delta report.
3. **Migrate consumers one surface at a time**, each proving reconciliation before it flips.
   **`/sell` is migration #1** — it carries the wrong verdict (§1.4). CMA and BPO follow, because the
   subdivision speed statistic there can never render today.
4. **Gates land as each bypass class reaches zero**, with a baseline that may only shrink.
5. **Then** the granular surfaces and leaderboards.

Repairs folded into step 1 rather than shipped as hotfixes (D8): restart boundary assignment, restart
the cube cron, normalise `buyer_financing`, null out `close_price_per_sqft = 0`, quarantine the 883
bare rows and the 150 zombie Actives, retire the two zero-sample geographies, unify the slug alphabet,
and correct `lib/property-type.ts` (E = Farm, G = Lease).

---

## 8. Canon changes this forces

- **CLAUDE.md §0** — "SFR convention is `PropertyType='A'`" is wrong (D1) and must be restated.
- **CLAUDE.md §7** — the quoted-column list names `CumulativeDaysOnMarket`, a dead column; remove it
  and add the `DaysOnMarket` warning.
- **`docs/DATABASE_FOR_AI_AGENTS.md`** — mark CDOM dead, `mls_source` a constant, and `listings` a
  two-market table.

## 9. Still open

1. Do agent/office analytics (`analytics_mart_office_share_annual`, currently wired to nothing — every
   `office_id` unresolved, MLS sentinel "No Office" ranked as a brokerage) belong in the public cube?
2. Turn on listing-view instrumentation and retire the dead `listing_views` table?
3. Historical inventory publishes as a **band** (§1.7) — publish the band, or refuse pre-2016
   months-of-supply entirely?
