-- place_membership stays current: an incremental refresh on pg_cron.
-- Audit COMP-3 (visibility audit 2026-09-22), package P9.
--
-- THE DEFECT. public.refresh_place_membership (20260823001500) is a keyset
-- sweep that was run by hand once, on 2026-08-22/23, and never again: no
-- cron route, no pg_cron job and no compute function calls it. Measured
-- 2026-09-23 00:28 UTC through service-role row reads:
--   * newest place_membership.computed_at = 2026-08-23 21:32:49 UTC;
--   * 242 of 1,228 Bend Active listings (19.7%) had no city membership row
--     (on-market month 2026-08: 56, 2026-09: 184);
--   * 2,131 of 596,916 listings keys had no membership row of any kind,
--     1,514 of them entered the MLS after the 2026-08-23 sweep;
--   * Tetherow: 15 Active single-family homes inside its polygon, 11 of them
--     with a Tetherow membership row, so /communities/tetherow printed 11.
-- Every Market Truth cell (market_metric) joins place_membership, so every
-- active count, median list price and months-of-supply figure at every grain
-- was missing a month of new listings.
--
-- THE FIX.
--   1. The membership rules move, unchanged, into one function that rebuilds
--      an explicit key set: place_membership_rebuild_keys(text[]).
--   2. refresh_place_membership(p_after, p_limit) keeps its signature and
--      return shape and delegates to it (the keyset sweep is still the tool
--      after a boundary edit).
--   3. refresh_place_membership_changed(p_limit, p_lookback_hours) rebuilds
--      only listings whose MLS ModificationTimestamp is newer than their
--      membership rows (or that have none), newest first. Stateless: a listing
--      synced late, after a run, is still newer than its old rows next run.
--      Candidate cost is an index range on idx_listings_modification_timestamp
--      plus one place_membership_listing_idx probe per candidate (8,239 rows in
--      a 45-day window, measured 2026-09-23).
--   4. pg_cron runs it every 15 minutes at :09/:24/:39/:54, after sync-delta
--      writes listings (:03/:18/:33/:48) and before the 6-hourly Market Truth
--      computes (:20 city, :40 neighborhood, :50 subdivision).
--   5. Each successful run stamps mv_refresh_state('place_membership'), the
--      freshness row the scoreboard reads (lib/data/loop/signals.ts).
--
-- Lock id 7109 (7101 tile, 7102 geo_snapshot, 7103 market_pulse,
-- 7104 listing_detail, 7105 similar_listings, 7106 listing_search,
-- 7107 listing_boundary_xref, 7108 neighborhood_year_pricing).
--
-- The 45-day default lookback is the catch-up: the first runs after this
-- lands rebuild every listing modified since the 2026-08-23 sweep, 2,000 per
-- run. After that a run sees only the last 15 minutes of changes plus any
-- listing whose rows are older than its latest modification.

