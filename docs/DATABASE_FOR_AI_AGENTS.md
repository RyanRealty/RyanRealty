# Ryan Realty Database — Agent Reference

**Read this BEFORE writing any SQL or building any market report against the Ryan Realty database.** This is the canonical guide for AI agents (Claude Code, Cursor, scheduled-task agents) and human developers. If something here contradicts older notes, this file wins.

- **Supabase project:** `dwvlophlbvvygjfxcrhm` (hostname `dwvlophlbvvygjfxcrhm.supabase.co`, project name `ryan-realty-platform`)
- **Source of truth for resort communities:** [data/resort-communities.json](../data/resort-communities.json)
- **Methodology current:** `v4-2026-05-15` (rows in `public.cache_methodology_definitions`)
- **Listings:** 589K+ rows (every MLS listing past + present, Oregon Data Share)
- **PostGIS:** 3.3.7 installed; polygons live in `public.boundaries`

---

## 0. The 30-second answer — "I need X, where do I look?"

| What you need | Where to query | Key columns | Freshness |
|---|---|---|---|
| **Size of the CO market ($ volume, composition, year)** | **`analytics_mart_market_annual`** via `getCoMarketAnnual` / `getCoMarketAnnualSeries`. This is the shipped sales cube (plans still say `sales_cube_*` — those tables were never created). Public reads are mart-only: no `listings` scan. Rows exist **1998–present**. | `year`, `type_scope` (`all`/`sfr`/`multi`/`land`/`other`), `sold_count`, `total_volume`, `median_close`, `property_type_breakdown` | Nightly last 2 years; `scripts/analytics/rebuild-analytics-marts.mjs --from Y --to Y` for history |
| **Fireplace / garage / HOA-class history** | **`analytics_mart_feature_annual`** via `getCoFeatureAnnual`. Mart-only on the request path. Rows exist **1998–present**. | `year`, `type_scope`, `feature_key`, `sold_count`, `total_volume` | Same rebuild |
| **Unique closed-sales search** (year × city × type × amenity) | **`analyzeClosedSales`** → `analytics_result_cache` then mart then `analyze_closed_sales_co` RPC. Never page `listings`. | aggregates only | Cache + RPC |
| **Brokerage / broker market share** | **`analytics_mart_office_share_annual`** + dims. Admin only (`/admin/analytics/competition`). **No public competitor names** (Matt I6). | office/agent share | Same rebuild |
| **Market report for a city** (Bend, Redmond, Sisters…) | `market_stats_cache WHERE geo_type='city' AND geo_slug=<slugified-city>` | `period_type`, `sold_count`, `median_sale_price`, `median_dom` | ≤ 6h |
| **Market report for a resort community** (Tetherow, Sunriver, Eagle Crest, Pronghorn, …) | `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug=<bare-slug>` — see §3a for the 14 valid slugs | same | ≤ 6h |
| **Market report for a Bend neighborhood** (Awbrey Butte, Larkspur, …) | `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug='bend-<slug>'` | same | ≤ 6h |
| **Live active/pending inventory** for cities + region + neighborhoods | `market_pulse_live WHERE geo_type IN ('city','region','neighborhood') AND property_type='A'` | `active_count`, `pending_count`, `months_of_supply` | ≤ 10–15 min |
| **Property details for one listing** | `listings WHERE "ListingKey" = ?` (note: PascalCase columns MUST be double-quoted — see §4) | every Spark MLS field | ≤ 10 min |
| **Active listings in a community** | `listings WHERE "SubdivisionName" = ANY(<aliases from neighborhood_subdivisions>) AND "StandardStatus" IN ('Active','Coming Soon','Active Under Contract')` | see §3a for the aliases | ≤ 10 min |
| **Comparable sales (CMA)** | **`sale_pricing_facts`** (all years, Central Oregon closed A) via `selectPricingFactsPool` / `selectPricingComps`. Fallback: `listings WHERE "StandardStatus"='Closed'` | close_price, concessions_amount, concessions_yn, seller_net (view `sale_pricing_seller_net`), close_ppsf, water/sewer/hoa/lot/story classes, original_ask, drop_count | facts refresh 6h; listings ≤ 10 min |
| **Listing-page market read** | **`listing_pricing_reads`** via `getListingPricingRead`. Do not walk the matcher on the request. Published CMA wins when present. | kind, range_low/high, delta_pct, n, refuse_reason | stamped on the facts cron, 6h stale |
| **Market-path time adjustment** | **`pricing_market_index`** (monthly median $/sqft per city, 1996+) | `month`, `n`, `median_ppsf`, `median_sale_to_original` | rebuilt after facts refresh |
| **Subdivision gated $/sqft cut** | **`pricing_subdivision_cells`** via `getPricingSubdivisionCells`. Window from `pricing_index_window.cells_since` | `median_ppsf`, `n` | rebuilt after facts refresh |
| **Polygon for a community** | `boundaries WHERE geo_type=<type> AND geo_slug=<slug>` | `polygon` (PostGIS geometry) | manual |
| **Homes inside a boundary** (map pins + "homes for sale" cards on city/neighborhood/community pages) | `listing_boundary_xref_mv WHERE geo_type=<type> AND geo_slug=<slug> AND standard_status='Active'` — via the `listings_in_boundary` RPC, wrapped by the `getGeoBoundaryMapData` DAL. **NEVER `ST_Within` against `listings` at request time** (it blows the anon 3s timeout — see §4d). | `listing_key`, `lat`, `lng`, `list_price` | ≤ 15 min (refreshed by `/api/cron/refresh-mvs`) |
| **Public Bend-district homes-for-sale count** (index tile + place hero + FAQ) | `listing_boundary_xref_mv` via `getNeighborhoodPublicInventory` / `getBendNeighborhoodPublicInventory` — SFR (`property_type='A'` AND `property_sub_type='Single Family Residence'`) + `PUBLIC_ACTIVE_STATUSES`. Same payload on `/neighborhoods`, `/cities/bend` tiles, and `/cities/bend/{slug}`. **Not** `market_pulse_live.active_count` (includes Coming Soon — G27) and **not** `listing_tile_mv.boundary_neighborhood` (different polygon). | `activeCount`, `medianListPrice`, `listingKeys` | ≤ 15 min (xref MV) + 15 min DAL cache |
| **Public registry-plat homes-for-sale count** (index tile + place hero + `#homes`) | `listing_tile_mv` via `getPlatPublicInventory` / `getRegistryPlatPublicInventory` — MLS `SubdivisionName` plus registry city aliases (`citySlug` and parent community slug). `listings.City` may be the resort name (South Meadow files as Black Butte Ranch, registry city Sisters). SFR (`property_type='A'` AND `property_sub_type='Single Family Residence'`) + `PUBLIC_ACTIVE_STATUSES`. Same payload on `/subdivisions` tiles and `/subdivisions/{slug}`. **Not** `geo_snapshot_mv.active_sfr_count` (Active-only, no keys), **not** a featured-fetch cap, and **not** `listings_in_boundary` pin length (all types). | `activeCount`, `medianListPrice`, `listingKeys` | ≤ 15 min (tile MV) + 15 min DAL cache |
| **Region SFR pulse vs city-row remainder** (hub / region report / annual review) | `market_pulse_live` region row + every city row via `getMarketPulseAllCitySnapshots`, named by `namePulseCityRemainder`. Region uses `is_central_oregon_city("City")`. City rows clip to the TIGER polygon when one exists. A page that prints both must name omitted cities and the remainder. | omitted city `active_count`, `remainder` (region − sum of city rows) | ≤ 10–15 min |
| **City cache slug from a URL** (`/housing-market/la-pine`, `/homes-for-sale/la-pine`) | `canonicalCityCacheSlug` in `lib/market/city-cache-slug.ts` — space-form `lower("City")` (`la pine`). Never pass the hyphen URL slug to `getMarketPulse` / `getPriceHistory` / `getCityMarketDetail` for `geo_type='city'`. Hyphen leftover rows are a retired polygon-scoped convention. | `geo_slug` | n/a (pure) |
| **May this pulse months-of-supply figure print?** | `publishMonthsOfSupply` in `lib/market/publish-months-of-supply.ts`. Pulse MOS uses that row's `active_count`. Withhold when the page count differs (alias-aware / boundary inventory) or when implied six-month closes exceed a printed 12-month sold count. Do not invent a 12-month MOS under the same public label. | `months_of_supply`, `active_count`, `sold_count` | n/a (pure) |
| **Which annual HOA may a place page print?** | `publishPlaceHoa` in `lib/market/publish-place-hoa.ts`. Master assessment (`hoa_master_assessment_annual` / `hoaMasterAnnual`) wins. Else the floor of registry `hoa_annual_estimate` values. Glance and FAQ must share that annual. Phase totals stay on phase / LP pages. | `hoaMasterAnnual`, `hoa_annual_estimate` | n/a (pure) |
| **What caption may a list median print?** | `publishSellMedian` in `lib/market/publish-median-caption.ts`. The caption names the number's grain. "Regional median" only for the region pulse. A place number under that label is a different set. Empty membership facts withhold via `publishFactValue`. Public chart sources use `toPublicCoreChartSeries` (Oregon Data Share + human geography, no table names). | `median_list_price` | n/a (pure) |
| **May a city report print this-month median sale?** | `publishCompleteMonthMedian` + `getCompleteMonthlyMarketDetail`. Current-month `market_stats_cache` monthly row only when `median_sale_price` is verified. Else last complete month, labeled `{Month} median sale`. Do not invent a median for sold_count with a null price. | `median_sale_price`, `period_start` | ≤ 6h |
| **May a plat page print pending days or a parent median as its own?** | `publishPlatFigures` in `lib/market/publish-plat-figures.ts`. Live plat figures are the counted SFR set (`getPlatPublicInventory`). City/community pulse is a different geography. Days-to-pending and 30-day sold withhold (no plat pulse row). | plat `medianListPrice` | n/a (pure) |
| **What active count and list median may a registry resort print on an index tile?** | `publishResortIndexFigures` in `lib/market/publish-resort-index-figures.ts` via `getRegistryResortPublicFigures`. Alias-aware SFR tiles (`resortActiveSfrCounts` / `resortTilesForSlug` on `fetchAllCityActiveSfr`). Same pair on homepage featured cards, `/communities` flagship + A-Z, `getCommunityBySlug`, and `/communities/{slug}`. **Not** `geo_snapshot_mv.active_sfr_count` (literal SubdivisionName). | alias-aware `activeCount`, `medianListPrice` | ≤ 15 min (tile MV) + 15 min cache |
| **What down payment and loan may a listing print?** | `publishFinancingSplit` in `lib/finance/publish-down-payment.ts`. Whole-dollar down from list price × percent. Loan is the remainder so the two sum to the listed price. Monthly payment, rental analysis, the standalone mortgage calculator, and showcase payment share that split. Display exact dollars, never nearest-thousand. | list price + down % | n/a (pure) |
| **What monthly HOA may a listing print?** | `publishListingHoa` in `lib/listing/publish-listing-hoa.ts`. Prefer `hoa_monthly`. Else normalize `association_fee` by frequency. Facts, True cost, and the listing rental-analysis HOA field share that monthly (`publishRentalHoaMonthly`). Display exact dollars, never nearest-thousand. | `hoa_monthly`, `association_fee` | n/a (pure) |
| **What asking price may a listing print?** | `publishListingAsk` / `publishListingDrop` in `lib/listing/publish-listing-ask.ts`. Exact whole-dollar `ListPrice`. Drop is exact original minus exact ask. H1, drop line, JSON-LD, and payment share that ask. | `ListPrice`, `OriginalListPrice` | n/a (pure) |
| **What compact hero price and spec line may a listing print?** | `publishListingHeroCompactPrice` / `publishListingHeroKeyStats` in `lib/listing/publish-listing-hero-stats.ts` (compact via `formatPriceCompact`). Never `$1000K`. Acres print only when beds/baths/sqft are absent. Do not invent beds from a sibling MLS row. | `ListPrice`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `lot_size_acres` | n/a (pure) |
| **Which key may a listing contact href use?** | `publishListingContactKey` in `lib/listing/publish-listing-contact-key.ts`. Public id is `ListNumber`. `/contact?listingKey=` resolves ListingKey or ListNumber. | `ListNumber`, `ListingKey` | n/a (pure) |
| **What price/status timeline may a listing detail print?** | `publishListingHistory` via `getListingDetailHistory`. Merge `listing_history` + live `status_history` + `price_history` + `OnMarketDate`/`ListPrice`. Do not read `listing_history` alone (recent rows are empty until strict verify). | `event`, `event_date`, `price` | delta ≤ 10 min; Spark history when verified |
| **Which URL opens the regional homes set the homepage names?** | `publishRegionalSearchHref` in `lib/search/publish-regional-search-href.ts` → `/homes-for-sale?view=list`. Split/map `/homes-for-sale` injects city=Bend when the URL has no city. A control next to the region count must not use the bare path. | n/a | n/a (pure) |
| **Which subdivisions roll up into a community** | `neighborhood_subdivisions WHERE neighborhood_slug=<slug>` | `subdivision_label` (the MLS SubdivisionName values) | manual |
| **Is this a resort community?** | `subdivision_flags WHERE entity_key='<city>:<slug>'` | `is_resort` | manual |
| **Methodology trace for any cache row** | `cache_methodology_definitions WHERE version=<version>` | `scope`, `definitions`, `notes` | every cache row carries `methodology_version` |
| **Spark MLS API reference** | [docs/SPARK_API_REFERENCE.md](SPARK_API_REFERENCE.md) | n/a | n/a |
| **CRM people on a TC deal** (who is on this file) | `tc_deal_people` by `deal_id` or `person_id` — DAL `getDealParties` / `getDealsForPerson` / `getPartyNamesByDealIds` | `deal_id`, `person_id`, `role` (`buyer` / `seller` / `other`). Unique `(deal_id, person_id)`. | live writes |
| **Did OREF / ODS / Oregon Realtors revise a form?** | `tc_form_catalog_items` + `tc_form_versions.update_available` — apply a catalog on `/admin/forms` | `disposition` (`current` / `updated` / `new` / `retired`), `source_form_id`, `source_version_id` | last catalog paste |
| **Company improvement experiment / class confidence** | `site_improvement_ledger` via `insertImprovementLedgerRow` / `getChangeClassConfidence` / `collectCompanyScoreboardSignals` (`lib/data/loop/`). Weekly packet: `docs/plans/COMPANY_SCOREBOARD.md`. A new public stat must land on one DAL and every blast-radius plane that will show it. | `domain` (closed set of 12), `change_class`, `predicted_delta`, `actual_delta` | per ship; window then learn |
| **Listing alerts / saved-search sends** | `listing_alerts` via `lib/data/leads/listingAlerts.ts`. Do not send from legacy `saved_searches`. | `filters`, `filters_hash`, `crm_person_id`, `notification_frequency`, `is_active` | live |
| **Did this visitor become a known person?** | `visitor_identity_map` + `crm_people` (Google / email-click / form). Same row feeds CAPI and Meta audiences. Path: `docs/MARKETING_LEAD_FLOW.md` §9. | `rr_vid`, `crm_person_id`, `user_id`, `identify_source` | live |
| **CRM funnel stage mix** | `crm_people.stage` via `collectCompanyScoreboardSignals` (packet). Entry stage is **Lead** (`buildNativePersonRow` / trigger `native-create`). Advance to Nurture on `sequence-enroll` or `first-outbound` (`advanceJourneyStage`). Do not backfill the historical book. | `stage` | live |
| **Did they open or click what we sent?** | `email_events` (`event` = `open` / `click`) | `recipient_email`, `person_id`, `occurred_at` | live webhook |
| **Is the SkySlope recon mirror current?** | `skyslope_transactions` via `getSkySlopeMirrorFreshness` / `refreshSkySlopeMirrorInbound` (`lib/data/tc/skyslope-mirror.ts`). Inbound Files API only. Vault (`tc_deals`) is the deal SoR. | `synced_at`, `property_key`, `stage` | daily cron `/api/cron/skyslope-mirror-refresh`; current means under 36 hours |
| **Is the Meta audience heartbeat holding?** | `meta_audience_log` via `readMetaAudienceHold` / `computeAudienceHold` (`lib/data/loop/meta-audience-hold.ts`). Same `crm_people` list feeds CAPI. Spend stays Matt-gated. | `ran_at`, `audience_id`, `dry_run`, `add_num_received` | daily crons `meta-audience-sync` 09:00 UTC + `meta-westside-audience` 14:00 UTC; current means under 36 hours; KEEP needs 7 consecutive UTC days ending ≥ 2026-08-22 |
| **/join visits and conversions** | `visitor_events` via `getJoinConversionStats` / `readJoinConversionStats` (`lib/data/loop/join-conversion.ts`). Visits = distinct sessions with `page_url` path `/join` (`page_view` / `section_view`). Conversions = `event_type='join_convert'` (contact form `Join the team` or a phone tap on `/join`). Fleet-test rows (`metadata.fleetTest`) are excluded. Packet + `/admin/today` read this DAL only. | `event_type`, `page_url`, `session_id`, `event_at`, `metadata.channel` | live |
| **Video park-or-rebuild docket (CAP-017 / M3)** | `docs/plans/ENTERPRISE_MAP/video-decision-docket.json` via `readVideoDecisionDocket` (`lib/data/loop/video-docket.ts`). Packet + `/admin/loop` read this DAL only. Park = incremental vendor $0 (R-045 stays). Rebuild = ElevenLabs Turbo $0.05/1k + $5/row cap; requires changing R-045. Decision stays `pending` until Matt answers M3. | `park.incrementalVendorUsd`, `rebuild.elevenLabsTurboUsdPer1kChars`, `decision.status` | docket stamped 2026-08-16 |
| **Integration health (INT-021…036 unknowns)** | `docs/plans/ENTERPRISE_MAP/integration-health-probes.json` via `readIntegrationHealth` (`lib/data/loop/integration-health.ts`). Packet + `/admin/loop` read this DAL only. Accept is health-counts **unknown = 0**. Green: OpenAI / xAI / Unsplash / Replicate+Synthesia / AdSense. Park: Sentry stub, NeverBounce, VAPID. | `unknownCount`, `rows[].health`, `rows[].evidence` | probed 2026-08-16 |

