# Market Truth — segment and metric registry

Companion to `SPEC.md` (verified facts) and `DDL.sql` (schema). This file closes SPEC §5:
every segment and every statistic as a **predicate**, not a description. English is how we ended up
with four meanings of "days on market".

**Rule:** a stat that is not in this file cannot be published. A stat in this file has exactly one
formula, one population, one floor, and one label.

---

## 1. Segments (SPEC D7)

MLS letter codes, verified from `details->>'PropertyTypeLabel'` (100% consistent, 300-row sample per
code): **A** Residential · **B** Mobile Home · **C** Residential Income · **D** Land · **E** Farm ·
**F** Commercial Sale · **G** Commercial Lease · **H** Business Opportunity.

Three files in the repo currently disagree with this and with each other (`lib/property-type.ts`,
`lib/data/analytics/property-type-labels.ts`, `components/site/listing-detail/PropertySpecs.tsx`) —
see SPEC §6.

| segment | predicate | notes |
|---|---|---|
| `detached` | `"PropertyType"='A' AND property_sub_type='Single Family Residence'` | **This is "single family" (D1).** 366,106 rows. |
| `condo` | `"PropertyType"='A' AND property_sub_type='Condominium'` | 11,244 |
| `townhome` | `"PropertyType"='A' AND property_sub_type='Townhouse'` | 10,871. **No pre-2003 history** — those sales were filed as Condominium, not detached. |
| `manufactured_land` | `"PropertyType"='A' AND property_sub_type='Manufactured On Land'` | 36,230. Owned land. |
| `manufactured_park` | `"PropertyType"='B'` | 12,902. In park / on leased land. A different market from the row above — never merge. |
| `multifamily_2_4` | `"PropertyType"='C'` | 14,712 (Duplex 6,528 · Multi Family 5,296 · Quadruplex 1,810 · Triplex 1,065). Publish the split only where it clears the floor; triplex never will. |
| `land` | `"PropertyType"='D'` | 109,290. **Subtype series cannot cross 2020** — Agriculture/Recreational/Rangeland did not exist before then and that land was filed as Residential Lots. |
| `farm` | `"PropertyType"='E'` | 4,150. **Not commercial.** 2,817 carry a dwelling; 1,016 closed sales have beds and ≥400 sqft. |
| `commercial_sale` | `"PropertyType"='F'` | 20,064 |
| `commercial_lease` | `"PropertyType"='G'` | 4,335. **Price is rent** (median list $1.25/sqft; 98.2% under $10,000). **Excluded from every sale statistic** — 595 already clear the `>=1000` filter. |
| `business` | `"PropertyType"='H'` | 1,421 |
| `all_residential` | `"PropertyType"='A'` | The old bucket. Keep the name honest — it is not single family. |

**Excluded from every residential segment** (fractional and non-fee interests, SPEC §1.9):
`property_sub_type IN ('Tenancy in Common','Timeshare','Residential Leased Land','Stock Cooperative')`.
2,006 TIC rows at a median list of $35,000 against whole-unit square footage; they read Sunriver's
class-A median **$65,000 (8.8%) low** and are 17.16% of Camp Sherman's detached closings.

---

## 2. Population predicates

### 2.1 `closed` — the base population for every sold statistic

The pre-audit draft put `row_number() OVER (...)` in `WHERE`. That is invalid Postgres
(`42P20`). Duplicate suppression is a `DISTINCT ON` (or a CTE), not a filter clause.

