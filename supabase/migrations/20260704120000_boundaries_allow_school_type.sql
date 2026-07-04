-- Allow school attendance-area polygons in the boundaries table.
alter table public.boundaries drop constraint if exists boundaries_geo_type_check;
alter table public.boundaries add constraint boundaries_geo_type_check
  check (geo_type = any (array['city','neighborhood','subdivision','park','school']));

-- Generic polygon upsert from GeoJSON (authoritative source only, per the GIS
-- rule). Used by scripts/seo-import-school-boundaries.mjs. ST_Multi normalizes to
-- MultiPolygon(4326).
create or replace function public.upsert_boundary(
  p_geo_type text, p_geo_slug text, p_geo_label text,
  p_geojson jsonb, p_source text, p_source_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.boundaries (geo_type, geo_slug, geo_label, polygon, source, source_url, imported_at)
  values (
    p_geo_type, p_geo_slug, p_geo_label,
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)),
    p_source, p_source_url, now()
  )
  on conflict (geo_type, geo_slug) do update
    set geo_label = excluded.geo_label, polygon = excluded.polygon,
        source = excluded.source, source_url = excluded.source_url, imported_at = now();
end;
$$;
revoke all on function public.upsert_boundary(text, text, text, jsonb, text, text) from anon, authenticated;
