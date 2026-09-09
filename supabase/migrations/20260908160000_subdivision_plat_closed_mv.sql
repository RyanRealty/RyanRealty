-- subdivision_plat_closed_mv — lifetime CLOSED sales attributed to a recorded
-- county plat by POINT-IN-POLYGON, unioned with the MLS-name attribution it
-- replaces as the sole source (SITE-24, 2026-09-08).
--
-- THE PROBLEM. /subdivisions/<slug> is indexable only when the slug has a GIS
-- polygon in public.boundaries AND clears SUBDIVISION_INDEX_MIN_LIFETIME_SALES
-- (=10) lifetime closed sales (lib/data/subdivisions/subdivision-index.ts). The
-- polygon half is at RECORDED-PLAT grain — 3.2K Deschutes County plats. The
-- count half was a TEXT JOIN on MLS "SubdivisionName", which is at RESORT
-- grain: every home inside Ridge At Broken Top, Tennis Tracts At Broken Top,
-- Courtyard Garages At Broken Top and Golf Tracts At Broken Top is listed as
-- "Broken Top"; every home in Golf Homes At Tetherow is listed as "Tetherow".
-- Not one sale is ever recorded under a sub-plat name, so a sub-plat scored 0
-- against ANY nonzero floor, forever, no matter how many houses sold inside it.
-- 18 of the top 25 /subdivisions pages by Search Console impressions were
-- served noindex by that mismatch, and Google had begun dropping them on
-- recrawl. The threshold was never the variable. The JOIN was.
--
-- WHY THE POLYGON JOIN IS A UNION AND NOT A REPLACEMENT. Measured on
-- production before this shipped, both shapes, per the absence rule:
--   Tennis Tracts At Broken Top   polygon 110   name 0
--   Golf Homes At Tetherow        polygon 107   name 0
--   Golf Tracts At Broken Top     polygon  54   name 0
--   Rock Ridge Cabin Sites of BBR polygon  32   name 0
--   Outcrop                       polygon   8   name 20+
-- Outcrop is the case that forbids a straight replacement. Its plat is real
-- (0.0190 sq mi) and its sales ARE named "Outcrop", but six of them share the
-- single coordinate (44.067163, -121.356922) — a builder/plat-office geocode
-- that lands outside the recorded polygon. A pure polygon join would have
-- dropped Outcrop from 20+ to 8 and taken an INDEXED page's index slot away.
-- Coarse geocodes are common in historical MLS data, so the union is not a
-- special case for one plat: geometry ADDS the sales a name can never carry,
-- and the name still carries the sales a geocode lost.
--
-- A listing counts ONCE per plat however it was attributed — the union is over
-- distinct listing_key, so a sale that is both inside the polygon and named for
-- the plat is one sale, not two. closed_in_polygon and closed_by_name are
-- carried beside the total so any surface printing the figure can say which
-- attribution produced it, and so the two can never be silently conflated.
--
-- SOURCE IS listing_tile_mv, DELIBERATELY, NOT raw listings. The count this
-- replaces already came from listing_tile_mv (see getIndexableSubdivisions.ts
-- for why that MV, not get_subdivision_status_counts, is the source of a
-- lifetime status count on this site), so the join is the only thing that
-- moves. listing_tile_mv is defined
--   WHERE permit_internet_yn IS DISTINCT FROM false
--     AND idx_participant IS DISTINCT FROM false
-- so an internet-display-opted-out or non-IDX listing counts here no more than
-- it counted before. That is the divergence documented in
-- lib/data/subdivisions/subdivision-sitemap-inventory.ts, carried forward
-- unchanged rather than newly introduced. Verified against RAW public.listings
-- (no such filter) for the two plats that came in under the floor: the wider
-- shape returned the same 8 rows for ridge-at-broken-top and the same 0 for
-- courtyard-garages-at-broken-top, so the filter is not what holds them back.
--
-- CLOSED CLASSIFICATION is byte-identical to the TypeScript classifier the old
-- path used (classifyLifetimeBuckets: `lower.includes('closed')`) and to
-- get_subdivision_status_counts' own FILTER clause:
--   lower(coalesce(standard_status,'')) like '%closed%'
-- slugify_geo() is IMMUTABLE and mirrors lib/slug.ts slugify() exactly, so the
-- name half of the union produces the same slugs the route does.
--
-- ALL PROPERTY TYPES, deliberately: the count this replaces applied no
-- property_type filter, so the floor keeps measuring the same population.
-- closed_count_sfr is carried beside it (PropertyType 'A') for surfaces that
-- publish an SFR figure; the index gate reads closed_count.
--
-- POLYGON QUALITY, CHECKED FIRST. Membership is ST_Contains against b.polygon,
-- so a plat is only ever credited with sales that physically sit inside its
-- recorded boundary. All seven SITE-24 plats are valid geometries and
-- sub-square-mile — Golf Tracts At Broken Top 0.3076 sq mi, Outcrop 0.0190,
-- Golf Homes At Tetherow 0.0185, Tennis Tracts At Broken Top 0.0144, Rock Ridge
-- Cabin Sites Of Black Butte Ranch 0.0106, Ridge At Broken Top 0.0077,
-- Courtyard Garages At Broken Top 0.0003 — plat-shaped, not resort-shaped and
-- not city-shaped. Contrast the known-broken case in
-- reference_neighborhood_sold_attribution_broken, where a "neighborhood"
-- polygon for broken-top measured 17.96 sq mi against Bend's 35.45. A plat
-- whose polygon is degenerate simply attracts no points and stays noindex; it
-- never borrows another place's sales. Courtyard Garages At Broken Top is
-- exactly that case and it is not a defect: 0.0003 sq mi is a garage tract, no
-- home has ever closed inside it, and it correctly stays out of the index.
--
-- OVERLAP IS REAL AND IS NOT DOUBLE COUNTING. A point can sit inside two
-- recorded plats (a replat over an original plat). Each plat then reports that
-- sale on its own row, which is correct: the figure is "closed sales inside
-- THIS plat", never a partition of the county.
--
-- WHY AN MV AND NOT A REQUEST-TIME ST_Contains. The gate is read on every
-- /subdivisions/<slug> render, by the sitemap, and by llms.txt. A per-request
-- spatial join of the closed set against 3.2K polygons is not a page read;
-- precomputing it once makes request time a (plat_slug) index lookup. Same
-- reason listing_boundary_xref_mv exists for the ACTIVE set (20260529020000) —
-- this is its lifetime-closed sibling, and deliberately a separate object: that
-- one is ~4% of the table and refreshes on a 15-minute cadence, this one covers
-- all of MLS history and only moves when a sale closes.
--
-- Built WITH NO DATA (instant); populated by refresh_subdivision_plat_closed_mv()
-- and refreshed nightly by pg_cron (see the schedule at the bottom of this file).
--
-- PROD APPLY NOTE (2026-09-09). This file is ONE object; production reached it
-- in six steps through the Supabase apply channel while it was being built,
-- registered in supabase_migrations.schema_migrations as
-- subdivision_plat_closed_mv, _top_city, _union_attribution, _gist_reachable,
-- refresh_subdivision_plat_closed_mv_nightly and _closed_by_year. The last of
-- those is a DROP + CREATE, because a materialized view cannot gain a column;
-- nothing in production code read the object at the time, so the window cost
-- nothing. The end state was read back out of pg_matviews and matches the
-- definition below statement for statement, the unique index and the grants are
-- in place, cron.job 210 refresh_subdivision_plat_closed_mv_nightly is active on
-- '20 10 * * *', and mv_refresh_state stamps the last run. A replay of this file
-- against an empty database produces the same object in one step.

