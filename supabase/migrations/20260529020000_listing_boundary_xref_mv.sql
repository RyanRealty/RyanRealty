-- listing_boundary_xref_mv — precomputed listing→boundary spatial join.
--
-- WHY: listings_in_boundary() did ST_Within at request time over the 589K-row
-- listings table. Even with a partial on-market GIST index the planner pulled
-- in a 21K-row status-btree BitmapAnd (~760ms cold) plus ~2s cold planning,
-- intermittently blowing the anon role's 3s statement_timeout (2 of 3 calls
-- timed out → empty map pins + empty homes-for-sale cards on community pages).
--
-- FIX: precompute the spatial join once (as the MV owner, no 3s cap) into an
-- indexed MV. Request time becomes a trivial (geo_type, geo_slug) index lookup
-- — sub-10ms, never times out — and is IDENTICAL for city, neighborhood, and
-- resort/master-planned community pages (one code path, one data path).
--
-- A listing appears once per boundary it falls inside, so an overlapping Bend
-- district + resort community (both geo_type='neighborhood') each get their own
-- row — the (geo_type, geo_slug, listing_key) PK keeps them distinct. This is
-- why the MV is the right home for resort communities, whose listings carry
-- alias SubdivisionNames the listing_tile_mv.boundary_neighborhood column
-- collapses to the overlapping Bend district name.
--
-- On-market statuses only (~4% of the table) keep the MV small (~tens of K rows)
-- and the refresh fast. property_type is carried so consumers can split
-- homes vs land if needed.
--
-- Built WITH NO DATA here (instant); the initial populate + ongoing refresh run
-- via refresh_listing_boundary_xref_mv(), wired into /api/cron/refresh-mvs.

create materialized view if not exists public.listing_boundary_xref_mv as
select
  l."ListingKey"      as listing_key,
  b.geo_type,
  b.geo_slug,
  l."Latitude"        as lat,
  l."Longitude"       as lng,
  l."ListPrice"       as list_price,
  l."StandardStatus"  as standard_status,
  l."PropertyType"    as property_type,
  l.property_sub_type as property_sub_type
from public.listings l
join public.boundaries b
  on ST_Within(
       ST_SetSRID(ST_MakePoint(l."Longitude", l."Latitude"), 4326),
       b.polygon
     )
where l."StandardStatus" in ('Active','Coming Soon','Active Under Contract','Pending')
  and l."Latitude"  is not null
  and l."Longitude" is not null
with no data;

-- Unique index → enables REFRESH MATERIALIZED VIEW CONCURRENTLY.
create unique index if not exists listing_boundary_xref_mv_pk
  on public.listing_boundary_xref_mv (geo_type, geo_slug, listing_key);

-- Hot lookup path: the RPC filters (geo_type, geo_slug, standard_status).
create index if not exists listing_boundary_xref_mv_lookup
  on public.listing_boundary_xref_mv (geo_type, geo_slug, standard_status);

grant select on public.listing_boundary_xref_mv to anon, authenticated, service_role;

-- Refresh RPC (CONCURRENTLY) for the cron. Own statement_timeout overrides the
-- 120s service_role cap so the spatial rebuild always completes.
create or replace function public.refresh_listing_boundary_xref_mv()
returns json
language plpgsql
security definer
set search_path = public
set statement_timeout = '180s'
as $$
declare
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
begin
  refresh materialized view concurrently public.listing_boundary_xref_mv;
  duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
  return json_build_object('ok', true, 'duration_ms', duration_ms);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.refresh_listing_boundary_xref_mv() to service_role, authenticated;

-- Point listings_in_boundary at the precomputed MV — trivial indexed lookup.
-- Same signature + return shape as before, so the DAL needs no change.
--
-- HOMES ONLY: this RPC powers the "homes on the map" pins + "homes for sale"
-- cards, so it returns property_type IN ('A','B','C') — Residential, Manufactured,
-- Multi-Family. It deliberately excludes 'D' (vacant land + commercial — land
-- cards render with blank beds/baths/sqft and mislabel the "Homes" section),
-- 'F' (farm/ranch), and junk rows like property_type 'G' carrying $1.15 list
-- prices (a "$2 home" card violates the data-accuracy mandate, CLAUDE.md §0).
-- The MV still stores every on-market property_type, so a future land/commercial
-- map can widen this filter without a re-refresh.
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
  select listing_key, lat, lng, list_price
  from public.listing_boundary_xref_mv
  where geo_type = p_geo_type
    and geo_slug = p_geo_slug
    and standard_status = 'Active'
    and property_type in ('A','B','C')
  limit p_limit
$$;

grant execute on function public.listings_in_boundary(text, text, int) to anon, authenticated;
