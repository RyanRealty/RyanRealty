-- city_quarter_sale_to_ask — the per-city, per-year, ONE-QUARTER median
-- sale-to-original-ask the approved chart-room dumbbell runs on (Unit CITY,
-- 2026-08-19). The dumbbell compares the SAME quarter across two years —
-- CLAUDE.md §0: YoY is the same window across two years, never a full year
-- against a running partial — so the year-grain city_year_pricing RPC cannot
-- feed it while the current year is incomplete.
--
-- Same posture as city_year_pricing (20260819090000):
--   * an RPC, not a PostgREST scan — sale_pricing_facts is ~149k rows,
--     service-role only, and percentile_cont at the data is exact in one
--     round trip;
--   * filters mirror lib/data/pricing/facts.ts rowToSale +
--     lib/pricing/classes.ts plausibleListedClose: detached only,
--     close_price > 0, sqft >= 300, close within 0.1x..10x of last_ask when
--     last_ask is known; only rows with a usable sale_to_original count;
--   * HAVING floor (default 5, the chart-room lock for this form): a median
--     of two sales is an anecdote, not a figure;
--   * SECURITY INVOKER with EXECUTE revoked from anon/authenticated so the
--     service-role-only posture of sale_pricing_facts carries through.
--     The DAL (lib/data/pricing/getCityQuarterSaleToAsk.ts) reads it with
--     the service client.

create or replace function public.city_quarter_sale_to_ask(
  qtr integer,
  min_closings integer default 5
)
returns table (
  city_slug text,
  city text,
  year integer,
  closings bigint,
  median_sale_to_original numeric
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
    percentile_cont(0.5) within group (order by f.sale_to_original) as median_sale_to_original
  from public.sale_pricing_facts f
  where f.product_class = 'detached'
    and f.close_price > 0
    and f.sqft >= 300
    and f.sale_to_original is not null
    and f.sale_to_original > 0
    and extract(quarter from f.close_date)::integer = qtr
    and (
      f.last_ask is null
      or f.last_ask <= 0
      or (f.close_price >= f.last_ask * 0.1 and f.close_price <= f.last_ask * 10)
    )
  group by f.city_slug, extract(year from f.close_date)::integer
  having count(*) >= min_closings
  order by f.city_slug, year
$$;

revoke execute on function public.city_quarter_sale_to_ask(integer, integer) from public;
revoke execute on function public.city_quarter_sale_to_ask(integer, integer) from anon;
revoke execute on function public.city_quarter_sale_to_ask(integer, integer) from authenticated;
grant execute on function public.city_quarter_sale_to_ask(integer, integer) to service_role;
