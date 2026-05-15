# Agent handoff — Area Guide template overhaul

**Date:** 2026-05-15
**Author:** prior session (Opus 4.7, 1M ctx)
**Receiver:** new Opus session (fresh ctx)
**Status:** READY FOR PICKUP

---

## Your mission, in one paragraph

Ryan Realty is on AgentFire (WordPress). AgentFire's stock Area Guide template pulls polygons + market widgets from a 3rd-party (Home Junction) and looks weak — wonky polygons, "No results matching your search criteria were found" as the dominant signal, no school data, no real subdivision context. Meanwhile, **the Supabase database `dwvlophlbvvygjfxcrhm` is loaded with everything needed to beat that template by an order of magnitude** — authoritative polygons, full market-pulse + market-stats tables with 30+ metrics each, market narratives, place attractions, subdivision descriptions, photos, asset library, blog posts, and the entire MLS (587K listings + 3.87M history rows). The customer-facing Next.js app at `ryanrealty.vercel.app` (future `ryan-realty.com`) already has skeleton routes for `/cities/[slug]`, `/cities/[slug]/[neighborhoodSlug]`, `/communities/[slug]`, `/area-guides`, and `/listings/[listingKey]`. **Your job is to design and ship 4 template specs that Matt approves, then build them out so every city, neighborhood, community, and subdivision in the database becomes a rich SEO-optimized page.**

---

## Hard constraints — read first

### CLAUDE.md is already loaded into your context

The full `/Users/matthewryan/RyanRealty/CLAUDE.md` (project instructions) loads automatically. The non-negotiables you must obey:

- **§0 Data Accuracy** — every figure on a published page must trace to a verified source. Pull queries fresh, print the raw result, cross-check math, cite the source row. No estimating. No "approximately." If a stat can't be verified, it doesn't ship.
- **§0.5 Draft-First, Commit-Last** — nothing renders to a tracked location or pushes until Matt sees the draft and explicitly approves it. The corollary `feedback_skill_authoring_autonomy.md` narrows this: code/scaffolding/migrations can commit + push without review; consumer-facing content does not.
- **Design System v2** (locked 2026-05-12) — Navy `#102742` + Cream `#faf8f4`, two-color palette. Geist sans for UI/body, Amboqia Boriango for display. shadcn/ui is the ONLY styling authority. Phone `541.213.6706` (Matt direct), `541.703.3095` (FUB-tracked). License #201206613.
- **Supabase column-name quirk** — RETS-standard mixed-case columns on `listings` MUST be wrapped in double quotes in SQL: `"ListPrice"`, `"StandardStatus"`, `"BedroomsTotal"`, etc. The #1 cause of failed queries.

### Persistent memory rules (auto-loaded each session)

Path: `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/`

The ones most relevant to this work:

- **`feedback_gis_authoritative_only.md`** (LOCKED 2026-05-14) — polygons MUST come from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or US Census TIGER. Never approximate. Never bounding-box from memory. Never LLM-generate. Every row gets `boundary_source` + `boundary_source_url` + `boundary_fetched_at` + `boundary_verified_by`. Don't break this rule the way the prior session did with fabricated Tree Farm/Awbrey Butte rectangles.
- **`feedback_draft_first_review.md`** — see CLAUDE.md §0.5
- **`feedback_skill_authoring_autonomy.md`** — code/scaffolding pushes without review; consumer content does not
- **`feedback_search_codebase_first.md`** — license #s, phone numbers, broker roster, brand specs already live in the repo; grep first, ask only if missing
- **`feedback_contact_sheet_required.md`** — every content draft surface must include an HTML contact sheet (videos play, images embed, captions read) with a clickable link Matt can open in the browser. For this work, the equivalent is **a draft template preview at a URL Matt can open** (Vercel preview deployment, localhost ngrok, or static HTML in `public/template-picker/`).
- **`reference_broker_headshots.md`** — three normalized broker portraits at `design_system/ryan-realty/assets/team/` with transparent PNGs

---

## What you're building

### 4 templates, in this order

