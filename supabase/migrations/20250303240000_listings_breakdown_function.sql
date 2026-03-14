-- Admin listings breakdown: total, by status, by city (Active/Pending/Closed per Spark API).
-- Categorization matches Spark StandardStatus: Active (or For Sale, Coming Soon, null), Pending (contains 'pending'), Closed (contains 'closed').
-- Used by getListingsBreakdown() so the sync page shows full counts (not limited by 1k row default).

CREATE OR REPLACE FUNCTION get_listings_breakdown()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  by_status_json JSON;
  by_city_json JSON;
  total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM listings;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.count DESC),
    '[]'::json
  ) INTO by_status_json
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM("StandardStatus"), ''), 'Active') AS status,
      COUNT(*)::int AS count
    FROM listings
    GROUP BY COALESCE(NULLIF(TRIM("StandardStatus"), ''), 'Active')
  ) t;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.total DESC),
    '[]'::json
  ) INTO by_city_json
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
  ) t;

  RETURN json_build_object(
    'total', total_count,
    'byStatus', by_status_json,
    'byCity', by_city_json
  );
END;
$$;

COMMENT ON FUNCTION get_listings_breakdown() IS 'Admin sync page: full listing counts. By status = raw Spark StandardStatus; by city buckets = Spark Active/Pending/Closed.';

-- City (and optional subdivision) status counts so search page summary matches sync page breakdown.
CREATE OR REPLACE FUNCTION get_city_status_counts(p_city text, p_subdivision text DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count int;
  pending_count int;
  closed_count int;
  other_count int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE
      COALESCE(TRIM("StandardStatus"), '') = ''
      OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
      OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
      OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
    )::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%')::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int,
    COUNT(*) FILTER (WHERE
      NOT (
        COALESCE(TRIM("StandardStatus"), '') = ''
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
      )
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%closed%'
    )::int
  INTO active_count, pending_count, closed_count, other_count
  FROM listings
  WHERE (p_city IS NULL OR TRIM("City") ILIKE TRIM(p_city))
    AND (p_subdivision IS NULL OR TRIM(p_subdivision) = '' OR TRIM("SubdivisionName") ILIKE TRIM(p_subdivision));

  RETURN json_build_object(
    'active', COALESCE(active_count, 0),
    'pending', COALESCE(pending_count, 0),
    'closed', COALESCE(closed_count, 0),
    'other', COALESCE(other_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION get_city_status_counts(text, text) IS 'Status counts for a city (and optional subdivision). Same logic as get_listings_breakdown so search page summary matches sync page.';

-- Per-subdivision status counts for a city (for hot communities). Same status logic as above.
CREATE OR REPLACE FUNCTION get_subdivision_status_counts(p_city text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY (t.active + t.pending) DESC), '[]'::json)
    FROM (
      SELECT
        COALESCE(TRIM("SubdivisionName"), '') AS subdivision_name,
        COUNT(*) FILTER (WHERE
          COALESCE(TRIM("StandardStatus"), '') = ''
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
        )::int AS active,
        COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%')::int AS pending,
        COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int AS closed
      FROM listings
      WHERE TRIM("City") ILIKE TRIM(p_city)
        AND TRIM(COALESCE("SubdivisionName", '')) <> ''
      GROUP BY COALESCE(TRIM("SubdivisionName"), '')
    ) t
  );
END;
$$;

COMMENT ON FUNCTION get_subdivision_status_counts(text) IS 'Per-subdivision active/pending/closed for a city. Used for hot communities so counts match sync page.';
