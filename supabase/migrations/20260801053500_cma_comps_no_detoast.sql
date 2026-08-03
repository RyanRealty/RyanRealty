-- audit: migration — get_cma_comps_by_listing_key stops reading listings.details
-- (marker required by the DAL-bypass guard).
--
-- THE DEFECT. The live definition carried five details reads: one in the WHERE
--
--   coalesce(c."ClosePrice", (c.details->>'ClosePrice')::numeric, c."ListPrice") is not null
--
-- and four more in the SELECT list (LotSizeAcres, YearBuilt, GarageSpaces,
-- PoolYN). The candidate set is every closed listing with coordinates inside the
-- month window, because neither GIST index on listings covers closed rows
-- (idx_listings_bend_point_gist is City='Bend' only, idx_listings_onmarket_point_gist
-- is on-market only), so the spatial predicate cannot bound the scan before the
-- details expressions run. Measured 2026-08-01: 11,768 rows match the default
-- 12-month closed-with-coordinates window. At 3.845 ms/row that is ~45 s against
-- the 12 s PostgREST timeout this RPC is called through (lib/cma.ts ->
-- supabase.rpc('get_cma_comps_by_listing_key')). Every CMA built from a listing
-- key went through it.
--
-- THE SECOND, WORSE DEFECT — UNGUARDED CASTS. `nullif(details->>'YearBuilt','')::integer`
-- and the GarageSpaces equivalent have no format guard. Measured over the whole
-- table during the 2026-08-01 backfill sweep: 39,804 rows carry a YearBuilt
-- payload that is not a plain integer and 16,225 carry such a GarageSpaces
-- payload. Any one of those inside a CMA's radius makes the whole RPC raise
-- 22P02, and lib/cma.ts turns an rpcError into `return null` — a silently
-- missing valuation. Reading the typed smallint columns removes that failure
-- mode entirely; the mapper that populates them already handles the formats
-- Postgres' cast rejects.
--
-- THE EQUIVALENCE PROOF. Per TOAST_READ_DISCIPLINE.md § remedy 2 a typed-column
-- swap is legal only with a COALESCE-aware whole-table proof, because several
-- typed columns disagree with the jsonb in both directions. The counters were
-- computed inside the 20260801051500 backfill sweep (one detoast per row, both
-- jobs sharing it) over all 594,199 rows, and the CMA's own universe was then
-- re-measured row by row. Both sets of numbers are recorded in the commit
-- message and the task report. The swap ships only for the fields whose
-- disagreement is zero in the scope the function actually reads.
--
-- The subject CTE, the distance maths, the ordering and the LIMIT are unchanged.

-- toast-ok: this definition no longer reads listings.details at all; the pragma
-- documents the removal so the header's quoted history cannot re-trip the gate.
create or replace function public.get_cma_comps_by_listing_key(
  p_listing_key text,
  p_radius_miles numeric default 2,
  p_months_back integer default 12,
  p_max_count integer default 10
)
returns table(
  listing_key text, listing_id text, address text, close_price numeric,
  close_date date, beds_total integer, baths_full numeric, living_area numeric,
  lot_size_acres numeric, year_built integer, garage_spaces integer,
  pool_yn boolean, property_type text, distance_miles numeric
)
language sql
stable
as $function$
with subject as (
  select
    l."ListingKey" as listing_key,
    l."ListNumber" as listing_id,
    l."Latitude"::numeric as lat,
    l."Longitude"::numeric as lon
  from public.listings l
  where l."ListingKey" = p_listing_key
     or l."ListNumber" = p_listing_key
  order by l."ModificationTimestamp" desc nulls last
  limit 1
),
closed_candidates as (
  select
    c."ListingKey" as listing_key,
    c."ListNumber" as listing_id,
    concat_ws(' ', c."StreetNumber", c."StreetName") || coalesce(', ' || c."City", '') as address,
    coalesce(c."ClosePrice", c."ListPrice") as close_price,
    c."CloseDate"::date as close_date,
    c."BedroomsTotal"::integer as beds_total,
    c."BathroomsTotal"::numeric as baths_full,
    c."TotalLivingAreaSqFt"::numeric as living_area,
    nullif(c.lot_size_acres, 0) as lot_size_acres,
    c.year_built::integer as year_built,
    c.garage_spaces::integer as garage_spaces,
    coalesce(c.pool_yn, false) as pool_yn,
    c."PropertyType"::text as property_type,
    round(
      (
        st_distance(
          st_setsrid(st_makepoint(c."Longitude"::numeric, c."Latitude"::numeric), 4326)::geography,
          st_setsrid(st_makepoint(s.lon, s.lat), 4326)::geography
        ) / 1609.34
      )::numeric,
      3
    ) as distance_miles
  from public.listings c
  cross join subject s
  where c."Latitude" is not null
    and c."Longitude" is not null
    and c."CloseDate" is not null
    and coalesce(c."StandardStatus", '') ilike '%Closed%'
    and c."CloseDate" >= (current_date - make_interval(months => greatest(1, p_months_back)))
    and coalesce(c."ClosePrice", c."ListPrice") is not null
    and (c."ListingKey" <> s.listing_key and coalesce(c."ListNumber", '') <> coalesce(s.listing_id, ''))
    and st_dwithin(
      st_setsrid(st_makepoint(c."Longitude"::numeric, c."Latitude"::numeric), 4326)::geography,
      st_setsrid(st_makepoint(s.lon, s.lat), 4326)::geography,
      greatest(0.1, p_radius_miles) * 1609.34
    )
)
select
  cc.listing_key, cc.listing_id, cc.address, cc.close_price, cc.close_date,
  cc.beds_total, cc.baths_full, cc.living_area, cc.lot_size_acres, cc.year_built,
  cc.garage_spaces, cc.pool_yn, cc.property_type, cc.distance_miles
from closed_candidates cc
order by cc.distance_miles asc nulls last, cc.close_date desc nulls last
limit greatest(1, p_max_count);
$function$;

comment on function public.get_cma_comps_by_listing_key(text, numeric, integer, integer) is
  'CMA comps by listing key. Reads TYPED COLUMNS ONLY — it must never read the listings jsonb document again: the five extractions it used to carry ran over ~11,768 closed candidates per call (~45 s against a 12 s PostgREST timeout) and their unguarded integer casts could raise 22P02 on any of the 39,804 rows whose YearBuilt payload is not a plain integer. See docs/TOAST_READ_DISCIPLINE.md.';
