-- F7: stop listing_tile_mv_src rewriting all 593,890 rows on every refresh.
--
-- SYMPTOM (live production audit, 2026-07-29)
--   /homes-for-sale/redmond/multi-family measured 51.6s / 4.4s / 36.7s on three
--   consecutive loads, and 799ms earlier the same day. The page's own query is
--   not the problem: EXPLAIN ANALYZE of the tile query (city_lower='redmond',
--   property_type='C', standard_status IN (...)) uses
--   listing_tile_mv_city_sub_status and runs in 106ms.
--
-- ROOT CAUSE
--   listing_tile_mv_src ends with `now() AS refreshed_at`. REFRESH MATERIALIZED
--   VIEW CONCURRENTLY diffs the new snapshot against the live one and applies
--   only the rows that differ. Because refreshed_at is now(), EVERY row differs
--   on EVERY refresh, so "concurrently" degenerates into a full delete+insert
--   of the whole table plus maintenance of all 12 indexes (including a GIN
--   tsvector index) plus the autovacuum that follows.
--
--   pg_stat_user_tables proves it, and the neighbouring MV is the control case:
--     listing_tile_mv_src           n_tup_ins   689,514,161  n_tup_del 701,737,984
--                                   n_live_tup      593,890  -> 1,161 FULL rewrites
--                                   autovacuum_count  1,168
--     listing_boundary_xref_mv_src  n_tup_ins        27,346  n_tup_del     14,507
--                                   n_live_tup       21,580  -> a real diff, ~25
--                                   rows per refresh. It has no now() column.
--
-- MEASURED COST OF THE DEFECT
--   pg_cron job refresh_dal_mvs_15min ('5,20,35,50 * * * *', 900s between ticks):
--     succeeded  181 runs  avg 492.4s  p50 484.4s  p95 564.8s  max 596.0s
--     failed     107 runs  avg 600.2s  (37% of runs die on the timeout)
--     duty cycle over the last 2 days: 60.6% of all wall-clock
--   pg_stat_statements for that one statement:
--     calls 1,073  total 500,805s  mean 466.7s
--     shared_blks_read 1,976,053,144  (= 15.8 TB read from disk)
--     cache hit 89.5%, against 99.7-99.8% for the user-facing PostgREST queries
--   pg_stat_database: temp_files 152,599 / temp_bytes 1,708 GB (work_mem is 7MB),
--     deadlocks 0, conflicts 0, ungranted locks 0.
--
--   For comparison, run_post_sync_pipeline is the smaller half of the problem:
--     4,068 calls, 115,772s total, mean 28.5s, 143,013,684 blocks read, 13.6% duty.
--
--   So this is RESOURCE STARVATION, not lock blocking. Every refresh function on
--   this database already uses CONCURRENTLY (verified across all six), which
--   never blocks a reader. What it does is stream ~16 TB through a 1 GB
--   shared_buffers and spill 1.7 TB to temp files, evicting the working set that
--   keeps the 106ms tile query at 106ms. When the cache is cold and the disk is
--   saturated, the same index scan is the 20-50s page load.
--
-- EXPECTED AFTER
--   The diff collapses from 593,890 changed rows to the number of listings the
--   MLS delta sync actually touched in the preceding 15 minutes (tens to low
--   hundreds), which is what listing_boundary_xref_mv_src already demonstrates.
--   refresh_dal_mvs_15min should fall from ~492s to single-digit seconds and its
--   duty cycle from 60.6% toward ~1%. Verify from cron.job_run_details, not from
--   post_sync_pipeline_runs (see the KNOWN DEFECT note at the bottom).
--
-- WHAT REPLACES refreshed_at
--   /api/cron/loop-health-check reads listing_tile_mv.refreshed_at as its MV
--   freshness probe (mvRefreshStamp('listing_tile_mv'), and evalSyncDelta uses it
--   to tell a dead ingest apart from a dead refresh). That probe is preserved
--   exactly: the column keeps its name, type and ordinal position on the view,
--   but is now sourced from a one-row state table stamped by the refresh
--   function instead of being materialised onto 593,890 rows.
--
-- PROD APPLY NOTE
--   This file is the plain DROP+CREATE form and is the intended END STATE. Do NOT
--   run it as-is against production: rebuilding listing_tile_mv_src takes ~8
--   minutes during which every search page has no data. Apply it with the
--   repo's zero-downtime MV swap instead:
--     1. CREATE MATERIALIZED VIEW listing_tile_mv_src_v2 ... WITH DATA, plus the
--        12 indexes under temporary names, alongside the serving MV.
--     2. One fast batch: DROP VIEW similar_listings_mv; DROP MATERIALIZED VIEW
--        similar_listings_mv_src; DROP VIEW listing_tile_mv; DROP MATERIALIZED
--        VIEW listing_tile_mv_src; ALTER ... RENAME the v2 MV and all 12 indexes
--        to the canonical names; then recreate the two views and
--        similar_listings_mv_src from the definitions below.
--     3. ANALYZE, then confirm cron.job_run_details for refresh_dal_mvs_15min.
--   The end state is identical either way.

