# Data Foundation — Top Site Goal

**Date:** 2026-08-10 (live probe of production Supabase + DAL inventory)  
**Purpose:** Any SEO, UI, nav, engagement, or lead work must be grounded in **what the database and registries actually hold**. This doc is the data map for `TOP_SITE_GOAL_SYSTEM.md`.  
**Rule:** §0 — every on-page figure traces to a named source below. No inventing inventory, medians, or HOA fees to “fill the layout.”

---

## 0. Executive picture (scale)

| Asset | Approx. scale (2026-08-10) | Role in top-site goal |
|-------|----------------------------|------------------------|
| `listings` | **~595k** rows (history + active) | Full MLS warehouse |
| Active listings | **~7,610** | Buy inventory product |
| **Closed + priced (`ClosePrice≥1k`)** | **~377k** | **Sales intelligence fact table** |
| `listing_tile_mv` | **~595k** | Fast cards/search/map pins |
| `market_pulse_live` | **45** geos (16 city · 28 nbhd · 1 region) | Live market HUD / Layer A numbers |
| `market_stats_cache` | **~13k** rows; monthly region from **2016-07** | Modern medians, **total_volume**, breakdowns (SFR-heavy consumers) |
| `geo_snapshot_mv` | **~6.9k** keys | Sitemap + city/community counts |
| `activity_events` | **~33k** | Price drops, new listings, ticker |
| `visitor_sessions` | **~69k** | Engagement truth (not GA4) |
| `visitor_events` | **~118k** | Path/behavior → leads scoring |
| `crm_people` | **~23k** | Lead identity + conversion store |
| `cmas` | **271** | Moat: written valuations |
| `blog_posts` | **87** | Current organic click leaders (GSC) |
| Static content registries | Parks 533 · schools 929 · trails 392 · events 1093 · venues 422 · golf courses 541 · resort JSON 870 lines | Lifestyle × homes authority |
| Curated resorts | **~19–20** in registry (not all 1.8k `communities` rows) | Premium community pages |
| **Analytics platform (planned)** | fact_closed_sale · marts · analyze RPC | Full extraction — `MARKET_ANALYTICS_PLATFORM.md` + SI ship units |

**Implication:** We already have **portal-class inventory + multi-decade closed sales**. Lag is packaging + discovery + conversion + measurement + **sales-intelligence productization** — not “we lack MLS data.”

---

## 1. Data domains (canonical stores)

### 1.1 Inventory (Buy)

| Store | Freshness | What it holds | Public consumers |
|-------|-----------|---------------|------------------|
| `listings` | Spark delta + full | RESO-ish columns + `details` jsonb + open houses + media flags | Detail pages, sync, admin |
| `listing_tile_mv` | After sync/MV refresh | Card projection: price, beds, baths, photo, lat/lng, tour, DOM, drops | Search, grids, map, sitemap tiles |
| Search RPCs / facets | On query | Filters, counts, matrix | `/homes-for-sale` |
| `activity_events` | Near-real-time | `new_listing`, `price_drop`, `back_on_market`, … | Price drops, ticker, digests |
| Open houses | From listing feed | `OpenHouses` field; **~297** active with field set | `/open-houses` |
| Virtual tours | Feed flag | **`has_virtual_tour` ~1,026 active** | Videos, feed, cards |

**DAL (do not bypass):**  
`searchListingsAll`, `getListingTiles`, `getListingDetail`, `getPriceDrops` / `getPriceDropDigest`, `getMotivatedListings`, `getUpcomingOpenHouses`, `getListingVideos`, `getSimilarListings`.

**Layer A numbers allowed on Buy surfaces:** active counts from pulse/snapshot, drop counts from activity_events, open-house counts from open-house DAL — never hardcode.

---

### 1.2 Market intelligence (Market)

| Store | Freshness | Fields that matter for UI/SEO | Consumers |
|-------|-----------|-------------------------------|-----------|
| `market_pulse_live` | **10–15 min** | `active_count`, `median_list_price`, `median_days_to_pending`, `months_of_supply`, `sold_count_*`, `median_close_price_90d`, sale-to-list, price_reduction_share, methodology JSON | City/region hero, KbMarketHud, reports, emails |
| `market_stats_cache` | ~6h / period | Rolling 30/90/365; monthly from **2016-07**; **`total_volume`**, sold_count, medians, **`property_type_breakdown`**, price bands, bedroom_breakdown, YoY | City market detail, history charts, archives — **volume under-exposed** |
| `getCoreChartSeries` / price history | Cache | Time series for charts | Market pages |
| `getCityRangeReport` / archives | Report tables | Weekly/period reports | `/housing-market/reports` |
| **`sales_cube_annual` (G9)** | Nightly/weekly rebuild | year × geo × **type_scope** → sold_count, **total_volume**, median*, bands | Market size / composition product |
| **`sales_cube_feature` (G9)** | Same | year × geo × type_scope × feature → counts/volume | Attribute history (fireplace-class) |

