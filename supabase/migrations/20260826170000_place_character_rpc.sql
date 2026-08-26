-- get_place_character RPC — the measured half of PLACE_CONTENT_RULES R1/R2/R3
-- (docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md), 2026-08-26.
--
-- Returns one row per MLS property sub-type for one place, carrying the three
-- listing-derived facts a place page may publish about its housing stock:
--
--   R1  year built  — the 10th and 90th PERCENTILE of year_built, plus the
--                     sample size. Never min-max: measured over 2,422
--                     subdivisions, min-max puts a false pre-1940 claim on 61
--                     places and 60+ year spans on 214, while percentiles cut
--                     the average span from 23 years to 12.
--   R2  HOA dues    — the median of hoa_monthly WITHIN ONE sub-type, plus how
--                     many figures it came from. Never across types: of 1,288
--                     subdivisions with 5+ dues figures, 840 are mixed-type,
--                     172 land more than $25/mo from the detached figure and 50
--                     print more than double it.
--   R3  HOA presence— reported-yes and reported-total, never a yes/no.
--                     association_yn is null on 38.6% of listings, below the
--                     70% item-response floor, and "no HOA" next to dues at
--                     closing is an actively misleading claim.
--
-- The sample floors live in the DAL (lib/data/places/getPlaceCharacter.ts) with
-- the copy they gate. This function measures; it does not decide what may be
-- said. It returns raw counts so a caller can never mistake a withheld figure
-- for a measured zero.
--
-- POPULATION. public.place_membership, is_primary and still current — the same
-- membership the metric layer counts, so these figures and the counts on the
-- same page describe one set of listings. Aliases and polygons both land there;
-- subdivision, neighborhood and community grains all key the same way.
--
-- TWO POPULATIONS, DELIBERATELY.
--   * R1 counts HOMES. A home listed four times is one home. Without the
--     dedupe the mandated sentence "based on N homes with a recorded build
--     year" would be counting listings and calling them homes. The key is the
--     county parcel number where the MLS carries one (null on roughly 40% of
--     rows), then street number + street name + city, then the listing key, so
--     an unidentifiable row still counts exactly once. The home's most recent
--     listing supplies its sub-type and year.
--   * R2 and R3 count LISTINGS INSIDE A RECENT WINDOW. Dues and HOA status are
--     current facts: a 2008 dues figure published as this year's median is a
--     wrong number, so the window is a parameter and the date it resolved to
--     comes back in window_from for the copy to state. Recency is the newest of
--     close date, status change, on-market and list date, so a listing that is
--     live today is inside the window whatever year it first listed.
--
-- "ModificationTimestamp" IS NOT A MARKET DATE and is deliberately absent from
-- that list. Every Deschutes River Woods listing from 2007 and 2008 carries
-- ModificationTimestamp 2026-02-10: it records the last sync touch, not
-- anything that happened in the market. Including it put 1,874 listings inside
-- a "36 month" window on a plat that sees a few dozen sales a year, which is
-- the whole of history wearing a recency label. status_change_timestamp on
-- those same rows reads 2008 and is the real date.
--
-- percentile_disc for the years: a build year must be a year some home was
-- actually built, not an interpolated 1979.4. percentile_cont for dues, the
-- standard median of money, rounded to the dollar.
--
-- hoa_monthly = 0 is not counted as a reported figure. Zero is the MLS's
-- placeholder for "not filled in" far more often than it is a real $0 due, and
-- counting it would drag every median it touches toward zero.
--
-- ODS §5-4 A.4: aggregates only. No row-level sold data leaves this function.

-- Covering indexes. Measured cold on the largest neighborhood
-- (bend-mountain-view, 11,663 member listings): the membership lookup alone
-- cost 6.5s of an 8.9s call, because place_membership_geo_idx carries no
-- listing_key and every match went to the heap. INCLUDE makes it index-only.
create index if not exists idx_place_membership_geo_primary_current
  on public.place_membership (geo_type, geo_slug)
  include (listing_key)
  where is_primary and effective_to is null;

-- The second half of the same call is 11,663 random heap fetches into a
-- 170-column table. INCLUDE carries every column the character read needs, so
-- an all-visible page never touches the heap at all.
create index if not exists idx_listings_place_character
  on public.listings ("ListingKey")
  include (property_sub_type, year_built, hoa_monthly, association_yn,
           parcel_number, "StreetNumber", "StreetName", "City",
           "CloseDate", status_change_timestamp, "OnMarketDate", "ListDate");

