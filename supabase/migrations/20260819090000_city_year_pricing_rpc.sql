-- city_year_pricing — the per-city-year aggregate the approved chart-room
-- forms run on (Unit F, chart-room foundations, 2026-08-19).
--
-- WHY AN RPC AND NOT A POSTGREST SCAN: sale_pricing_facts holds ~149k rows and
-- is service-role only (RLS on, no anon policies). PostgREST cannot aggregate,
-- so a DAL-side aggregate would page ~150 requests of 1,000 rows per cache
-- miss and recompute medians in JS. percentile_cont at the data is exact, one
-- round trip, and returns a few hundred small rows for every city+year.
--
-- WHY NOT A MATERIALIZED VIEW: the result is small and the base table
-- refreshes every 6h; a STABLE function under the DAL's 6h unstable_cache
-- window gives the same effective freshness with no refresh job to schedule
-- or monitor (listing_tile_mv taught us what an unwatched MV refresh costs).
--
-- Filters mirror lib/data/pricing/facts.ts rowToSale + lib/pricing/classes.ts
-- plausibleListedClose (IMPLAUSIBLE_CLOSE_RATIO 0.1 .. 10):
--   detached only · close_price > 0 · sqft >= 300 ·
--   close within 0.1x..10x of last_ask when last_ask is known.
-- Years with fewer than min_closings closings stay out (default 3): a median
-- of two sales is an anecdote, not a figure.
--
-- SECURITY: INVOKER, and EXECUTE is revoked from anon/authenticated so the
-- service-role-only posture of sale_pricing_facts carries through (definer
-- RPC grant lockdown, 2026-07). The DAL reads it with the service client.

create or replace function public.city_year_pricing(min_closings integer default 3)
returns table (
  city_slug text,
  city text,
  year integer,
  closings bigint,
  median_close numeric,
  median_ppsf numeric,
  median_days_to_offer numeric,
  median_sale_to_original numeric,
  new_construction_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.city_slug,
    min(f.city) as city,
    extract(year from f.close_date)::integer as year,
    count(*) as closings,
    percentile_cont(0.5) within group (order by f.close_price) as median_close,
    percentile_cont(0.5) within group (
      order by coalesce(f.close_ppsf, f.close_price / nullif(f.sqft, 0))
    ) filter (
      where coalesce(f.close_ppsf, f.close_price / nullif(f.sqft, 0)) > 0
    ) as median_ppsf,
    percentile_cont(0.5) within group (order by f.days_to_offer) filter (
      where f.days_to_offer is not null and f.days_to_offer >= 0
    ) as median_days_to_offer,
    percentile_cont(0.5) within group (order by f.sale_to_original) filter (
      where f.sale_to_original is not null and f.sale_to_original > 0
    ) as median_sale_to_original,
    count(*) filter (
      where f.new_construction_yn is true or f.flag_new_construction is true
    ) as new_construction_count
  from public.sale_pricing_facts f
  where f.product_class = 'detached'
    and f.close_price > 0
    and f.sqft >= 300
    and (
      f.last_ask is null
      or f.last_ask <= 0
      or (f.close_price >= f.last_ask * 0.1 and f.close_price <= f.last_ask * 10)
    )
  group by f.city_slug, extract(year from f.close_date)::integer
  having count(*) >= min_closings
  order by f.city_slug, year
$$;

revoke execute on function public.city_year_pricing(integer) from public;
revoke execute on function public.city_year_pricing(integer) from anon;
revoke execute on function public.city_year_pricing(integer) from authenticated;
grant execute on function public.city_year_pricing(integer) to service_role;
