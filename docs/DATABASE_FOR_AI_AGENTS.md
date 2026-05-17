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
| **Market report for a city** (Bend, Redmond, Sisters…) | `market_stats_cache WHERE geo_type='city' AND geo_slug=<slugified-city>` | `period_type`, `sold_count`, `median_sale_price`, `median_dom` | ≤ 6h |
| **Market report for a resort community** (Tetherow, Sunriver, Eagle Crest, Pronghorn, …) | `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug=<bare-slug>` — see §3a for the 14 valid slugs | same | ≤ 6h |
| **Market report for a Bend neighborhood** (Awbrey Butte, Larkspur, …) | `market_stats_cache WHERE geo_type='neighborhood' AND geo_slug='bend-<slug>'` | same | ≤ 6h |
| **Live active/pending inventory** for cities + region | `market_pulse_live WHERE geo_type IN ('city','region') AND property_type='A'` | `active_count`, `pending_count`, `months_of_supply` | ≤ 10–15 min |
| **Property details for one listing** | `listings WHERE "ListingKey" = ?` (note: PascalCase columns MUST be double-quoted — see §4) | every Spark MLS field | ≤ 10 min |
| **Active listings in a community** | `listings WHERE "SubdivisionName" = ANY(<aliases from neighborhood_subdivisions>) AND "StandardStatus" IN ('Active','Coming Soon','Active Under Contract')` | see §3a for the aliases | ≤ 10 min |
| **Comparable sales (CMA)** | `listings WHERE "StandardStatus"='Closed' AND "CloseDate" >= ... AND <filters>` | `"ClosePrice"`, `close_price_per_sqft`, `sale_to_list_ratio`, `days_to_pending` | ≤ 10 min |
| **Polygon for a community** | `boundaries WHERE geo_type=<type> AND geo_slug=<slug>` | `polygon` (PostGIS geometry) | manual |
| **Which subdivisions roll up into a community** | `neighborhood_subdivisions WHERE neighborhood_slug=<slug>` | `subdivision_label` (the MLS SubdivisionName values) | manual |
| **Is this a resort community?** | `subdivision_flags WHERE entity_key='<city>:<slug>'` | `is_resort` | manual |
| **Methodology trace for any cache row** | `cache_methodology_definitions WHERE version=<version>` | `scope`, `definitions`, `notes` | every cache row carries `methodology_version` |
| **Spark MLS API reference** | [docs/SPARK_API_REFERENCE.md](SPARK_API_REFERENCE.md) | n/a | n/a |

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
                │  city + region only today               │
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
2. **`market_pulse_live`** is fast-moving inventory snapshots (refreshed every 10 min by the Spark sync). It currently only carries city + region rows — NOT neighborhoods.
3. **`market_stats_cache`** is period-anchored historical analytics (refreshed every 6 hours by `/api/cron/refresh-market-stats`). It carries every level: city, region, neighborhood (resort communities + Bend districts), subdivision.

---

## 2. Every table, grouped by purpose

> Row counts are approximate at 2026-05-15. `rows=0` doesn't mean unused — many tables are written by user actions and stay near-zero in our dev/staging-shaped data.

### 2a. Geographic source-of-truth (where polygons + aliases live)

| Table | Rows | Purpose |
|---|---|---|
| `public.boundaries` | 3,251 | All polygons. `geo_type ∈ {city, neighborhood, subdivision}`. **10 cities** (TIGER/Line), **28 neighborhoods** (14 Bend districts + 14 resort communities), **3,213 subdivisions** (Deschutes County GIS plats). PostGIS geometry in `polygon` (MULTIPOLYGON, SRID 4326). |
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
| `public.listing_history` | 200K+ | MLS history events per listing (price changes, status changes). Use for price/status timelines. |
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

### 2c. Market analytics (the cache — read these, don't compute) ⭐

| Table | Rows | Purpose |
|---|---|---|
| **`public.market_pulse_live`** | 17 | **Live inventory snapshot**. ONE row per `(geo_type, geo_slug, property_type)`. 29 columns: active_count, pending_count, new_count_7d/30d, median_list_price, months_of_supply, absorption_rate_pct, market_health_score, etc. **Refreshed by `refresh_market_pulse()` on every sync (~10 min freshness).** Today carries city + region only (not neighborhoods). |
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
| `public.saved_searches` | 0 | Per-user saved search filters. `notification_frequency` drives the alert digest cadence. |
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
| `public.spatial_ref_sys` | 0 | PostGIS system table. RLS off (PostGIS-required; harmless). |

---

## 3. Market reports — the canonical pattern

### 3a. Resort/master-planned communities (14)

These are registered as `geo_type='neighborhood'` in `public.boundaries`. **Their child SubdivisionName aliases live in `public.neighborhood_subdivisions`.** The cache aggregates every alias under one report — much richer than a `SubdivisionName='Tetherow'` text match would produce.