| # | Template | URL pattern | Source of truth |
|---|---|---|---|
| 1 | **City** | `/cities/[slug]` | `cities` table (slug, name, boundary, hero) + spatial join to listings + `market_pulse_live` city rows + `market_stats_cache` |
| 2 | **Neighborhood** (Bend's 13 official neighborhoods + parent areas like Tetherow, Broken Top, NW Crossing master-planned communities) | `/cities/[slug]/[neighborhoodSlug]` | `neighborhoods` table (with authoritative City of Bend GIS polygons) + spatial join + `market_pulse_live` neighborhood rows |
| 3 | **Subdivision** (3,213 Deschutes County recorded plats from `boundaries`) | `/communities/[slug]` | `communities` table (1,816 rows) + `boundaries` (3,213 plat polygons) + spatial join + `market_stats_cache` |
| 4 | **Listing detail** | `/listings/[listingKey]` | `listings` table single row + `listing_photos` + `listing_history` + `open_houses` + spatial reverse-lookup to enclosing community/neighborhood/city |

The first three are "area pages" with the same data spine but different scope. The 4th is a single-property detail page; it links back UP into the 3 area templates ("This home is in Tree Farm, in the Summit West neighborhood, in the city of Bend"). The reverse linkage matters for SEO and UX.

### "Every city/neighborhood/subdivision exposed" — what that means at scale

| Page type | Estimated count after build |
|---|---|
| Cities | ~10 (Bend, Redmond, Sisters, La Pine, Sunriver, Terrebonne, Tumalo, Madras, Prineville, Culver — all in `boundaries` with TIGER 2024 polygons) |
| Neighborhoods | ~13–15 (Bend's 13 named City of Bend GIS districts + a small handful of master-planned communities like Tetherow, Broken Top, NWX that don't map 1:1 to a Bend district) |
| Subdivisions | **3,213** (one page per Deschutes County recorded plat in `boundaries` where `geo_type='subdivision'`) |
| Listing details | dynamic — ~600 active SFR + thousands of historical |

**3,213 subdivision pages** is the big number. Most will have minimal active inventory but rich historical / plat data. Many will be tiny (5–20 lots). The template needs to gracefully handle "this subdivision has 1 home for sale" AND "this subdivision has zero active and only 3 historical sales" — both have to look intentional, not broken. Compare to AgentFire's current "No results matching your search criteria" which is exactly the failure mode to avoid.

---

## Data inventory — what you can pull from

### Supabase project `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`)

**Geographic / boundary layer:**

| Table | Rows | Purpose | Notes |
|---|---|---|---|
| `boundaries` | 3,237 | Master GIS polygon store | 14 Bend neighborhoods (City of Bend GIS) + 10 cities (TIGER 2024) + 3,213 Deschutes County subdivisions. PostGIS `polygon` column is `MultiPolygon` in EPSG:4326. Has `source`, `source_url`, `imported_at` per row. |
| `cities` | small | Denormalized city pages | Has `boundary_geojson`, hero images, seo title/description. Currently mostly empty — populate from `boundaries`. |
| `neighborhoods` | 13 | Denormalized Bend neighborhoods | Authoritative City of Bend GIS polygons in `boundary_geojson` (jsonb). Has `boundary_source`, `boundary_source_url`, `boundary_fetched_at`, `boundary_verified_by` per the 2026-05-14 GIS authoritativeness migration. |
| `communities` | 1,816 | Subdivision/community directory | Has name, slug, description, hero image, `boundary_geojson`, `is_resort` flag, `resort_content` jsonb. Joins to `cities` and `neighborhoods` by id. Many rows currently lack polygons — backfill from `boundaries`. |
| `neighborhood_subdivisions` | 1,586 | Subdivision → parent neighborhood mapping | (neighborhood_slug, subdivision_label, parent_city_slug). Use to display "this subdivision is part of Summit West neighborhood." |
| `geo_places` | 199 | Hierarchical place graph (city → neighborhood → community) | Has type, parent_id, name, slug, metadata. Use for breadcrumbs and the "Related areas" widget. |
| `place_attractions` | small | POI per place | Name, phone, description, sort_order — restaurants, parks, schools, gyms etc. keyed by `entity_key`. |
| `subdivision_descriptions` | small | AI-generated subdivision blurbs | Has `description`, `attractions`, `dining` text per entity_key. Use as default body copy. |

**Market data layer:**

| Table | Rows | Purpose |
|---|---|---|
| `market_pulse_live` | 17 | LIVE aggregates per geo. 30+ metrics per row: `active_count`, `pending_count`, `new_count_7d`, `new_count_30d`, `median_list_price`, `market_health_score`, `market_health_label`, `months_of_supply`, `absorption_rate_pct`, `pending_to_active_ratio`, `median_sale_to_list`, `pct_sold_over_asking`, `pct_sold_under_asking`, `pct_sold_at_asking`, `median_days_to_pending`, `avg_price_drops_active`, `price_reduction_share`, `expired_rate_90d`, `sell_through_rate_90d`, `net_inventory_change_30d`, `median_active_dom`, `new_construction_share`, `sold_count_30d`, `sold_count_90d`, `median_close_price_90d`. Currently only emits city + region rows. **Phase 4 of the May 14 audit is to extend it to neighborhood + subdivision** (see `docs/seo-neighborhood-polygon-fix-2026-05-14.md`). |
| `market_stats_cache` | 4,283 | HISTORICAL period stats (monthly/quarterly/YTD). 40+ columns including `sold_count`, `median_sale_price`, `total_volume`, `median_dom`, `median_ppsf`, `avg_sale_to_list_ratio`, `price_band_counts` (jsonb), `bedroom_breakdown` (jsonb), `property_type_breakdown` (jsonb), `yoy_sold_delta_pct`, `yoy_median_price_delta_pct`, `mom_*`, `dom_distribution`, `cash_purchase_pct`, `affordability_monthly_piti`, `price_tier_breakdown`, `end_of_period_inventory`. |
| `market_narratives` | small | AI-generated written market narratives keyed by geo_type/geo_slug/period. Sections: `overview`, `price_analysis`, `speed_analysis`, `inventory_analysis`, `buyer_outlook`, `seller_outlook`, `faq` (jsonb). |
| `market_reports` | small | Full report objects (period_type, title, content_html, image_storage_path). |

**Listings layer:**

| Table | Rows | Purpose |
|---|---|---|
| `listings` | **587,142** | Live MLS feed. RETS-style mixed-case columns — must double-quote in SQL. Has `boundary_neighborhood` populated for ~3,200 Bend active/recent-closed rows after the May 14 backfill. Also `boundary_city`. Spatial index `idx_listings_bend_point_gist` exists for Bend point-in-polygon lookups. |
| `listing_history` | **3,868,389** | Close history. Use for long-running trend analysis per area. |
| `price_history` | 345,206 | Listing price changes over time. Use for price-drop indicator pills. |
| `listing_photos` | 3,712 | Per-listing photos with `is_hero` and `classification` flags. |
| `listing_videos` | small | Listing tour videos. |
| `listing_agents` | 215 | Listing agent roster. |
| `open_houses` | small | Upcoming open houses, joined to listings. |
| `expired_listings` | small | Expired listings — useful for inventory-velocity calculations. |

**Content + media layer:**

| Table | Rows | Purpose |
|---|---|---|
| `blog_posts` | 78 | Blog content with tags + category. Filter by tag for "related blog posts" per area. |
| `asset_library` | 662 | Media library with `geo_tags` (text[]) and `subject_tags` (text[]). Search by geo for hero/illustration images. |
| `banner_images` | small | Hero banners. |
| `hero_videos` | small | Hero video assets. |
| `reviews` | small | Google reviews + broker reviews. Display social proof on every page. |
| `community_engagement_metrics` | 1,487 | Engagement counters per community/area. Could power "trending" or "popular" badges. |

**Auxiliary:**

| Table | Purpose |
|---|---|
| `properties` (7,250) | Parcel-level master data: address, geocode, community_id, neighborhood_id. Separate from `listings` (which is the MLS feed). Use for permanent property identity. |
| `cmas`, `cma_comps`, `cma_deliveries` | CMA tooling — can power a "request a CMA for this area" lead form. |
| `subdivision_flags` | Quality flags per subdivision. Use to suppress junk subdivisions from the autogenerated list. |

### External APIs (existing credentials in `.env.local`)

| Service | Env var | Purpose for area pages |
|---|---|---|
| Spark API | `SPARK_API_KEY`, `SPARK_API_BASE_URL` | Live MLS pull — fallback when Supabase isn't fresh. Use sparingly. |
| OpenAI / Anthropic | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Generating area descriptions when `subdivision_descriptions` is empty. |
| Replicate | `REPLICATE_API_TOKEN` | AI imagery generation for area hero shots when no real photo exists. |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Audio narration of area summaries (Victoria voice, locked). |
| Follow Up Boss | `FOLLOWUPBOSS_API_KEY` | Lead capture from area-page CTAs. |
| Google service account | `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`, `..._PRIVATE_KEY`, `..._SUBJECT` | Gmail send + Search Console. Use for "alert me when new listings post" subscriptions. |

### MISSING data sources — gaps you'll need to fill

| Data | Why it matters | Recommended source | Implementation |
|---|---|---|---|
| **Schools** | Top buyer concern. School ratings/districts/distances are table-stakes for area pages. Currently NOT in the DB. | **GreatSchools.org API** (free tier, may need partnership for full data) OR **NCES Common Core of Data** (free, gov data, less rich) OR **Niche.com** (no public API). | Add a `schools` table (id, name, lat, lon, grades, rating, district, type, source, source_url, last_synced). Populate via a one-time backfill cron. Per area page: spatial query for schools within polygon + nearby district headers. |
| **Walk/transit/bike scores** | UX signal travelers love. | WalkScore.com API ($) or generate locally from OSM. | Per-area cached score; refresh quarterly. |
| **Climate/hazard** (wildfire risk, smoke days, snowfall) | Bend is in fire country. Major buyer concern. | NOAA Climate Data Online API (free), NIFC InciWeb (free), US Forest Service. | Add a `climate_risk` table per place. Refresh annually. |
| **Commute time to anchors** (downtown Bend, Mt. Bachelor, airport) | Quality-of-life detail. | Mapbox Directions API (free tier). | Compute once at build time per area centroid → 3 known anchors. |
| **Tax rate** | Listed in market_stats_cache as `median_tax_rate` but per-area accuracy needs verification. | Deschutes County Assessor (DIAL has tax maps + millage rates). | Populate per-city / per-county to start. |

---

## Existing Next.js scaffolding — what's already there

`/Users/matthewryan/RyanRealty/app/` already has these routes:

| Route | Files | Status |
|---|---|---|
| `app/cities/[slug]/page.tsx` | + error.tsx, loading.tsx | Skeleton exists. Read first to see what's there. |
| `app/cities/[slug]/[neighborhoodSlug]/page.tsx` | + error.tsx, loading.tsx | Nested neighborhood under city. |
| `app/communities/[slug]/page.tsx` | + error.tsx, loading.tsx | Subdivision/community page. |
| `app/area-guides/page.tsx` | + loading.tsx | Index page listing all area guides. |
| `app/listings/[listingKey]/` | full route | Listing detail. |
| `app/listing/[listingKey]/` | full route | Older alternate path. |
| `app/listing/by-key/[listingKey]/` | full route | Yet another alternate. **DEDUPE THESE** — pick one canonical path. |
| `app/admin/(protected)/geo/area-guide-upload` | admin tool | For uploading content to areas. |
| `app/admin/(protected)/resort-communities` | admin tool | Resort community admin. |
| `app/open-houses/[city]/` | per-city open houses | |
| `app/reports/sales/[city]/[period]/` | per-city sales reports | |
| `app/housing-market/explore/` | market explorer | |
| `app/sitemap.ts` | dynamic sitemap | Already enumerates many of these — read carefully before changing URL structures. |

`/Users/matthewryan/RyanRealty/lib/` already has:

- `lib/communities.ts` — community queries
- `lib/community-content.ts` — community content fetchers
- `lib/community-profiles.ts` — community profile builders
- `lib/city-content.ts` — city content fetchers
- `lib/resort-communities.ts` — resort-specific helpers
- `lib/structured-data.ts` — JSON-LD generators (Article, FAQPage, LocalBusiness, RealEstateAgent, BreadcrumbList)
- `lib/slug.ts` — slug utilities (cityEntityKey, listingDetailPath, etc.)
- `lib/search-presets.ts` — search preset helpers
- `lib/supabase/paginate.ts` — pagination helper for Supabase
- `lib/seo-route-contracts.test.ts` — SEO route contract tests (read this to understand the URL conventions)

Server actions in `app/actions/`:

- `cities.ts`, `communities.ts`, `subdivision-flags.ts`, `listing-detail.ts`, `market-stats.ts`, `area-guide-upload.ts`, `dashboard.ts`, `listings.ts`

**Step 1 of your work is to read all of these and understand what's already implemented.** Do not duplicate. Extend the existing scaffolding.

---

## Template specs — start here, refine with Matt

These are starting points. Matt approves before any of them gets built.

### Template 1 — City page (`/cities/[slug]`)

```
[HERO]
  - Full-bleed hero image from cities.hero_image_url OR asset_library where geo_tags @> [slug]
  - Optional hero video (cities.hero_video_url)
  - Headline: "Homes for Sale in <City Name>, Oregon"
  - Eyebrow: "Live market data + <active_count> homes currently listed"
  - Crumbs: Ryan Realty > Areas > <City>

[LIVE MARKET PULSE]  (data: market_pulse_live where geo_type='city' and geo_slug=<slug>)
  - 6 KPI cards in a grid
    1. Active inventory (active_count + new_count_7d delta)
    2. Median list price (median_list_price + 30d trend)
    3. Months of supply (months_of_supply + interpretation: seller's / balanced / buyer's)
    4. Median days to pending (median_days_to_pending)
    5. Sale-to-list ratio (median_sale_to_list)
    6. Market health score (market_health_score + market_health_label)
  - Source line: "Live as of <updated_at>, computed by Ryan Realty from Spark/Supabase"

[NARRATIVE]  (data: market_narratives latest row for this geo)
  - Overview paragraph
  - Buyer outlook / Seller outlook tabs
  - Expandable FAQ section (from market_narratives.faq jsonb)

[ACTIVE LISTINGS]
  - Top 12 active listings inside the city polygon (PostGIS ST_Contains)
  - Each card: hero photo, price, beds/baths/sqft, address, days on market, link to /listings/[listingKey]
  - "See all <active_count> active listings in <City>" link

[NEIGHBORHOODS WITHIN CITY]
  - Card grid of all neighborhoods that join to this city (neighborhoods.parent_city_slug)
  - Each card: hero, name, active count, median price
  - Link to /cities/[slug]/[neighborhoodSlug]

[HISTORICAL TRENDS]  (data: market_stats_cache, last 24 months by period_type='monthly')
  - Median sale price chart (line, 24mo)
  - Sold count chart (bar, 24mo)
  - YoY delta callout
  - Price band breakdown (donut from price_band_counts jsonb)
  - Bedroom breakdown (horizontal bars from bedroom_breakdown jsonb)

[SCHOOLS]  (data: NEW schools table, joined by spatial proximity to city polygon)
  - School district overview
  - 3 closest elementary + 2 middle + 1 high
  - Each: name, rating, grades, link to /schools/[id]

[ATTRACTIONS + LIFESTYLE]  (data: place_attractions where entity_key=<slug>, sort_order asc)
  - Restaurants, parks, breweries, trails
  - Cards with photo, name, short description, phone if available

[CLIMATE + COMMUTE]  (data: NEW climate_risk + commute_times)
  - Wildfire risk indicator
  - Average snowfall
  - Commute time to downtown Bend, Mt. Bachelor, RDM airport

[RECENT SALES]  (data: listing_history × spatial join, last 90 days)
  - Table of 10 most recent closes
  - Address (linked to /listings/[listingKey]), close price, close date, S/L%, DOM

[LEAD CAPTURE]
  - "Get listings in <City>" subscription form → FUB
  - "Free home valuation in <City>" → /free-home-valuation/?location=<slug>
  - Broker headshots (3 brokers) + CTA "Talk to Matt"

[FOOTER STRUCTURED-DATA]
  - JSON-LD: BreadcrumbList, RealEstateAgent, LocalBusiness, FAQPage (from market_narratives.faq)
  - Each rendered as <script type="application/ld+json">

[SEO]
  - <title>: <City> Bend Oregon Homes for Sale | <active_count> Active Listings
  - <meta description>: <City> real estate. <active_count> homes for sale, median $<X>. Live market data, school info, and Ryan Realty's licensed Oregon broker insight.
  - Canonical: https://ryan-realty.com/cities/<slug>/
  - OG image: dynamic OG generator at app/api/og/route.tsx (already exists)
```

### Template 2 — Neighborhood page (`/cities/[slug]/[neighborhoodSlug]`)

Same skeleton as City but scoped down. Differences:

- HERO is the neighborhood's specific photo (asset_library with geo_tags including neighborhood slug)
- Crumbs: Ryan Realty > Areas > Bend > Awbrey Butte
- LIVE MARKET PULSE pulls market_pulse_live where geo_type='neighborhood' (will be empty until Phase 4 — fall back to spatial-join computed on-the-fly)
- NO sub-section for nested neighborhoods (this IS the leaf neighborhood); instead show "Subdivisions in <Neighborhood>" — auto-list communities/subdivisions whose polygon centroid is inside the neighborhood polygon
- Schools section is more local — only schools whose lat/lon are inside the neighborhood polygon
- Add a "Why people choose <Neighborhood>" section sourced from `neighborhoods.description` or AI-generated from listing_history patterns (sqft, year_built, lot_size, architectural style)

### Template 3 — Subdivision page (`/communities/[slug]`)

Smaller scope. Differences from neighborhood:

- HERO can fall back to a representative listing photo if no asset_library match (e.g. most recent close in the polygon)
- LIVE PULSE may have 0 active listings — design the empty state intentionally:
  - "0 active listings in Tree Farm right now."
  - "Last sale: $4,100,000, closed <X> days ago, sold in 40 days at 99.4% of list."
  - "8 total sales since plat recorded. Median: $3.3M."
  - "Get notified when a home lists in Tree Farm" → FUB subscription form
- HISTORICAL section pulls ALL closes in this subdivision via spatial join, plot as scatter + trendline
- ATTRACTIONS pulls from `subdivision_descriptions.attractions` + `place_attractions`
- LIFESTYLE / amenities pulls from `subdivision_descriptions.dining` + nearby parks/trails
- Cross-link UP: "Tree Farm is part of the Summit West neighborhood, in the city of Bend." Each link uses the path templates above.

### Template 4 — Listing detail page (`/listings/[listingKey]`)

Single property focus. The data:

```
[GALLERY]
  - listing_photos sorted by sort_order, hero first
  - Carousel with 5+ photos
  - Lightbox

[FACTS HEADER]
  - Price (formatted)
  - Beds / Baths / Sqft / Lot Size
  - Status pill (Active / Pending / Coming Soon)
  - Days on market
  - Price change indicator (from price_history) if any in last 30 days

[ADDRESS + MAP]
  - Address (StreetNumber + StreetName + City + State + PostalCode)
  - Mapbox map showing exact pin + subdivision polygon overlay
  - "This home is in <Subdivision>, <Neighborhood>, <City>" with each linking to the area page
  - Walk Score / Transit Score / Bike Score (when integrated)

[REMARKS]
  - PublicRemarks (rewritten if banned-word list hits)
  - Listing agent info (from listing_agents)

[PROPERTY DETAILS]
  - Year built, lot size, garage spaces, HOA, taxes, MLS#, etc.

[FEATURES]
  - From InteriorFeatures, ExteriorFeatures, ApplianceFeatures arrays
  - Grouped by category with icons

[SCHOOLS]
  - 3 closest schools to property lat/lon

[OPEN HOUSES]  (data: open_houses where listing_key=<key>)
  - Upcoming events with RSVP button

[PRICE HISTORY + LISTING HISTORY]
  - Table of price changes and status changes
  - "First listed <X> days ago at $<Y>, currently at $<Z>"

[CMA-LITE]  (data: listing_history × spatial join, last 6 months)
  - 6 most-similar closes within 0.5mi
  - Each: address, sqft, beds/baths, close price, close date

[NEIGHBORHOOD CONTEXT]
  - Mini market-pulse from the enclosing neighborhood
  - "Market in <Neighborhood>: <active_count> active, median $<X>, sale-to-list <Y>%"
  - Link to full neighborhood page

[BROKER CTA]
  - "See this home with Matt Ryan" → schedule
  - "Get our take" — short broker comment if Matt's added one in admin

[FOOTER STRUCTURED-DATA]
  - JSON-LD: RealEstateListing, SingleFamilyResidence (or appropriate subtype), BreadcrumbList, Place
```

---

## Implementation approach — API-first, NOT through the AgentFire UI

Matt said: "Ideally, we would want to run through the API so we don't have to do things through the UI." Translation: build the templates in the Next.js app (`ryanrealty.vercel.app`), not via Spark Editor / Chrome MCP UI manipulation.

### Two paths to consider — pick one or hybrid

**Path A: Next.js renders everything; AgentFire stays as marketing CMS**
- All 4 templates render via Next.js at `ryan-realty.com` after DNS cutover, OR at `ryanrealty.vercel.app` today
- AgentFire keeps the brand homepage, About, Sellers, Buyers landing pages (where AgentFire's CBL editor is genuinely useful)
- Area + listing pages move OFF AgentFire entirely
- AgentFire menu items link OUT to the Next.js paths
- This is the future-state Matt described in `project_domain.md` — "current: ryanrealty.vercel.app, future: ryan-realty.com"
- **Recommended.** Cleanest, most maintainable, gives the templates full design control.

**Path B: AgentFire CBL with custom shortcodes pulling from Supabase**
- Build WordPress shortcodes (e.g. `[ryan_market_pulse geo="bend"]`, `[ryan_active_listings geo="bend" limit=12]`)
- Drop shortcodes into AgentFire pages so the visual frame is AgentFire but the data is ours
- Pro: no DNS cutover; AgentFire keeps menus + URL structure; visitors see one site
- Con: stuck with Spark theme limitations; harder to ship rich JS interactivity
- **Acceptable as a stopgap** to fix the worst pages today while building Path A in parallel

Recommend **Path A** as the primary track, with a small set of shortcodes (Path B) for the 4 highest-traffic existing AgentFire pages (Bend, Tumalo, Sisters, NW Crossing area pages) as a stopgap to be retired when Path A goes live.

### Build sequence (suggested)

1. **Schema additions:**
   - `schools` table (NCES-sourced + GreatSchools-enriched). Migration + backfill cron.
   - `climate_risk` table (NOAA + NIFC). Migration + annual refresh cron.
   - `commute_times` table (Mapbox Directions, 3 anchors per place). Migration + build-time precompute.
   - Backfill `cities` and `communities` from `boundaries` so every row has a polygon and provenance.
2. **`market_pulse_live` Phase 4 extension** (referenced in `docs/seo-neighborhood-polygon-fix-2026-05-14.md`): extend the aggregator to emit `geo_type='neighborhood'` and `geo_type='subdivision'` rows so live pulse covers every page level.
3. **Component library:**
   - `<MarketPulseCards>` (6 KPI grid)
   - `<HistoricalChart>` (line/bar over 24mo)
   - `<ActiveListingsGrid>` (card grid with hero photo + facts)
   - `<RecentSalesTable>` (close history table)
   - `<SchoolList>` (school cards)
   - `<AttractionsList>` (POI cards)
   - `<ClimateBadge>` (wildfire + snowfall pill)
   - `<CommuteList>` (3 anchor commute pills)
   - `<AreaCrumbs>` (city → neighborhood → subdivision)
   - `<RelatedAreasGrid>` (sibling neighborhoods or sub-subdivisions)
   - `<LeadCaptureForm>` (FUB integration)
   - `<BrokerCtaCard>` (broker portrait + schedule)
   - `<StructuredDataBlock>` (JSON-LD emitter — reuse `lib/structured-data.ts`)
4. **Page templates** in `app/cities/[slug]/page.tsx`, `app/cities/[slug]/[neighborhoodSlug]/page.tsx`, `app/communities/[slug]/page.tsx`, `app/listings/[listingKey]/page.tsx` — composing the components above with the appropriate data fetchers.
5. **Static generation** via `generateStaticParams()` so every city / neighborhood / subdivision becomes a pre-rendered route at build time. Use ISR (`revalidate: 3600`) so pulse data refreshes hourly without rebuilding the world.
6. **Sitemap update** (`app/sitemap.ts`) — enumerate all routes the new templates produce.
7. **Internal linking pass** — every area page must link to its parent + children + siblings. Run an audit at the end.
8. **Cron jobs** for data freshness: market_pulse_live refresh, schools sync (monthly), climate_risk refresh (annual), commute_times refresh (annual).

### Sub-skills to load (skill routing)

Per CLAUDE.md "Skill Routing" — load the relevant skill SKILL.md files BEFORE work:

- `data:write-query` (SQL best practices for Supabase listings)
- `data:analyze` (validating analyses before sharing)
- `design:design-system` (shadcn/ui + design system v2 enforcement)
- `engineering:code-review` (mandatory on every meaningful change before ship)
- `engineering:architecture` (when choosing between Path A and Path B)
- `engineering:testing-strategy` (template needs unit + integration tests)
- `engineering:deploy-checklist` (before production deploy)
- `marketing:seo-audit` (template SEO sanity check)
- `marketing:draft-content` (AI-generated area copy)
- `social_media_skills/blog-post/SKILL.md` (cross-link blog posts per area)

### MCP servers + tools you have

- **Supabase MCP** (`mcp__5adfee1a-..._execute_sql`, `_apply_migration`, `_list_tables`, etc.) — primary database access. Use for all schema migrations + ad-hoc queries.
- **Vercel MCP** (`mcp__da9a2bb6-..._deploy_to_vercel`, `_list_deployments`, etc.) — for deploying preview URLs Matt can review.
- **Claude in Chrome MCP** (`mcp__Claude_in_Chrome__*`) — last resort for AgentFire UI tasks. Avoid where the REST API can do it.
- **WebFetch / WebSearch** — for pulling GreatSchools / NOAA / NIFC docs at integration time.

---

## Open questions for Matt — surface these FIRST

Don't start coding before getting answers. Top of the list:

1. **Path A vs Path B vs hybrid?** Where do the new templates live? Next.js (`ryanrealty.vercel.app` today, `ryan-realty.com` after cutover) or AgentFire shortcodes or both?
2. **Cutover plan for ryan-realty.com?** If Path A, when do we cut DNS from AgentFire to Vercel? Need to coordinate with AgentFire (they own DNS through Cloudflare per the May 14 ticket thread).
3. **Schools data source?** GreatSchools API costs money. NCES is free but less rich. Niche.com has no public API. Pick one before scoping the schools section.
4. **Walkability budget?** WalkScore.com API is paid. OSM-derived walkability is free but requires effort.
5. **3,213 subdivisions — all of them?** Some recorded plats are tiny (single lot, 50 years old, never built out). Should we suppress subdivisions with < N homes platted? Use `subdivision_flags` table to mark which ones to publish.
6. **Resort communities special treatment?** `communities.is_resort` flag exists. Tetherow / Broken Top / Sunriver Lodge are resorts — different audience (second-home buyers, vacation rentals). May warrant a 5th template or a "resort variant" of the subdivision template.
7. **Tetherow + Broken Top are in `communities` (subdivision-grade) or `neighborhoods` (Bend district-grade)?** Decide which template they get. Probably subdivision-grade since they're not part of the City of Bend's 13 official neighborhood districts — they're south of city limits in unincorporated Deschutes County.
8. **Listing detail URL — `/listings/[listingKey]` or `/listing/[listingKey]` or `/listing/by-key/[listingKey]`?** Three exist; pick one canonical, redirect the others.
9. **Approval workflow for 3,200+ auto-generated subdivision pages?** Matt can't manually approve each one. Spec the autonomy boundary: "auto-publish as long as no banned words trip + every figure has a citation + a Matt-defined whitelist of subdivisions; everything else goes to a queue."

---

## First deliverables (before you write any production code)

1. **Read everything referenced above** — CLAUDE.md, the user-memory feedback files, `docs/seo-neighborhood-polygon-fix-2026-05-14.md`, `docs/seo-audit-ryan-realty-com-2026-05-13.md`, `docs/agentfire-menu-audit-2026-05-15.md`, every file in `lib/` and `app/actions/` listed above.
2. **Reply to Matt with the 9 open questions** above (or your refined version), structured so he can answer in one or two messages.
3. **Draft 4 template mocks** as static HTML files at `public/template-picker/area-templates/v1/{city,neighborhood,subdivision,listing}.html` — wire them up with real data from the database so Matt can click through actual cities/neighborhoods/subdivisions and see how the template behaves. Per `feedback_contact_sheet_required.md`, every draft surface must have an HTML preview Matt can open in his browser.
4. **Get Matt's verbal approval** on the template direction before writing production component code.
5. **Then** start with the schema additions + market_pulse_live Phase 4 + component library.

---

## What I (the prior session) just shipped today (2026-05-15) that matters here

- `43eff652` — `feat(gis): authoritative City of Bend neighborhood polygons + spatial backfill` — replaced 4 fabricated polygons with authoritative City of Bend GIS shapes; added GIST spatial index `idx_listings_bend_point_gist`; tagged ~3,200 listings (active + 24mo closed) via point-in-polygon; added provenance columns + RPC functions. **This is the foundation the area templates query against.** Do not re-do this work; build on top of it.
- Tree Farm + Valhalla Heights AgentFire pages got updated copy + corrected Yoast metadata (Northeast → Northwest). These will be obsoleted by the new templates but the corrected copy is in the page bodies in case AgentFire stays as a fallback.
- `docs/agentfire-menu-audit-2026-05-15.md` — comprehensive menu audit. The new area pages will need menu placement; the audit doc has proposals for nav restructure.
- `feedback_gis_authoritative_only.md` (user-memory) — the GIS rule. Internalize it before importing any new boundary data (schools, parks, climate).

## Repository handoff state

- Branch: `main`
- Working tree: largely clean except for in-flight non-GIS work (template-picker assets, list-kit Tumalo renders) that was already there
- Latest commit: `43eff652`

---

**Good luck. Don't approximate polygons. Don't ship unverified numbers. Show Matt the draft before you commit.**