-- NEITHER BRANCH MAY PUT `boundaries` BEHIND A CTE. A CTE referenced more than
-- once is MATERIALIZED, and a materialized `plats` has no GIST index, so the
-- planner turns ST_Contains into a bare nested loop of ~3.2K polygons against
-- every closed point. Measured on production: the same logic with a shared
-- `plats` CTE ran past 10 minutes and had to be cancelled; joining
-- public.boundaries directly in each branch, where boundaries_polygon_gist is
-- reachable, is the 27s shape. Each branch therefore repeats its own filters
-- rather than sharing a CTE — the duplication is the point.
create materialized view if not exists public.subdivision_plat_closed_mv as
with
-- Attribution A: the sale's point falls inside the recorded plat.
by_polygon as (
  select b.geo_slug,
         b.geo_label,
         t.listing_key,
         t.city_lower,
         t.property_type,
         t.close_date,
         true as in_polygon
  from public.listing_tile_mv t
  join public.boundaries b
    on b.geo_type = 'subdivision'
   and b.polygon is not null
   and ST_IsValid(b.polygon)
   and ST_Contains(
         b.polygon,
         ST_SetSRID(ST_MakePoint(t.lng::float8, t.lat::float8), 4326)
       )
  where lower(coalesce(t.standard_status, '')) like '%closed%'
    and t.lat is not null
    and t.lng is not null
),
-- Attribution B: the sale is recorded under this plat's own name. This is the
-- join being replaced as the SOLE source, kept as a contributor so no plat that
-- is indexed today loses its index to a coarse historical geocode.
by_name as (
  select b.geo_slug,
         b.geo_label,
         t.listing_key,
         t.city_lower,
         t.property_type,
         t.close_date,
         false as in_polygon
  from public.listing_tile_mv t
  join public.boundaries b
    on b.geo_type = 'subdivision'
   and b.polygon is not null
   and b.geo_slug = public.slugify_geo(t.subdivision_name)
  where lower(coalesce(t.standard_status, '')) like '%closed%'
),
-- One row per (plat, sale) however many attributions found it.
attributed as (
  select geo_slug,
         geo_label,
         listing_key,
         bool_or(in_polygon)     as in_polygon,
         bool_or(not in_polygon) as by_name,
         min(city_lower)         as city_lower,
         min(property_type)      as property_type,
         min(close_date)         as close_date
  from (
    select * from by_polygon
    union all
    select * from by_name
  ) u
  group by geo_slug, geo_label, listing_key
),
-- THE PLAT'S OWN CLOSED SERIES, by calendar year of the close.
--
-- WHY IT LIVES HERE AND NOT IN A SECOND OBJECT. It is the same union, grouped
-- one level finer, and a sub-plat has no other route to a series at all: the
-- yearly table the /subdivisions page already prints is an MLS SubdivisionName
-- join, so a plat whose homes are filed under the resort's name has an empty
-- one and the page could only ever say "too few recent sales to chart" over a
-- plat with a hundred sales on it. Computing it beside the total guarantees the
-- series and the total are the same population — sum(closed_by_year) can differ
-- from closed_count ONLY by the sales whose close_date is null, and by nothing
-- else, which is a property the page can state instead of a coincidence it
-- hopes for.
--
-- `attributed` is referenced twice from here down, so Postgres materializes it.
-- That is fine and wanted: it is a small post-join aggregate. The CTE the header
-- warns about is `boundaries`, whose GIST index a materialized CTE would hide.
per_year as (
  select geo_slug,
         geo_label,
         extract(year from close_date)::int as close_year,
         count(*)::int                      as closed_in_year
  from attributed
  where close_date is not null
  group by geo_slug, geo_label, extract(year from close_date)::int
),
years as (
  select geo_slug,
         geo_label,
         jsonb_object_agg(close_year::text, closed_in_year order by close_year) as closed_by_year
  from per_year
  group by geo_slug, geo_label
)
select
  a.geo_slug                                                as plat_slug,
  a.geo_label                                               as plat_label,
  count(*)::int                                             as closed_count,
  count(*) filter (where a.in_polygon)::int                 as closed_in_polygon,
  count(*) filter (where a.by_name)::int                    as closed_by_name,
  count(*) filter (where a.property_type = 'A')::int        as closed_count_sfr,
  -- The MLS city most of this plat's closed sales were listed under. The old
  -- path got a city by looping the Central Oregon cities; a polygon sits in one
  -- city, so the city is no longer part of the count — it is display context
  -- for the page title. NULL when the sales carry no city, and the page then
  -- says nothing about the city rather than guessing one (§0).
  mode() within group (order by a.city_lower)               as top_city_lower,
  min(a.close_date)                                         as first_close_date,
  max(a.close_date)                                         as last_close_date,
  -- {"2013": 4, "2014": 11, ...} — closed sales per calendar year, same union,
  -- same distinct listing_key. NULL for a plat whose sales all carry a null
  -- close_date; the page then draws no series rather than an invented one.
  y.closed_by_year                                          as closed_by_year
