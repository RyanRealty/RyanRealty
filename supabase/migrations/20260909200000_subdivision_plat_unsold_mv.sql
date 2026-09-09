-- subdivision_plat_unsold_mv — the twelve-month DID-NOT-SELL aggregate per
-- recorded county plat, attributed the same two ways its closed sibling is
-- (SITE-55, 2026-09-09).
--
-- WHY THIS EXISTS. Matt, on the expired-listing first message that is the lead
-- engine: "show that we are true market experts by being able to dive into that
-- subdivision they're in… it has to be dialed so we can show them exactly
-- what's going on there, including homes that sold and didn't sell." The sold
-- half already exists (subdivision_plat_closed_mv, 20260908160000). This is the
-- other half, and until now it existed nowhere outside the seller CMA, which
-- reads raw `listings` per CITY (lib/data/cma/localOutcomeReads.ts) — a grain
-- too coarse to answer "what happened in MY plat".
--
-- AGGREGATE ONLY, DELIBERATELY. Oregon MLS policy (docs/MASTER_SPEC.md §3.8):
-- listings with StandardStatus Withdrawn, Expired or Cancelled "may not be
-- actively marketed" and "must not appear in search results or active listing
-- feeds". A per-plat COUNT with a median days-on-market and a median cut is
-- market reporting, the same class of figure as months of supply; a public list
-- of failed ADDRESSES would be a display surface for off-market listings and is
-- Matt's call, not this migration's. So this view emits counts and medians and
-- carries no listing_key, no address and no price out of the aggregate.
--
-- ATTRIBUTION is byte-identical in shape to the closed sibling: a listing
-- counts once per plat, whether it was matched by point-in-polygon or by the
-- MLS name, and the two halves are carried beside the total so no surface can
-- silently conflate them. The same reason applies for the union: geometry adds
-- what a resort-grain name can never carry, and the name keeps what a coarse
-- builder geocode lost.
--
-- SOURCE IS raw public.listings, NOT listing_tile_mv, because the tile MV
-- carries no off_market_date and an expired row is not a tile. The two display
-- filters the tile MV applies are applied here explicitly
-- (permit_internet_yn IS DISTINCT FROM false, idx_participant IS DISTINCT FROM
-- false), so an internet-display-opted-out or non-IDX listing counts here no
-- more than it counts anywhere else on the public site.
--
-- THE WINDOW is the twelve months to the anchor date below, on off_market_date,
-- the same date the CMA's did-not-sell classifier uses
-- (lib/pricing/local-outcomes.ts: StandardStatus IN Expired/Canceled/Withdrawn,
-- off_market_date >= since). It is stamped on every row (window_start,
-- window_end) so a page printing the figure prints the window with it.
--
-- DAYS IT RAN is off_market_date - listing_contract_date, the same list-to-off
-- span the CMA calls the final cycle, and never "DaysOnMarket" (list-to-close,
-- warned against in docs/DATABASE_FOR_AI_AGENTS.md §4a). A row with no contract
-- date contributes to the count and not to the median, so the median never
-- borrows a zero it did not measure.
--
-- THE CUT is total_price_change_pct, already computed per listing, counted only
-- where it is negative — the ask came down. A plat where nothing cut reports
-- zero cuts and a null median, which is the honest shape: unknown is not zero.
--
-- NEITHER BRANCH MAY PUT `boundaries` BEHIND A CTE (the closed sibling's
-- lesson): a CTE referenced twice is materialized, its GIST index is gone, and
-- ST_Contains degrades to a nested loop over 3.2K polygons. Each branch repeats
-- its own filters on purpose.
-- A ROW PER PLAT, NOT A ROW PER FAILURE — the correction this file was almost
-- shipped without. The first shape emitted rows only where something came off
-- unsold, and every caller then read "no row" as "nothing failed". On
-- diamond-bar-ranch that published "Every home that came off the market there
-- sold" while two listings had come off unsold inside the window (2026-09-01
-- Withdrawn, 2026-01-21 Canceled): that plat has no public.boundaries row at
-- all, so neither join could ever reach it, and the absence was a fact about
-- the query rather than about the market (CLAUDE.md §0, the counter-query
-- rule). The key set is therefore every recorded plat UNION every MLS
-- subdivision name that has carried a listing, left-joined to the failures, so
-- unsold_count 0 means MEASURED AND CLEAN and a missing row means NOT MEASURED.
-- The name branch also stopped requiring a boundaries join for the same reason.
--
-- THE WINDOW IS ANCHORED TO THE DATA, NOT THE CLOCK (F7, ci:mv-determinism).
-- current_date in a view body makes every row differ on every refresh, so
-- REFRESH CONCURRENTLY rewrites all of it nightly instead of the rows that
-- moved. The anchor is its own view. It cannot be a bare max(off_market_date):
-- exactly one production row (ListingKey 20200228170447973610000000, Expired,
-- modified 2024-11-02) carries off_market_date 3000-03-31, and that single typo
-- moved the window a thousand years forward and zeroed all 3,000-odd plats on
-- the first build of this shape. The sync clock is the bound a row cannot
-- outrun — a listing cannot be modified in the future — so the anchor is the
-- newest off-market date that is not after the newest modification the feed has
-- ever written, and the window is the twelve months to that date.
create or replace view public.subdivision_plat_unsold_anchor as
select coalesce(
         max(l.off_market_date) filter (
           where l.off_market_date <= (select max(m."ModificationTimestamp")::date from public.listings m)
         ),
         max(l.off_market_date)
       )::date as as_of