-- 1 ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_membership_rebuild_keys(p_keys text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  IF p_keys IS NULL OR array_length(p_keys, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.place_membership
  WHERE listing_key = ANY (p_keys);

  WITH keys AS (
    SELECT
      l."ListingKey" AS listing_key,
      nullif(btrim(l."City"), '') AS city_proper,
      sa.city_slug AS sa_slug,
      public.market_in_service_area(l."City") AS in_sa,
      public.market_hyphen_slug(l.county) AS county_slug,
      left(regexp_replace(coalesce(l."PostalCode", ''), '[^0-9]', '', 'g'), 5) AS zip5,
      nullif(btrim(l."SubdivisionName"), '') AS subdivision_name,
      l."Latitude" AS lat,
      l."Longitude" AS lng,
      COALESCE(
        (timezone('America/Los_Angeles', l."OnMarketDate"))::date,
        (timezone('America/Los_Angeles', l."ListDate"))::date,
        DATE '1970-01-01'
      ) AS effective_from
    FROM public.listings l
    LEFT JOIN public.market_service_area sa
      ON lower(sa.city_proper) = lower(btrim(coalesce(l."City", '')))
    WHERE l."ListingKey" = ANY (p_keys)
  ),
  pts AS (
    SELECT
      k.*,
      CASE
        WHEN k.lat IS NOT NULL AND k.lng IS NOT NULL
         AND k.lat BETWEEN -90 AND 90 AND k.lng BETWEEN -180 AND 180
        THEN ST_SetSRID(ST_MakePoint(k.lng::float8, k.lat::float8), 4326)
      END AS geom
    FROM keys k
  ),
  text_rows AS (
    SELECT
      p.listing_key,
      'region'::text AS geo_type,
      'central-oregon'::text AS geo_slug,
      'city_text'::text AS method,
      'verified'::text AS confidence,
      NULL::numeric AS polygon_acres,
      p.effective_from
    FROM pts p
    WHERE p.in_sa
    UNION ALL
    SELECT
      p.listing_key,
      'city',
      coalesce(p.sa_slug, public.market_hyphen_slug(p.city_proper)),
      'city_text',
      'verified',
      NULL,
      p.effective_from
    FROM pts p
    WHERE coalesce(p.sa_slug, public.market_hyphen_slug(p.city_proper)) IS NOT NULL
    UNION ALL
    SELECT
      p.listing_key,
      'county',
      p.county_slug,
      'city_text',
      'unverified',
      NULL,
      p.effective_from
    FROM pts p
    WHERE p.county_slug IS NOT NULL
    UNION ALL
    SELECT
      p.listing_key,
      'zip',
      p.zip5,
      'city_text',
      'unverified',
      NULL,
      p.effective_from
    FROM pts p
    WHERE p.zip5 ~ '^[0-9]{5}$'
  ),
  poly_rows AS (
    SELECT
      p.listing_key,
      b.geo_type,
      b.geo_slug,
      'polygon'::text AS method,
      'unverified'::text AS confidence,
      (ST_Area(b.polygon::geography) / 4046.8564224)::numeric AS polygon_acres,
      p.effective_from
    FROM pts p
    JOIN public.boundaries b
      ON b.geo_type IN ('subdivision', 'neighborhood', 'community')
     AND ST_IsValid(b.polygon)
     AND p.geom IS NOT NULL
     AND ST_Within(p.geom, b.polygon)
  ),
  sub_alias AS (
    SELECT DISTINCT ON (p.listing_key)
      p.listing_key,
      'subdivision'::text AS geo_type,
      b.geo_slug,
      'alias'::text AS method,
      'unverified'::text AS confidence,
      NULL::numeric AS polygon_acres,
      p.effective_from
    FROM pts p
    JOIN public.boundaries b
      ON b.geo_type = 'subdivision'
     AND lower(btrim(b.geo_label)) = lower(p.subdivision_name)
    WHERE p.subdivision_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM poly_rows r
        WHERE r.listing_key = p.listing_key AND r.geo_type = 'subdivision'
      )
    ORDER BY p.listing_key, b.geo_slug
  ),
  nbh_alias AS (
    SELECT DISTINCT ON (p.listing_key)
      p.listing_key,
      'neighborhood'::text AS geo_type,
      ns.neighborhood_slug AS geo_slug,
      'alias'::text AS method,
      'unverified'::text AS confidence,
      NULL::numeric AS polygon_acres,
      p.effective_from
    FROM pts p
    JOIN public.neighborhood_subdivisions ns
      ON lower(btrim(ns.subdivision_label)) = lower(p.subdivision_name)
    WHERE p.subdivision_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM poly_rows r
        WHERE r.listing_key = p.listing_key AND r.geo_type = 'neighborhood'
      )
    ORDER BY p.listing_key, ns.neighborhood_slug
  ),
  comm_alias AS (
    SELECT DISTINCT ON (p.listing_key)
      p.listing_key,
      'community'::text AS geo_type,
      c.slug AS geo_slug,
      'alias'::text AS method,
      'unverified'::text AS confidence,
      NULL::numeric AS polygon_acres,
      p.effective_from
    FROM pts p
    JOIN public.communities c
      ON lower(btrim(c.name)) = lower(p.subdivision_name)
      OR c.slug = public.market_hyphen_slug(p.subdivision_name)
    WHERE p.subdivision_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM poly_rows r
        WHERE r.listing_key = p.listing_key AND r.geo_type = 'community'
      )
    ORDER BY p.listing_key, c.slug
  ),
  all_rows AS (
    SELECT * FROM text_rows
    UNION ALL
    SELECT * FROM poly_rows
    UNION ALL
    SELECT * FROM sub_alias
    UNION ALL
    SELECT * FROM nbh_alias
    UNION ALL
    SELECT * FROM comm_alias
  ),
  ranked AS (
    SELECT
      a.*,
      row_number() OVER (
        PARTITION BY a.listing_key, a.geo_type
        ORDER BY
          CASE a.method WHEN 'polygon' THEN 0 WHEN 'city_text' THEN 0 ELSE 1 END,
          a.polygon_acres ASC NULLS LAST,
          a.geo_slug ASC
      ) AS rn
    FROM all_rows a
    WHERE a.geo_slug IS NOT NULL
  )
  INSERT INTO public.place_membership (
    listing_key, geo_type, geo_slug, method, confidence,
    is_primary, polygon_acres, effective_from, effective_to
  )
  SELECT
    listing_key, geo_type, geo_slug, method, confidence,
    (rn = 1), polygon_acres, effective_from, NULL
  FROM ranked;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.place_membership_rebuild_keys(text[]) IS
  'Market Truth membership rules for an explicit listing key set: deletes and rebuilds place_membership for exactly those keys (cities by MLS city text, sub-city by ST_Within with smallest-area primary, alias fallback). Called by refresh_place_membership (keyset sweep) and refresh_place_membership_changed (pg_cron). Returns rows inserted.';

