-- neighborhood_year_pricing_mv — the per-Bend-district, per-year closed-sale
-- aggregate the approved chart-room forms run on at NEIGHBORHOOD grain
-- (Unit NEIGHBORHOOD, chart-room rollout, 2026-08-19).
--
-- WHY THIS SOURCE AND NOT THE OTHER TWO. Three tables claim to answer
-- "how does this Bend district sell", and two of them cannot:
--
--   market_pulse_live (geo_type='neighborhood', 28 rows) — its CLOSED side is
--     broken at this grain. Awbrey Butte reads sold_count_30d = 1 and
--     months_of_supply = 31.50, which implies 12 closings in six months; the
--     polygon-assigned truth is 75 single-family closings in six months
--     (verified 2026-08-19). Summit West reads 43.20 months against a real
--     3.6. Nothing on the closed side of a neighborhood pulse row is charted.
--
--   market_stats_cache (geo_type='neighborhood') — the trailing-year row for
--     bend-awbrey-butte reports sold_count 17 where the polygon reports 138
--     (Mountain View 55 vs 202, Old Bend 17 vs 32). Its MEDIAN agrees closely
--     ($1,150,000 vs $1,165,550, 1.35%), so it is sampling the same market
--     with a much narrower catch. Not a countable population.
--
--   listing_tile_mv.boundary_neighborhood — the polygon assignment against
--     public.boundaries, the SAME geometry the place page's map and its
--     inventory (listing_boundary_xref_mv) already use. Closed rows run back
--     to 1997 for all thirteen districts, every district has 29 complete years
--     at >= 3 closings, and the result is IDENTICAL to sale_pricing_facts
--     detached under the same filters (Awbrey Butte 1997/2000/2005/2010/2015/
--     2020/2024/2025: same n, same median, both ways). That is this MV.
--
-- WHY A MATERIALIZED VIEW AND NOT A STABLE FUNCTION. The aggregate is a
-- 53k-row bitmap heap scan over a very wide MV: 9.2s warm, 10.1s cold,
-- measured 2026-08-19. A STABLE function behind the DAL's cache would put
-- that on the first request after every eviction. The result is ~400 rows, so
-- it is stored once and read as a table. Refreshed CONCURRENTLY from
-- /api/cron/refresh-mvs immediately after listing_tile_mv, the view it
-- derives from — no new schedule, no new watch surface.
--
-- POPULATION. Single-family exactly as the public inventory defines it
-- (property_type='A' AND property_sub_type='Single Family Residence'), closed,
-- close_price > 0, sqft >= 300, inside a recorded Bend district polygon.
-- Years under MIN closings stay out: a median of two sales is an anecdote.
-- The extra `__bend_districts__` row is the union of the same thirteen
-- districts, computed the same way, so a district can be charted against the
-- Bend districts as a whole without a second source or a second methodology.

drop materialized view if exists public.neighborhood_year_pricing_mv;

create materialized view public.neighborhood_year_pricing_mv as
with district as (
  select b.geo_slug, b.geo_label
  from public.boundaries b
  where b.geo_type = 'neighborhood'
    and b.geo_slug like 'bend-%'
    and b.geo_slug <> 'bend-undesignated'
),
base as (
  select
    d.geo_slug,
    d.geo_label,
    extract(year from t.close_date)::integer as year,
    t.close_price,
    t.sqft
  from public.listing_tile_mv t
  join district d on d.geo_label = t.boundary_neighborhood
  where t.standard_status = 'Closed'
    and t.property_type = 'A'
    and t.property_sub_type = 'Single Family Residence'
    and t.close_date is not null
    and t.close_price > 0
    and t.sqft >= 300
)
select
  geo_slug,
  geo_label,
  year,
  count(*)::integer as closings,
  percentile_cont(0.5) within group (order by close_price)::numeric as median_close,
  percentile_cont(0.5) within group (order by close_price / sqft)::numeric as median_ppsf,
  sum(close_price)::numeric as total_volume
from base
group by geo_slug, geo_label, year
having count(*) >= 3
union all
select
  '__bend_districts__' as geo_slug,
  'All Bend districts' as geo_label,
  year,
  count(*)::integer,
  percentile_cont(0.5) within group (order by close_price)::numeric,
  percentile_cont(0.5) within group (order by close_price / sqft)::numeric,
  sum(close_price)::numeric
from base
group by year
having count(*) >= 3;

-- REFRESH ... CONCURRENTLY requires a unique index.
create unique index neighborhood_year_pricing_mv_key
  on public.neighborhood_year_pricing_mv (geo_slug, year);

comment on materialized view public.neighborhood_year_pricing_mv is
  'Per-Bend-district, per-year closed single-family aggregate from listing_tile_mv polygon assignment (public.boundaries). Same geometry as listing_boundary_xref_mv. geo_slug __bend_districts__ is the union of the thirteen districts. Years with fewer than 3 closings are omitted. Refreshed from /api/cron/refresh-mvs after listing_tile_mv.';

grant select on public.neighborhood_year_pricing_mv to anon, authenticated, service_role;

create or replace function public.refresh_neighborhood_year_pricing_mv()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  started timestamptz := clock_timestamp();
  n integer;
begin
  refresh materialized view concurrently public.neighborhood_year_pricing_mv;
  select count(*) into n from public.neighborhood_year_pricing_mv;
  return jsonb_build_object(
    'ok', true,
    'rows', n,
    'duration_ms', (extract(epoch from (clock_timestamp() - started)) * 1000)::integer
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.refresh_neighborhood_year_pricing_mv() from public;
revoke execute on function public.refresh_neighborhood_year_pricing_mv() from anon;
revoke execute on function public.refresh_neighborhood_year_pricing_mv() from authenticated;
grant execute on function public.refresh_neighborhood_year_pricing_mv() to service_role;