> **Don't aggregate raw `listings` for market reports.** The cache tables exist exactly so you don't have to. They're stamped with `methodology_version` and refreshed every 6 hours. Use them.

---

## 1. Mental model — how data flows

```
                ┌─────────────────────────────────────────┐
                │  Spark MLS (Oregon Data Share)          │
                │  replication.sparkapi.com/v1            │
                └────────────────────┬────────────────────┘
                                     │ /api/cron/sync-delta every 10 min
                                     ▼
                ┌─────────────────────────────────────────┐
                │  public.listings (589K rows)            │
                │  raw MLS field-by-field, ~130 columns,  │
                │  + 30 computed metrics + boundary tags  │
                └────────────────────┬────────────────────┘
                                     │ refresh_market_pulse() after every sync
                                     ▼
                ┌─────────────────────────────────────────┐
                │  public.market_pulse_live               │
                │  ONE row per (geo_type, geo_slug,       │
                │  property_type)                         │
                │  city + region + neighborhoods          │
                │  active/pending/new counts, MoS, etc.   │
                └─────────────────────────────────────────┘

                ┌─────────────────────────────────────────┐
                │  public.listings (same source as above) │
                └────────────────────┬────────────────────┘
                                     │ /api/cron/refresh-market-stats every 6h
                                     │ calls compute_and_cache_period_stats(...)
                                     ▼
                ┌─────────────────────────────────────────┐
                │  public.market_stats_cache              │
                │  ONE row per (geo_type, geo_slug,       │
                │  period_type, period_start)             │
                │  for every city + region + 14 resort    │
                │  communities + 14 Bend neighborhoods    │
                │  × 6 period types (rolling_30d/90d/365d │
                │  + monthly + quarterly + ytd)           │
                └─────────────────────────────────────────┘

GEOGRAPHY SOURCE-OF-TRUTH (manually curated, rarely changes):

  public.boundaries           — PostGIS polygons (geo_type ∈ {city, neighborhood, subdivision})
  public.neighborhood_subdivisions  — parent→child SubdivisionName aliases for resort/neighborhood reports
  public.subdivision_flags    — is_resort flag (entity_key = 'city:slug')

  Registry: data/resort-communities.json (the canonical list — 14 resort/area communities, 100 aliases)
```

