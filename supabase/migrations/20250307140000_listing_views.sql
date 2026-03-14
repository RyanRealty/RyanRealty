-- Listing views for "Trending Homes" (most viewed in last 24h per city).
-- RLS: anyone can insert (anon + authenticated); only service role reads for aggregation.

CREATE TABLE IF NOT EXISTS listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  city text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_views_city_viewed_at ON listing_views (city, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_key ON listing_views (listing_key);

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert listing_views" ON listing_views;
CREATE POLICY "Anyone can insert listing_views"
  ON listing_views FOR INSERT TO anon, authenticated WITH CHECK (true);

-- No SELECT policy for anon/authenticated; aggregation via SECURITY DEFINER function only.

CREATE OR REPLACE FUNCTION get_trending_listing_keys(p_city text, p_limit int DEFAULT 16)
RETURNS TABLE (listing_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lv.listing_key
  FROM listing_views lv
  WHERE lv.city = p_city
    AND lv.viewed_at > now() - interval '24 hours'
  GROUP BY lv.listing_key
  ORDER BY count(*) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_trending_listing_keys IS 'Top listing keys by view count in last 24h for a city; for Trending Homes row.';

GRANT EXECUTE ON FUNCTION get_trending_listing_keys TO anon;
GRANT EXECUTE ON FUNCTION get_trending_listing_keys TO authenticated;

COMMENT ON TABLE listing_views IS 'One row per listing detail page view; used to compute trending homes by city (last 24h).';