from public.listings l
where l."StandardStatus" in ('Expired', 'Canceled', 'Cancelled', 'Withdrawn')
  and l.off_market_date is not null;

grant select on public.subdivision_plat_unsold_anchor to anon, authenticated, service_role;

create materialized view if not exists public.subdivision_plat_unsold_mv as
with
anchor as (select as_of from public.subdivision_plat_unsold_anchor),
by_polygon as (
  select b.geo_slug,
         b.geo_label,
         l."ListingKey" as listing_key,
         l.off_market_date,
         l.listing_contract_date,
         l.total_price_change_pct,
         true as in_polygon
  from public.listings l
  cross join anchor a
  join public.boundaries b
    on b.geo_type = 'subdivision'
   and b.polygon is not null
   and ST_IsValid(b.polygon)
   and ST_Contains(
         b.polygon,
         ST_SetSRID(ST_MakePoint(l."Longitude"::float8, l."Latitude"::float8), 4326)
       )
  where l."StandardStatus" in ('Expired', 'Canceled', 'Cancelled', 'Withdrawn')
    and l.off_market_date is not null
    and l.off_market_date > (a.as_of - interval '12 months')
    and l.off_market_date <= a.as_of
    and l."Latitude" is not null
    and l."Longitude" is not null
    and l.permit_internet_yn is distinct from false
    and l.idx_participant is distinct from false
),
by_name as (
  select public.slugify_geo(l."SubdivisionName") as geo_slug,
         max(l."SubdivisionName") over (partition by public.slugify_geo(l."SubdivisionName")) as geo_label,
         l."ListingKey" as listing_key,
         l.off_market_date,
         l.listing_contract_date,
         l.total_price_change_pct,
         false as in_polygon
  from public.listings l
  cross join anchor a
  where l."StandardStatus" in ('Expired', 'Canceled', 'Cancelled', 'Withdrawn')
    and l.off_market_date is not null
    and l.off_market_date > (a.as_of - interval '12 months')
    and l.off_market_date <= a.as_of
    and l."SubdivisionName" is not null
    and public.slugify_geo(l."SubdivisionName") <> ''
    and l.permit_internet_yn is distinct from false
    and l.idx_participant is distinct from false
),
unioned as (
  select geo_slug,
         max(geo_label) as geo_label,
         listing_key,
         max(off_market_date) as off_market_date,
         max(listing_contract_date) as listing_contract_date,
         max(total_price_change_pct) as total_price_change_pct,
         bool_or(in_polygon) as in_polygon
  from (
    select geo_slug, geo_label, listing_key, off_market_date, listing_contract_date, total_price_change_pct, in_polygon from by_polygon
    union all
    select geo_slug, geo_label, listing_key, off_market_date, listing_contract_date, total_price_change_pct, in_polygon from by_name
  ) both_halves
  group by geo_slug, listing_key
),
failed as (
  select
    geo_slug,
    max(geo_label) as geo_label,
    count(*)::int as unsold_count,
    count(*) filter (where in_polygon)::int as unsold_in_polygon,
    count(*) filter (where not in_polygon)::int as unsold_by_name,
    percentile_cont(0.5) within group (
      order by (off_market_date - listing_contract_date)
    ) filter (where listing_contract_date is not null
              and off_market_date >= listing_contract_date) as median_days_listed,
    count(*) filter (where listing_contract_date is not null
                       and off_market_date >= listing_contract_date)::int as days_sample,
    count(*) filter (where total_price_change_pct < 0)::int as cut_count,
    percentile_cont(0.5) within group (
      order by abs(total_price_change_pct)
    ) filter (where total_price_change_pct < 0) as median_cut_pct
  from unioned
  group by geo_slug
),
plat_keys as (
  select geo_slug, max(geo_label) as geo_label
  from (
    select geo_slug, geo_label
    from public.boundaries
    where geo_type = 'subdivision' and geo_slug is not null and geo_slug <> ''
    union all
    select public.slugify_geo("SubdivisionName") as geo_slug, max("SubdivisionName") as geo_label
    from public.listings
    where "SubdivisionName" is not null
      and public.slugify_geo("SubdivisionName") <> ''
    group by 1
  ) keys
  group by geo_slug
)
select
  k.geo_slug,
  coalesce(f.geo_label, k.geo_label) as geo_label,
  coalesce(f.unsold_count, 0) as unsold_count,
  coalesce(f.unsold_in_polygon, 0) as unsold_in_polygon,
  coalesce(f.unsold_by_name, 0) as unsold_by_name,
  f.median_days_listed,
  coalesce(f.days_sample, 0) as days_sample,
  coalesce(f.cut_count, 0) as cut_count,
  f.median_cut_pct,
  (a.as_of - interval '12 months')::date as window_start,
  a.as_of as window_end
