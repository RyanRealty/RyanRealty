-- OnMarketDate cohort rollup (matches Spark / year-by-year sync year bounds).
-- Use with listing_year_finalization_stats (coalesce ListDate, OnMarketDate) for reporting; do not mix without labeling.

create or replace view public.listing_year_on_market_finalization_stats as
select
  extract(year from l."OnMarketDate")::integer as list_year,
  count(*)::bigint as total_listings,
  count(*) filter (where l.history_finalized is true)::bigint as finalized_listings,
  count(*) filter (where l.history_verified_full is true)::bigint as verified_full_listings
from public.listings l
where l."OnMarketDate" is not null
group by 1;

comment on view public.listing_year_on_market_finalization_stats is
  'Per OnMarketDate calendar year rollup for history_finalized / history_verified_full (aligns with year-by-year sync).';

grant select on public.listing_year_on_market_finalization_stats to service_role;