from attributed a
left join years y
  on y.geo_slug = a.geo_slug
 and y.geo_label = a.geo_label
group by a.geo_slug, a.geo_label, y.closed_by_year
with no data;

-- Unique index → REFRESH MATERIALIZED VIEW CONCURRENTLY, and the only lookup
-- shape any consumer needs (one plat, or the whole set).
create unique index if not exists subdivision_plat_closed_mv_pk
  on public.subdivision_plat_closed_mv (plat_slug);

grant select on public.subdivision_plat_closed_mv to anon, authenticated, service_role;

comment on materialized view public.subdivision_plat_closed_mv is
  'Lifetime CLOSED sales per recorded county plat: the union, over distinct listing_key, of sales whose point falls inside boundaries.polygon (geo_type=subdivision) and sales recorded under that plat name in MLS. Source listing_tile_mv — same source, same closed classification, same internet-display filter as the name-only join it replaces. closed_in_polygon / closed_by_name decompose the total, and closed_by_year carries the same union grouped by calendar year of the close. Feeds the /subdivisions indexability floor and the plat market series (SITE-24).';

-- Refresh RPC. Its own statement_timeout overrides the service_role cap so the
-- spatial rebuild always completes; the freshness stamp goes in
-- mv_refresh_state, never on the MV payload (ci:mv-determinism / F7).
create or replace function public.refresh_subdivision_plat_closed_mv()
returns json
language plpgsql
security definer
set search_path = public
set statement_timeout = '900s'
as $$
declare
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  is_populated boolean;
begin
  select relispopulated into is_populated
  from pg_class
  where oid = 'public.subdivision_plat_closed_mv'::regclass;

  -- CONCURRENTLY requires an already-populated MV; the first ever run is a
  -- plain refresh.
  if coalesce(is_populated, false) then
    refresh materialized view concurrently public.subdivision_plat_closed_mv;
  else
    refresh materialized view public.subdivision_plat_closed_mv;
  end if;

  insert into public.mv_refresh_state (mv_name, refreshed_at)
  values ('subdivision_plat_closed_mv', now())
  on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;

  duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
  return json_build_object('ok', true, 'duration_ms', duration_ms);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.refresh_subdivision_plat_closed_mv() from public, anon;
