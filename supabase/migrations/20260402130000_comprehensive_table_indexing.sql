-- Comprehensive database table indexing migration.
-- Cross-references every query pattern in server actions, RPCs, and API routes
-- against existing indexes. Only creates indexes that are provably missing.
-- All statements are idempotent (IF NOT EXISTS / DO $$ guards).

-- ============================================================================
-- LISTINGS TABLE
-- ============================================================================

-- Spatial: CMA (get_cma_comps) uses ST_DWithin on (Longitude, Latitude).
-- A GIST index on a computed point geography dramatically speeds radius queries.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'Latitude'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'listings'
        AND indexname = 'idx_listings_geo_point'
    ) THEN
      CREATE INDEX idx_listings_geo_point
        ON listings USING GIST (
          (ST_SetSRID(ST_MakePoint("Longitude"::double precision, "Latitude"::double precision), 4326)::geography)
        )
        WHERE "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL;
    END IF;
  END IF;
END $$;

-- CloseDate: non-partial btree for range scans in compute_and_cache_period_stats,
-- get_city_metrics_timeseries, get_homepage_market_stats (BETWEEN period_start AND period_end).
-- The existing partial index (WHERE CloseDate IS NOT NULL or WHERE StandardStatus IN ('Closed','Final'))
-- cannot serve general range scans when the planner doesn't know the predicate ahead of time.
CREATE INDEX IF NOT EXISTS idx_listings_close_date_range
  ON listings ("CloseDate" DESC NULLS LAST);

-- StreetNumber: exact-match join in get_cma_comps_by_community
-- (l."StreetNumber" = p.street_number) and listing detail resolution.
CREATE INDEX IF NOT EXISTS idx_listings_street_number
  ON listings ("StreetNumber");

-- Composite: City + CloseDate for closed-sales-by-city reporting.
-- compute_and_cache_period_stats filters: lower("City") = lower(slug) AND "CloseDate" BETWEEN dates.
-- The functional index on LOWER(TRIM(COALESCE("City",''))) handles the city predicate;
-- this composite serves the non-LOWER exact city + close date pattern used in
-- get_city_metrics_timeseries (TRIM("City") ILIKE ... AND "CloseDate" BETWEEN ...).
CREATE INDEX IF NOT EXISTS idx_listings_city_closedate
  ON listings ("City", "CloseDate" DESC NULLS LAST)
  WHERE "CloseDate" IS NOT NULL;

-- Composite: StandardStatus + CloseDate for CMA queries.
-- get_cma_comps: WHERE StandardStatus ILIKE '%Closed%' AND CloseDate >= threshold.
CREATE INDEX IF NOT EXISTS idx_listings_status_closedate
  ON listings ("StandardStatus", "CloseDate" DESC NULLS LAST)
  WHERE "CloseDate" IS NOT NULL;

-- Composite: City + StandardStatus + ModificationTimestamp for search result ordering.
-- The most common search pattern: active listings in a city, ordered by newest.
CREATE INDEX IF NOT EXISTS idx_listings_city_status_modified
  ON listings ("City", "StandardStatus", "ModificationTimestamp" DESC NULLS LAST);

-- ClosePrice: used in CMA sorting and reporting aggregations.
-- get_cma_comps filters: COALESCE(ClosePrice, ...) IS NOT NULL AND > 0.
CREATE INDEX IF NOT EXISTS idx_listings_close_price_btree
  ON listings ("ClosePrice")
  WHERE "ClosePrice" IS NOT NULL AND "ClosePrice" > 0;

-- ListDate: used as fallback for OnMarketDate in refresh_market_pulse
-- (COALESCE(OnMarketDate, ListDate) >= threshold).
CREATE INDEX IF NOT EXISTS idx_listings_list_date
  ON listings ("ListDate" DESC NULLS LAST)
  WHERE "ListDate" IS NOT NULL;

