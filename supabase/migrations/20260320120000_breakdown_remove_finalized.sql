-- Remove finalized from by_city in refresh_listings_breakdown (by-city table no longer shows that column).

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

  WITH city_rows AS (
    SELECT
      COALESCE(TRIM(l."City"), '(no city)') AS city,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE
        COALESCE(TRIM(l."StandardStatus"), '') = ''
        OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%active%'
        OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%for sale%'
        OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%coming soon%'
      )::int AS active,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%pending%')::int AS pending,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%')::int AS closed,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%withdrawn%')::int AS withdrawn,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%expired%')::int AS expired,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%cancel%')::int AS canceled,
      COUNT(*) FILTER (WHERE
        NOT (
          COALESCE(TRIM(l."StandardStatus"), '') = ''
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%active%'
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%for sale%'
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%coming soon%'
        )
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%pending%'
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%closed%'
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%withdrawn%'
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%expired%'
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%cancel%'
      )::int AS other
    FROM listings l
    GROUP BY COALESCE(TRIM(l."City"), '(no city)')
  )
  SELECT COALESCE(
    (SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY (t.total) DESC)
     FROM (SELECT city, total, active, pending, closed, withdrawn, expired, canceled, other FROM city_rows) t),
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

COMMENT ON FUNCTION refresh_listings_breakdown() IS 'Recomputes full listings breakdown: by_status (raw Spark), by_city (active, pending, closed, withdrawn, expired, canceled, other). Call after every sync.';
