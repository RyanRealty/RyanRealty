# West-side dominance — ranked backlog

Generated 2026-07-28 from live data. Mission: most leads captured into `crm_people`,
trending toward most west-side closed sides. Every figure below carries a trace (§0).

## The battlefield (trailing 12 months, verified)

| | Sides | Volume | Share |
|---|---|---|---|
| West-side Bend market | 1,452 sides (726 closings) | $867M | — |
| Cascade Hasson SIR | 262 | $331.1M | 18.0% |
| Stellar Realty Northwest | 134 | $151.8M | 9.2% |
| Harcourts The Garner Group | 111 | $153.2M | 7.6% |
| RE/MAX Key Properties | 115 | $125.2M | 7.9% |
| Bend Premier Real Estate | 79 | $86.4M | 5.4% |
| Brian Ladd (top individual, 2 name variants) | 49 | $77.1M | 3.4% |
| **Ryan Realty LLC** | **4** | **$5.0M** | **0.28%** |

West-side = GIS `boundary_neighborhood` IN (Summit West, Awbrey Butte, River West,
Century West, Southwest Bend, Old Bend). Adjustable; per-neighborhood rows retained in trace.

## Our funnel (verified)

- Sessions, 90d: **1,140 total (~12/day)** — Direct 409, Organic 326, Unassigned 161, Paid Social 107.
- Google Search, 90d: **36 clicks / 4,681 impressions** across 500 queries. Brand query "ryan realty" at position 31.1.
- Inbound leads, 90d (crm_people, excl. Farm import + crons): **~41 total; 11 from the website** (~3.7/mo).
- GA4 lead-events, 90d: valuation_requested 90 · contact_agent 48 · generate_lead 41 · call_initiated 5 — **131 lead-shaped events vs 11 CRM website leads. Discrepancy unexplained.**

## Ranked backlog

| # | Item | Evidence | Est. impact | Effort | Class |
|---|---|---|---|---|---|
| 1 | **Fix the lead-write discrepancy** — trace valuation/contact/lead events to `crm_people` writes; find where submissions die or events over-fire | 131 GA4 lead events vs 11 CRM website leads / 90d | If even 20% are real lost leads: +8/mo immediately | M | SHIP-NOW |
| 2 | **Win the sitting-duck queries** — on-page + content depth + internal links for Tetherow, Broken Top, Black Butte Ranch, Brasada, luxury-homes-bend pages | 980 imp/90d at pos 9.8–17.2, 0 clicks | pos→top-3 ≈ 90–150 clicks/mo on buyer/seller-intent queries | M | SHIP-NOW |
| 3 | **Brand SERP repair** — "ryan realty" at pos 31; Organization schema, GBP↔site linkage, homepage title | 109 imp/90d, 10 clicks | Own the brand query; floor fix | S | SHIP-NOW |
| 4 | **Backfill NULL `boundary_neighborhood`** (876 Bend closings, 34%) — existing `seo-backfill-bend-listings-neighborhood.mjs` + spatial index path | 876/2,540 Bend closings unattributed | Strengthens every neighborhood page + market stat | S | SHIP-NOW |
| 5 | **Indexing coverage audit** — 4,681 impressions/90d across 500 queries is coverage-starved for a site with programmatic city/neighborhood/listing pages | GSC totals above | Prerequisite multiplier for #2 | M | SHIP-NOW |
| 6 | **Competitor digital teardown** (Cascade Hasson, Stellar, Harcourts Garner, RE/MAX Key, Bend Premier): what ranks, what captures, review velocity | Top-5 set derived from closed production above | Informs next backlog revision | M | SHIP-NOW (analysis) |
| 7 | **Paid Social scale decision** — 107 sessions → 52 keyEvents (best conversion ratio of any channel) | GA4 channels table | Spend change | — | QUEUE-FOR-APPROVAL |
| 8 | **Start expired-listing sends** — sequences built, sends never started (market-report funnel audit) | 44 expired + 14 FSBO prospects added in 30d | First-mover on listable inventory | — | QUEUE-FOR-APPROVAL |

## Blind spots

- GSC domain property (`sc-domain:`) not readable by the service account; URL-prefix property is owner-level and was used. Domain-level data may differ slightly.
- No Spark cross-check run this pass (Supabase closed data is the reconciled source for historical closes per §0).
- Farm cohort (4,393 imported contacts, 30d) excluded from lead counts — it is prospecting inventory, not inbound flow.

## Verification traces

- Market/office/agent tables: Supabase `listings`, `"StandardStatus"='Closed'`, `"PropertyType"='A'`, `"City"='Bend'`, `"CloseDate" 2025-07-28..2026-07-28`, `boundary_neighborhood IN (6 west-side NAs)`; sides = list ∪ buy UNION ALL; office query returned 12 rows, agent query 15+3.
- Neighborhood enumeration: same filter grouped by `boundary_neighborhood`, 16 rows, NULL=876 of 2,540.
- Lead intake: `crm_people`, `deleted=false AND fub_created_at IS NULL AND created_at >= now()-'90 days'` grouped by source, 16 rows.
- GA4: Data API `properties/527333348`, 90daysAgo..yesterday, channel report + eventName filter on 5 conversion events.
- GSC: Search Analytics API, `https://ryan-realty.com/`, 93d window, 500-query page; winnable = pos 4–20 AND imp ≥ 50.