-- SubdivisionName + StandardStatus composite for get_cma_comps_by_community
-- (WHERE SubdivisionName = v_sub AND StandardStatus ILIKE '%Closed%').
CREATE INDEX IF NOT EXISTS idx_listings_subdivision_status
  ON listings ("SubdivisionName", "StandardStatus")
  WHERE "SubdivisionName" IS NOT NULL;

-- ============================================================================
-- GEOGRAPHIC HIERARCHY TABLES (cities, neighborhoods, communities)
-- These tables are queried by slug/name in almost every page render but had
-- ZERO indexes beyond primary keys and the communities FK indexes.
-- ============================================================================

-- cities: slug lookup for city pages, OG images, navigation
CREATE INDEX IF NOT EXISTS idx_cities_slug ON cities (slug);

-- cities: name lookup for ILIKE search and stats queries
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities (name);

-- cities: functional lower(name) for case-insensitive matching
CREATE INDEX IF NOT EXISTS idx_cities_name_lower ON cities (LOWER(name));

-- neighborhoods: slug lookup for neighborhood pages
CREATE INDEX IF NOT EXISTS idx_neighborhoods_slug ON neighborhoods (slug);

-- neighborhoods: name for ILIKE search suggestions
CREATE INDEX IF NOT EXISTS idx_neighborhoods_name ON neighborhoods (name);

-- neighborhoods: city_id FK for parent lookups and cascading operations
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_id ON neighborhoods (city_id);

-- neighborhoods: composite slug + city_id for city-scoped neighborhood resolution
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_slug ON neighborhoods (city_id, slug);

-- communities: slug lookup for community/subdivision pages
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities (slug);

-- communities: name lookup for activity feed and subdivision matching
CREATE INDEX IF NOT EXISTS idx_communities_name ON communities (name);

-- communities: functional lower(name) for case-insensitive matching
CREATE INDEX IF NOT EXISTS idx_communities_name_lower ON communities (LOWER(name));

-- ============================================================================
-- LISTING_HISTORY
-- Price-change partial index for market reports (already exists but verify naming)
-- ============================================================================

-- listing_history: event ILIKE '%Pending%' pattern in market reports
CREATE INDEX IF NOT EXISTS idx_listing_history_event
  ON listing_history (event);

-- ============================================================================
-- OPEN_HOUSES
-- ============================================================================

-- open_houses: composite listing_key + event_date for upcoming open houses per listing
CREATE INDEX IF NOT EXISTS idx_open_houses_listing_date
  ON open_houses (listing_key, event_date ASC);

-- open_houses: event_date range queries (upcoming events)
CREATE INDEX IF NOT EXISTS idx_open_houses_event_date
  ON open_houses (event_date);

-- ============================================================================
-- PROPERTIES
-- ============================================================================

-- properties: city for CMA and valuation section (ILIKE on city)
CREATE INDEX IF NOT EXISTS idx_properties_city_lower
  ON properties (LOWER(city));

-- properties: composite street_number + postal_code for CMA join pattern
-- (l."StreetNumber" = p.street_number AND l."PostalCode" = p.postal_code)
CREATE INDEX IF NOT EXISTS idx_properties_street_postal
  ON properties (street_number, postal_code);

-- ============================================================================
-- MARKET STATS CACHE
-- These are lookup tables queried by (geo_type, geo_slug) on every page load.
-- The UNIQUE constraint on (geo_type, geo_slug, period_type, period_start)
-- creates an implicit unique index but the app often queries just geo_type + geo_slug.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'market_stats_cache') THEN
    CREATE INDEX IF NOT EXISTS idx_market_stats_cache_geo
      ON market_stats_cache (geo_type, geo_slug);
    CREATE INDEX IF NOT EXISTS idx_market_stats_cache_period
      ON market_stats_cache (geo_type, geo_slug, period_type, period_start DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'market_pulse_live') THEN
    CREATE INDEX IF NOT EXISTS idx_market_pulse_live_geo
      ON market_pulse_live (geo_type, geo_slug);
    CREATE INDEX IF NOT EXISTS idx_market_pulse_live_active
      ON market_pulse_live (active_count DESC)
      WHERE active_count > 0;
  END IF;
END $$;