begin;

-- 1 ─────────────────────────────────────────────────────────────────────────
-- Freshness state, one row per MV. This is the whole point: the refresh stamp
-- moves off the 593,890-row payload and onto a single row, so the MV body
-- becomes a pure function of `listings` and CONCURRENTLY can diff it properly.

create table if not exists public.mv_refresh_state (
  mv_name      text primary key,
  refreshed_at timestamptz not null default now()
);

comment on table public.mv_refresh_state is
  'One row per materialized view recording when it was last refreshed. Exists so MV bodies stay deterministic: a now() column inside an MV makes every row differ on every REFRESH ... CONCURRENTLY, which turns an incremental diff into a full table rewrite (F7, 2026-07-29).';

insert into public.mv_refresh_state (mv_name, refreshed_at)
values ('listing_tile_mv_src', now())
on conflict (mv_name) do nothing;

alter table public.mv_refresh_state enable row level security;

drop policy if exists mv_refresh_state_read on public.mv_refresh_state;
create policy mv_refresh_state_read on public.mv_refresh_state
  for select to anon, authenticated, service_role using (true);

grant select on public.mv_refresh_state to anon, authenticated, service_role;

-- 2 ─────────────────────────────────────────────────────────────────────────
-- Drop the dependency chain. similar_listings_mv_src reads listing_tile_mv_src
-- (verified via pg_depend), so it and its view come down first.

drop view if exists public.similar_listings_mv;
drop materialized view if exists public.similar_listings_mv_src;
drop view if exists public.listing_tile_mv;
drop materialized view if exists public.listing_tile_mv_src;

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Rebuild the source MV. Byte-identical to the previous definition except the
-- trailing `now() AS refreshed_at` column, which is gone.

create materialized view public.listing_tile_mv_src as
  select
    "ListingKey"          as listing_key,
    "ListNumber"          as list_number,
    "StandardStatus"      as standard_status,
    "ListPrice"           as list_price,
    "ClosePrice"          as close_price,
    "CloseDate"           as close_date,
    "BedroomsTotal"       as beds,
    "BathroomsTotal"      as baths,
    "TotalLivingAreaSqFt" as sqft,
    "StreetNumber"        as street_number,
    "StreetName"          as street_name,
    nullif(btrim(details ->> 'StreetSuffix'::text), ''::text) as street_suffix,
    "City"                as city,
    lower(trim(both from "City")) as city_lower,
    "PostalCode"          as postal_code,
    "SubdivisionName"     as subdivision_name,
    lower(trim(both from "SubdivisionName")) as subdivision_lower,
    "Latitude"            as lat,
    "Longitude"           as lng,
    "PhotoURL"            as photo_url,
    "PropertyType"        as property_type,
    property_sub_type,
    "OnMarketDate"        as on_market_date,
    "ModificationTimestamp" as modified_at,
    price_per_sqft,
    lot_size_acres,
    year_built,
    garage_spaces,
    pool_yn,
    has_virtual_tour,
    "DaysOnMarket"        as dom,
    price_drop_count,
    lower(regexp_replace(
      concat_ws('-'::text, "StreetNumber",
        regexp_replace(coalesce("StreetName", ''::text), '\s+'::text, '-'::text, 'g'::text)),
      '[^a-z0-9-]'::text, ''::text, 'g'::text)) as address_slug,
    boundary_city,
    boundary_neighborhood,
    boundary_subdivision,
    (((setweight(to_tsvector('english'::regconfig, coalesce("StreetNumber", ''::text)), 'A'::"char")
      || setweight(to_tsvector('english'::regconfig, coalesce("StreetName", ''::text)), 'A'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce("City", ''::text)), 'B'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce("SubdivisionName", ''::text)), 'B'::"char"))
      || setweight(to_tsvector('english'::regconfig, coalesce("PostalCode", ''::text)), 'C'::"char")
      as search_vector
  from public.listings l
  where permit_internet_yn is distinct from false
    and idx_participant   is distinct from false;

comment on materialized view public.listing_tile_mv_src is
  'Tile projection over listings. MUST stay a deterministic function of listings: any now()/current_date column makes REFRESH ... CONCURRENTLY rewrite all 593K rows. Refresh timestamp lives in public.mv_refresh_state.';

-- 4 ─────────────────────────────────────────────────────────────────────────
-- All 12 indexes, recreated verbatim. listing_tile_mv_key is the unique index
-- CONCURRENTLY requires and must exist before the first concurrent refresh.

