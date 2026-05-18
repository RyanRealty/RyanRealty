-- fub_person_geo + lookup_address_geo RPC + boundaries spatial index
--
-- Powers the geo-tagging pipeline that takes a FUB lead's address → geocode
-- → spatial lookup → canonical city/neighborhood/subdivision tags pushed
-- back to FUB. See docs/FUB_GEO_TAGGING_2026-05-17.md.
--
-- Three pieces:
--   1. public.fub_person_geo — per-lead spatial intel (already applied
--      via earlier migration `fub_person_geo_table_only`)
--   2. public.lookup_address_geo(lat, lng) RPC — point-in-polygon lookup
--      with smallest-polygon-wins logic (prefers most-specific match)
--   3. GIST spatial index on public.boundaries.polygon — makes the RPC
--      sub-100ms instead of timing out

-- 1. Table (idempotent — may already exist)
CREATE TABLE IF NOT EXISTS public.fub_person_geo (
  fub_person_id    int PRIMARY KEY,
  source_address   text NOT NULL,
  source_type      text NOT NULL,                  -- 'mailing' | 'property' | 'lp-form'
  latitude         double precision,
  longitude        double precision,
  geocode_confidence text,
  formatted_address text,
  city_slug        text,
  neighborhood_slug text,
  subdivision_slug text,
  geo_scope        text,                           -- 'local' | 'out-of-area' | 'out-of-state'
  owner_type       text,                           -- 'occupied' | 'absentee'
  geocoded_at      timestamptz NOT NULL DEFAULT now(),
  tagged_in_fub_at timestamptz,
  notes            text
);

CREATE INDEX IF NOT EXISTS fub_person_geo_city_idx ON public.fub_person_geo (city_slug);
CREATE INDEX IF NOT EXISTS fub_person_geo_neighborhood_idx ON public.fub_person_geo (neighborhood_slug);
CREATE INDEX IF NOT EXISTS fub_person_geo_subdivision_idx ON public.fub_person_geo (subdivision_slug);
CREATE INDEX IF NOT EXISTS fub_person_geo_owner_idx ON public.fub_person_geo (owner_type, geo_scope);

ALTER TABLE public.fub_person_geo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fub_person_geo_service_role_all ON public.fub_person_geo;
CREATE POLICY fub_person_geo_service_role_all ON public.fub_person_geo
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. RPC with smallest-polygon-wins logic
--
-- Without ORDER BY ST_Area, PostGIS returns whichever polygon the GIST index
-- finds first when polygons overlap (e.g., NWX subdivision sits inside the
-- broader Broken Top neighborhood polygon). The smaller polygon is the more-
-- specific match and is what we want to report.
CREATE OR REPLACE FUNCTION public.lookup_address_geo(lat double precision, lng double precision)
RETURNS TABLE(city_slug text, neighborhood_slug text, subdivision_slug text)
LANGUAGE sql STABLE AS $$
  WITH pt AS (
    SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326) AS geom
  )
  SELECT
    (SELECT geo_slug FROM public.boundaries, pt
     WHERE geo_type = 'city' AND ST_Contains(polygon, pt.geom)
     ORDER BY ST_Area(polygon) ASC LIMIT 1) AS city_slug,
    (SELECT geo_slug FROM public.boundaries, pt
     WHERE geo_type = 'neighborhood' AND ST_Contains(polygon, pt.geom)
     ORDER BY ST_Area(polygon) ASC LIMIT 1) AS neighborhood_slug,
    (SELECT geo_slug FROM public.boundaries, pt
     WHERE geo_type = 'subdivision' AND ST_Contains(polygon, pt.geom)
     ORDER BY ST_Area(polygon) ASC LIMIT 1) AS subdivision_slug;
$$;

-- 3. GIST spatial index on boundaries.polygon
-- Without this, ST_Contains scans every polygon for every lookup (seconds).
-- With this, lookups are sub-100ms across 3,251 polygons.
CREATE INDEX IF NOT EXISTS boundaries_polygon_gist ON public.boundaries USING GIST (polygon);
ANALYZE public.boundaries;