**Three things to internalize:**

1. **`listings`** is raw + heavy. Never `SELECT *` on it. Use the cache tables for any aggregation.
2. **`market_pulse_live`** is fast-moving inventory snapshots (refreshed every 10–15 min). City + region via `refresh_market_pulse()`; neighborhood (14 resorts + Bend districts) via `refresh_community_market_pulse()` (BL-016).
3. **`market_stats_cache`** is period-anchored historical analytics (refreshed every 6 hours by `/api/cron/refresh-market-stats`). It carries every level: city, region, neighborhood (resort communities + Bend districts), subdivision.

---

## 2. Every table, grouped by purpose

> Row counts are approximate at 2026-05-15. `rows=0` doesn't mean unused — many tables are written by user actions and stay near-zero in our dev/staging-shaped data.

### 2a. Geographic source-of-truth (where polygons + aliases live)

| Table | Rows | Purpose |
|---|---|---|
| `public.boundaries` | 3,251+ | Polygons. `geo_type ∈ {city, neighborhood, subdivision, school_district, park, …}`. **10 cities** (TIGER/Line), **28 neighborhoods** (14 Bend districts + 14 resort communities), **3,213 subdivisions** (Deschutes County GIS plats), **6 school districts** (Oregon Dept. of Education, W2.7). PostGIS geometry in `polygon` (MULTIPOLYGON, SRID 4326). **Trails are NOT a `boundaries` geo_type** — see `public.trail_lines`. |
| `public.trail_lines` | 18 | **Authoritative trail LINEWORK** (MultiLineString 4326) from USFS / BPRD / BLM. W2.7 decision (2026-07-24): do **not** invent a `geo_type='trail'` polygon corridor — that would be buffered geometry we made up. Keep trails here; `ci:boundary-provenance` bans `trail` as a boundaries geo_type. |
| **`public.listing_boundary_xref_mv`** ⭐ | ~9.3K | **Precomputed listing→boundary spatial join** (mig `20260529020000`). ONE row per (boundary, on-market listing inside it): `(geo_type, geo_slug, listing_key, lat, lng, list_price, standard_status, property_type)`. Overlapping polygons (e.g. a Bend district AND the Tetherow resort, both `geo_type='neighborhood'`) each get their own row, so resort listings are correctly attributed even though their MLS `SubdivisionName` aliases collapse the `listing_tile_mv.boundary_neighborhood` column to the Bend district. **This is what the `listings_in_boundary` RPC reads** — a trivial indexed lookup, NOT a request-time `ST_Within`. Refreshed CONCURRENTLY by `/api/cron/refresh-mvs` (≤15 min). The boundary-map pins + "homes for sale" cards on every city/neighborhood/community page come from here via the `getGeoBoundaryMapData` DAL. |
| `public.neighborhood_subdivisions` | 1,686 | Parent → child SubdivisionName aliases. For each `neighborhood_slug`, lists the `subdivision_label` values that aggregate under it. Resort communities (e.g. `tetherow`) have multiple aliases (Tetherow, Sunrise Village, Braeburn, …). Bend neighborhoods (e.g. `bend-awbrey-butte`) have many subdivision-plat names that fall inside the City of Bend district polygon. |
| `public.subdivision_flags` | 14 | `entity_key='city:slug'`, `is_resort` boolean. Used by consumer code to route a (city, subdivision) request to the neighborhood-level cache for resort/area communities. |
| `public.geo_places` | 0 | Optional hierarchy table (country → state → city → neighborhood → community). Not actively used. |
| `public.cities` | 0 | City master list. Currently unused; `slugify(city_field)` is the canonical city slug. |
| `public.neighborhoods` | 13 | City of Bend neighborhood districts with `boundary_geojson` jsonb. Separate from `boundaries` rows (older spatial system, still consumed by AgentFire neighborhood pages). |
| `public.communities` | 1,848 | Auto-populated from MLS SubdivisionName syncs. Flat list, no parent-child structure. The 14 resort communities are flagged via `subdivision_flags`. |

### 2b. Property data (the source-of-truth listing universe)

| Table | Rows | Purpose |
|---|---|---|
| `public.listings` | **589,193** | Every MLS listing past + present. PK = `ListingKey`. PascalCase Spark columns + ~30 computed/promoted columns. **See §4 for the column quoting rule and tier breakdown.** |
| `public.listing_history` | 200K+ | Spark full-history events. Public listing-detail timelines do **not** read this table alone — `getListingDetailHistory` merges it with live `status_history` + `price_history` + `OnMarketDate` via `publishListingHistory`. Recent listings are often empty here until strict verify. |
| `public.listings_historical` | 0 | Spark `/v1/listings/historical` mirror (off-market/expired/cancelled/withdrawn). Same key fields as `listings`. |
| `public.price_history` | 100K+ | One row per price change event: `old_price`, `new_price`, `change_pct`, `timestamp`. Join via `listing_key`. |
| `public.status_history` | 200K+ | One row per status transition (Active → Pending → Closed, etc.). Join via `listing_key`. |
| `public.listing_photos` | 0 | Per-listing photo metadata. Join via `listing_key`. Photos themselves live in Spark CDN URLs. |
| `public.listing_videos` | 0 | Per-listing video metadata (MLS or ARYEO tours). |
| `public.listing_agents` | 0 | List agent + buyer agent per listing (Spark `ListAgent*`, `BuyerAgent*`). |
| `public.listing_photo_classifications` | 0 | Per-photo tags + quality scores for hero selection. |
| `public.open_houses` | 0 | Open house events from Spark `$expand=OpenHouse`. |
| `public.listing_views` | 0 | Per-pageview tracking for trending homes. |
| `public.listing_inquiries` | 0 | Contact-form submissions from listing pages. |
| `public.listing_shares` | 0 | Public share-link tracking. |
| `public.engagement_metrics` | 0 | Aggregated engagement signals per listing. |
| `public.expired_listings` | 0 | Superuser-only prospecting list with owner contact info. |
| `public.activity_events` | 385 | Sync change events (`new_listing`, `price_drop`, `status_pending`, `status_closed`). Feeds activity feeds + content engine. |
| **`public.sale_pricing_facts`** | growing | **Pricing moat SoR.** One row per closed Central Oregon residential sale, **every year we have (1996+)**. No close-date floor. Classes (water/sewer/hoa/lot/story/product), journey (original ask, drops, pending), remark flags, `concessions_amount` + `concessions_yn`, `new_construction_yn`. Service-role only. Refresh: `refresh_sale_pricing_facts_batch`. Concessions YN backfill: `backfill_sale_pricing_concessions_yn`. Water reclass (Private-only → unknown): `backfill_sale_pricing_water_reclass` drains `sale_pricing_water_reclass_queue`. New-construction: `stamp_sale_pricing_new_construction` + `backfill_sale_pricing_new_construction_yn`. |
| **`public.listing_pricing_reads`** | growing | **Public listing-page stamp.** One row per active Central Oregon SFR. Kind is `listed-over-under`, `unlisted-range`, or `refuse`. The page reads this row and does not walk the matcher. Writer: `stampListingPricingReadsBatch` at the end of `/api/cron/refresh-sale-pricing-facts`. Due keys: `listing_pricing_reads_due` (SFR only: `property_sub_type = 'Single Family Residence'`). Contract `public-v1-2026-08-14` in `lib/pricing/public-contract.ts`. Listed over/under uses comps-implied close, never ask × 0.98. New construction and numbered builder-phase plats refuse. Published CMA wins over this row. Service-role only. |
| **`public.sale_pricing_seller_net`** | view | Same rows plus `seller_net` = close_price minus resolved seller concessions. ClosePrice is the contract price. Concessions do not change it. |
| `public.sale_pricing_water_reclass_queue` | empty | One-time keys stored as `well` under the old SQL (`Private` → well). `backfill_sale_pricing_water_reclass` drains it. Hosted queue hit 0 on 2026-08-14 (46,886 processed). |
| `public.sale_pricing_price_steps` | growing | Deduped ListPrice path per sale, from `listing_history.raw`. |
| **`public.pricing_market_index`** | monthly | City × month median $/sqft / sale-to-original / days-to-offer from facts. The long series for path time-adjustment. `market_stats_cache` monthly is only ~14 months — do not use it as the long index. |
| `public.pricing_subdivision_cells` | last 36 mo | Subdivision median $/sqft for the gated / different-tier cut. Window is `pricing_index_window.cells_since` (stamped by `refresh_pricing_indexes()`), not `CURRENT_DATE` in the MV body (F7). |
| `public.pricing_index_window` | 1 | One-row stamp. `cells_since` is the inclusive close_date floor for `pricing_subdivision_cells`. Service-role only. |