| Community | Slug | City | Aliases | Active SFR today | Active inventory note |
|---|---|---|---|---|---|
| **Tetherow** | `tetherow` | Bend | 9 (Tetherow + Sunrise Village + Westbrook Meadows + Braeburn + 1st On The Hillsites + Lodges at Bachelor V + Triple + Campbell Road + Roald West) | 15 | |
| **Broken Top** | `broken-top` | Bend | 5 (+ Golden Butte + Parks At Broken Top + Overturf Butte + The Highlands at Broken Top) | 16 | |
| **Eagle Crest** | `eagle-crest` | Redmond | 5 (+ Ridge At Eagle Crest + Cline Falls Oasis + Coppermill + Cline Falls Mob Park) | 54 | |
| **Pronghorn** | `pronghorn` | Bend | 1 (single MLS name) | 14 | Slow-turnover. ~9 SFR sales / year. |
| **Caldera Springs** | `caldera-springs` | Sunriver | 5 (+ Powder Village Condo + Business Park + Sunriver Business Pa + Compound Condominium) | 17 | |
| **Sunriver** | `sunriver` | Sunriver | **32** (Sunriver + The Ridge + StoneTH + Deer Park + Mtn Village East + River Village + Fairway Crest Village + Forest Park + Meadow Village + Overlook Park + Mtn Village West + Tennis Village + Meadow House + Fairway Vill Condo + Fremont Crossing + Abbot House Condo + Kitty Hawk + Quelah Condos + WildflS + Polehouse + Aquila Lodges + Fairway Island + Cluster Court + Skypark + Mtn View Lodge + Ranch Cabins + SkylinC + Quelah Estates + Aspen Meadows + Pace Estate + Camp Abbot Hangars + Sunriver Lodge) | 37 | MLS has no exact "Sunriver" — every Sunriver listing uses a sub-area name. |
| **Awbrey Glen** | `awbrey-glen` | Bend | 6 (+ Shevlin Bluffs + Shevlin Estates + Awbrey Court + Shevlin Court + The Farm) | 6 | |
| **NorthWest Crossing** | `northwest-crossing` | Bend | 8 (+ Skyliner Summit + Shevlin Ridge + Westside Pines + Westside Meadows + Valhalla Heights + Treeline Phase 1 + Outcrop) | 21 | |
| **Crosswater** | `crosswater` | Sunriver | 4 (+ Osprey Pointe Condo + Pace Estate + Lisle Acres) | 1 | Ultra-slow turnover; last SFR sale Sep 2025. |
| **Black Butte Ranch** | `black-butte-ranch` | Sisters | 5 (+ Bbr + South Meadow + Glaze Meadow Homesite Section + Country House Condo) | 23 | |
| **Brasada Ranch** | `brasada-ranch` | Powell Butte | 2 (+ Powell Butte View) | 25 | |
| **Widgi Creek** | `widgi-creek` | Bend | 6 (+ Inn Of The 7th + 7th Mtn Golf Village + PointsWest + Elkai Woods + Milepost 1) | 6 | |
| **Vandevert Ranch** | `vandevert-ranch` | Bend | 1 (single MLS name) | 0 | Tiny private community. Last SFR sale Jan 2025. |
| **Three Rivers** | `three-rivers` | Bend | 11 (Oww + DrrhTrs + River Meadows + Sun Dance + Deschutes River Recreation Homesites + Drrh Trs + Deschutes Pines + Blissful Acres + Fountainbleau + Swarens Fancher + OWW2) | 39 | South Deschutes residential area. `is_resort=false`. |

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

**Quoted (Spark PascalCase) columns:**
`"ListingKey"`, `"ListNumber"`, `"StreetNumber"`, `"StreetName"`, `"City"`, `"StateOrProvince"`, `"PostalCode"`, `"Latitude"`, `"Longitude"`, `"ListPrice"`, `"OriginalListPrice"`, `"ClosePrice"`, `"OnMarketDate"`, `"CloseDate"`, `"StandardStatus"`, `"PropertyType"`, `"SubdivisionName"`, `"BedroomsTotal"`, `"BathroomsTotal"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"PublicRemarks"`, `"CumulativeDaysOnMarket"`, `"DaysOnMarket"`, `"ModificationTimestamp"`.

**Snake_case (computed/promoted) columns — no quoting required:**
`year_built`, `pending_timestamp`, `price_per_sqft`, `close_price_per_sqft`, `sale_to_list_ratio`, `days_to_pending`, `days_pending_to_close`, `property_age`, `lot_size_acres`, `lot_size_sqft`, `tax_annual_amount`, `hoa_monthly`, `estimated_monthly_piti`, `school_district`, `boundary_city`, `boundary_neighborhood`, `boundary_subdivision`.

### 4b. The "800 fields" reality

Spark gives us ~130 first-class columns + a `details` JSONB blob (~70 more fields). **NEVER `SELECT details` on hot paths** — it's ~200KB per row. Use the promoted columns or extract via `details->>'FieldName'` for one-off needs.

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

---

## 5. Cron + freshness — what runs when

```
*/10 * * * *   /api/cron/sync-delta           Spark → listings (incremental sync)
                                              + calls refresh_market_pulse() (city + region only)
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