grant execute on function public.refresh_subdivision_plat_closed_mv() to service_role;

-- SCHEDULE: pg_cron, not /api/cron/refresh-mvs. That route is the 15-minute
-- lane for MVs that track live inventory; this one covers all of MLS history
-- and only moves when a sale closes, so it is a nightly job and does not belong
-- in a 15-minute request-timed sweep. pg_cron is the established channel for
-- exactly this on this project (job refresh_dal_mvs_15min already refreshes
-- geo_snapshot_mv and listing_boundary_xref_mv the same way).
--
-- 03:20 America/Los_Angeles is 10:20 UTC — after the nightly delta sync and the
-- listing_tile_mv refresh this MV reads from, and off every other job's minute.
-- Measured full rebuild against production: 38.0s.
--
-- `set local statement_timeout` must be its OWN statement BEFORE the payload:
-- statement_timeout is armed when the enclosing statement starts, so a per-
-- function SET can never extend an already-armed timer (proven 2026-07-29;
-- reference_pgcron_long_ddl_channel).
select cron.unschedule('refresh_subdivision_plat_closed_mv_nightly')
where exists (
  select 1 from cron.job where jobname = 'refresh_subdivision_plat_closed_mv_nightly'
);

select cron.schedule('refresh_subdivision_plat_closed_mv_nightly', '20 10 * * *', $j$
  set local statement_timeout = '1800s';
  select public.refresh_subdivision_plat_closed_mv();
$j$);
