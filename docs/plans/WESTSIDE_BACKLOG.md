# West-side dominance — ranked backlog

Generated 2026-07-28 from live data. Mission: most leads captured into `crm_people`,
trending toward most west-side closed sides. Every figure below carries a trace (§0).

## The battlefield (trailing 12 months, verified)

| | Sides | Volume | Share |
|---|---|---|---|
| West-side Bend market | 1,564 sides (782 closings) | $931.9M | — |
| Cascade Hasson SIR | 282 | $354.3M | 18.0% |
| Stellar Realty Northwest | 147 | $169.0M | 9.4% |
| RE/MAX Key Properties | 120 | $131.0M | 7.7% |
| Harcourts The Garner Group | 120 | $167.4M | 7.7% |
| Bend Premier Real Estate | 84 | $92.4M | 5.4% |
| Brian Ladd (top individual, 2 name variants) | 49 | $77.1M | 3.4% |
| **Ryan Realty LLC** | **4** | **$5.0M** | **0.26%** |

*(Refreshed 2026-07-28 after the neighborhood backfill below recovered 129 closings into
the GIS ledgers; shares moved < 0.3pt.)*

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
| 1 | ~~Fix the lead-write discrepancy~~ **DONE 2026-07-28** (`f262c541`): no leads were lost — GA4 was inflated by cron CMA builds (180/90d) + CTA clicks firing `valuation_requested`. Both cut; GA4 now matches CRM reality. | 131 GA4 lead events vs ~10 real submissions / 90d | Metrics now trustworthy for spend decisions | M | SHIPPED |
| 2 | **Win the sitting-duck queries** — first tranche SHIPPED 2026-07-28 (`32b47a83`): registry-driven "On the market now" cross-link card on every blog post (six ranking posts carried zero links to /communities/*). Remaining: content depth on the 4 community pages themselves, blocked-on-value by #5 (crawl budget). Titles/H1s verified already exact-match. | 980 imp/90d at pos 9.8–17.2, 0 clicks | pos→top-3 ≈ 90–150 clicks/mo | M | IN PROGRESS |
| 3 | ~~Brand SERP repair~~ **VERIFIED COMPLETE on-site 2026-07-28**: RealEstateAgent+LocalBusiness schema with full NAP (115 NW Oregon Ave #2, 97703), tracked phone, 8 sameAs, visible address — all present on the live homepage. Pos 31 for bare "ryan realty" is entity ambiguity vs national namesakes; remaining lever is authority accrual (GBP review velocity, links), folded into #6. Add the GBP profile URL to sameAs when confirmed. | 109 imp/90d, 10 clicks | On-site floor already correct | S | CLOSED (on-site) |
| 4 | ~~Backfill NULL `boundary_neighborhood`~~ **DONE 2026-07-28**: official-polygon backfill recovered 129 closings (876→747 NULL); verified 0 recoverable rows remain — the 747 are genuinely outside the 13 Bend NA polygons | 876/2,540 Bend closings unattributed | Market map + neighborhood ledgers corrected | S | SHIPPED |
| 4b | **Redirect consolidation** — geography legacy URLs retargeted to canonical community pages (+ dead `/broken-top` revived); overrides live in the generator so regen can't clobber | GSC: legacy URLs ranking pos 4–24 while canonical pages sat at 26–52 | Consolidates authority behind the pages that convert | S | SHIPPED |
| 4c | **Build `/luxury` (luxury homes in Bend) page** — Google currently ranks our sitemap page for "luxury homes bend" (144 imp, pos 10.3, 0 clicks) because no real surface exists | GSC winnable table | New page on an existing archetype; 30–50 clicks/mo | M | SHIP-NOW |
| 5 | **Fix crawl-budget starvation** — GSC sitemap report: **10,744 submitted, 60 indexed (0.6%)**. 9,446 URLs (88%) are `/homes-for-sale/*` search permutations; hub pages are indexed but `/neighborhoods/*` and the 502 subdivision pages are "unknown to Google" (never crawled). Fix: split sitemaps by URL class (per-class indexed reporting), prune low-value permutations, strengthen internal link paths hub→tail. **Highest-leverage SEO item on the board — do first next session.** | GSC sitemaps.list + urlInspection API 2026-07-28 | Multiplies every other SEO item; without it the tail cannot rank | M | SHIP-NOW |
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