REVOKE ALL ON FUNCTION public.place_membership_rebuild_keys(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_membership_rebuild_keys(text[])
  TO service_role;

-- 2 ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_place_membership(
  p_after text DEFAULT '',
  p_limit integer DEFAULT 1500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '90s'
AS $$
DECLARE
  v_last text := coalesce(p_after, '');
  v_n integer := 0;
  v_lim integer := least(greatest(coalesce(p_limit, 1500), 1), 4000);
  v_keys text[];
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" > v_last
    ORDER BY l."ListingKey"
    LIMIT v_lim
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upserted', 0, 'last_key', v_last, 'done', true);
  END IF;
  v_last := v_keys[array_length(v_keys, 1)];

  v_n := public.place_membership_rebuild_keys(v_keys);

  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_n,
    'last_key', v_last,
    'done', array_length(v_keys, 1) < v_lim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_place_membership(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_place_membership(text, integer)
  TO service_role;

-- 3 ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_place_membership_changed(
  p_limit integer DEFAULT 2000,
  p_lookback_hours integer DEFAULT 1080
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  t_start timestamptz := clock_timestamp();
  v_lim integer := least(greatest(coalesce(p_limit, 2000), 1), 4000);
  v_hours integer := least(greatest(coalesce(p_lookback_hours, 1080), 1), 24 * 400);
  v_since timestamptz := now() - make_interval(hours => v_hours);
  v_keys text[];
  v_candidates integer := 0;
  v_n integer := 0;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7109);
  IF NOT got_lock THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true,
      'reason', 'refresh_place_membership_changed already running');
  END IF;

  BEGIN
    -- Newest modification first, so a backlog never delays today's listings.
    -- A listing whose attributes place it nowhere (no city, county, zip or
    -- point) writes no rows and stays a candidate until it ages out of the
    -- window; it sits at the tail of the order, behind real changes.
    SELECT coalesce(array_agg(s.k), ARRAY[]::text[])
    INTO v_keys
    FROM (
      SELECT l."ListingKey" AS k
      FROM public.listings l
      WHERE l."ModificationTimestamp" >= v_since
        AND l."ListingKey" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.place_membership pm
          WHERE pm.listing_key = l."ListingKey"
            AND pm.computed_at >= l."ModificationTimestamp"
        )
      ORDER BY l."ModificationTimestamp" DESC, l."ListingKey" ASC
      LIMIT v_lim
    ) s;

    v_candidates := coalesce(array_length(v_keys, 1), 0);
    IF v_candidates > 0 THEN
      v_n := public.place_membership_rebuild_keys(v_keys);
    END IF;

    INSERT INTO public.mv_refresh_state (mv_name, refreshed_at)
    VALUES ('place_membership', clock_timestamp())
    ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = excluded.refreshed_at;

    PERFORM pg_advisory_unlock(7109);
    RETURN jsonb_build_object(
      'ok', true,
      'candidates', v_candidates,
      'upserted', v_n,
      'done', v_candidates < v_lim,
      'since', v_since,
      'duration_ms', (extract(epoch from (clock_timestamp() - t_start)) * 1000)::integer
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(7109);
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$$;

COMMENT ON FUNCTION public.refresh_place_membership_changed(integer, integer) IS
  'Incremental place_membership refresh: rebuilds listings whose ModificationTimestamp (within p_lookback_hours) is newer than their membership rows, or that have none, newest first, p_limit per call. Advisory lock 7109, skip on contention. Stamps mv_refresh_state(place_membership). pg_cron job refresh_place_membership_15min.';

REVOKE ALL ON FUNCTION public.refresh_place_membership_changed(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_place_membership_changed(integer, integer)
  TO service_role;

-- 4 ───────────────────────────────────────────────────────────────────────────
-- statement_timeout is armed when the enclosing statement starts, so the
-- budget is its own statement before the payload (reference_pgcron_long_ddl_channel,
-- 20260908160000).
DO $$
BEGIN
  PERFORM cron.unschedule('refresh_place_membership_15min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_place_membership_15min');

  PERFORM cron.schedule(
    'refresh_place_membership_15min',
    '9,24,39,54 * * * *',
    $job$
  set local statement_timeout = '300s';
  select public.refresh_place_membership_changed(2000, 1080);
  $job$
  );
END $$;
