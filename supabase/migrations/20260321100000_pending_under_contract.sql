-- Count "Active Under Contract" (and any status containing "under contract") as pending.
-- RESO StandardStatus uses "Active Under Contract" for under-contract listings; we were only matching "%pending%".

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

  -- Pending = RESO "Pending" or "Active Under Contract" (under contract). Active excludes those so buckets stay mutually exclusive.
  WITH city_rows AS (
    SELECT
      COALESCE(TRIM(l."City"), '(no city)') AS city,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE
        (
          COALESCE(TRIM(l."StandardStatus"), '') = ''
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%active%'
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%for sale%'
          OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%coming soon%'
        )
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%pending%'
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%under contract%'
      )::int AS active,
      COUNT(*) FILTER (WHERE
        LOWER(COALESCE(l."StandardStatus", '')) LIKE '%pending%'
        OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%under contract%'
      )::int AS pending,
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
        AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%under contract%'
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

COMMENT ON FUNCTION refresh_listings_breakdown() IS 'Recomputes breakdown. Pending = status contains pending or under contract (RESO Active Under Contract). Call after every sync.';

-- Same pending logic for city and subdivision status counts (search page, hot communities).
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
      (
        COALESCE(TRIM("StandardStatus"), '') = ''
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
      )
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%under contract%'
    )::int,
    COUNT(*) FILTER (WHERE
      LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%'
      OR LOWER(COALESCE("StandardStatus", '')) LIKE '%under contract%'
    )::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int,
    COUNT(*) FILTER (WHERE
      NOT (
        COALESCE(TRIM("StandardStatus"), '') = ''
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
        OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
      )
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%under contract%'
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
          (
            COALESCE(TRIM("StandardStatus"), '') = ''
            OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
            OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
            OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%'
          )
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%under contract%'
        )::int AS active,
        COUNT(*) FILTER (WHERE
          LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%under contract%'
        )::int AS pending,
        COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int AS closed
      FROM listings
      WHERE TRIM("City") ILIKE TRIM(p_city)
        AND TRIM(COALESCE("SubdivisionName", '')) <> ''
      GROUP BY COALESCE(TRIM("SubdivisionName"), '')
    ) t
  );
END;
$$;
