-- Saved/favorited listings per user (saved homes).
-- RLS: users can only read/insert/delete their own rows.

CREATE TABLE IF NOT EXISTS saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_key ON saved_listings (listing_key);

ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved_listings" ON saved_listings;
CREATE POLICY "Users can read own saved_listings"
  ON saved_listings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved_listings" ON saved_listings;
CREATE POLICY "Users can insert own saved_listings"
  ON saved_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved_listings" ON saved_listings;
CREATE POLICY "Users can delete own saved_listings"
  ON saved_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE saved_listings IS 'User saved/favorited listings (listing_key = Spark listing key).';
