-- Dashboard: profiles notification_preferences and buyer_preferences; saved_searches notification fields; saved_listings collection_name.
-- Safe to run: adds columns only if missing.

-- profiles: notification_preferences, buyer_preferences (for dashboard settings and notifications)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'notification_preferences') THEN
    ALTER TABLE profiles ADD COLUMN notification_preferences jsonb DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'buyer_preferences') THEN
    ALTER TABLE profiles ADD COLUMN buyer_preferences jsonb DEFAULT '{}';
  END IF;
END $$;

-- saved_listings: collection_name for "My Collections"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_listings' AND column_name = 'collection_name') THEN
    ALTER TABLE saved_listings ADD COLUMN collection_name text NOT NULL DEFAULT 'All Saved';
  END IF;
END $$;

-- saved_searches: notification_frequency, is_paused, last_notified_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'notification_frequency') THEN
    ALTER TABLE saved_searches ADD COLUMN notification_frequency text NOT NULL DEFAULT 'daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'is_paused') THEN
    ALTER TABLE saved_searches ADD COLUMN is_paused boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'saved_searches' AND column_name = 'last_notified_at') THEN
    ALTER TABLE saved_searches ADD COLUMN last_notified_at timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN profiles.notification_preferences IS 'User notification settings: email on/off, per-category toggles, frequencies.';
COMMENT ON COLUMN profiles.buyer_preferences IS 'Buyer preferences: cities, communities, budget, beds/baths, must-haves, timeline.';

-- User-created collection names (so empty collections can exist)
CREATE TABLE IF NOT EXISTS user_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own user_collections" ON user_collections;
CREATE POLICY "Users own user_collections"
  ON user_collections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
COMMENT ON TABLE user_collections IS 'User-named collections for grouping saved listings.';
