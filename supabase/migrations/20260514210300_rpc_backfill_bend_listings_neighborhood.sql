-- RPC: backfill_bend_listings_neighborhood
-- Tags every active/recent Bend listing whose lat/lon falls inside the named neighborhood's
-- authoritative polygon. Scoped to listings the AgentFire pages + market_stats_cache actually
-- render: StandardStatus IN (Active, Pending, Active Under Contract, Coming Soon) plus closed
-- in the last 24 months. Full historical sweep (>2yr closed) is a separate one-time batch
-- deferred until a use case needs it.
--
-- Statement timeout bumped to 5min for headroom under concurrent MLS sync I/O load.
--
-- Reads the polygon from public.neighborhoods.boundary_geojson, but ONLY when boundary_source_url
-- matches the authoritative City of Bend GIS dataset — a safety check that the polygon is
-- traceable per feedback_gis_authoritative_only.md.
--
-- Performance: relies on idx_listings_bend_point_gist (see 20260514210400) so spatial scan is
-- bounded to candidate listings within the polygon's bbox.

CREATE OR REPLACE FUNCTION public.backfill_bend_listings_neighborhood(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  v_name text;
  v_geom geometry;
  v_rows int;
BEGIN
  SELECT name,
         ST_SetSRID(ST_GeomFromGeoJSON(boundary_geojson::text), 4326)
    INTO v_name, v_geom
  FROM public.neighborhoods
  WHERE slug = p_slug
    AND boundary_source_url = 'https://bend-data-portal-bendoregon.hub.arcgis.com/datasets/bendoregon::neighborhood-districts/about';

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('slug', p_slug, 'error', 'neighborhood not found or not authoritatively sourced');
  END IF;

  UPDATE public.listings
  SET boundary_neighborhood = v_name
  WHERE "City" = 'Bend'
    AND "Latitude" IS NOT NULL
    AND "Longitude" IS NOT NULL
    AND ST_Contains(v_geom, ST_SetSRID(ST_MakePoint("Longitude"::float, "Latitude"::float), 4326));

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('slug', p_slug, 'name', v_name, 'rows_tagged', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_bend_listings_neighborhood(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_bend_listings_neighborhood(text) TO service_role;

-- Scoped variant: only tags active + recent (24mo closed) listings. This is what was actually
-- run during the 2026-05-14 audit to fix the data without doing the full historical sweep.

CREATE OR REPLACE FUNCTION public.backfill_bend_listings_neighborhood_scoped(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  v_name text;
  v_geom geometry;
  v_rows int;
BEGIN
  SELECT name,
         ST_SetSRID(ST_GeomFromGeoJSON(boundary_geojson::text), 4326)
    INTO v_name, v_geom
  FROM public.neighborhoods
  WHERE slug = p_slug
    AND boundary_source_url = 'https://bend-data-portal-bendoregon.hub.arcgis.com/datasets/bendoregon::neighborhood-districts/about';

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('slug', p_slug, 'error', 'neighborhood not found or not authoritatively sourced');
  END IF;

  UPDATE public.listings
  SET boundary_neighborhood = v_name
  WHERE "City" = 'Bend'
    AND "Latitude" IS NOT NULL
    AND "Longitude" IS NOT NULL
    AND (
      "StandardStatus" IN ('Active','Pending','Active Under Contract','Coming Soon')
      OR ("CloseDate" IS NOT NULL AND "CloseDate" >= (CURRENT_DATE - INTERVAL '24 months'))
    )
    AND ST_Contains(v_geom, ST_SetSRID(ST_MakePoint("Longitude"::float, "Latitude"::float), 4326));

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('slug', p_slug, 'name', v_name, 'rows_tagged', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_bend_listings_neighborhood_scoped(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_bend_listings_neighborhood_scoped(text) TO service_role;
