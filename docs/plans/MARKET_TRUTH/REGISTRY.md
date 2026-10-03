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
| `median_days_to_contract_90d` | Same formula, trailing **90 days** of complete closes | 10 | **2006** | HUD "days to pending" window. Not the 12-month leftover DTC cell. |
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
| `closed_count_30d` | `count(*)` trailing **30 days** of complete closes | 1 | 1997 | HUD "Closed · 30 days". Not leftover 12-month `closed_count`. |
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
`bend-undesignated` still exists. `place_membership` rebuilt 2026-08-23 against
the new hulls (397 batches, **2,680,623** rows). Nested remainder is
`is_primary` = smallest containing neighborhood — do not ST_Difference a community
out of a city district. Neighborhood MOS publishes only when 180-day closes
clear min_n (same membership as actives). Pulse MOS stays untrusted.
Neighborhood extra product types overlay inventory plus
pending/closed counts; MOS only when publishable.
2026-08-23y: subdivision cells are counts only (`active_count`,
`pending_count`, `closed_count`) from `is_primary` membership. No
median, MOS, or verdict at this grain. 2026-08-23z: public plat
history, charts, and stats withhold closed-sale prices through
`publishSubdivisionClosedPrice`. Live list median of on-market
inventory stays a different population. Extra product types at this
grain overlay **active / pending / closed counts** only.

---

## 5. Historical inventory (D11)

Reconstructed from `market_fact_listing_span`:

- `first_on_market_confidence = 'recovered'` → **point estimate**, publishes normally.
- `first_on_market_confidence = 'assumed'` → contributes a **range**, and any figure containing
  assumed spans publishes as a band with `is_floor` semantics and a stated reason.

About 73% of relisted listings recover; the rest are assumed. Reconstruction of 2026-08-10 lands
within 0.4% of the stored snapshot.

Never read `status_change_timestamp` — 51,506 rows carry a single bulk-migration date.

---

## 6. The monthly market report (2026-09-25)

The Central Oregon monthly market report (`lib/market-report/`, editions at
`/housing-market/reports/monthly`) reads Market Truth through its own compact store
(`market_report_*` tables, migrations `20260925010000`..`20260925040000`). Everything above
holds; these are the report's additional predicates. Definition id on every row: `mr-v1`.

| report segment | predicate | used for |
|---|---|---|
| `sfr` | `detached` AND (`lot_size_acres` < 1 OR null) | The main series: Central Oregon, Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras. Keeps acreage from pulling on in-town prices. Calibrated against the appraiser-style monthly report the region used before: Bend July 2026 median $780,000, identical. |
| `acreage` | `detached` AND `lot_size_acres` >= 1 | Its own table. |
| `condo_townhome` | `condo` OR `townhome` | Its own table and Bend chart. |
| `detached` | `detached`, any lot | Terrebonne, Culver, Powell Butte, Camp Sherman (most homes there sit on acreage). |

- **Places.** Towns are the MLS city (D5) through `place_membership` city rows. **Bend quadrants**
  (`market_report_bend_quadrant`): the address `StreetDirPrefix` (NW, NE, SE, SW), else the quadrant
  of the listing's City of Bend neighborhood district, else `bend-outside` ("Rural Bend", outside
  both). Communities are their mapped boundary.
- **Periods.** `month`, `trailing3` (towns), `trailing12`, `quarter`. A period past
  `market_report_state.complete_through` is refused.
- **Months of supply** = homes for sale on the period's last day ÷ (closings in the six months ending
  that day ÷ 6), the §0 formula; verdict ≤ 4 seller's, 4 to 6 balanced, ≥ 6 buyer's.
- **Floors** are §2.3's: a median needs 10, a change from a year ago, a share, months of supply and a
  verdict need 30. A withheld figure is stored `v: null` and printed as a dash with the reason.
