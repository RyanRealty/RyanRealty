-- listings_in_boundary RPC
-- Returns active SFR-ish listings whose point falls inside the boundary polygon
-- for a given geo (city, neighborhood, or resort community).
--
-- Used by getGeoBoundaryMapData DAL to produce map pins identically across
-- the city, neighborhood, and community page types. Replaces per-page
-- City/SubdivisionName string-match divergence with a single spatial query.
--
-- Slug rules:
--   city        -> geo_type='city', geo_slug = city slug (e.g. 'bend')
--   neighborhood -> geo_type='neighborhood', geo_slug = 'bend-awbrey-butte'
--   resort/master-planned community -> geo_type='neighborhood', geo_slug = bare slug (e.g. 'tetherow')
--
-- Security: SECURITY DEFINER runs as the migration owner (postgres), which
-- bypasses RLS on boundaries (anon has no policy). Same pattern as boundary_geojson.
-- Anon gets EXECUTE only — no direct table access.

create or replace function public.listings_in_boundary(
  p_geo_type text,
  p_geo_slug text,
  p_limit int default 300
)
returns table(
  listing_key text,
  lat         double precision,
  lng         double precision,
  list_price  numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l."ListingKey"  as listing_key,
    l."Latitude"    as lat,
    l."Longitude"   as lng,
    l."ListPrice"   as list_price
  from public.listings l
  join public.boundaries b
    on b.geo_type = p_geo_type
   and b.geo_slug = p_geo_slug
  where l."StandardStatus" = 'Active'
    and l."Latitude"  is not null
    and l."Longitude" is not null
    and ST_Within(
          ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326),
          b.polygon
        )
  limit p_limit
$$;

grant execute on function public.listings_in_boundary(text, text, int) to anon, authenticated;