```sql
SELECT DISTINCT ON (
  CASE
    WHEN parcel_number IS NOT NULL AND btrim(parcel_number) <> ''
      THEN btrim(parcel_number) || '|' || "CloseDate"::date::text
    ELSE "ListingKey"
  END
)
  *
FROM public.listings
WHERE "StandardStatus" ILIKE '%Closed%'
  AND "ClosePrice" >= 1000
  AND "CloseDate" IS NOT NULL
  AND public.market_in_service_area("City")
  AND "PropertyType" IS DISTINCT FROM 'G'
  AND (property_sub_type IS NULL OR property_sub_type NOT IN
       ('Tenancy in Common','Timeshare','Residential Leased Land','Stock Cooperative'))
  AND NOT (
        "ListPrice" > 0 AND (
          "ClosePrice" / "ListPrice" BETWEEN 9 AND 11
       OR "ListPrice" / "ClosePrice" BETWEEN 9 AND 11
       OR "ListPrice" / "ClosePrice" > 500 ))
ORDER BY
  CASE
    WHEN parcel_number IS NOT NULL AND btrim(parcel_number) <> ''
      THEN btrim(parcel_number) || '|' || "CloseDate"::date::text
    ELSE "ListingKey"
  END,
  "ModificationTimestamp" DESC NULLS LAST;
```

Partial exclusions are an **array**, applied per `stat_id` — never a row-level `is_publishable=false`
that drops the sale from volume (AUDIT B2).

**Retroactive off-market entries** — `"CloseDate"::date < "ListDate"::date` (14,412 rows on
2026-08-22) — are **not** an ingest bug. They are after-the-fact MLS comp entry for pocket and
office-exclusive sales. They are **retained for volume and price, excluded from every speed
statistic**, flagged `exclusion_reasons ⊇ {'retroactive_entry'}` on the speed side only.

### 2.2 `active` — the base population for every inventory statistic

```sql
"StandardStatus" = 'Active'          -- exact. NOT ILIKE '%Active%'
                                     -- ILIKE admits 'Active Under Contract' (44 rows today)
AND public.market_in_service_area("City")
AND "PropertyType" <> 'G'
```

Coming Soon is **never** inventory. Pending is counted separately. Live
`refresh_market_pulse` currently counts `IN ('Active','Coming Soon')` — that is a defect the
migration must not copy (AUDIT B4).

**No city polygon filter.** That filter is what makes `/sell` publish a wrong verdict: it keeps 488
of 781 Bend detached actives and biases the ratio toward "seller's market" because the excluded ring
runs at 8.03 months of supply (SPEC §1.1).

### 2.3 Sample floors and window ladder (D4)

| statistic class | `min_n` |
|---|---|
| range (low–high) | **5** |
| median (price, $/sqft, sale-to-list, speed) | **10** |
| delta (YoY, MoM) or a market verdict | **30** |

Ladder: try **12 → 24 → 36** months, stop at the first window clearing `min_n`, and **store
`window_months` so the figure prints its own window**. If 36 fails, write
`is_publishable = false, withheld_reason = 'below_min_n'` and let the surface offer the parent place.

Today's cache uses `n >= 3`, which is why 1,286 rows publish a median on 3–4 sales.

---

## 3. The stats

Every entry: `stat_id` · formula · population · `min_n` · grains · earliest year · notes.

### Price

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `median_close` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price)` | 10 | 1997 | Mix-sensitive: 37% of Bend's published −3.7% YoY is composition. Always publish alongside `segment_share`. |
| `median_ppsf` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price / living_sqft)` over `living_sqft > 0` | 10 | 1997 | **Median of per-home ratios.** Four methods spread 17.9% on Bend; aggregate `sum/sum` gives $432 against this method's $391. Publish `excluded_n` for the sqft-null rows. |
| `median_list_active` | `percentile_cont(0.5)` over `list_price`, population `active` | 10 | now | |
| `total_volume` | `sum(close_price)` | 5 | 1997 | |
| `price_band_distribution` | `count(*)` grouped by band | 5 | 1997 | Bands declared once, never per surface. |