create unique index listing_tile_mv_key
  on public.listing_tile_mv_src using btree (listing_key);

create index listing_tile_mv_list_number
  on public.listing_tile_mv_src using btree (list_number);

create index listing_tile_mv_address_slug
  on public.listing_tile_mv_src using btree (city_lower, address_slug);

create index listing_tile_mv_city_sub_status
  on public.listing_tile_mv_src using btree (city_lower, subdivision_lower, standard_status)
  where standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text, 'Pending'::text]);

create index listing_tile_mv_city_status_mod
  on public.listing_tile_mv_src using btree (city_lower, standard_status, modified_at desc nulls last)
  where standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text]);

create index listing_tile_mv_boundary_neighborhood
  on public.listing_tile_mv_src using btree (boundary_neighborhood)
  where boundary_neighborhood is not null;

create index listing_tile_mv_latlng_all
  on public.listing_tile_mv_src using btree (lat, lng)
  where lat is not null and lng is not null;

create index listing_tile_mv_active_latlng
  on public.listing_tile_mv_src using btree (lat, lng)
  where standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
    and lat is not null and lng is not null;

create index listing_tile_mv_active_geo
  on public.listing_tile_mv_src using gist (st_setsrid(st_makepoint((lng)::double precision, (lat)::double precision), 4326))
  where standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
    and lat is not null and lng is not null;

create index listing_tile_mv_search
  on public.listing_tile_mv_src using gin (search_vector);

create index idx_listing_tile_mv_postal_code_prefix
  on public.listing_tile_mv_src using btree (postal_code text_pattern_ops);

create index idx_listing_tile_mv_street_number_prefix
  on public.listing_tile_mv_src using btree (street_number text_pattern_ops);

-- 5 ─────────────────────────────────────────────────────────────────────────
-- The serving view. Same 38 columns, same order, same types. refreshed_at is
-- now an uncorrelated scalar subquery, evaluated once per statement as an
-- InitPlan, so /api/cron/loop-health-check keeps working unchanged:
--   .from('listing_tile_mv').select('refreshed_at').not('refreshed_at','is',null).limit(1)

create view public.listing_tile_mv as
  select
    listing_key, list_number, standard_status, list_price, close_price, close_date,
    beds, baths, sqft, street_number, street_name, street_suffix,
    city, city_lower, postal_code, subdivision_name, subdivision_lower,
    lat, lng, photo_url, property_type, property_sub_type,
    on_market_date, modified_at, price_per_sqft, lot_size_acres, year_built,
    garage_spaces, pool_yn, has_virtual_tour, dom, price_drop_count,
    address_slug, boundary_city, boundary_neighborhood, boundary_subdivision,
    search_vector,
    (select s.refreshed_at from public.mv_refresh_state s
      where s.mv_name = 'listing_tile_mv_src') as refreshed_at
  from public.listing_tile_mv_src
  where coalesce(standard_status, ''::text) !~~* '%coming%soon%'::text;

grant select, insert, update, delete, references, trigger, truncate
  on public.listing_tile_mv to anon, authenticated, service_role, postgres;

-- 6 ─────────────────────────────────────────────────────────────────────────
-- Rebuild the dependent MV and its view, unchanged. similar_listings_mv_src
-- keeps its own now() column: it holds 75,842 rows in 36 MB across 2 btree
-- indexes and refreshes once daily at 04:30, so its full rewrite costs ~nothing
-- and is out of scope for this fix. Left deliberately, not overlooked.

create materialized view public.similar_listings_mv_src as
  with active_anchors as (
    select listing_key, city_lower, subdivision_lower, list_price, beds, photo_url
    from public.listing_tile_mv_src
    where standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
      and city_lower is not null
      and list_price is not null
      and list_price > 0::numeric
  ), candidates as (
    select
      a.listing_key as anchor_key,
      c.listing_key as similar_key,
      case when a.subdivision_lower is not null and a.subdivision_lower = c.subdivision_lower
           then 100 else 50 end
        + (40::numeric * (1::numeric - least(1::numeric, abs(c.list_price - a.list_price) / a.list_price)))::integer
        as similarity_score,
      row_number() over (
        partition by a.listing_key
        order by
          (case when a.subdivision_lower is not null and a.subdivision_lower = c.subdivision_lower then 0 else 1 end),
          (abs(c.list_price - a.list_price)),
          c.modified_at desc nulls last
      ) as rank
    from active_anchors a
    join public.listing_tile_mv_src c
      on c.city_lower = a.city_lower
     and c.standard_status = any (array['Active'::text, 'Coming Soon'::text, 'Active Under Contract'::text])
     and c.listing_key <> a.listing_key
     and c.list_price is not null
     and c.list_price >= (a.list_price * 0.80)
     and c.list_price <= (a.list_price * 1.20)
     and (a.beds is null or c.beds is null or (c.beds >= greatest(0, a.beds - 1) and c.beds <= (a.beds + 1)))
     and c.photo_url is not null
  )
  select
    anchor_key,
    similar_key,
    rank::smallint             as rank,
    similarity_score::smallint as similarity_score,
    now()                      as refreshed_at
  from candidates
  where rank <= 12;