**Closed-sales fact table (same `listings` warehouse):**

| Probe (2026-08-10) | Note |
|--------------------|------|
| ~377k closed+priced | Fact grain for all sales intelligence |
| 1990 = 0 rows | Do not claim 1990 market from this feed |
| 1998 ~8.7k; 2005 ~19k; 2024 ~12k all-types | Deep history is real from mid‑90s |
| Typed attrs | `fireplace_yn`, `pool_yn`, `PropertyType`, beds, sqft, city, ClosePrice/Date, … |
| G62 | No request-path `details` fan-out for history features |

**Compute path (existing):**  
`compute_and_cache_period_stats` · `refresh_market_pulse` · crons `refresh-market-stats` · `refresh-market-stats-monthly-recompute` · `market-history-snapshot` · `scripts/backfill-market-history.mjs` (floor 2016-07).

**Pulse coverage (live):**  
- **Cities with pulse:** Bend (490 active), Redmond (185), La Pine (171), Prineville (77), Powell Butte (67), Madras (53), Sunriver (49), Sisters (37), … + smaller CO geos  
- **Neighborhoods:** 28 rows (e.g. Southwest Bend)  
- **Region:** 1 Central Oregon row  
- **Scope:** methodology is **SFR-only (PropertyType=A)** — copy and schema must say so when claiming “homes”

**DAL (today):** `getMarketPulse`, `getRegionPulse`, `getCityMarketDetail`, `getPriceHistory`, `getCoreChartSeries`, `getCityReportSnapshot`, `getMarketReports`, `getCityArchive`, `getMarketHistoryWeekly`.  
**DAL (G9):** `getSalesCubeAnnual`, `getSalesCubeFeature`, `getMarketSizeSeries` — see `SALES_INTELLIGENCE_EXECUTABLE.md`.

**Layer A:** every market H1/lead figure must come from pulse, stats_cache, or sales cubes for that geo + **labeled type_scope**.

**Perf law:** Public market history **reads cubes/cache only**. Rebuilds are service-role RPC + partial indexes on closed sales. Spec: `docs/data/CACHE_TABLE_FIELD_SPEC.md` + sales intelligence plan.

---

### 1.3 Geography (Areas)

| Store | Scale | Notes |
|-------|-------|-------|
| `geo_snapshot_mv` | ~6.9k | `city` / `community` / sparse `neighborhood` — active_sfr_count, median, community_count |
| `communities` table | **1,848** | Mostly raw MLS community names — **not** all public pages |
| Resort registry `data/resort-communities.json` | **~19–20** curated | Only these get full `/communities/[slug]` product treatment |
| Neighborhoods | thin in DB (`neighborhoods` ≈ 13) + pulse nbhd rows + boundary system | City → nbhd via boundary/geo pipeline |
| Subdivisions | GIS + index thresholds | Sitemap needs polygon + lifetime listing floor |
| Out-of-area cities | DAL `getOutOfAreaCities` | `/oregon/[city]` referral tier |
| Static: parks, schools, trails, events, venues, golf | See counts above | Registry + optional nearby homes join |

**DAL:** `getGeoSnapshot`, `getAllCitySnapshots`, `getBoundaryGeoJSON`, community registry helpers, park/school/trail/venue/golf detail joiners (all call `getMarketPulse` for parent city when useful).

**SEO rule:** Public community **pages** = curated resorts + high-signal geos. Do not promise 1,848 community landing pages without product.

---

### 1.4 Content (organic traffic engine — GSC proven)

| Store | Scale | GSC role |
|-------|-------|----------|
| `blog_posts` | 87 | **Top organic click winners** (Sunriver, Eagle Crest, kids, VR rules) |
| Guides | DAL guides table | Evergreen how-tos |
| Market reports HTML | report rows + generated | Data + email |
| `marketing_brain_actions` | brain pipeline | Produce → approve → publish |

**Implication for “top site”:** Layer A + UI investment on **blog/community clusters** is as important as city inventory H1s. Data for HOA fees etc. must be **sourced** (registry/blog research), not invented from MLS alone.

---

### 1.5 Identity, CRM, conversion (leads)

| Store | Scale | Chain (from data-atlas) |
|-------|-------|-------------------------|
| `crm_people` + contact points | ~23k | Lead SoT |
| `crm_timeline` | large | Inbound/outbound truth |
| `listing_alerts` | **6** (tiny) | Alert product underused vs traffic |
| `saved_searches` | 2 | Account product cold |
| `cmas` | 271 | Valuation moat delivered |
| `crm_deals` / TC | thin | Post-lead pipeline |
| Prospecting: expired / FSBO | dedicated tables | Seller acquisition |