### Speed

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `median_days_to_contract` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY (contract_date - on_market_date))` where `>= 0` | 10 | **2006** | **The headline speed stat (D2).** `purchase_contract_date` copies CloseDate before 2003 and carries negative escrow 2003–05. Excludes retroactive entries. |
| `median_days_to_close` | `percentile_cont(0.5)` over `close_date - on_market_date` | 10 | 1997 | Labelled **"days to close"**, never "days on market". |
| `median_age_active_inventory` | `percentile_cont(0.5)` over `current_date - on_market_date`, population `active` | 10 | now | Unsold inventory age. A different quantity from both rows above. |

**Banned as a source:** `listings."DaysOnMarket"` (list-to-close minus one day, escrow included,
r = 1.000 with list-to-close) and `"CumulativeDaysOnMarket"` (500 non-null of 595,379). Gate 6.

### Negotiation

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `median_sale_to_final_list` | `percentile_cont(0.5)` over `close_price / list_price` | 10 | 1997 | **The consensus "sale to list".** Bend 99.3% where the current clamped mean publishes 95.7%. |
| `median_sale_to_original_list` | `percentile_cont(0.5)` over `close_price / original_list_price` | 10 | **2002** | The **negotiation** metric — a separate label, never interchangeable. OriginalListPrice copies ListPrice through the 1990s. |
| `pct_with_price_cut` | `count(*) FILTER (WHERE original_list_price > list_price) / count(*)` | 30 | 2002 | 45.2% of sales had a price change (41.4% down, 3.8% up). |
| `median_price_cut_pct` | `percentile_cont(0.5)` over `1 - list_price/original_list_price` where cut | 10 | 2002 | |
| `median_concession_reported` | `percentile_cont(0.5)` over `concession_amount` where `concession_reported AND concession_amount > 0` | 10 | **2013** | Label must say **"among sales that had one"**. Current copy calls it "the median seller concession", which is a different number. Incidence uses `concession_reported`, never `amount IS NULL`. |

**Mean sale-to-list is banned at every grain** — $1 auction list prices give Central Oregon 2022 a
mean of 6,927%.

### Supply

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `active_count` | `count(*)`, population `active` | 1 | now | One definition. Today three coexist inside the cache alone (488 / 453 / 794). |
| `new_listings` | `count(*)` of episodes starting in window, **excluding relists within 90 days** | 5 | 1997 | 90 days is a **new-listing de-dupe**, not the DOM/CDOM reset. CDOM / first-on-market reset is **60 days off-market** (Oregon Data Share §3-20). Publish raw and de-duplicated during migration. |
| `pending_count` | `count(*)` where status Pending or Active Under Contract | 1 | now | Never inside `active_count`. |
| `closed_count` | `count(*)`, population `closed` | 1 | 1997 | |
| `months_of_supply` | `active_count / (closed_count_180d / 6.0)` | 30 | now | House convention. **Must print its window and the threshold sentence.** The 6-month denominator swings 1.32× by window end-month from seasonality alone — enough to cross 4.0 and 6.0. |
| `months_of_supply_12mo` | `active_count / (closed_count_365d / 12.0)` | 30 | now | Stored alongside; the NAR-shaped variant. Diverges up to 2.31 months in thin geographies. |
| `absorption_rate` | `closed_count_180d / 6.0 / active_count` | 30 | now | |

**Verdict** (`market_verdict`): `<= 4` seller's · `4–6` balanced · `>= 6` buyer's. Stricter than NAR's
six-month balance point — **keep**, but every rendered verdict carries the threshold sentence and the
window. `min_n = 30`, and non-publishable when membership method is mixed.

### Mix and features

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `segment_share` | `count(*) per segment / count(*)` | 30 | 1997 | Subtype segmentation only from 2003 (townhome) and 2020 (land). |
| `bedroom_distribution` | `count(*)` grouped by beds | 30 | 1997 | |
| `cash_share` | `count(*) FILTER (buyer_financing matches cash) / count(*) FILTER (buyer_financing IS NOT NULL)` | 30 | **2004** | Parse from the format-invariant `details` value, not the mapper output. Three incompatible stored shapes exist; the April-2026 flip happened in our mapper, not at the MLS. Comma lists ("Cash, Conventional") must split. |
| `financing_mix` | share by financing type | 30 | 2004 | Near-complete from 2020. |
| `feature_share` | `count(*) FILTER (flag IS TRUE) / count(*)` | 30 | — | **Publish as a floor: `is_floor = true`, label "at least" (D12).** No explicit negative exists anywhere — `fireplace_yn` is true 175,832 / NULL 419,547 / **false 0**. `garage_yn` is genuinely three-state and may publish as a true share. |

### Movement

| stat_id | formula | min_n | earliest | notes |
|---|---|---|---|---|
| `yoy_median_price` | `median_close(t) / median_close(t-12m) - 1` | 30 both sides | 1998 | Both windows must independently clear the floor. |
| `mom_median_price` | same, one month back | 30 both sides | 1998 | Seasonal steps reach ±3.4%, larger than the deltas typically reported. Seasonally adjust or state the effect. |
| `yoy_sold_count` | `closed_count(t) / closed_count(t-12m) - 1` | 30 both sides | 1998 | Count metrics **are** seasonally adjusted; price, speed and ratios are not. |
| `yoy_days_to_contract` | delta of `median_days_to_contract` | 30 both sides | 2007 | |

---

## 4. Grains

`region · county · city · neighborhood · community · subdivision · zip`, crossed with segment and window.

**Subdivision publishes counts and individual sales only — never a price statistic.** 515 of 680 Bend
subdivisions (75.7%) never reach 10 detached sales even over 36 months. It remains the comp and CMA
grain.

Every geography read uses `place_membership` with `is_primary = true`. A sum that does not filter
`is_primary` fails gate 8 — 19.5% of sales sit inside 2+ subdivision polygons and summing inflates
totals 1.33× at subdivision grain and 1.50× at neighborhood grain.

**Neighborhood polygons are not publishable until repaired.** 2026-08-23n: seven Spark hulls
replaced with Deschutes County GIS plat unions — Northwest Crossing **4,857 → 342 acres**,
Eagle Crest **6,371 → 1,643**, Caldera Springs **3,942 → 1,019**, Black Butte Ranch
**2,659 → 1,185**, Pronghorn **1,583 → 370**, Crosswater **1,012 → 512**, Vandevert Ranch
**1,072 → 397**. Overlap pairs **25 → 12** (10,000 m² floor). 2026-08-23u: remaining Spark
hulls replaced from official GIS — Sunriver **10,113 → 3,744** (Deschutes Unincorporated
Communities), Three Rivers **15,703 → 2,520** (Deschutes River Recreation Homesites plat
union), Widgi Creek **1,276 → 317** (Inn of the 7th Mountain unincorporated community),
Brasada Ranch **16,126 → 888** (Crook County GIS subdivision). Overlap pairs **12 → 4**,
all nested community-in-district (Awbrey Glen ⊂ Awbrey Butte, Broken Top ⊂ Century West,
Northwest Crossing ⊂ Summit West, Northwest Crossing ∩ River West sliver).
`bend-undesignated` still exists. MOS stays unpublished. `place_membership` rebuilt
2026-08-23 against the new hulls (397 batches, **2,680,623** rows). Nested remainder is
`is_primary` = smallest containing neighborhood — do not ST_Difference a community
out of a city district. Neighborhood leftover cells exist; MOS/verdict stay
`is_publishable=false`.

---

## 5. Historical inventory (D11)

Reconstructed from `market_fact_listing_span`:

- `first_on_market_confidence = 'recovered'` → **point estimate**, publishes normally.
- `first_on_market_confidence = 'assumed'` → contributes a **range**, and any figure containing
  assumed spans publishes as a band with `is_floor` semantics and a stated reason.

About 73% of relisted listings recover; the rest are assumed. Reconstruction of 2026-08-10 lands
within 0.4% of the stored snapshot.

Never read `status_change_timestamp` — 51,506 rows carry a single bulk-migration date.