create unique index similar_listings_mv_anchor_rank
  on public.similar_listings_mv_src using btree (anchor_key, rank);

create unique index similar_listings_mv_anchor_similar
  on public.similar_listings_mv_src using btree (anchor_key, similar_key);

create view public.similar_listings_mv as
  select anchor_key, similar_key, rank, similarity_score, refreshed_at
  from public.similar_listings_mv_src s
  where exists (select 1 from public.listing_tile_mv a where a.listing_key = s.anchor_key)
    and exists (select 1 from public.listing_tile_mv b where b.listing_key = s.similar_key);

grant select, insert, update, delete, references, trigger, truncate
  on public.similar_listings_mv to anon, authenticated, service_role, postgres;

-- 7 ─────────────────────────────────────────────────────────────────────────
-- The refresh function now stamps mv_refresh_state. Body otherwise unchanged
-- (pulled via pg_get_functiondef before this migration): same advisory lock
-- 7101, same CONCURRENTLY, same 900s ceiling, same skip-on-contention return.

create or replace function public.refresh_listing_tile_mv()
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '900s'
as $function$
declare
  t_start     timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock    boolean;
begin
  got_lock := pg_try_advisory_lock(7101);
  if not got_lock then
    return json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_tile_mv already running');
  end if;

  begin
    refresh materialized view concurrently public.listing_tile_mv_src;

    insert into public.mv_refresh_state (mv_name, refreshed_at)
    values ('listing_tile_mv_src', clock_timestamp())
    on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;

    duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
    perform pg_advisory_unlock(7101);
    return json_build_object('ok', true, 'duration_ms', duration_ms);
  exception
    when others then
      perform pg_advisory_unlock(7101);
      return json_build_object('ok', false, 'error', sqlerrm);
  end;
end;
$function$;

-- 8 ─────────────────────────────────────────────────────────────────────────
-- Reschedule the MV job so a future regression cannot silently starve the
-- later MVs. Two problems with the current command, both independent of the
-- root cause above:
--
--   a) All four refreshes ran as ONE statement sharing ONE timeout budget, so a
--      slow tile refresh consumed the allowance for the other three and the MVs
--      after it never refreshed. 107 of 288 runs died that way. Split into four
--      statements, each gets its own budget. Note this narrows the failure, it
--      does not remove it: pg_cron runs a multi-statement command as one
--      implicit transaction, so a statement that actually times out still aborts
--      the rest. Full isolation would need four separate cron jobs, which trades
--      that isolation for four heavy refreshes running concurrently — worse for
--      the contention this migration exists to fix. Sequential is the right call.
--   b) The 900s ceiling from 20260716043000 never applied on this path.
--      statement_timeout is armed when a statement starts; a per-function SET
--      cannot extend a timer already running for the enclosing statement. The
--      enclosing `select f(), g(), h(), i()` inherited the database-level
--      `statement_timeout=10min` on database `postgres`, which is exactly where
--      the failures cluster (600.1s / 600.2s / max 602.0s). `set local` as the
--      first statement of the cron command fixes that properly.

select cron.unschedule(jobid) from cron.job where jobname = 'refresh_dal_mvs_15min';
select cron.schedule(
  'refresh_dal_mvs_15min',
  '5,20,35,50 * * * *',
  $$
  set local statement_timeout = '900s';
  select public.refresh_listing_tile_mv();
  select public.refresh_geo_snapshot_mv();
  select public.refresh_listing_boundary_xref_mv();
  select public.refresh_listing_search_mv();
  $$
);

analyze public.listing_tile_mv_src;
analyze public.similar_listings_mv_src;

commit;

-- KNOWN DEFECT, NOT FIXED HERE
--   public.run_post_sync_pipeline records every duration with
--   `EXTRACT(EPOCH FROM (now() - v_started_at))`. now() is transaction_timestamp
--   and does not advance inside a transaction, so post_sync_pipeline_runs stores
--   0.000000 for total_seconds, pulse_seconds and stats_seconds on every row —
--   662 consecutive rows over 7 days, including runs that pg_cron timed at 592s.
--   completed_at equals started_at to the microsecond. The fix is clock_timestamp()
--   in the five EXTRACT expressions. Left out of this migration to keep it
--   reviewable; until it lands, measure this change from cron.job_run_details and
--   pg_stat_statements, never from post_sync_pipeline_runs.
