-- Migration 006: User Engagement
-- Saved listings, saved searches, activity log, engagement metrics, shared collections. Section 6.

CREATE TABLE IF NOT EXISTS saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  collection_name text NOT NULL DEFAULT 'All Saved',
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_key ON saved_listings(listing_key);
COMMENT ON TABLE saved_listings IS 'User saved listings. One row per user+listing_key; collection_name for grouping.';

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_name text,
  filters jsonb NOT NULL DEFAULT '{}',
  notification_frequency text NOT NULL DEFAULT 'daily',
  is_paused boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE saved_searches IS 'Saved search filters; notification_frequency drives digest (instant/daily/weekly).';

CREATE TABLE IF NOT EXISTS user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_cookie_id text,
  activity_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_activities IS 'Master activity log: view, save, like, share, search, etc. user_id null for anonymous.';

CREATE TABLE IF NOT EXISTS engagement_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL UNIQUE,
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  share_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_listing_key ON engagement_metrics(listing_key);
COMMENT ON TABLE engagement_metrics IS 'Aggregated engagement per listing; join to listings via listing_key.';

CREATE TABLE IF NOT EXISTS shared_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  listing_ids jsonb NOT NULL DEFAULT '[]',
  personal_message text,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE shared_collections IS 'Shareable collection URLs; slug used in public URL.';