from plat_keys k
cross join anchor a
left join failed f on f.geo_slug = k.geo_slug
with no data;

create unique index if not exists subdivision_plat_unsold_mv_slug_idx
  on public.subdivision_plat_unsold_mv (geo_slug);

grant select on public.subdivision_plat_unsold_mv to anon, authenticated, service_role;

create or replace function public.refresh_subdivision_plat_unsold_mv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.subdivision_plat_unsold_mv;
  insert into public.mv_refresh_state (mv_name, refreshed_at)
  values ('subdivision_plat_unsold_mv', now())
  on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;
exception
  when feature_not_supported then
    -- CONCURRENTLY needs a populated view; the first refresh after WITH NO DATA
    -- is the plain one.
    refresh materialized view public.subdivision_plat_unsold_mv;
    insert into public.mv_refresh_state (mv_name, refreshed_at)
    values ('subdivision_plat_unsold_mv', now())
    on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;
end;
$$;

revoke all on function public.refresh_subdivision_plat_unsold_mv() from public, anon;
grant execute on function public.refresh_subdivision_plat_unsold_mv() to service_role;

-- SCHEDULE: nightly, beside its closed sibling. The window is rolling, so this
-- view is stale the day after it is built even if no listing changes — the
-- refresh is what moves window_end, and a page prints that stamp. 10:25 UTC is
-- five minutes after the closed sibling, off every other job's minute.
select cron.unschedule('refresh_subdivision_plat_unsold_mv_nightly')
where exists (
  select 1 from cron.job where jobname = 'refresh_subdivision_plat_unsold_mv_nightly'
);

select cron.schedule('refresh_subdivision_plat_unsold_mv_nightly', '25 10 * * *', $j$
  set local statement_timeout = '1800s';
  select public.refresh_subdivision_plat_unsold_mv();
$j$);

-- PROD APPLY NOTE (2026-09-09). Applied through the Supabase channel in three
-- steps as it was built: subdivision_plat_unsold_mv (the row-per-failure first
-- shape), refresh_subdivision_plat_unsold_mv, then
-- subdivision_plat_unsold_mv_covers_every_plat and
-- subdivision_plat_unsold_mv_anchor_to_sync_clock, both DROP + CREATE, because a
-- materialized view cannot gain rows it was never keyed for and cannot change
-- the window its body computes. Nothing in
-- production code read the object during that window. The end state matches the
-- definition above statement for statement. First full build measured 1,164
-- plats carrying at least one failure, 2,995 listings, 2,703 by polygon and 292
-- by name, window 2025-09-09..2026-09-09; the covered key set is every recorded
-- plat plus every MLS subdivision name.