Pricing matcher (`lib/pricing/match.ts`) on top of facts. Refuse a comps-implied close when n&lt;3 — product-wide: `computePricing`, `predictedCloseFromAdjusted`, and `pickCompSource` (facts-ready never falls back to the listings ladder). Drop a fact whose close is under 10% of last ask or over 10× last ask (`56302 Sable Rock` closed $1,625 against last ask $1,680,000). Subject water is PK-bounded `details.WaterSource` via `getListingWaterSource` — typed `listings.water` is null on actives. `{Private:true}` alone is unknown in both JS `classifyWater` and SQL `pricing_classify_water` (Caldera community water and a ranch well share that flag). Well still wins when both tokens are present. Once the search leaves the subdivision, comps must sit in the same City of Bend GIS neighborhood — mapped vs unmapped is a different market (Highway 20 does not fail-open into Boyd Acres). A mile-ring sale with no coordinates is dropped. 1 acre inside a mapped neighborhood is not rural. A 1-acre lot in Redmond / Sisters / Prineville / Madras / La Pine / Culver is not rural (no Bend mesh); ranch (5+ acres) in those towns still is. Unmapped Bend on an acre or more is rural. New construction: year 0–2 wins over `NewConstructionYN=false`; flag true is new; sale-side flag comes from `new_construction_yn` or remarks `flag_new_construction`. Same-subdivision GLA widens to ±30% before a mile ring opens. The quality stop is three tight (±15% GLA) same-subdivision or 1-mile-strict sales — a wide GLA rung does not stop the ladder. Inside a mapped neighborhood the subdivision $/sqft cut tightens to 15% (Awbrey Woods tract $382 vs Awbrey Butte custom $457). Across neighborhoods the 30% gated-expensive cut still applies.

### 2c. Market analytics (the cache — read these, don't compute) ⭐

| Table | Rows | Purpose |
|---|---|---|
| **`public.market_pulse_live`** | ~45 | **Live inventory snapshot**. ONE row per `(geo_type, geo_slug, property_type)`. 29 columns: active_count, pending_count, new_count_7d/30d, median_list_price, months_of_supply, absorption_rate_pct, market_health_score, etc. **City/region:** `refresh_market_pulse()`. **Neighborhoods:** `refresh_community_market_pulse()` (BL-016). ~10–15 min freshness via post-sync pipeline. |
| **`public.market_stats_cache`** | 4,367 | **Period-anchored historical analytics**. ONE row per `(geo_type, geo_slug, period_type, period_start)`. ~40 columns: sold_count, median_sale_price, avg_sale_price, median_dom, percentile_25/50/75 speed, median_ppsf, sale_to_list_ratio, market_health_score, end_of_period_inventory, YoY + MoM deltas, dom_distribution jsonb, price_band_counts jsonb, etc. **Refreshed by `/api/cron/refresh-market-stats` every 6 hours.** Carries city + region + neighborhood (resort + Bend districts) levels. |
| `public.market_narratives` | 0 | AI-generated long-form market commentary tied to a stats row. |
| `public.cache_methodology_definitions` | 2 | **Audit trail for every cache row.** Each version (`v3-2026-05-07`, `v4-2026-05-15`) documents the geography rule, property-type filter, manual overrides. **Every cache row carries `methodology_version` so you can trace what produced it.** |
| `public.cache_backfill_progress` | 0 | Tracks resumable backfill jobs. |
| `public.market_reports` | 0 | Generated long-form market reports (city-level "monthly report" deliverables). |

### 2d. Sync infrastructure (the pipeline)

| Table | Rows | Purpose |
|---|---|---|
| `public.sync_cursor` | 2 | Progress cursor for `/api/cron/sync-full`. Reset via `20260315130000_reset_sync_state.sql` to restart from scratch. |
| `public.sync_state` | 1 | Last successful delta/full sync timestamp. Cron reads `last_delta_sync_at` for `_filter=ModificationTimestamp gt T`. |
| `public.sync_state_by_resource` | 0 | One row per resource type for incremental sync. 10-min cycle reads/writes here. |
| `public.sync_history` | 0 | Admin sync runs: listings / history / photos / full. |
| `public.sync_logs` | 0 | One row per API call for monitoring + debugging. |
| `public.sync_jobs` | 0 | Initial-sync operations. Resumable when `in_progress` and stale. |
| `public.sync_alerts` | 0 | Stall/error alert events. |
| `public.sync_checkpoints` | 0 | `@odata.nextLink` resumable state. |
| `public.sync_year_cursor` | 0 | Progress for `/api/cron/sync-year-by-year` historical backfill. |
| `public.year_sync_log` | 0 | Log of year-by-year sync completions. |
| `public.listing_sync_status` | 0 | Per-listing sub-resource sync flags (photos done? history done?). |
| `public.strict_verify_runs` | 0 | One row per strict-verify cron run; used by admin sync-status report. |
| `public.post_sync_pipeline_runs` | 0 | Audit log of every `run_post_sync_pipeline()` call. |

### 2e. Content (banners, descriptions, attractions)

| Table | Rows | Purpose |
|---|---|---|
| `public.banner_images` | 0 | Maps city/subdivision to AI-generated banner image path in Storage bucket `banners`. |
| `public.hero_videos` | 0 | Aerial flyover video per `entity_key` (city or city:subdivision slug). |
| `public.subdivision_descriptions` | 0 | AI-generated short descriptions per subdivision/neighborhood page. |
| `public.place_attractions` | 0 | Attractions / things to do / coming events per place. |
| `public.page_images` | 0 | Page hero + attribution images. |
| `public.site_pages` | 0 | Editable site content (About page, etc.). |
| `public.ai_content` | 0 | Generic AI-generated content per entity. |
| `public.blog_posts` | 0 | Blog content. RLS allows public read where `status='published'`. |
| `public.blog_settings` | 0 | Single-row config for automated blog publishing. |
| `public.video_tours_cache` | 2 | Precomputed video tour tile payloads. |
| `public.asset_library` | 0 | Index for fetched/generated/rendered media assets. |
| `public.reviews` | 0 | Aggregated reviews from Zillow / Realtor / Yelp / Google. |

### 2f. CMAs + valuations

| Table | Rows | Purpose |
|---|---|---|
| `public.cmas` | 1 | Finalized per-property CMA deliverables. One row per finalized CMA. |
| `public.cma_comps` | 8 | Linking table: comp listings used per CMA. |
| `public.cma_deliveries` | 21 | Delivery tracking (email/print/portal). ⚠️ RLS currently disabled — see §9 security note. |
| `public.valuations` | 0 | Estimated values per property (system-generated). |
| `public.valuation_comps` | 0 | Comps backing a valuation. |
| `public.valuation_requests` | 0 | Home-valuation form submissions. |
| `public.properties` | 0 | Address-deduplicated properties with `geography` for PostGIS radius/CMA. Used by older `resolve_neighborhood_for_point` RPC. |

### 2g. Broker + admin

| Table | Rows | Purpose |
|---|---|---|
| `public.brokers` | 0 | Broker profile records. `profile_id` links to `auth.users`; nullable for imported brokers. The 3 active Ryan Realty brokers (Matt Ryan, Paul Stevenson, Rebecca Peterson) live here. |
| `public.broker_generated_media` | 0 | Synthesia videos / generated photos per broker. |
| `public.headshot_prompts` | 0 | AI prompts for broker headshot variations. |
| `public.brokerage_settings` | 0 | Brokerage-level branding (name, logo, contact). Single row. |
| `public.admin_roles` | 0 | Role-based admin access: `superuser`, `broker`, `report_viewer`. |
| `public.admin_actions` | 0 | Audit log for admin CRUD operations. |
| `public.profiles` | 0 | Extended profile per `auth.users`. `admin_role` controls admin backend access. |

### 2h. User-facing (saved searches, favorites, activity)

| Table | Rows | Purpose |
|---|---|---|
| `public.listing_alerts` | — | THE canonical listing-alert table (unified 2026-07-07, migration `20260707160000_unify_listing_alerts.sql`). Every alert row — guest capture, signed-in save, broker assign, system default — keyed by (email, filters_hash); `notification_frequency` drives the digest cadence. DAL: `lib/data/leads/listingAlerts.ts`. |
| `public.saved_searches` | 0 | LEGACY — survives only for the public-share feature (`is_public`, `public_title`, `cache_listing_keys`, `public_click_count`). Alerts moved to `listing_alerts` July 2026; do not build alert logic against this table. |
| `public.saved_listings` | 0 | User-favorited listings. One row per (user, listing_key). |
| `public.saved_communities` | 0 | User-favorited communities (`entity_key='city:subdivision'`). |
| `public.saved_cities` | 0 | User-favorited cities (`city_slug='bend'`, `'sunriver'`, etc.). |
| `public.likes` | 0 | Per-listing like events. Realtime-enabled for live counts. |
| `public.liked_communities` | 0 | Per-community like events. |
| `public.user_collections` | 0 | User-named collections grouping saved listings. |
| `public.user_buying_preferences` | 0 | Down payment %, interest rate, term — feeds est. monthly payment on listings. |
| `public.user_events` | 0 | Product analytics: page_view, listing_view, listing_click, save, like, share, search. |
| `public.user_activities` | 0 | Master activity log (view/save/like/share/search). `user_id` nullable for anonymous. |
| `public.listing_views` | 0 | Per-pageview tracking (for trending). |
| `public.listing_inquiries` | 0 | Contact-form submissions. |
| `public.open_house_rsvps` | 0 | RSVPs for open houses (high-intent signal). |
| `public.visits` | 0 | Site-visit telemetry. |
| `public.push_subscriptions` | 0 | Web Push (PWA notifications). |
| `public.community_engagement_metrics` | 1,383 | Aggregated engagement per community (`entity_key='city:subdivision'`). Service-role writes from server actions. |

### 2i. Marketing brain + content engine

| Table | Rows | Purpose |
|---|---|---|
| `public.marketing_brain_actions` | 5 | The single source of truth for every marketing/content/site/ops/comms action the marketing brain produces. **See [CLAUDE.md §Marketing Brain Architecture](../CLAUDE.md) for the protocol.** |
| `public.marketing_decisions` | 11 | Decision-log for marketing-brain actions. |
| `public.marketing_channel_daily` | 207 | Per-channel daily metrics (impressions/clicks/leads). |
| `public.marketing_inbox_events` | 0 | Inbound marketing events. |
| `public.content_calendar` | 0 | Planned content per week. |
| `public.content_performance` | 0 | Per-deliverable performance metrics (48h post-publish). |
| `public.content_classification` | 0 | AI classification of content. |
| `public.competitor_intel` | 0 | Competitor activity tracking. |
| `public.audit_runs` | 0 | Per-audit invocation log. |
| `public.agent_insights` | 0 | AI-generated insights for admin dashboard. |
| `public.email_campaigns` | 0 | FUB/Resend campaign tracking. |
| `public.notification_queue` | 0 | Outbound notifications (saved_search_match, price_drop). Processed every 30s. |
| `public.optimization_runs` | 0 | Eternal optimization loop run log. |

