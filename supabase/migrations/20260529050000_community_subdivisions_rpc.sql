-- community_subdivisions RPC
-- Returns the GIS subdivision plats that make up a resort/master-planned
-- community (or any geo with a boundary), by spatial containment of each
-- subdivision's centroid within the parent polygon. Each row carries the
-- subdivision's GeoJSON (for "broken out" polygons on the map) and its active
-- home count (from listing_boundary_xref_mv).
--
-- WHY spatial + RPC (not parent_id): subdivision plats are not parented to
-- resort communities in boundaries.parent_id (they point at cities), and the
-- MLS SubdivisionName aliases don't match the county-GIS plat names. The
-- authoritative membership is geometric: a plat belongs to a community if it
-- sits inside the community's (corrected) polygon. boundaries is small (~3.2K
-- subdivision rows) so the ST_Within scan is ~300ms — fine for a cached DAL,
-- unlike the 589K-row listings table (which is why listings_in_boundary uses
-- the precomputed MV). Gated: anon gets EXECUTE only.
--
-- SET statement_timeout '15s' overrides the anon 3s cap as a cold-buffer safety
-- net; the cached DAL (getCommunitySubdivisions) means this runs at most once
-- per geoNeighborhood TTL per community.

create or replace function public.community_subdivisions(
  p_geo_type text,
  p_geo_slug text
)
returns table(
  geo_slug    text,
  geo_label   text,
  geojson     text,
  active_homes int
)
language sql
stable
security definer
set search_path = public
set statement_timeout = '15s'
as $$
  select
    s.geo_slug,
    s.geo_label,
    ST_AsGeoJSON(s.polygon) as geojson,
    (
      select count(*)::int
      from public.listing_boundary_xref_mv x
      where x.geo_type = 'subdivision'
        and x.geo_slug = s.geo_slug
        and x.standard_status = 'Active'
        and x.property_type in ('A','B','C')
    ) as active_homes
  from public.boundaries s
  join public.boundaries p
    on p.geo_type = p_geo_type
   and p.geo_slug = p_geo_slug
  where s.geo_type = 'subdivision'
    -- A child plat is SMALLER than its parent community and lies MOSTLY inside
    -- it. Centroid-in-polygon alone over-matches oversized/bad neighbor plats
    -- (e.g. a 1,072-acre "Highlands at Broken Top" geometry whose centroid
    -- happens to fall in Tetherow's footprint). Majority-overlap + the area
    -- guard keep the list to genuine children of THIS community.
    and ST_Area(s.polygon) < ST_Area(p.polygon)
    and ST_Area(ST_Intersection(s.polygon, p.polygon)) / NULLIF(ST_Area(s.polygon), 0) > 0.5
  order by active_homes desc, s.geo_label
$$;

grant execute on function public.community_subdivisions(text, text) to anon, authenticated;