**Lead doors (data writers):** LPs, valuation form, contact, alerts, CMA kickoff, Meta/portal → `ensureNativeLead` / events.

**Gap for top-site leads:** inventory/content traffic is high; **alert enrollments (6) and saved searches (2) are near-zero** — conversion product not absorbing demand.

---

### 1.6 Engagement & measurement

| Store | What it proves |
|-------|----------------|
| `visitor_sessions` | Real on-site sessions (thousands/day first_seen); engagement_score; UTM/referrer/landing |
| `visitor_events` | page_view paths, listing_view, scroll — feeds hot-lead scoring |
| `web_vitals` | ~323k rows — CWV field data |
| GA4 `G-ST40W4WM6T` | **Undercounts** vs first-party (consent + blockers) — ops secondary until fixed |
| GSC API | Organic clicks/impressions — discovery health |

**Scoreboard mapping:**

| Goal | Primary data |
|------|----------------|
| Traffic | GSC + visitor_sessions |
| Engagement | visitor_sessions.engagement_score, multipage events |
| UX | web_vitals + lab |
| Leads | crm_people created, cmas delivered, listing_alerts, form events |

---

### 1.7 Sync / trust (§0)

| Store | Role |
|-------|------|
| Spark → listings | Source of inventory truth |
| `sync_history` / sync_state | Freshness banners |
| `admin_overrides` on listings | Survive sync (P12) |
| Methodology on pulse | SFR-only, versioned — show on market pages |

---

## 2. Page slot → data source matrix

| Page family | Layer A numbers | Body modules (data-backed) | Lead hooks (data-backed) |
|-------------|-----------------|----------------------------|---------------------------|
| **Homepage** | Region pulse active/median/DOM | Towns from city snapshots; communities registry; featured tiles; map geojson; ticker from activity; market HUD | Valuation form; browse |
| **City** | City pulse + snapshot | Map pins; featured/search; neighborhoods; communities; charts from stats_cache; FAQ from buildMarketFaq; articles | Alerts (underused); valuation; contact |
| **Neighborhood** | Nbhd pulse if exists else parent city labeled | Boundary map; tiles in polygon; market HUD scoped | Same |
| **Community (resort)** | Community snapshot + city pulse | Resort registry content; map; open houses; schools; activity | Buy CTA; community alerts |
| **Search / listing** | Result counts from search RPC | Tiles MV; facets; detail 157+ fields; history; similar; video | Contact; tour; valuation |
| **Price drops** | Drop counts from activity_events | Drop tiles + map | Alerts; valuation |
| **Open houses** | Count from open-house DAL | Calendar + map | Alerts |
| **Market report** | Pulse + stats_cache + history | Charts, bands, comparison table, methodology | Alerts; valuation |
| **Sell / valuation** | Optional region pulse context | Plans (config); comps via CMA build | **CMA row** in `cmas` |
| **Blog** | Rare live stats (if embedded) | Post body in DB | Soft CTAs → sell/buy |
| **Park/school/trail/event** | Nearby homes count + city pulse | Registry + geo join listings | Contact / browse |
| **Admin visitors** | — | visitor_* | Hot lead → CRM |

If a module has **no DAL function**, it is not a public claim.

---

## 3. What we can claim (and cannot)

### 3.1 Safe claims (data-backed)

- Active SFR inventory counts per city/region (pulse/snapshot)  
- Median list / days to pending / months of supply (pulse, methodology disclosed)  
- Price reductions in last N days (activity_events)  
- Open houses on calendar (when field present)  
- Homes with video tours (has_virtual_tour)  
- “Written CMA: 3 closed + 3 active comps” when built by `buildCma`  
- Broker names/phones from brand contact + broker records  
- Blog topics and community pages as published  

### 3.2 Unsafe without new data work

- HOA fee amounts (GSC winners ask this — **not** in MLS pulse; needs research registry or sourced blog with citations)  
- School ratings (use linked GreatSchools etc., not invented scores)  
- Crime stats, demographics steering (fair housing)  
- “#1 brokerage” / volume leaderboards without verified SoT  
- Every MLS community name as a full landing page (1,848 rows ≠ product)  
- Coming Soon inventory on public sitemap (policy excluded)  

### 3.3 Underused data (conversion gold)

| Asset | Scale | Opportunity |
|-------|-------|-------------|
| `listing_alerts` | 6 rows | Capture buyers from high traffic search/city pages |
| `saved_searches` | 2 | Account product |
| `has_virtual_tour` active | 1,026 | Video-first surfaces for engagement |
| `cmas` | 271 | Social proof of process (anonymized counts OK if accurate) |
| `activity_events` | 33k | Homepage/city “what just happened” engagement |
| Pulse neighborhoods | 28 | Deeper Bend area pages with real MoS |
| Blog 87 + GSC | proven | Internal link into city/community + valuation |