-- ============================================================================
-- REPORTING_CACHE
-- Queried by (geo_type, geo_name ILIKE, period_type) with ORDER BY period_start.
-- The existing UNIQUE constraint covers exact matches but ILIKE needs a functional index.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reporting_cache_geo_lower
  ON reporting_cache (geo_type, LOWER(geo_name), period_type);

-- ============================================================================
-- MARKET_NARRATIVES (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'market_narratives') THEN
    CREATE INDEX IF NOT EXISTS idx_market_narratives_geo
      ON market_narratives (geo_type, geo_name);
    CREATE INDEX IF NOT EXISTS idx_market_narratives_period_end
      ON market_narratives (period_end DESC);
  END IF;
END $$;

-- ============================================================================
-- BROKER_STATS
-- Queried by broker_id, period_type, period_start for report pages.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_broker_stats_lookup
  ON broker_stats (broker_id, period_type, period_start DESC);

-- ============================================================================
-- BLOG_POSTS
-- ============================================================================

-- blog_posts: published listing with date ordering (public blog page)
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at
  ON blog_posts (published_at DESC)
  WHERE status = 'published';

-- ============================================================================
-- GUIDES
-- ============================================================================

-- guides: slug lookup is covered by UNIQUE constraint
-- guides: status + city for filtered guide lists
CREATE INDEX IF NOT EXISTS idx_guides_status_city
  ON guides (status, city);

-- ============================================================================
-- SAVED_CITIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_cities') THEN
    CREATE INDEX IF NOT EXISTS idx_saved_cities_user_id ON saved_cities (user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_cities_city_slug ON saved_cities (city_slug);
  END IF;
END $$;

-- ============================================================================
-- SAVED_COMMUNITIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_communities') THEN
    CREATE INDEX IF NOT EXISTS idx_saved_communities_user_id ON saved_communities (user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_communities_entity_key ON saved_communities (entity_key);
  END IF;
END $$;

-- ============================================================================
-- USER_COLLECTIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_collections') THEN
    CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections (user_id);
  END IF;
END $$;

-- ============================================================================
-- LISTING_SYNC_STATUS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'listing_sync_status') THEN
    CREATE INDEX IF NOT EXISTS idx_listing_sync_status_updated
      ON listing_sync_status (updated_at DESC);
  END IF;
END $$;

-- ============================================================================
-- SYNC_HISTORY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sync_history_completed
  ON sync_history (completed_at DESC NULLS LAST);

-- ============================================================================
-- LISTINGS_HISTORICAL (replication table)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'listings_historical') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_historical_city
      ON listings_historical ("City");
    CREATE INDEX IF NOT EXISTS idx_listings_historical_status
      ON listings_historical ("StandardStatus");
    CREATE INDEX IF NOT EXISTS idx_listings_historical_mod_ts
      ON listings_historical ("ModificationTimestamp" DESC NULLS LAST);
  END IF;
END $$;

-- ============================================================================
-- EMAIL_CAMPAIGNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created
  ON email_campaigns (created_at DESC);

-- ============================================================================
-- OPTIMIZATION_RUNS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'optimization_runs') THEN
    CREATE INDEX IF NOT EXISTS idx_optimization_runs_run_at
      ON optimization_runs (run_at DESC);
  END IF;
END $$;