- **Price bands.** 28 bands: under $100K, $50K steps to $1M, $200K steps to $1.8M, then $1.8M, $2M,
  $2.5M, $3M, $4M and up (`market_report_band_idx`, twin of `lib/market-report/bands.ts`). Sold by
  close price, for sale by asking price. Months-of-supply tiers are sums of whole bands.
- **Speed and negotiation.** Days to pending = `days_to_contract` (recorded from 2006). Sale to list
  = median `sale_to_final_list`; a price cut = a sale listed above its final list price. Financing
  shares from 2004; seller concessions (share of sales reporting the field) from 2013.
- **Flow.** New listings = episodes whose on-market date falls in the period, relists within 90 days
  excluded. Pendings = episodes that went under contract in the period.
- **The gate (CLAUDE.md §0).** Every edition runs the Spark × Supabase reconciliation before it
  renders (`lib/market-report/reconcile.ts`): every figure it prints that Spark can reproduce
  (closed-sale counts and median close prices for the region, the cities and the towns, by
  segment, for the headline window, the same window a year earlier, the six months behind months
  of supply, the chart points the daily refresh can still move, and the price-band counts) is
  recomputed from Spark with the method's own exclusions, and each must agree within 1%, by count,
  by median, and by listing key (missing, extra, close price). Any miss holds the edition as a draft
  with the reason and texts the owner. On-market counts on a past day and the polygon geographies
  have no Spark equivalent; they rest on the same sales and episodes the gate checks.
- **Freshness.** `/api/cron/market-report-refresh` (daily) runs the closings reconciliation repair
  (`lib/sync/closingsReconcile.ts`) over the trailing 13 months, then refreshes the store and
  recomputes those months. `/api/cron/market-report-publish` (the 8th) publishes the month that
  ended. An edition is frozen when it publishes; its payload and citations are stored with it.
- **The monthly email (Matt 2026-09-30, "Draft it for my OK").** When the newest month publishes,
  `lib/market-report/edition-email-draft.ts` writes its email as a `newsletters` DRAFT
  (`created_by` `cron:market-report-edition:<YYYY-MM>`, one live per month, unique index
  `20260930130000`) and texts Matt the `/admin/newsletters/<id>` link. The email prints only the
  edition's frozen figures, each cited as printed (a median to the whole dollar), and must pass the
  R-2 figure check before it is written. Every citation carries the edition build it came from
  (`generated_at`). A draft is never rewritten: every publish by any path (`publishEdition`) and
  the daily refresh's backstop check each open email against its edition by the figures it prints
  (each citation's payload path, value as printed, and printed direction; the prose labels can be
  reworded without effect). The same figures from a new build keep the draft and everything Matt
  did with it, and move its trace to the new build.
  New figures replace it in one transaction (`replace_newsletter_draft`, migration
  `20260930180000`): the old email is canceled, even if scheduled, and a new draft is written
  under the same marker and audience; Matt is texted the new link, whether the old one had been
  approved, and that edits to it are not carried over, and the old page links to the new one.
  One already going out cannot be recalled: he is texted once per build (new figures, a report
  taken down, or figures that cannot be checked) with the link to pause the rest. A new email that
  cannot be built, or a report no longer published, still cancels the old one, and the backstop
  drafts the month once it can. Every enqueue (the scheduled send, Send now, a one-off list)
  checks a report email against its report first: one behind it is settled by the draft writer
  on the spot (the same printed figures re-stamp it and it goes; new ones replace it and it is
  held, `report_replaced`), and nothing unchecked goes out. What Matt reviews is what he approves; the editor's
  Save writes only while the email is a draft. Deleting a draft cancels it, so a skipped month
  stays skipped. Nothing goes to anyone until Matt approves that send, and a broker's one-click
  newsletter send delivers only the current issue he sent to the list (`newsletters.list_send`,
  in the last 45 days, not paused) or scheduled, never a draft or a one-off test, and never a
  report email whose report was rebuilt after it went out (`lib/data/newsletter/current-issue.ts`).
  The site's Market menu links the archive directly (Matt 2026-09-30, "Yes, add the link").

