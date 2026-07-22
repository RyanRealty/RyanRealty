-- Hidden listings: "Hide homes I don't want to see" per signed-in user.
-- A hidden home is filtered out of the user's search results (client-side,
-- because listing caches are shared) and excluded from their alert emails
-- (before the seen-set diff in runListingAlerts, so it never counts as new).
-- RLS mirrors saved_listings: users read/insert/delete only their own rows.

CREATE TABLE IF NOT EXISTS hidden_listings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_key)
);

-- The composite PK (user_id, listing_key) already serves the per-user scan
-- (PK prefix), which is the only query shape (actions + alert engine).

ALTER TABLE hidden_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own hidden_listings" ON hidden_listings;
CREATE POLICY "Users can read own hidden_listings"
  ON hidden_listings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own hidden_listings" ON hidden_listings;
CREATE POLICY "Users can insert own hidden_listings"
  ON hidden_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own hidden_listings" ON hidden_listings;
CREATE POLICY "Users can delete own hidden_listings"
  ON hidden_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE hidden_listings IS 'Listings a user chose to hide from their search results and alert emails (listing_key = canonical RETS ListingKey).';