### 2j. Social OAuth tokens

| Table | Rows | Purpose |
|---|---|---|
| `public.tiktok_auth` | 0 | TikTok Business OAuth tokens. |
| `public.google_business_profile_auth` | 0 | GBP OAuth. |
| `public.youtube_auth` | 0 | YouTube Data API tokens. |
| `public.linkedin_auth` | 0 | LinkedIn Pages tokens. |
| `public.x_auth` | 0 | X (Twitter) tokens. |
| `public.pinterest_auth` | 0 | Pinterest Business tokens. |
| `public.threads_auth` | 0 | Threads OAuth. |
| `public.nextdoor_auth` | 0 | Nextdoor Business Share API tokens (single row at `id='default'`). |

### 2k. Config + misc

| Table | Rows | Purpose |
|---|---|---|
| `public.app_config` | 0 | Runtime-configurable parameters (mortgage_rate, insurance_rate, default_tax_rate, etc.). Read by RPCs that compute affordability. |
| `public.settings` | 0 | Generic key-value site config. |
| `public.tc_sessions` | 0 | Transaction Coordinator Pipeline session log. `thread_id` enables follow-up email context. |
| `public.tc_deal_people` | 0 | **Many CRM people on one Vault `tc_deals` row.** Unique `(deal_id, person_id)` — dual-intent is still one person on that file. Two houses = two deals. Roles: `buyer` / `seller` / `other`. RLS on, no policies: service-role only (same as other `tc_*`). Does not write SkySlope and does not revive `tc_deals.fub_person_ids`. Reads: `getDealParties`, `getDealsForPerson`, `getPartyNamesByDealIds` in `lib/data/tc/deal-people.ts`. Per §0. |
| `public.tc_form_libraries` | 4 | OREF / ODS / Oregon Realtors / RR. `source_library_id` is the SkySlope Forms library id (1340 / 1528 / 1837). |
| `public.tc_form_versions` | 111 | Licensed blanks + field maps. `source_form_id` is stable across revisions; `source_version_id` changes. `update_available` is set by the catalog check. |
| `public.tc_form_catalog_items` | 0 | Last published catalog row per source form. Disposition `current` / `updated` / `new` / `retired`. |
| `public.tc_form_catalog_checks` | 0 | One row per library per catalog check (counts only). |
| `public.spatial_ref_sys` | 0 | PostGIS system table. RLS off (PostGIS-required; harmless). |

**`tc_deal_people` note (Track 2 P2, 2026-08-14).** A transaction has more than one person. Dual-intent is still one `crm_people` row: the unique key is `(deal_id, person_id)`, so the same person cannot be buyer and seller on the same file. Two houses are two `tc_deals` rows. Roles are only `buyer`, `seller`, and `other`. Spouse / partner / co-buyer / sibling ride the primary's side; agents and everyone else are `other`. Vault is SoR. SkySlope is not written. Closings board names come from `getPartyNamesByDealIds`. Create from the person page (`StartDealForm` → `createDealWithPeople`); add/remove on the deal page (`DealParties`, above lender/title contacts).

**Form libraries (T2.1b, 2026-08-14).** The in-house TC uses three SkySlope catalogs plus house forms: OREF (`1340`, paid subscription), Oregon Data Share (`1528`, free with membership), Oregon Realtors (`1837`, free with membership), RR. A catalog check is metadata-only (no PDF). Diff: `lib/tc/form-catalog-diff.ts`. Apply: `/admin/forms` paste or `POST /api/admin/forms/catalog-check`. Do not aggregate these tables for public market numbers. Never redistribute blanks.

---

## 3. Market reports — the canonical pattern

### 3a. Resort/master-planned communities (14)

These are registered as `geo_type='neighborhood'` in `public.boundaries`. **Their child SubdivisionName aliases live in `public.neighborhood_subdivisions`.** The cache aggregates every alias under one report — much richer than a `SubdivisionName='Tetherow'` text match would produce.

**Membership is EVIDENCED, never inferred from proximity (2026-08-26).** `subdivision_aliases` in `data/resort-communities.json` is rendered as a literal claim ("Subdivisions in X") and it also scopes the alias-aware active count, the community market scope, and the CMA resort comp guard (`lib/cma/resort-guard.ts`). Most entries originally earned their list from a Spark `/listings/nearby` ≥ 80% inside-test, which asserts membership from listing PROXIMITY — a community's envelope naturally contains the independently recorded plats next door. That test produced 5 false children for Awbrey Glen (fixed 05917a61) and 21 more across Tetherow, NorthWest Crossing, Broken Top, Eagle Crest and Brasada Ranch (fixed 2026-08-26). Every alias now carries a measurement in its entry's `verification.confirmed[]`, and `scripts/check-resort-membership-evidence.mjs` (`ci:resort-membership-evidence`) fails the commit if one does not.

| Community | Slug | City | Aliases | Active SFR today | Active inventory note |
|---|---|---|---|---|---|
| **Tetherow** | `tetherow` | Bend | 2 (Tetherow + Triple) | 15 | Corrected 2026-08-26. Sunrise Village, Westbrook Meadows, Braeburn, 1st On The Hillsites, Lodges at Bachelor V, Campbell Road, Roald West REMOVED — each its own recorded plat, 0/1,062 of their listings inside the Tetherow polygon. 'Triple' is the MLS truncation of Triple Knot (9/9 inside). |
| **Broken Top** | `broken-top` | Bend | 1 (single MLS name) | 16 | Corrected 2026-08-26. Golden Butte, Parks At Broken Top, Overturf Butte, The Highlands at Broken Top REMOVED — own plats with own HOAs; the boundary polygon already excluded three of them by name. Reverses a Matt name-override on Highlands (geometry puts it inside neither Broken Top nor Tetherow). |
| **Eagle Crest** | `eagle-crest` | Redmond | 2 (Eagle Crest + Ridge At Eagle Crest) | 54 | Corrected 2026-08-26. Cline Falls Oasis, Coppermill, Cline Falls Mob Park REMOVED — own plats west across Cline Falls Hwy, 0/85 inside. Ridge At Eagle Crest STAYS (201/201 inside; 40+ Ridge plats in the containment list). |
| **Pronghorn** | `pronghorn` | Bend | 1 (single MLS name) | 14 | Slow-turnover. ~9 SFR sales / year. |
| **Caldera Springs** | `caldera-springs` | Sunriver | 1 (single MLS name) | 17 | Powder Village Condo, Business Park, Sunriver Business Pa, Compound Condominium were removed 2026-06-27 (Sunriver-area, not Caldera phases). |
| **Sunriver** | `sunriver` | Sunriver | **31** (Sunriver + The Ridge + StoneTH + Deer Park + Mtn Village East + River Village + Fairway Crest Village + Forest Park + Meadow Village + Overlook Park + Mtn Village West + Tennis Village + Meadow House + Fairway Vill Condo + Fremont Crossing + Abbot House Condo + Kitty Hawk + Quelah Condos + WildflS + Polehouse + Aquila Lodges + Fairway Island + Cluster Court + Skypark + Mtn View Lodge + Ranch Cabins + SkylinC + Quelah Estates + Aspen Meadows + Camp Abbot Hangars + Sunriver Lodge) | 37 | MLS has no exact "Sunriver" — every Sunriver listing uses a sub-area name. All 30 children VERIFIED 2026-08-26 at 89.7–100% inside the polygon; none removed. (Pace Estate moved to Crosswater in the v2 patch.) |
| **Awbrey Glen** | `awbrey-glen` | Bend | 1 (single MLS name) | 6 | Corrected 2026-08-25. Shevlin Bluffs, Shevlin Estates, Awbrey Court, Shevlin Court, The Farm REMOVED — each is its own recorded Deschutes County plat with its own HOA, not an Awbrey Glen phase. County plats = Awbrey Glen Homesites Phases One, Two, Four, Five, Six, Seven, Eight (no Phase Three). |
| **NorthWest Crossing** | `northwest-crossing` | Bend | 1 (single MLS name) | 21 | Corrected 2026-08-26. Skyliner Summit, Shevlin Ridge, Westside Pines, Westside Meadows, Valhalla Heights, Treeline Phase 1, Outcrop REMOVED — 3 of their 2,063 listings are inside the NWX polygon (0.1%). All seven sit in the wider `bend-summit-west` neighbourhood, which is what the radius picked up; the county names Skyliner Summit after Broken Top, not NWX. |
| **Crosswater** | `crosswater` | Sunriver | 2 (Crosswater + Osprey Pointe Condo) | 1 | Ultra-slow turnover; last SFR sale Sep 2025. Corrected 2026-08-26 by RESEARCH, not geometry. **Osprey Pointe Condo KEPT** even though 0/9 of its listings are inside the polygon: its recorded declaration (Deschutes 97-33704, Bk 462 Pg 1137) names Crosswater Owners' Association as master association and submits it to the Crosswater Master Declaration (Bk 346 Pg 1105), 1/24 of the master assessment per unit; its only road, Canoe Camp Dr, is Crosswater-Association-owned. It is a condo carved OUT of Crosswater, so the plat-union polygon misses it — the TEST was wrong, not the claim. **Pace Estate + Lisle Acres REMOVED**: no association owns a parcel in either plat, MLS CCR's YN = No, and the active Lisle Acres listing says "just outside the resort area with no HOA & no CC & Rs". |
| **Black Butte Ranch** | `black-butte-ranch` | Sisters | 5 (+ Bbr + South Meadow + Glaze Meadow Homesite Section + Country House Condo) | 23 | All 4 children VERIFIED 2026-08-26; none removed. Country House Condo is 0/5 inside the polygon (a plat-union of homesite sections that omits the condo tract) but 6/6 of its listings carry MLS City='Black Butte Ranch'. |
| **Brasada Ranch** | `brasada-ranch` | Powell Butte | 1 (single MLS name) | 25 | Corrected 2026-08-26. Powell Butte View REMOVED — 1/148 inside (0.7%), scattered rural parcels 6–9km off the ranch. `community_subdivisions` returns 0 rows here because `boundaries` holds Deschutes plats and Brasada is in CROOK county, so the point-in-polygon test is the evidence. |
| **Widgi Creek** | `widgi-creek` | Bend | 4 (+ PointsWest + Elkai Woods + Milepost 1) | 6 | All 3 children VERIFIED 2026-08-26 at 100% inside. CAVEAT: `boundaries.geo_slug='widgi-creek'` is the county INN OF 7TH MOUNTAIN unincorporated-community polygon, shared with the separate `inn-of-the-7th-mountain` entry — wider than the community; narrow it to a Widgi plat union. |
| **Vandevert Ranch** | `vandevert-ranch` | Bend | 1 (single MLS name) | 0 | Tiny private community. Last SFR sale Jan 2025. |
| **Three Rivers** | `three-rivers` | Bend | 11 (Oww + DrrhTrs + River Meadows + Sun Dance + Deschutes River Recreation Homesites + Drrh Trs + Deschutes Pines + Blissful Acres + Fountainbleau + Swarens Fancher + OWW2) | 39 | South Deschutes CDP, `is_resort=false`. **All 11 VERIFIED 2026-08-26; none removed.** Three Rivers is a 4,819-acre census-designated PLACE of 20+ subdivisions, so membership is area membership, not plat containment. The boundary polygon is the ST_Union of DRRH plats alone = 2,503 acres, only 51.9% of the CDP, so 8 aliases fail it — yet they sit CLOSER to the CDP centre (1.1–2.8km) than the 3 that pass (3.05–4.12km). **Widen the polygon**, don't trim the list. Not to be confused with `3 Rivers Rec` (Three Rivers Recreation Area, Lake Billy Chinook): 535 listings, City=Culver 97734, 56km NW of Bend, no registry entry. |