**Closings drift, found 2026-09-25.** Across the whole feed (every property type, every city Spark
serves), Spark held 1,093 closings from January 2024 to September 2026 that our `listings` copy
lacked, mis-dated, held at an old status, or held without a property sub-type and living area. Most
were March to May 2026: for March 2026 we held 795 closed listings against Spark's 978. Two causes: the delta sync skipped every finalized row, so a withdrawn listing
that relisted and sold, or a close date corrected later, never landed (fixed: a finalized row now
reopens when the MLS changes a fact a statistic reads, `lib/sync/listingDrift.ts`); and a batch of
spring 2026 rows was written without those fields and never modified again (caught by the daily
reconciliation). `prune_market_fact_sale` now drops sale facts whose listing is no longer Closed.

**Matt's two rulings, 2026-09-25 (they bind every statistic, not only the report).**

1. **The MLS record wins over our stored copy.** Where Spark's current record of a closed sale
   differs from ours on a fact a statistic reads, ours is repaired from Spark
   (`scripts/closings-reconcile.ts --repair`; the daily cron does the same for the trailing 13
   months). The first full pass over 1995 to 2023 found 2,530 closings, 2,520 of them close
   prices: 2,318 were in 2000 and 2001, where 1,541 of our stored close prices equaled the list
   price (the April 2026 fill-in from listing history, `apply_close_price_from_history_batch`,
   wrote an asking price where the sold price was blank); in 2007 to 2012 several were tenfold
   typos the MLS had since corrected. Every year's closed count matched Spark exactly, and 2024 and
   2025 (12,145 and 12,219 closings) matched with no drift at all. The values replaced are kept in
   `listing_mls_repair_log` (migration `20260925100000`): per batch, right before the write, the
   whole row as it stood (`before_row`, from 2026-09-29), its statistic facts (`ours`) and what
   Spark serves (`mls`); a batch is not written when its log write fails, and each row's outcome
   moves to repaired or failed as its write answers. It holds the 2026-09-25 runs: the 2,530
   historical closings with their statistic facts, and the 1,093 closings of 2024 to 2026 from the
   first pass, whose facts kept status, city and close date only.
