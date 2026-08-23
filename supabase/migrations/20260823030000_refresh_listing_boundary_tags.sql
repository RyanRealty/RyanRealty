-- Market Truth Step 7 — restart boundary assignment.
-- listings.boundary_* stalled: 182 / 4333 Actives on/after 2026-05-01 had
-- boundary_city (4.2%). tag_listing_boundaries is LIMIT 1 with no smallest-
-- polygon tie-break (SPEC §1.7). This recency RPC batches untagged Actives,
-- picks the smallest valid polygon per geo_type, and stamps
-- 'Outside Boundaries' when no city polygon contains the point so the queue
-- does not retry forever. Do not SET session_replication_role here: hosted
-- postgres is not superuser, and that GUC is superuser-only. Batches stay
-- small so compute_listing_derived_fields (PITI) does not time out.

CREATE OR REPLACE FUNCTION public.refresh_listing_boundary_tags(
  p_after text DEFAULT '',
  p_limit integer DEFAULT 400,
  p_on_or_after date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_updated integer := 0;
  v_scanned integer := 0;
  v_last text := coalesce(p_after, '');
  v_cap integer := GREATEST(1, LEAST(coalesce(p_limit, 400), 2000));
BEGIN
  CREATE TEMP TABLE _bt_batch ON COMMIT DROP AS
  SELECT l."ListingKey" AS listing_key,
         l."Longitude"::float8 AS lon,
         l."Latitude"::float8 AS lat
  FROM public.listings l
  WHERE l."StandardStatus" = 'Active'
    AND l.boundary_city IS NULL
    AND l."Latitude" IS NOT NULL
    AND l."Longitude" IS NOT NULL
    AND (
      p_on_or_after IS NULL
      OR coalesce(l."OnMarketDate"::date, (l."ModificationTimestamp" AT TIME ZONE 'America/Los_Angeles')::date) >= p_on_or_after
    )
    AND (coalesce(p_after, '') = '' OR l."ListingKey" > p_after)
  ORDER BY l."ListingKey"
  LIMIT v_cap;

  SELECT count(*)::int, coalesce(max(listing_key), v_last)
  INTO v_scanned, v_last
  FROM _bt_batch;

  IF v_scanned = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'upserted', 0,
      'last_key', v_last,
      'done', true,
      'scanned', 0
    );
  END IF;

  WITH hits AS (
    SELECT DISTINCT ON (b.listing_key, bd.geo_type)
      b.listing_key,
      bd.geo_type,
      bd.geo_label
    FROM _bt_batch b
    JOIN public.boundaries bd
      ON bd.polygon IS NOT NULL
     AND ST_IsValid(bd.polygon)
     AND ST_Within(ST_SetSRID(ST_MakePoint(b.lon, b.lat), 4326), bd.polygon)
    WHERE bd.geo_type IN ('city', 'neighborhood', 'subdivision')
    ORDER BY b.listing_key, bd.geo_type, ST_Area(bd.polygon::geography) ASC, bd.geo_slug ASC
  ),
  pivoted AS (
    SELECT
      b.listing_key,
      max(h.geo_label) FILTER (WHERE h.geo_type = 'city') AS city,
      max(h.geo_label) FILTER (WHERE h.geo_type = 'neighborhood') AS neighborhood,
      max(h.geo_label) FILTER (WHERE h.geo_type = 'subdivision') AS subdivision
    FROM _bt_batch b
    LEFT JOIN hits h ON h.listing_key = b.listing_key
    GROUP BY b.listing_key
  )
  UPDATE public.listings l
  SET
    boundary_city = coalesce(p.city, 'Outside Boundaries'),
    boundary_neighborhood = coalesce(p.neighborhood, l.boundary_neighborhood),
    boundary_subdivision = coalesce(p.subdivision, l.boundary_subdivision)
  FROM pivoted p
  WHERE l."ListingKey" = p.listing_key;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_updated,
    'last_key', v_last,
    'done', v_scanned < v_cap,
    'scanned', v_scanned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_listing_boundary_tags(text, integer, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_listing_boundary_tags(text, integer, date) TO service_role;