**Pattern for querying a resort community market report:**

```sql
-- Tetherow rolling_90d market report
SELECT geo_label, period_type, sold_count, median_sale_price, median_dom,
       end_of_period_inventory, market_health_label, methodology_version
FROM public.market_stats_cache
WHERE geo_type='neighborhood' AND geo_slug='tetherow' AND period_type='rolling_90d'
ORDER BY computed_at DESC LIMIT 1;
```

**Slow-turnover fallback** — Pronghorn / Crosswater / Vandevert Ranch will show `sold_count=0` for `rolling_90d`. Always check `rolling_365d` and `ytd` for those:

```sql
SELECT period_type, sold_count, median_sale_price, end_of_period_inventory
FROM public.market_stats_cache
WHERE geo_type='neighborhood' AND geo_slug='pronghorn'
ORDER BY (CASE period_type WHEN 'rolling_90d' THEN 0 WHEN 'rolling_30d' THEN 1
                            WHEN 'monthly' THEN 2 WHEN 'quarterly' THEN 3
                            WHEN 'ytd' THEN 4 WHEN 'rolling_365d' THEN 5 END)
LIMIT 1;
```

**Or use the TypeScript server action** which already handles fallback: `import { getMarketStatsForSubdivision } from '@/app/actions/market-stats'` then `await getMarketStatsForSubdivision('bend', 'Tetherow')`. The server action checks `subdivision_flags` and routes to neighborhood-level cache automatically.

### 3b. Cities + region

| Geo | Slug | Type | Notes |
|---|---|---|---|
| Central Oregon | `central-oregon` | `region` | Filter = `is_central_oregon_city("City")` — the 16-city hardcoded set. |
| Bend | `bend` | `city` | TIGER 2024 incorporated-place polygon. ~482 active SFR. Drops ~239 listings that are MLS-tagged "Bend" but outside the city polygon (per the documented intent — Bend = city-of-Bend). |
| Redmond | `redmond` | `city` | TIGER polygon. ~141 active SFR. |
| Sisters | `sisters` | `city` | TIGER polygon. |
| Sunriver | `sunriver` | `city` | TIGER polygon. (Also exists as a `neighborhood`-typed entry — both work; `city` row applies the TIGER limit, `neighborhood` row uses the full Sunriver resort alias list.) |
| La Pine, Madras, Prineville, Tumalo, Terrebonne, Culver, Black Butte Ranch, Camp Sherman, Crooked River Ranch, Warm Springs, Metolius, Powell Butte | various slugs | `city` | All in `MARKET_REPORT_DEFAULT_CITIES`. Refreshed every 6h. |

```sql
-- Bend rolling_90d
SELECT period_type, sold_count, median_sale_price, median_dom, end_of_period_inventory
FROM public.market_stats_cache
WHERE geo_type='city' AND geo_slug='bend' AND period_type='rolling_90d';

-- Bend live pulse (active inventory, refreshed every 10-15 min)
SELECT active_count, pending_count, new_count_30d, median_list_price,
       months_of_supply, absorption_rate_pct, market_health_label
FROM public.market_pulse_live
WHERE geo_type='city' AND geo_slug='bend' AND property_type='A';
```

### 3c. Bend neighborhoods (14)

City of Bend Neighborhood Districts. Polygons from City of Bend GIS (authoritative, [data/bend-neighborhood-districts.geojson](../data/bend-neighborhood-districts.geojson)).

| Slug | Label | Notes |
|---|---|---|
| `bend-awbrey-butte` | Awbrey Butte | Different from `awbrey-glen` (resort community within Awbrey Butte). |
| `bend-larkspur` | Larkspur | |
| `bend-old-bend` | Old Bend | |
| `bend-old-farm-district` | Old Farm District | |
| `bend-mountain-view` | Mountain View | |
| `bend-summit-west` | Summit West | |
| `bend-boyd-acres` | Boyd Acres | |
| `bend-river-west` | River West | |
| `bend-century-west` | Century West | |
| `bend-orchard-district` | Orchard District | |
| `bend-southwest-bend` | Southwest Bend | |
| `bend-southeast-bend` | Southeast Bend | |
| `bend-southern-crossing` | Southern Crossing | |
| `bend-undesignated` | Undesignated | Catch-all for properties inside City of Bend but outside any named district. |

```sql
SELECT geo_label, period_type, sold_count, median_sale_price, median_dom
FROM public.market_stats_cache
WHERE geo_type='neighborhood' AND geo_slug='bend-awbrey-butte' AND period_type='rolling_90d';
```

### 3d. Subdivisions (legacy, text-equality only)

The 3,213 subdivision polygons in `boundaries` exist for property-level tagging (`listings.boundary_subdivision`) and for the parent-community polygon derivation. **They are NOT the primary aggregation taxonomy** — per the Spark MLS evidence ([SPARK_API_REFERENCE.md](SPARK_API_REFERENCE.md)), the MLS field is the universal community name and the county GIS plats are a separate ontology (legal-plat records).

If you need a subdivision-level report by name (e.g. someone searches "Tetherow Phase 5"), use:

```sql
SELECT period_type, sold_count, median_sale_price
FROM public.market_stats_cache
WHERE geo_type='subdivision' AND geo_slug='tetherow-phase-5' AND period_type='rolling_90d';
```

⚠️ Most subdivision-level rows don't exist in the cache (we only populate for the 14 resort umbrella communities). If you need a one-off subdivision report, call:

```sql
SELECT public.compute_and_cache_period_stats('subdivision', 'tetherow-phase-5', 'rolling_90d', (CURRENT_DATE - INTERVAL '90 days')::date);
```

---

## 4. Listings — the 800-field reality

### 4a. The mixed-case column rule (READ THIS FIRST)

`public.listings` uses **Spark-RETS PascalCase column names that must be double-quoted in SQL**:

```sql
-- ✅ Correct
SELECT "ListingKey", "ListPrice", "BedroomsTotal", "StandardStatus", "CloseDate"
FROM public.listings WHERE "City" = 'Bend';

-- ❌ Silently wrong (returns "column does not exist")
SELECT ListingKey, ListPrice, BedroomsTotal FROM listings WHERE StandardStatus = 'Active';
```

`listings` is a **two-market table**: Central Oregon and Southern Oregon rows live together.
`mls_source` is a **constant** (`central_oregon` on 100% of rows, including Jackson County) —
never filter on it. Scope is MLS `"City"` via `market_in_service_area` / `is_central_oregon_city`.

**Quoted (Spark PascalCase) columns:**
`"ListingKey"`, `"ListNumber"`, `"StreetNumber"`, `"StreetName"`, `"City"`, `"StateOrProvince"`, `"PostalCode"`, `"Latitude"`, `"Longitude"`, `"ListPrice"`, `"OriginalListPrice"`, `"ClosePrice"`, `"OnMarketDate"`, `"CloseDate"`, `"StandardStatus"`, `"PropertyType"`, `"SubdivisionName"`, `"BedroomsTotal"`, `"BathroomsTotal"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"PublicRemarks"`, `"DaysOnMarket"`, `"ModificationTimestamp"`.

**Dead / do not read:** `"CumulativeDaysOnMarket"` (500 non-null of ~595k, all Closed).
**`"DaysOnMarket"` is list-to-close, not days-to-contract** — do not publish it as DOM.

**Snake_case (computed/promoted) columns — no quoting required:**
`year_built`, `pending_timestamp`, `price_per_sqft`, `close_price_per_sqft`, `sale_to_list_ratio`, `days_to_pending`, `days_pending_to_close`, `property_age`, `lot_size_acres`, `lot_size_sqft`, `tax_annual_amount`, `hoa_monthly`, `estimated_monthly_piti`, `school_district`, `boundary_city`, `boundary_neighborhood`, `boundary_subdivision`.

### 4b. The "800 fields" reality

Spark gives us ~130 first-class columns + a `details` JSONB blob (~70 more fields).

**⚠️ Read [`TOAST_READ_DISCIPLINE.md`](TOAST_READ_DISCIPLINE.md) before writing any query that touches `details`.** It is the second trap on this table, and it is more expensive than the quoting rule above.

