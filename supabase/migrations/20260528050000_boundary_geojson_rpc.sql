-- RPC: boundary_geojson
-- Returns the PostGIS polygon for a geo as a GeoJSON geometry string.
-- Called by getBoundaryGeoJSON DAL function; cached at the app layer.
-- Security: SECURITY DEFINER with fixed search_path — safe for anon callers.
create or replace function public.boundary_geojson(p_geo_type text, p_geo_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ST_AsGeoJSON(polygon)
  from public.boundaries
  where geo_type = p_geo_type and geo_slug = p_geo_slug
  limit 1
$$;

grant execute on function public.boundary_geojson(text, text) to anon, authenticated;
