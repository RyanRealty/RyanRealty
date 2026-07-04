-- Upsert a trail line from GeoJSON (authoritative source only, per the GIS rule).
-- ST_Multi normalizes LineString/MultiLineString to MultiLineString(4326).
-- Called by scripts/seo-import-trail-lines.mjs with USFS/BPR/OPRD/BLM linework.
create or replace function public.upsert_trail_line(
  p_slug text, p_geojson jsonb, p_source text, p_source_url text, p_verified_by text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trail_lines (trail_slug, geom, source, source_url, verified_by, imported_at)
  values (
    p_slug,
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)),
    p_source, p_source_url, p_verified_by, now()
  )
  on conflict (trail_slug) do update
    set geom = excluded.geom, source = excluded.source, source_url = excluded.source_url,
        verified_by = excluded.verified_by, imported_at = now();
end;
$$;
revoke all on function public.upsert_trail_line(text, jsonb, text, text, text) from anon, authenticated;