---

## 4. Data → top-site phases

| Phase | Goal | Data dependency |
|-------|------|-----------------|
| **P1 Nav** | Findability | No new tables — site-nav only |
| **P2 Layer A** | SEO shell | Read pulse/snapshot only — restore H1s with live numbers |
| **P3 Page product** | Parity + moat | Wire existing DAL into every slot; no new warehouse |
| **P4 Measurement** | Trust numbers | visitor_* already rich; repair GA4 dual-write or consent |
| **P5 UI 2026** | Engagement | Same data, better presentation; charts from existing series |
| **P6 Conversion** | Leads | Enroll alerts; CMA path; CRM first-touch already on atlas |
| **P7 Authority** | Traffic quality | Blog/HOA/community facts need **curated** tables or sourced posts, not MLS alone |

---

## 5. Architecture rules for implementers

1. **Public pages read only `@/lib/data` (and approved registries).** No raw Supabase in `app/**/page.tsx` (existing page-dal gate).  
2. **Prefer matviews/pulse over scanning `listings`.** Cards = `listing_tile_mv`; market = pulse/stats_cache.  
3. **Poison-null:** DAL resilient cache pattern — never cache empty as truth (`getGeoSnapshot` / `getListingDetail`).  
4. **SFR honesty:** When pulse is SFR-only, copy and JSON-LD must not say “all homes.”  
5. **Freshness:** Surface `updated_at` / `refreshed_at` where pulse is shown (AEO + trust).  
6. **Identity:** Lead write paths go through ensureNativeLead / governed send — not ad-hoc inserts.  
7. **Sitemap:** Emit from same universe builders as product (registry + snapshot thresholds), not from nav.  

---

## 6. Live “Bend money page” data pack (example)

What a correctly data-fed Bend city page can show **today** without new schema:

| Slot | Source | Example values (probe) |
|------|--------|------------------------|
| Active SFR | `market_pulse_live` city bend | ~490 |
| Median list | pulse | ~$750,000 |
| Median days to pending | pulse | present on row |
| Months of supply | pulse | present; methodology v3 SFR |
| New 7d / 30d | pulse | ~42 / ~145 |
| Map + cards | listing_tile_mv search | live |
| Price drops | activity_events | region/city filters |
| Neighborhood MoS | pulse geo_type neighborhood | e.g. SW Bend 29 active, MoS 6.44 |
| Articles | blog_posts | GSC winners linked |
| Team / reviews | brand + testimonials pipeline | |
| CMA CTA | creates/reads `cmas` | |

UI modernization (P5) restyles this pack; it must not replace sources.

---

## 7. Gaps that need data work (explicit backlog)

| Gap | Blocks | Suggested direction |
|-----|--------|---------------------|
| HOA / fee facts not structured | GSC query winners | Curated `community_facts` or sourced blog only |
| Neighborhoods table thin | Area depth | Expand boundary pipeline + pulse already partial |
| listing_alerts / saved_searches cold | Lead capture | Product + UX on search/city |
| UA/geo null on many visitor_sessions | Bot filtering | Restore capture on track endpoint |
| GA4 ≪ first-party | Ops trust | Measurement Protocol dual-write |
| Child sitemap cold latency | GSC errors:1 risk | Warm cron already; verify reliability |
| `communities` 1848 vs 20 pages | SEO confusion | Keep curated public set; no mass pages |

---

## 8. Related docs

| Doc | Role |
|-----|------|
| `TOP_SITE_GOAL_SYSTEM.md` | Outcomes + phases |
| `PAGE_IA_COMPONENT_MATRIX.md` | Nav + UI slots |
| `ADMIN_PRODUCT/data-atlas.md` | CRM/process writer→reader chains |
| `lib/data/**` | Implementation SoT |
| `marketing_brain_skills/brand-voice/VOICE.md` | Layer A/B claims discipline |

---

## 9. Bottom line

- The warehouse is **already a competitive weapon** (~595k listings, live pulse, activity, geo snapshots, CMA, content, first-party behavior).  
- **Top site** work is mostly: **surface the right data in Layer A**, **route humans through Buy/Areas/Market/Sell**, **convert with alerts+CMA+CRM**, **measure with visitor_*** + GSC**, **present with 2026 UI on locked brand**.  
- Do not plan features that require data we do not have (HOA tables, full community set, national coverage). Do plan features that **light up underused tables** (alerts, video tours, neighborhood pulse, blog→city internal links).

*Probe timestamp: 2026-08-10. Re-run counts before any public claim about “X active homes” in marketing decks; always load live pulse on the page.*
