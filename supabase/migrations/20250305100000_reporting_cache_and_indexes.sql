-- Reporting: pre-aggregated cache so reports use 100% of listings but stay lightning-fast.
-- Refresh runs after each sync (or cron); get_listings_breakdown() reads from cache.
-- Run: npx supabase db push

-- Single-row cache for full listings breakdown (total, by status, by city). Updated by refresh_listings_breakdown().
CREATE TABLE IF NOT EXISTS report_listings_breakdown (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total bigint NOT NULL DEFAULT 0,
  by_status jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_city jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE report_listings_breakdown IS 'Pre-aggregated full breakdown of all listings. Refreshed after sync so reports are fast and 100% accurate.';

ALTER TABLE report_listings_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read report_listings_breakdown" ON report_listings_breakdown;
CREATE POLICY "Allow public read report_listings_breakdown"
  ON report_listings_breakdown FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role full access report_listings_breakdown" ON report_listings_breakdown;
CREATE POLICY "Service role full access report_listings_breakdown"
  ON report_listings_breakdown FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Populate cache by scanning all listings. Call after every sync so reports stay accurate.
CREATE OR REPLACE FUNCTION refresh_listings_breakdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count bigint;
  by_status_json jsonb;
  by_city_json jsonb;
BEGIN
  SELECT COUNT(*) INTO total_count FROM listings;

  SELECT COALESCE(
    (SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY (t.count) DESC)
     FROM (
       SELECT
         COALESCE(NULLIF(TRIM("StandardStatus"), ''), 'Active') AS status,
         COUNT(*)::bigint AS count
       FROM listings
       GROUP BY COALESCE(NULLIF(TRIM("StandardStatus"), ''), 'Active')
     ) t),
    '[]'::jsonb
  ) INTO by_status_json;

  SELECT COALESCE(
    (SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY (t.total) DESC)
     FROM (
       SELECT
         COALESCE(TRIM("City"), '(no city)') AS city,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE
           COALESCE(TRIM("StandardStatus"), '') = ''
           OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
           OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
           OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
         )::int AS active,
         COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%')::int AS pending,
         COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int AS closed,
         COUNT(*) FILTER (WHERE
           NOT (
             COALESCE(TRIM("StandardStatus"), '') = ''
             OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
             OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
             OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
           )
           AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
           AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%closed%'
         )::int AS other
       FROM listings
       GROUP BY COALESCE(TRIM("City"), '(no city)')
     ) t),
    '[]'::jsonb
  ) INTO by_city_json;

  INSERT INTO report_listings_breakdown (id, total, by_status, by_city, updated_at)
  VALUES (1, total_count, by_status_json, by_city_json, now())
  ON CONFLICT (id) DO UPDATE SET
    total = EXCLUDED.total,
    by_status = EXCLUDED.by_status,
    by_city = EXCLUDED.by_city,
    updated_at = EXCLUDED.updated_at;
END;
$$;

COMMENT ON FUNCTION refresh_listings_breakdown() IS 'Recomputes full listings breakdown from all rows and updates report_listings_breakdown. Call after every sync.';

-- get_listings_breakdown() now reads from cache = instant. Same JSON shape as before.
CREATE OR REPLACE FUNCTION get_listings_breakdown()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r report_listings_breakdown%ROWTYPE;
BEGIN
  SELECT * INTO r FROM report_listings_breakdown WHERE id = 1 LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('total', 0::bigint, 'byStatus', '[]'::json, 'byCity', '[]'::json);
  END IF;
  RETURN json_build_object(
    'total', r.total,
    'byStatus', r.by_status,
    'byCity', r.by_city
  );
END;
$$;

COMMENT ON FUNCTION get_listings_breakdown() IS 'Returns pre-aggregated full breakdown (all listings). Fast: reads from report_listings_breakdown. Run refresh_listings_breakdown() after sync.';

-- Indexes for fast reporting queries (listings)
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings ("City");
CREATE INDEX IF NOT EXISTS idx_listings_standard_status ON listings ("StandardStatus");
CREATE INDEX IF NOT EXISTS idx_listings_modification_timestamp ON listings ("ModificationTimestamp" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings ("City", "StandardStatus");

-- Index for price-drop and history reports
CREATE INDEX IF NOT EXISTS idx_listing_history_price_change ON listing_history (price_change) WHERE price_change IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listing_history_event_listing ON listing_history (listing_key, event_date DESC);

-- Populate cache with current data (so reports work immediately after push)
SELECT refresh_listings_breakdown();