create or replace function public.get_place_character(
  p_geo_type          text,
  p_geo_slug          text,
  p_hoa_window_months integer default 36
)
returns table(
  segment            text,
  home_count         int,
  year_sample        int,
  year_p10           int,
  year_p90           int,
  hoa_reported       int,
  hoa_median_monthly numeric,
  assoc_reported     int,
  assoc_yes          int,
  window_from        date
)
language sql
stable
security definer
set search_path = public
set statement_timeout = '15s'
as $$
  with cutoff as (
    select (current_date
            - make_interval(months => greatest(coalesce(p_hoa_window_months, 36), 1))
           )::date as from_date
  ),
  member as (
    select pm.listing_key
    from public.place_membership pm
    where pm.geo_type = p_geo_type
      and pm.geo_slug = p_geo_slug
      and pm.is_primary
      and pm.effective_to is null
  ),
  raw as (
    select
      l."ListingKey"                          as listing_key,
      nullif(btrim(l.property_sub_type), '')  as sub_type,
      l.year_built                            as year_built,
      l.hoa_monthly                           as hoa_monthly,
      l.association_yn                        as association_yn,
      coalesce(
        nullif(btrim(l.parcel_number), ''),
        nullif(
          lower(concat_ws('|', btrim(l."StreetNumber"), btrim(l."StreetName"), btrim(l."City"))),
          ''
        ),
        l."ListingKey"
      )                                       as home_key,
      greatest(
        coalesce(l."CloseDate",             '-infinity'::timestamptz),
        coalesce(l.status_change_timestamp, '-infinity'::timestamptz),
        coalesce(l."OnMarketDate",          '-infinity'::timestamptz),
        coalesce(l."ListDate",              '-infinity'::timestamptz)
      )                                       as as_of_ts
    from member m
    join public.listings l on l."ListingKey" = m.listing_key
    where nullif(btrim(l.property_sub_type), '') is not null
  ),
  homes as (
    select distinct on (r.home_key) r.*
    from raw r
    order by r.home_key, r.as_of_ts desc, r.listing_key desc
  ),
  home_agg as (
    select h.sub_type as segment, count(*)::int as home_count
    from homes h
    group by 1
  ),
  year_rows as (
    select h.sub_type as segment, h.year_built
    from homes h
    where h.year_built between 1850 and 2030
  ),
  year_agg as (
    select
      segment,
      count(*)::int                                                    as year_sample,
      (percentile_disc(0.10) within group (order by year_built))::int  as year_p10,
      (percentile_disc(0.90) within group (order by year_built))::int  as year_p90
    from year_rows
    group by 1
  ),
  window_rows as (
    select r.sub_type as segment, r.hoa_monthly, r.association_yn
    from raw r
    cross join cutoff c
    where r.as_of_ts > '-infinity'::timestamptz
      and r.as_of_ts::date >= c.from_date
  ),
  hoa_agg as (
    select
      segment,
      count(*) filter (where hoa_monthly is not null and hoa_monthly > 0)::int as hoa_reported,
      count(*) filter (where association_yn is not null)::int                  as assoc_reported,
      count(*) filter (where association_yn is true)::int                      as assoc_yes
    from window_rows
    group by 1
  ),
  dues as (
    select
      segment,
      round(percentile_cont(0.5) within group (order by hoa_monthly))::numeric as hoa_median_monthly
    from window_rows
    where hoa_monthly is not null and hoa_monthly > 0
    group by 1
  )
  select
    ha.segment,
    ha.home_count,
    coalesce(ya.year_sample, 0)   as year_sample,
    ya.year_p10,
    ya.year_p90,
    coalesce(hg.hoa_reported, 0)  as hoa_reported,
    d.hoa_median_monthly,
    coalesce(hg.assoc_reported, 0) as assoc_reported,
    coalesce(hg.assoc_yes, 0)      as assoc_yes,
    (select from_date from cutoff) as window_from
  from home_agg ha
  left join year_agg ya on ya.segment = ha.segment
  left join hoa_agg  hg on hg.segment = ha.segment
  left join dues     d  on d.segment  = ha.segment
  order by ha.home_count desc, ha.segment
$$;

-- Grant lockdown (memory: SECURITY DEFINER RPC grant lockdown — revoke from
-- PUBLIC, then grant the exact roles). Anon is intentional and necessary: the
-- public place pages read through supabaseAnon, and the function returns only
-- aggregates.
revoke all on function public.get_place_character(text, text, integer) from public;
grant execute on function public.get_place_character(text, text, integer)
  to anon, authenticated, service_role;