2. **A closed sale the MLS no longer serves is left out.** When a closing we hold returns nothing
   from Spark even looked up by listing key, the reconciliation records it in
   `market_listing_absent_from_mls`, and `refresh_market_fact_sale` marks it `absent_from_mls`
   (unpublishable, migration `20260925060000`); a key Spark serves again is released. Seeded with
   the three found on 2026-09-25 (15714 Tumble Weed Turn, Sisters; 18581 Couch Market, Bend; 717
   Larch, Redmond). Engines that read `listings` directly rather than `market_fact_sale` (the
   older `market_stats_cache`, the CMA's `sale_pricing_facts`, 29 paths in all) do not read the
   table, so on 2026-09-30 Matt ruled the three **deleted from our copy** ("Yes, delete them
   everywhere"): each whole row went to `listing_mls_repair_log` first (ids 3634 to 3636, source
   `absent-from-mls-delete`; undo = re-insert `before_row`), then the `listings` rows and their
   `market_fact_listing_span` rows were deleted and the report refresh pruned the three sale
   facts. The CMA's comparable-sales table (`sale_pricing_facts`) only ever upserted, so it still
   held them; `prune_sale_pricing_facts_batch` (migrations `20260930120000`, `20260930140000`,
   `20260930150000`, in the 6-hourly pricing cron) removed them and one Redmond sale the MLS had
   moved back to Pending, the only four stale rows in the whole table (migration `20260930170000`
   is the current version). A listing the MLS is still changing gets a 48-hour clock first
   (`sale_pricing_facts.stale_since`), and a run may remove 50: a batch past that removes nothing
   and texts the owner, and a person approves a larger cleanup with `p_max_delete`. 717 Larch now counts once, under the number the MLS
   re-entered it as (220220138). After the deletion the trailing 13 months matched Spark
   exactly: 14,461 closings, 0 drifted, 0 absent. The three stay in `market_listing_absent_from_mls`,
   and the daily check still looks each one up by key: if the MLS ever serves one again, the
   record is released and the reconciliation re-pulls the sale (a Spark closing with no row of
   ours is drift, reason `missing`). Their place membership and report listing rows were left;
   with their sale facts and episodes gone they count nowhere.

   **Future removals are deleted automatically** (Matt 2026-09-30, asked what should happen the
   next time: "Delete it automatically. The daily check deletes it after saving the full record,
   and texts you what it removed."). Each daily closings check counts a sighting of every sale
   it confirms missing (`record_absent_from_mls`, one per 12 hours at most), and passes those
   keys to `delete_mls_removed_sales` (migrations `20260930220000` to `20260930260000`), which
   deletes a sale on its third sighting, 36 hours or more after the first: one bad answer from
   Spark, or a day the check did not run, never deletes anything. In one transaction the whole
   row goes to `listing_mls_repair_log` first (source `absent-from-mls-delete`, the shape of
   3634 to 3636), then the listing, its Market Truth sale fact and on-market episodes, the
   monthly report's listing, sale and episode copies, its CMA comp and its place membership. A
   code sweep that day found these are the rows that keep counting a sale once its listing is
   gone: place membership joined to a sale fact the prune no longer reaches (it prunes only the
   trailing 13 months) feeds the `market_metric` closed counts, and the report's listing row
   joined to never-pruned episodes feeds each edition's homes for sale, new listings and
   pendings. The listing's MLS history, its activity events and the CMA zone cache are read only
   through the listing, so they stay. Matt is texted each removed sale's address, MLS number,
   close date and price, from the log (`reported_at`), so a deletion whose answer was lost is
   still told. A Bend calendar day may delete 10: more due at once deletes nothing, holds them
   (`held_at`) and is texted, and while a held sale is still ours and still found missing the
   check deletes nothing on its own until an agent checks them and approves them by name (how:
   `docs/DATABASE_FOR_AI_AGENTS.md`, the `listings` row). A failed deletion is texted and never
   stops the day's report refresh. Only the daily cron deletes (its window is the one the
   refresh recomputes); `scripts/closings-reconcile.ts --delete-removed` does it for an older
   window, whose report periods must then be recomputed. If the MLS ever serves a deleted sale
   again, the delta sync, the full Spark sync and the closings repair put its saved row back
   before they write, frozen as saved, and rebuild its membership, episodes, report attributes,
   sale fact and CMA comp (`restore_mls_removed_sales`, `lib/sync/mlsRemovedRestore.ts`), so it
   returns with its frozen gallery, broker overrides and counters, and Matt is told. The restore
   stays pending until the daily check rebuilds those rows again after the day's writes, so a
   sale re-served with corrected figures is rebuilt on them and a failed step is retried. A test
   (`lib/sync/mlsRemovedRestore.test.ts`) fails if the deletion ever clears a table the restore
   does not rebuild, and `delete_mls_removed_sales_selftest()` runs the whole cycle on synthetic
   rows and rolls back (the integration suite calls it). A published monthly edition keeps the figures it was published
   with; the next edition's comparisons read the corrected data.

**Matt's rulings, 2026-10-01 (after the published reports were audited against the MLS).**
The audit re-checked every published figure Spark can reproduce (127,207 across the 248 editions,
none over 1%) and recomputed the per-sale figures from Spark's own fields in seven sample months
(168 of 168 exact), then found what the cross-check cannot see. Asked "How does this happen", he
was shown the causes below and ruled:

3. **Our listings copy is set against the MLS every morning and corrected to it** ("Fix now and
   check daily"). A statewide check found 1,143 of the 8,918 listings Spark holds as for sale or
   under contract out of step with ours (392 in Central Oregon): 672 back on the market that we
   held as Expired, Withdrawn or Canceled, because the delta sync skipped every finalized row
   until the evening of 2026-09-29 (60 of 60 sampled were finalized, every MLS change dated
   before the fix); 334 we held on the market that had expired, been canceled or withdrawn,
   most changed in the MLS from 2026-03-20 to 2026-05-26 and never applied (the window whose
   closings were repaired 2026-09-25; the sync run log stops 2026-03-16, so why it missed that
   window cannot be shown from our records); 19 we lacked; 101 with a wrong price, home type or
   size. `lib/sync/onMarketReconcile.ts` repairs them through the closings repair (before-images
   in `listing_mls_repair_log`, source `on-market-reconcile`), daily from
   `/api/cron/on-market-reconcile`.
4. **A for-sale listing the MLS no longer serves follows the removed-sales rule** ("Treat like
   removed sales"): whole row saved, deleted on the third daily sighting, Matt texted each one.
   21 on 2026-10-01 (19 Active, 2 Coming Soon, last changed in the MLS October 2025 to July 2026;
   13 are Central Oregon single-family homes listed March to July 2026). Asked how the republish should treat them, he ruled **"Leave them out
   now"**: a listing the daily check records as no longer served gets no on-market episodes from
   that day (builder `20261002010534`), as a removed sale already left the sale facts, and is
   deleted on the third sighting (`20261002010548`, the deletion by status class). First recorded
   2026-10-02 01:13Z. **What they are** (checked a second way 2026-10-02, after Matt's "Flex
   usually keeps everything"): MLS-deleted duplicate entries. Each one's MLS number is served
   neither by key nor by number, while the same address is served under another number. Flex keeps
   every real listing (the feed held 129,663 Expired, 76,906 Canceled and 426 Withdrawn that day),
   but a deleted entry never reaches our copy as a delete. Examples: 3778 Lava, Redmond, 220226052
   (deleted; Coming Soon $560,000 on our site) beside 220226053 (Active $550,000); 728 Brookstone,
   Prineville, 220219363 (deleted; Active $449,000 on our site) while the home sold 2026-09-02 for
   $415,000 as 220221210. Matt 2026-10-02, **"Yes, remove them Sunday"**: the 21 go on Sunday
   2026-10-04 after the third daily check, approved by name, since 21 at once is over the daily 10.
5. **Every edition is rebuilt and republished from the corrected data** ("Republish all 248"). After the off-market repair of 2026-10-02 (652 rows), a full recompute from 1997-01 changed 66 editions: 35 from 2006-01 to 2008-11, whose 36-month charts read periods before 2006 that an earlier recompute from 2006-01 had left on older data, and 31 from 2024-02 to 2026-08 by a listing or a few (July 2026 homes for sale 1,307 to 1,308); all 66 republished through the gate, none held. A full recompute now starts at 1997-01, where the record starts (`scripts/market-report-compute.ts` refuses `--facts` with a later `--from`).
   Homes for sale on a past day count `Active` only (§2.2): an Active listing with a Contingency
   (this MLS's Active Under Contract) is under contract, not for sale; 22 of the 1,258 homes the
   August 2026 edition counted on 2026-08-31 were. The episode builder reads it that way from migration
   `20261001222207_span_under_contract` (a Contingency set while Active ends the episode as
   under contract; cleared while Active, the home is back on the market). In the 9,201 full
   histories pulled that day: 479 set, 167 cleared, none in the same edit as a return to Active. Seller concessions print only where the Yes/No
   field covers 90% of the period's sales (`CONCESSION_COVERAGE_MIN`): before mid-2023 the field
   was filled almost only when a concession was given, so the printed share read 100% (261 notes
   in 117 PDFs), and Spark serves it on 1 of August 2016's 461 sales today.
6. **Full MLS histories cover the last 13 months only** ("Keep the 13 months", asked 2026-10-01
   whether to pull the other 175,505 report-area listings, about 10 hours of MLS calls): the
   9,201 listings on the market since 2025-09-01 have whole histories; an older listing keeps the
   newest 10 events the old fetch kept, and its episodes fall back to the listing row's on and
   off dates where those 10 hold no start.
