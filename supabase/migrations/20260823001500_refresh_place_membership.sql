-- Market Truth Step 3 — place_membership for listed AND sold alike.
-- Cities: MLS city text (D5), hyphen slug. Never city polygons.
-- Sub-city: ST_Within, is_primary = smallest area then geo_slug ASC (AUDIT B7).
-- Alias fallback from SubdivisionName / neighborhood_subdivisions when no polygon.
-- Invalid polygons are skipped. Polygon confidence starts unverified.

CREATE OR REPLACE FUNCTION public.market_hyphen_slug(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT nullif(
    trim(both '-' from regexp_replace(lower(btrim(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.market_hyphen_slug(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_hyphen_slug(text) TO service_role;

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

  DELETE FROM public.place_membership
  WHERE listing_key = ANY (v_keys);

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
    WHERE l."ListingKey" = ANY (v_keys)
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