Measured 2026-07-31: `details` averages **10,074 bytes** per row (max 21,471) and accounts for **12 GB of the table's 14 GB** against a 1 GB `shared_buffers`. Postgres cannot read one key out of a TOASTed value, so `details->>'FieldName'` detoasts the **entire** document, **per candidate row** — measured **+3.845 ms/row (36.9× slower)** than reading typed columns over the same 29,135 rows.

The cost is per row the predicate *examines*, not per row returned, so `LIMIT` does not save you. 96,682 Bend closed rows × 3.8 ms ≈ 6 minutes against a 12 s timeout.

- **NEVER `SELECT details`, and never `.select('*')`, on any path with a broad candidate set** (whole-city, sold/closed, matview refresh, cron sweep). `*` includes `details`.
- `details->>'FieldName'` is **not** a cheap escape hatch — it costs the same as selecting the whole blob.
- Safe: single-row lookups already bounded by `"ListingKey"` / `"ListNumber"`.
- For filterable fields use the trigger-maintained side tables (`listing_feature_flags`, `listing_remarks_search`).
- Typed columns are backfilled artifacts, **not guaranteed mirrors** — `pool_yn` returns 167 rows where the jsonb expression returns 15,763. Prove equivalence over the whole table before swapping. The proof query is in `TOAST_READ_DISCIPLINE.md`.

Tier breakdown (kept from prior version):

**Tier 1 — Computed metrics** (auto-updated by `compute_listing_derived_fields()` trigger on every INSERT/UPDATE):

| Column | Type | Meaning |
|---|---|---|
| `price_per_sqft` | numeric(10,2) | `"ListPrice" / "TotalLivingAreaSqFt"` |
| `close_price_per_sqft` | numeric(10,2) | `"ClosePrice" / "TotalLivingAreaSqFt"` |
| `sale_to_list_ratio` | numeric(6,4) | `"ClosePrice" / "OriginalListPrice"`. >1.0 = over asking. |
| `sale_to_final_list_ratio` | numeric(6,4) | `"ClosePrice" / "ListPrice"` (final list) |
| `total_price_change_pct` | numeric(8,2) | % change OriginalList → final List |
| `total_price_change_amt` | numeric(12,2) | $ change OriginalList → final List |
| `price_per_acre` | numeric(14,2) | `"ListPrice" / lot_size_acres` |
| `price_per_bedroom` | numeric(12,2) | `"ListPrice" / "BedroomsTotal"` |
| `property_age` | smallint | Current year − `year_built` |
| `bed_bath_ratio` | numeric(4,2) | `"BedroomsTotal" / "BathroomsTotal"` |
| `hoa_annual_cost` | numeric(10,2) | `hoa_monthly * 12` |
| `tax_rate` | numeric(6,4) | `tax_annual_amount / tax_assessed_value * 100` |
| `estimated_monthly_piti` | numeric(10,2) | P&I + Taxes + Insurance + HOA at 6.5% / 30yr |
| `days_to_pending` | smallint | Days from `"OnMarketDate"` to `pending_timestamp` |
| `days_pending_to_close` | smallint | Days from pending to `"CloseDate"` |
| `was_relisted` | boolean | Came back to Active after off-market |
| `listing_quality_score` | smallint | 0-100 based on photos, tour, remarks |

**Tier 2 — Promoted from `details` JSONB** (extracted on every sync):

- **Property:** `property_sub_type` (Single Family Residence, Condo/Townhouse, Manufactured, Residential Lots, Multi-Family, Commercial), `year_built`, `levels`, `architectural_style`, `new_construction_yn`, `stories_total`, `rooms_total`, `basement_yn`
- **Structure:** `building_area_total`, `above_grade_finished_area`, `below_grade_finished_area`, `construction_materials`, `roof`
- **Lot:** `lot_size_acres`, `lot_size_sqft`, `pool_yn`, `spa_yn`, `fireplace_yn`, `fireplaces_total`, `waterfront_yn`, `horse_yn`, `fencing`
- **Parking:** `garage_yn`, `garage_spaces`, `carport_spaces`, `parking_total`
- **Systems:** `heating_yn`, `cooling_yn`, `sewer`, `water`
- **Financial:** `tax_annual_amount`, `tax_assessed_value`, `tax_year`, `association_fee`, `association_fee_frequency`, `hoa_monthly`, `buyer_financing`, `concessions_amount`
- **Location:** `county`, `elementary_school`, `middle_school`, `high_school`, `school_district`, `view_description`, `parcel_number`
- **Dates:** `pending_timestamp`, `purchase_contract_date`, `off_market_date`, `status_change_timestamp`, `listing_contract_date`
- **Agent:** `list_agent_email`, `list_agent_mls_id`, `buyer_agent_name`, `buyer_agent_mls_id`, `buyer_office_name`
- **Boundary tags** (added 2026-05-14, populated by `tag_listing_boundaries` RPC):
  - `boundary_city` — e.g. `'Bend'`, `'Outside Boundaries'`, `NULL` (untagged)
  - `boundary_neighborhood` — e.g. `'Awbrey Butte'`, `NULL`
  - `boundary_subdivision` — e.g. `'Tetherow Phase 5'`, `NULL`

**Tier 3 — Computed from related tables** (price_history, status_history):

`price_drop_count`, `price_increase_count`, `total_price_changes`, `largest_price_drop_pct`, `days_since_last_price_change`, `dom_percentile`, `price_percentile`, `status_change_count`.

### 4c. SFR-only convention

For consumer-facing market reports, we filter to:

```sql
"PropertyType" = 'A'
AND property_sub_type = 'Single Family Residence'
```

`PropertyType` codes from Spark: `A`=Residential, `B`=Manufactured, `C`=Multi-Family, `D`=Land, `E`=Commercial, `F`=Farm/Ranch.

`property_sub_type` for `A` includes: `'Single Family Residence'`, `'Condo/Townhouse'`. The cache RPCs filter to SFR exclusively — this matches consumer search behavior. If you need a lot report or a condo report, you'll need a separate query path.

### 4d. Never `ST_Within` against `listings` at request time