-- ============================================================================
-- ADMIN_ACTIONS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_actions') THEN
    CREATE INDEX IF NOT EXISTS idx_admin_actions_created
      ON admin_actions (created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- PROFILES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lead_tier'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_lead_tier
      ON profiles (lead_tier)
      WHERE lead_tier IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- VALUATIONS
-- ============================================================================

-- valuations: ORDER BY computed_at for latest valuations
CREATE INDEX IF NOT EXISTS idx_valuations_computed_at
  ON valuations (property_id, computed_at DESC);

-- valuation_comps: ORDER BY similarity_score for ranked comps
CREATE INDEX IF NOT EXISTS idx_valuation_comps_similarity
  ON valuation_comps (valuation_id, similarity_score DESC);

-- ============================================================================
-- LISTING_EMBEDDINGS
-- ============================================================================

-- Functional index for case-insensitive city filter in match_listings_semantic
CREATE INDEX IF NOT EXISTS idx_listing_embeddings_city_lower
  ON listing_embeddings (LOWER(COALESCE(city, '')));

-- ============================================================================
-- SUBDIVISION_FLAGS / SUBDIVISION_DESCRIPTIONS
-- ============================================================================

-- subdivision_flags: partial index for resort filtering
-- (already exists from migration but ensure it's there)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subdivision_flags') THEN
    CREATE INDEX IF NOT EXISTS idx_subdivision_flags_resort
      ON subdivision_flags (entity_key)
      WHERE is_resort = true;
  END IF;
END $$;

-- ============================================================================
-- PLACE_ATTRACTIONS
-- ============================================================================

-- place_attractions: entity_key lookup (already exists but verify)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'place_attractions') THEN
    CREATE INDEX IF NOT EXISTS idx_place_attractions_entity_key
      ON place_attractions (entity_key);
  END IF;
END $$;

-- ============================================================================
-- BANNER_IMAGES
-- ============================================================================

-- banner_images: (entity_type, entity_key) lookup has UNIQUE constraint
-- but add a plain btree for entity_type-only scans
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'banner_images') THEN
    CREATE INDEX IF NOT EXISTS idx_banner_images_entity_type
      ON banner_images (entity_type);
  END IF;
END $$;

-- ============================================================================
-- PAGE_IMAGES
-- ============================================================================

-- page_images: (page_type, page_id) for area guide lookups (already in 012 but verify)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_images') THEN
    CREATE INDEX IF NOT EXISTS idx_page_images_page
      ON page_images (page_type, page_id);
  END IF;
END $$;

-- ============================================================================
-- EXPIRED_LISTINGS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expired_listings') THEN
    CREATE INDEX IF NOT EXISTS idx_expired_listings_listing_key
      ON expired_listings (listing_key);
    CREATE INDEX IF NOT EXISTS idx_expired_listings_expired_at
      ON expired_listings (expired_at DESC);
  END IF;
END $$;

-- ============================================================================
-- STATUS_HISTORY / PRICE_HISTORY (if not covered by 012)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'status_history') THEN
    CREATE INDEX IF NOT EXISTS idx_status_history_listing_date
      ON status_history (listing_key, changed_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_history') THEN
    CREATE INDEX IF NOT EXISTS idx_price_history_listing_date
      ON price_history (listing_key, changed_at DESC);
  END IF;
END $$;

-- ============================================================================
-- HEADSHOT_PROMPTS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'headshot_prompts') THEN
    CREATE INDEX IF NOT EXISTS idx_headshot_prompts_sort
      ON headshot_prompts (sort_order);
  END IF;
END $$;

-- ============================================================================
-- BROKER_GENERATED_MEDIA
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'broker_generated_media') THEN
    CREATE INDEX IF NOT EXISTS idx_broker_generated_media_broker
      ON broker_generated_media (broker_id);
  END IF;
END $$;

-- ============================================================================
-- OPEN_HOUSE_RSVPS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'open_house_rsvps') THEN
    CREATE INDEX IF NOT EXISTS idx_open_house_rsvps_open_house
      ON open_house_rsvps (open_house_id);
    CREATE INDEX IF NOT EXISTS idx_open_house_rsvps_user
      ON open_house_rsvps (user_id);
  END IF;
END $$;

-- ============================================================================
-- ANALYZE updated tables so the query planner uses the new indexes
-- ============================================================================

ANALYZE listings;
ANALYZE listing_history;
ANALYZE cities;
ANALYZE neighborhoods;
ANALYZE communities;
ANALYZE open_houses;
ANALYZE properties;
ANALYZE reporting_cache;
ANALYZE broker_stats;
ANALYZE blog_posts;
ANALYZE email_campaigns;
ANALYZE sync_history;
ANALYZE valuations;
ANALYZE valuation_comps;
ANALYZE listing_embeddings;
