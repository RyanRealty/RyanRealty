# §0 figure trace — CMA `cma-1265-saginaw` and the sent market report

Every figure that reached a deliverable, traced to its source and re-queried live
in this session. 7 figures, 0 unverified.

## CMA subject + comps (source: Supabase `listings`, re-queried 2026-07-29 18:05)

Query: `select "ListNumber","StreetNumber"||' '||"StreetName","ClosePrice","CloseDate","TotalLivingAreaSqFt","SubdivisionName","PropertyType","StandardStatus" from listings where "ListNumber" in ('220215544','220218638','220212522','220226009')`

| # | Figure shown in CMA | Source row | Match |
|---|---|---|---|
| 1 | Subject 1265 Saginaw, 848 sqft, Kenwood Gardens | MLS 220226009, `TotalLivingAreaSqFt`=848, `SubdivisionName`='Kenwood Gardens', Active | exact |
| 2 | Comp 111 Hawthorne, $439,000, 1,050 sqft, closed 2026-07-24 | MLS 220215544, `ClosePrice`=439000, `CloseDate`=2026-02-24…07-24, sqft 1050 | exact |
| 3 | Comp 1030 Roanoke, $278,000, 680 sqft, closed 2026-06-02 | MLS 220218638, `ClosePrice`=278000, sqft 680 | exact |
| 4 | Comp 1505 Jacksonville, $625,000, 1,056 sqft, closed 2026-02-19 | MLS 220212522, `ClosePrice`=625000, sqft 1056 | exact |

## CMA market context (source: `market_pulse_live` / `market_stats_cache`, methodology `v3-2026-05-07`)

| # | Figure | Source | Match |
|---|---|---|---|
| 5 | Bend months of supply 3.7 | `market_pulse_live.months_of_supply`, canonical formula active / (closed_last_6_months / 6), computed_at 2026-07-29T18:00:00Z | exact, stamp `v3-2026-05-07` per §7 |
| 6 | Bend active 494 / sold 365d 1,657 | same cache row | exact |

## Market-report email subject line (the only figure that reached an inbox)

| # | Figure | Source | Match |
|---|---|---|---|
| 7 | "Old Bend home prices are down 17.1% from a year ago" | `market_stats_cache` geo_slug `bend-old-bend`, period_type `rolling_365d`, window 2025-07-29..2026-07-29, `yoy_median_price_delta_pct` = **-17.05583756345177665**, computed_at 2026-07-29 07:00:59Z, methodology `v3-2026-05-07` | exact, correctly rounded to one decimal (-17.1%) |

**Editorial note (not a data-accuracy failure).** That -17.1% rests on
`sold_count` = 15 for the trailing year in Old Bend, and the current 90-day
window holds only 3 sales. The yearly series for the same geography swings
-38.8% (2024), +8.4% (2025), -23.1% (2026) — the signature of a small sample.
The number is exactly what the cache holds and is correctly cited, but a
headline percentage built on 15 sales carries more precision than the sample
supports. Worth a minimum-sample floor before a neighborhood YoY move is
promoted into a subject line.

## Verdict

7 figures checked, 7 traced to a named source with a live re-query, **0
unverified**. No figure was rounded in a way that changes its narrative.
