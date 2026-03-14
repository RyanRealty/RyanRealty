-- Saved/favorited cities per user. city_slug matches cities table / URL (e.g. bend, redmond).

CREATE TABLE IF NOT EXISTS saved_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, city_slug)
);

CREATE INDEX IF NOT EXISTS idx_saved_cities_user_id ON saved_cities (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_cities_city_slug ON saved_cities (city_slug);

ALTER TABLE saved_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved_cities" ON saved_cities;
CREATE POLICY "Users can read own saved_cities"
  ON saved_cities FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved_cities" ON saved_cities;
CREATE POLICY "Users can insert own saved_cities"
  ON saved_cities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved_cities" ON saved_cities;
CREATE POLICY "Users can delete own saved_cities"
  ON saved_cities FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE saved_cities IS 'User saved/favorited cities (city_slug = URL slug, e.g. bend, sunriver).';
