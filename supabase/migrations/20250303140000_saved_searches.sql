-- Saved searches for logged-in users (Instagram-for-real-estate style).
-- RLS: users can only read/insert/delete their own rows.

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches (user_id);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved_searches" ON saved_searches;
CREATE POLICY "Users can read own saved_searches"
  ON saved_searches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved_searches" ON saved_searches;
CREATE POLICY "Users can insert own saved_searches"
  ON saved_searches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved_searches" ON saved_searches;
CREATE POLICY "Users can delete own saved_searches"
  ON saved_searches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE saved_searches IS 'User saved searches; filters match listing page query params (city, subdivision, minPrice, etc.).';
