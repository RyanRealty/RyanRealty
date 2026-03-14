-- Sync dashboard: exact status buckets (active, pending, contingent, closed, closed_finalized, expired, withdrawn, cancelled, other) and by city (A–Z).
-- Buckets are mutually exclusive. Pending = pending/under contract only; contingent is separate.

CREATE OR REPLACE FUNCTION get_listing_sync_status_breakdown()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count bigint;
  active_count int;
  pending_count int;
  contingent_count int;
  closed_count int;
  closed_finalized_count int;
  expired_count int;
  withdrawn_count int;
  cancelled_count int;
  other_count int;
  by_city_json jsonb;
BEGIN
  SELECT COUNT(*) INTO total_count FROM listings;

  -- Totals: mutually exclusive buckets (order: closed, expired, withdrawn, cancelled, contingent, pending, active, other)
  SELECT
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%' AND history_finalized = true)::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%expired%')::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%withdrawn%')::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%cancel%')::int,
    COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%contingent%')::int,
    COUNT(*) FILTER (WHERE
      (LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%'
       OR LOWER(COALESCE("StandardStatus", '')) LIKE '%under contract%'
       OR LOWER(COALESCE("StandardStatus", '')) LIKE '%undercontract%')
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%contingent%'
    )::int,
    COUNT(*) FILTER (WHERE
      (COALESCE(TRIM("StandardStatus"), '') = ''
       OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
       OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
       OR LOWER(COALESCE("StandardStatus", '')) LIKE '%coming soon%')
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%closed%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%expired%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%withdrawn%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%cancel%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%contingent%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%under contract%'
      AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%undercontract%'
    )::int
  INTO closed_count, closed_finalized_count, expired_count, withdrawn_count, cancelled_count, contingent_count, pending_count, active_count
  FROM listings;

  other_count := GREATEST(0, total_count::int - closed_count - expired_count - withdrawn_count - cancelled_count - contingent_count - pending_count - active_count);

  -- By city: same buckets, ordered by city A–Z
  SELECT COALESCE(
    (SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.city)
     FROM (
       SELECT
         COALESCE(TRIM(l."City"), '(no city)') AS city,
         COUNT(*) FILTER (WHERE
           (COALESCE(TRIM(l."StandardStatus"), '') = ''
            OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%active%'
            OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%for sale%'
            OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%coming soon%')
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%closed%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%expired%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%withdrawn%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%cancel%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%contingent%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%pending%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%under contract%'
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%undercontract%'
         )::int AS active,
         COUNT(*) FILTER (WHERE
           (LOWER(COALESCE(l."StandardStatus", '')) LIKE '%pending%'
            OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%under contract%'
            OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%undercontract%')
           AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%contingent%'
         )::int AS pending,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%contingent%')::int AS contingent,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%')::int AS closed,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%' AND l.history_finalized = true)::int AS closed_finalized,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%expired%')::int AS expired,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%withdrawn%')::int AS withdrawn,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%cancel%')::int AS cancelled,
         (COUNT(*)::int - COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%closed%')::int
          - COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%expired%')::int
          - COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%withdrawn%')::int
          - COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%cancel%')::int
          - COUNT(*) FILTER (WHERE LOWER(COALESCE(l."StandardStatus", '')) LIKE '%contingent%')::int
          - COUNT(*) FILTER (WHERE
            (LOWER(COALESCE(l."StandardStatus", '')) LIKE '%pending%'
             OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%under contract%'
             OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%undercontract%')
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%contingent%')::int
          - COUNT(*) FILTER (WHERE
            (COALESCE(TRIM(l."StandardStatus"), '') = ''
             OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%active%'
             OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%for sale%'
             OR LOWER(COALESCE(l."StandardStatus", '')) LIKE '%coming soon%')
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%closed%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%expired%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%withdrawn%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%cancel%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%contingent%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%pending%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%under contract%'
            AND LOWER(COALESCE(l."StandardStatus", '')) NOT LIKE '%undercontract%')::int
         ) AS other
       FROM listings l
       GROUP BY COALESCE(TRIM(l."City"), '(no city)')
     ) t),
    '[]'::jsonb
  ) INTO by_city_json;

  RETURN json_build_object(
    'total', total_count,
    'active', COALESCE(active_count, 0),
    'pending', COALESCE(pending_count, 0),
    'contingent', COALESCE(contingent_count, 0),
    'closed', COALESCE(closed_count, 0),
    'closed_finalized', COALESCE(closed_finalized_count, 0),
    'expired', COALESCE(expired_count, 0),
    'withdrawn', COALESCE(withdrawn_count, 0),
    'cancelled', COALESCE(cancelled_count, 0),
    'other', COALESCE(other_count, 0),
    'by_city', by_city_json
  );
END;
$$;

COMMENT ON FUNCTION get_listing_sync_status_breakdown() IS 'Sync dashboard: counts by status (active, pending, contingent, closed+finalized, expired, withdrawn, cancelled, other) and by city A–Z.';
