-- Migration 012: Indexes
-- Section 7.10c plus PostGIS spatial, FK indexes, and composite query patterns.
-- Use IF NOT EXISTS where supported (PostgreSQL 9.5+); omit for partial indexes.

-- Delta sync: find modified listings quickly (existing listings table may use PascalCase columns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'modification_timestamp') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_modification_ts ON listings(modification_timestamp);
    CREATE INDEX IF NOT EXISTS idx_listings_status_modified ON listings(standard_status, modification_timestamp);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'ModificationTimestamp') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_modification_ts ON listings("ModificationTimestamp");
    CREATE INDEX IF NOT EXISTS idx_listings_status_modified ON listings("StandardStatus", "ModificationTimestamp");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'standard_status') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_standard_status ON listings(standard_status);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'StandardStatus') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_standard_status ON listings("StandardStatus");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'listing_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_listing_key ON listings(listing_key);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'ListingKey') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_listing_key ON listings("ListingKey");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'property_id') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_property_id ON listings(property_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'subdivision_name') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_subdivision_name ON listings(subdivision_name);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'SubdivisionName') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_subdivision_name ON listings("SubdivisionName");
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'close_date') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_close_date ON listings(close_date) WHERE standard_status IN ('Closed', 'Final');
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'CloseDate') THEN
    CREATE INDEX IF NOT EXISTS idx_listings_close_date ON listings("CloseDate") WHERE "StandardStatus" IN ('Closed', 'Final');
  END IF;
END $$;

-- Property/listing lookup
CREATE INDEX IF NOT EXISTS idx_properties_unparsed_address ON properties(unparsed_address);
CREATE INDEX IF NOT EXISTS idx_properties_community_id ON properties(community_id);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood_id ON properties(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);

-- PostGIS spatial index for CMA and radius queries
CREATE INDEX IF NOT EXISTS idx_properties_geography ON properties USING GIST(geography);

-- Saved search matching
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'is_paused') THEN
    CREATE INDEX IF NOT EXISTS idx_saved_searches_active ON saved_searches(notification_frequency) WHERE is_paused = false;
  END IF;
END $$;

-- Notification queue: process pending
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);

-- Engagement: trending score computation
CREATE INDEX IF NOT EXISTS idx_user_activities_recent ON user_activities(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_entity ON user_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_listing_key ON engagement_metrics(listing_key);

-- Price history: recent drops
CREATE INDEX IF NOT EXISTS idx_price_history_listing_key_changed ON price_history(listing_key, changed_at);
CREATE INDEX IF NOT EXISTS idx_status_history_listing_key ON status_history(listing_key);

-- Listing media
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_key ON listing_photos(listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_videos_listing_key ON listing_videos(listing_key);

-- Listing agents
CREATE INDEX IF NOT EXISTS idx_listing_agents_listing_key ON listing_agents(listing_key);

-- Valuations and reporting
CREATE INDEX IF NOT EXISTS idx_valuations_property ON valuations(property_id);
CREATE INDEX IF NOT EXISTS idx_valuation_comps_valuation ON valuation_comps(valuation_id);
CREATE INDEX IF NOT EXISTS idx_reporting_cache_lookup ON reporting_cache(geo_type, geo_name, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_broker_stats_broker ON broker_stats(broker_id);
CREATE INDEX IF NOT EXISTS idx_trending_scores_entity ON trending_scores(entity_type, entity_id);

-- Saved listings and shared collections
CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_key ON saved_listings(listing_key);
CREATE INDEX IF NOT EXISTS idx_shared_collections_slug ON shared_collections(slug);
CREATE INDEX IF NOT EXISTS idx_shared_collections_creator ON shared_collections(creator_user_id);

-- Blog and content
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_broker_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_entity ON ai_content(entity_type, entity_id);

-- Open houses
CREATE INDEX IF NOT EXISTS idx_open_houses_listing_key ON open_houses(listing_key);
CREATE INDEX IF NOT EXISTS idx_open_houses_date ON open_houses(event_date);

-- Sync and jobs
CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_sync_type ON sync_checkpoints(sync_type);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON job_runs(job_name, started_at DESC);

-- FUB and reviews
CREATE INDEX IF NOT EXISTS idx_fub_contacts_broker ON fub_contacts_cache(broker_id);
CREATE INDEX IF NOT EXISTS idx_reviews_broker ON reviews(broker_id);
CREATE INDEX IF NOT EXISTS idx_reviews_hidden ON reviews(is_hidden) WHERE is_hidden = false;

-- Third-party cache
CREATE INDEX IF NOT EXISTS idx_listing_schools_listing_key ON listing_schools(listing_key);
CREATE INDEX IF NOT EXISTS idx_listing_amenities_listing_key ON listing_amenities(listing_key);
CREATE INDEX IF NOT EXISTS idx_page_images_page ON page_images(page_type, page_id);