The boundary-map pins + "homes for sale" cards need the set of listings physically inside a polygon. The obvious query — `ST_Within(ST_MakePoint("Longitude","Latitude"), b.polygon)` joined to `listings` — is a **trap**. A wide-bbox polygon (Tetherow's bbox reaches dense central Bend) makes even an index-assisted scan evaluate `ST_Within` over thousands of candidates: ~10s cold, which blows the **anon role's 3s `statement_timeout`** (verified: 2 of 3 anon calls cancelled). The map outline still renders (the `boundary_geojson` RPC is cheap) but the pins + cards silently come back empty.

**The fix, and the only supported path:** read the precomputed `listing_boundary_xref_mv` via the `listings_in_boundary(p_geo_type, p_geo_slug, p_limit)` RPC, wrapped by the `getGeoBoundaryMapData` DAL. The spatial join runs once at MV-refresh time (as the MV owner, no 3s cap); request time is a trivial `(geo_type, geo_slug)` index lookup — sub-10ms, never times out, identical for city / neighborhood / community pages. Gate **G31** enforces that every page rendering a boundary map imports `getGeoBoundaryMapData` rather than rolling its own query. If you ever need a status other than `'Active'`, the MV already carries `standard_status` + `property_type` — widen the RPC, don't reintroduce request-time `ST_Within`.

---

## 5. Cron + freshness — what runs when

```
*/10 * * * *   /api/cron/sync-delta           Spark → listings (incremental sync)
                                              + calls refresh_market_pulse() + refresh_community_market_pulse()
*/5 * * * *    /api/cron/sync-history-terminal Spark history sync for terminal listings
0 2 * * 0      /api/cron/sync-full            Sunday 2am full re-sync
0 */6 * * *    /api/cron/refresh-market-stats Every 6 hours — backfill_rolling for cities,
                                              + compute_and_cache_period_stats for every
                                                geo (city + region + 28 neighborhoods)
                                                × 6 period types (rolling_30d/90d/365d
                                                  + monthly + quarterly + ytd)
0 4 * * 0      /api/cron/refresh-market-stats-monthly-recompute  Sunday 4am full recompute
0 14 * * 6     /api/cron/market-report        Weekly market report generation
```

**Result:**
- `market_pulse_live` row for Bend: 10-15 min freshness
- `market_stats_cache` row for any geo: ≤ 6h freshness
- After a Spark sync (every 10 min), city + region live counts refresh; neighborhood cache rows refresh on the 6h cycle

---

## 6. Methodology versioning

Every cache row carries a `methodology_version` string. To trace any number back to its rules:

```sql
SELECT version, effective_at, scope, definitions, notes
FROM public.cache_methodology_definitions
WHERE version = (
  SELECT methodology_version FROM public.market_stats_cache
  WHERE geo_type='neighborhood' AND geo_slug='tetherow'
  ORDER BY computed_at DESC LIMIT 1
);
```

Current versions:

| Version | Effective | Notes |
|---|---|---|
| `v3-2026-05-07` | 2026-05-07 | First locked methodology after May 2026 audit. SFR-only. City polygon when present, else City text fallback. Subdivision text equality. |
| `v4-2026-05-15` | 2026-05-15 | **Current.** Adds 14 resort communities as `geo_type='neighborhood'`, 100 alias mappings. Polygon-first geography for cities + neighborhoods. SFR-only filter unchanged. |

---

## 7. Common queries (copy-paste templates)

### Market report dashboard (one row per geo, one period)

```sql
SELECT geo_label, sold_count, median_sale_price, median_dom,
       end_of_period_inventory, yoy_median_price_delta_pct,
       market_health_label, methodology_version
FROM public.market_stats_cache
WHERE period_type = 'rolling_90d'
  AND geo_type = 'neighborhood'
  AND geo_slug IN ('tetherow','sunriver','broken-top','eagle-crest','pronghorn',
                   'caldera-springs','awbrey-glen','northwest-crossing','crosswater',
                   'black-butte-ranch','brasada-ranch','widgi-creek','vandevert-ranch','three-rivers')
ORDER BY sold_count DESC;
```

### Active inventory snapshot for all cities

```sql
SELECT geo_label, active_count, pending_count, new_count_7d, new_count_30d,
       median_list_price, months_of_supply, market_health_label, updated_at
FROM public.market_pulse_live
WHERE geo_type = 'city' AND property_type = 'A'
ORDER BY active_count DESC;
```

### One listing, full detail

```sql
SELECT
  "ListingKey", "ListNumber", "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice", "OriginalListPrice", "ClosePrice", "StandardStatus",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  year_built, property_sub_type, price_per_sqft, estimated_monthly_piti,
  "Latitude", "Longitude", boundary_city, boundary_neighborhood, boundary_subdivision,
  "PublicRemarks", "OnMarketDate", "CloseDate"
FROM public.listings
WHERE "ListingKey" = $1;
```

### Comparable sales for a CMA

```sql
SELECT "ListingKey", "ListNumber", "StreetNumber", "StreetName",
       "ListPrice", "ClosePrice", sale_to_list_ratio, days_to_pending,
       close_price_per_sqft, "BedroomsTotal", "BathroomsTotal",
       "TotalLivingAreaSqFt", year_built, lot_size_acres,
       "Latitude", "Longitude", "CloseDate"
FROM public.listings
WHERE "StandardStatus" = 'Closed'
  AND "City" = $1
  AND "CloseDate" >= CURRENT_DATE - INTERVAL '6 months'
  AND "BedroomsTotal" BETWEEN $2 AND $3
  AND "ListPrice" BETWEEN $4 AND $5
ORDER BY "CloseDate" DESC
LIMIT 10;
```

### "How many active homes are in Tetherow right now?"

```sql
SELECT COUNT(*) FROM public.listings
WHERE "SubdivisionName" = ANY (
  SELECT subdivision_label FROM public.neighborhood_subdivisions
  WHERE neighborhood_slug = 'tetherow'
)
AND "StandardStatus" IN ('Active','Coming Soon','Active Under Contract')
AND property_sub_type = 'Single Family Residence'
AND "PropertyType" = 'A';
```

(Or even simpler — just read `market_pulse_live` once neighborhoods are populated there, or `market_stats_cache.end_of_period_inventory` for the most recent period.)

---

## 8. Gotchas (the stuff that bites)

1. **Mixed-case columns** — always double-quote PascalCase columns. See §4a.
2. **Slug formats differ by geo_type:**
   - `geo_type='city'` → bare slug `'bend'`
   - `geo_type='region'` → `'central-oregon'`
   - `geo_type='neighborhood'` → bare slug `'tetherow'` or `'bend-awbrey-butte'`
   - `geo_type='subdivision'` → `slugify(SubdivisionName)`, e.g. `'tetherow-phase-5'`
   - `subdivision_flags.entity_key` → `'city:slug'` format, e.g. `'bend:tetherow'`
3. **`market_pulse_live` doesn't carry neighborhoods yet** (only city + region). For neighborhood-level live inventory, use `market_stats_cache.end_of_period_inventory` from the freshest period row.
4. **Pronghorn / Crosswater / Vandevert Ranch are slow-turnover.** Rolling_90d often shows `sold_count=0`. Fall back to `rolling_365d` or `ytd` for those.
5. **`property_sub_type` filter is critical for SFR reports.** Pronghorn has 35 active lots + 16 active homes; without the SFR filter you'd mix them.
6. **Bend = TIGER incorporated city, not "Bend area"** — drops ~239 MLS-tagged-Bend listings that are physically in unincorporated Deschutes County. This is intentional. If you need "Bend area" semantics, query the `region='central-oregon'` cache instead.
7. **Subdivision-level cache is sparse.** Only the 14 umbrella communities have `geo_type='neighborhood'` rows populated. For a one-off subdivision (e.g. "Tetherow Phase 5"), call `compute_and_cache_period_stats('subdivision', slug, period_type, period_start)` to populate on-demand.
8. **`refresh_market_pulse()` is city-only.** If you need a live pulse for a neighborhood, either extend the SQL function or read the period-anchored cache.
9. **`listings.boundary_*` columns are sparsely populated.** Only ~7K of 589K rows have `boundary_city` set today. The tagger runs on demand, not on every sync — see `tag_all_listings_boundaries()`.

---

## 9. Don't do this

❌ **Don't aggregate `listings` for market reports.** Use the cache. Methodology + verification trace come for free.

❌ **Don't `SELECT *` or `SELECT details` on `listings`** on hot paths. Use explicit column lists.

❌ **Don't invent slugs.** Use [data/resort-communities.json](../data/resort-communities.json) or query `public.boundaries` / `public.neighborhood_subdivisions` for the canonical set.

❌ **Don't invent SubdivisionName aliases.** Spark's authoritative list is at `/v1/standardfields/SubdivisionName` (8,033 values). Local mirror lives in `public.neighborhood_subdivisions` for resort umbrella names.

❌ **Don't write a market report without a `methodology_version` trace.** Every figure that ships to a human needs to trace back to its rule set. See [CLAUDE.md §0 Data Accuracy](../CLAUDE.md).

❌ **Don't run `tag_all_listings_boundaries()` casually.** It iterates 540K+ listings × 3,237 polygons. Run it once, after polygon updates.

⚠️ **Security note:** `public.cma_deliveries` currently has RLS disabled (and `public.spatial_ref_sys`, but that's a benign PostGIS system table). `cma_deliveries` contains client delivery records — should be locked down. Open issue.

---

## 10. When to escalate (vs. self-serve)

| Situation | What to do |
|---|---|
| New SubdivisionName variant appears in MLS that we don't recognize | Add to `data/resort-communities.json` if it belongs to a resort community, otherwise it'll naturally show up in subdivision-level queries. Run migration after editing the registry. |
| New resort community needs to be tracked | Edit `data/resort-communities.json`, regenerate `supabase/migrations/<ts>_resort_communities_neighborhood_aliases.sql`, apply. |
| Bend neighborhood polygon needs an update | See [docs/seo-neighborhood-polygon-fix-2026-05-14.md](seo-neighborhood-polygon-fix-2026-05-14.md). Source: City of Bend GIS authoritative GeoJSON. |
| Cache numbers look wrong | Check `methodology_version` on the row first. If it matches `v4-2026-05-15`, the rule set is current — debug the underlying RPC. If stale, trigger a fresh `compute_and_cache_period_stats` call. |
| Need a property-level boundary tag for a specific listing | `SELECT public.tag_listing_boundaries('<ListingKey>')` — single-row tag using current `boundaries` polygons. |
| Need to add a new period_type | Extend `compute_and_cache_period_stats()` RPC + add a TS type entry in `app/actions/market-stats.ts` `MarketPeriodType`. |
| MLS field exists in `details` JSONB but not promoted | Add a column to `listings`, extend `compute_listing_derived_fields()` trigger or a separate sync hook. |

---

## 11. Canonical references

| Source | Purpose |
|---|---|
| `data/resort-communities.json` | The 14-community parent→child registry (v2-2026-05-15) |
| `public.cache_methodology_definitions` | Full audit trail for every cache methodology version |
| `supabase/migrations/20260515170000_resort_communities_neighborhood_aliases.sql` | Migration that populated resort communities |
| `supabase/migrations/20260425090000_cache_layer_complete_rewrite.sql` | Cache RPC bodies (`compute_and_cache_period_stats`, `refresh_market_pulse`, `backfill_rolling`) |
| `app/api/cron/refresh-market-stats/route.ts` | The 6-hour cron that keeps cache fresh |
| `app/actions/market-stats.ts` | `getCachedStats()`, `getLiveMarketPulse()`, `getMarketStatsForCity()`, `getMarketStatsForSubdivision()` — the canonical TS consumer |
| `app/actions/communities.ts` | Community-page server actions (`getCommunityBySlug`, `getCommunityMarketStats`, etc.) |
| `lib/resort-communities.ts` | Hard-coded resort list for SEO/page-layout (separate from the registry; will eventually consolidate) |
| `lib/subdivision-aliases.ts` | Legacy alias map (kept for compatibility; resort communities now use `neighborhood_subdivisions`) |
| `docs/SPARK_API_REFERENCE.md` | Spark MLS API reference |
| `docs/SPARK_FIELDS_AUDIT.md` | Spark field → our column mapping |
| `.cursor/rules/data-architecture.mdc` | Architecture rules enforced by Cursor |
| `.cursor/rules/supabase-data-layer.mdc` | Supabase data layer rules |
| `CLAUDE.md` (root) | Master agent instructions |

---

## 12. Quick health-check (run any time you're not sure if the data is fresh)

```sql
SELECT 'methodology' AS check, version AS value, effective_at::text AS detail
FROM public.cache_methodology_definitions ORDER BY effective_at DESC LIMIT 1
UNION ALL
SELECT 'most-recent cache row', MAX(updated_at)::text, 'should be within 6h'
FROM public.market_stats_cache
UNION ALL
SELECT 'most-recent pulse row', MAX(updated_at)::text, 'should be within 15 min'
FROM public.market_pulse_live
UNION ALL
SELECT 'most-recent listing sync', MAX("ModificationTimestamp")::text, 'should be within 10 min'
FROM public.listings
UNION ALL
SELECT 'resort communities', COUNT(*)::text, 'should be 14'
FROM public.boundaries WHERE geo_type='neighborhood' AND source LIKE '%spatial discovery%'
UNION ALL
SELECT 'neighborhood aliases', COUNT(*)::text, 'should be ~100'
FROM public.neighborhood_subdivisions
WHERE neighborhood_slug IN ('tetherow','broken-top','eagle-crest','pronghorn','caldera-springs',
                            'sunriver','awbrey-glen','northwest-crossing','crosswater',
                            'black-butte-ranch','brasada-ranch','widgi-creek','vandevert-ranch','three-rivers');
```

If any of those look stale or off, start by reading the methodology row notes and the cron logs (`/api/cron/refresh-market-stats` response in Vercel).
