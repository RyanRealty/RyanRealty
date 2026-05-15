-- RPC: import_bend_neighborhood_boundary
-- Atomically replaces a single Bend neighborhood polygon in both public.boundaries (master,
-- geo_type='neighborhood', geo_slug='bend-<slug>', stored as MultiPolygon) and public.neighborhoods
-- (denormalized convenience mirror, slug='<slug>'). Both rows must already exist; this is
-- update-not-insert. Returns measured acres for verification.
--
-- Source: scripts/seo-import-bend-neighborhood-boundaries.mjs
-- Input source data: data/bend-neighborhood-districts.geojson (City of Bend GIS)
-- Reference: docs/seo-neighborhood-polygon-fix-2026-05-14.md
--            feedback_gis_authoritative_only.md (locked 2026-05-14)

CREATE OR REPLACE FUNCTION public.import_bend_neighborhood_boundary(
  p_slug text,
  p_geojson text,
  p_source text,
  p_source_url text,
  p_verified_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_multi geometry(MultiPolygon, 4326);
  v_acres numeric;
  v_boundaries_rows int;
  v_neighborhoods_rows int;
  v_boundary_slug text := 'bend-' || p_slug;
BEGIN
  v_multi := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326));
  v_acres := ROUND((ST_Area(v_multi::geography) / 4046.8564224)::numeric, 2);

  UPDATE public.boundaries
  SET polygon = v_multi,
      source = p_source,
      source_url = p_source_url,
      imported_at = now()
  WHERE geo_type = 'neighborhood' AND geo_slug = v_boundary_slug;
  GET DIAGNOSTICS v_boundaries_rows = ROW_COUNT;

  IF p_slug <> 'undesignated' THEN
    UPDATE public.neighborhoods
    SET boundary_geojson = p_geojson::jsonb,
        boundary_source = p_source,
        boundary_source_url = p_source_url,
        boundary_fetched_at = now(),
        boundary_verified_by = p_verified_by,
        updated_at = now()
    WHERE slug = p_slug;
    GET DIAGNOSTICS v_neighborhoods_rows = ROW_COUNT;
  ELSE
    v_neighborhoods_rows := 0;
  END IF;

  RETURN jsonb_build_object(
    'slug', p_slug,
    'boundary_slug', v_boundary_slug,
    'measured_acres', v_acres,
    'boundaries_rows_updated', v_boundaries_rows,
    'neighborhoods_rows_updated', v_neighborhoods_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_bend_neighborhood_boundary(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_bend_neighborhood_boundary(text,text,text,text,text) TO service_role;
