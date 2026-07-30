-- F7 follow-up: stop geo_snapshot_mv rewriting all 6,903 rows on every refresh.
--
-- SYMPTOM (live production audit, 2026-07-29; queries re-run in the authoring
-- session 2026-07-30)
--   pg_stat_user_tables for public.geo_snapshot_mv:
--     n_live_tup 6,903 · n_tup_ins 5,632,619 · n_tup_del 5,625,716
--     -> 5,632,619 / 6,903 = 816 implied FULL rewrites (812 at the 2026-07-29
--        measurement that triggered this fix — the counter climbs every 15 min)
--     autovacuum_count 1,499
--   pg_total_relation_size 3,984 kB, rewritten and re-vacuumed every 15 minutes.
--   pg_stat_statements: the refresh_geo_snapshot_mv() RPC path measured
--   1,020 calls · mean 30.5s · max 296s — a CONCURRENTLY "diff" that is really
--   a full delete+insert of the whole MV plus both btree indexes plus the
--   autovacuum after. Matt directed 2026-07-29 that this class not be tolerated.
--
-- ROOT CAUSE — same class as 20260729193000 (tile) and 20260730000500 (search)
--   The MV body carries `now() AS refreshed_at` (ordinal 9 of 9) in each of its
--   three UNION ALL branches (city / community / neighborhood). REFRESH
--   MATERIALIZED VIEW CONCURRENTLY diffs the fresh snapshot against the live
--   rows; because refreshed_at is now(), EVERY row differs on EVERY refresh.
--   With now() removed, every remaining function in the body (lower, btrim,
--   textcat, texticlike/~~*, count, min, percentile_cont) is provolatile='i'
--   (verified in pg_proc this session), so the body becomes a pure function of
--   `listings` and ci:mv-determinism holds with no baseline entry.
--
-- THE STRUCTURAL DIFFERENCE FROM THE TILE/SEARCH FIXES
--   geo_snapshot_mv had no _src/serving-view split: the DAL reads the matview
--   by name (getGeoSnapshot.ts, getOutOfAreaCities.ts, getMegaMenuData.ts,
--   getSiteIndexLinks.ts, app/actions/*, market-stat-consistency). This
--   migration INTRODUCES the split: the deterministic matview becomes
--   geo_snapshot_mv_src and a VIEW named geo_snapshot_mv presents the SAME
--   9 columns in the SAME order, so every existing reader keeps working
--   untouched (`.from('geo_snapshot_mv')` selects `*` in the DAL).
--
-- WHAT REPLACES refreshed_at — KEPT on the serving view (readers proven)
--   lib/data/geo/getGeoSnapshot.ts selects * and maps row.refreshed_at into
--   GeoSnapshot.refreshedAt; lib/data/geo/getOutOfAreaCities.ts names it in its
--   select list and returns refreshedAt; lib/out-of-area-cities.ts carries it in
--   the public type. So the column keeps its name, type (timestamptz) and
--   ordinal (9 of 9) on the VIEW, sourced from the one-row
--   public.mv_refresh_state table (created by 20260729193000, stamped by the
--   refresh function) instead of being materialised onto 6,903 rows.
--   /api/cron/loop-health-check probes only listing_tile_mv and
--   listing_search_mv via mvRefreshStamp — it never probes geo_snapshot_mv.
--
-- GRANT MODEL (verified live via pg_class.relacl + pg_attribute.attacl —
-- matview and column grants are invisible to information_schema.role_table_grants)
--   geo_snapshot_mv (old matview)  {postgres=arwdDxtm, anon=arwdDxtm,
--     authenticated=arwdDxtm, service_role=arwdDxtm}, no column ACLs. This is
--     the project's ONE `materialized_view_in_api` advisor hit: it is the only
--     matview in public with anon/authenticated in relacl (every other matview
--     is postgres+service_role only). All data here is public aggregates, so
--     the exposure was harmless, but the advisor warning goes away with it.
--   geo_snapshot_mv (new VIEW)     same effective access as today: full grants
--     to anon/authenticated/service_role (matching the tile serving view; DML
--     against a view over a matview still fails at the executor, exactly as it
--     did against the matview itself).
--   geo_snapshot_mv_src (new)      postgres + service_role ONLY. Supabase
--     pg_default_acl auto-grants anon/authenticated/service_role full rights on
--     every newly created relation, so the REVOKE below is load-bearing, not
--     ceremony (the lesson 20260730001000 had to re-learn for the tile _src).
--
-- PROD APPLY NOTE — statement order is the zero-downtime part
--   Single transaction. The expensive step (CREATE ... WITH DATA: three
--   aggregate passes over 589K `listings` rows, ~30s judging by the measured
--   refresh mean) runs FIRST under the new name geo_snapshot_mv_src, which
--   collides with nothing — the old matview keeps serving reads the entire
--   time. Only THEN does the migration take the AccessExclusive lock on the
--   serving name (DROP old matview -> rename indexes -> CREATE VIEW -> grants),
--   all instant catalog ops, so the lock window is milliseconds, not the ~30s
--   build. Build-first is possible here precisely because the serving name and
--   the new matview name differ; the indexes are created under *_new names
--   because the canonical index names are schema-wide unique and still occupied
--   by the old matview's indexes until the DROP. To any other session there is
--   never a moment where geo_snapshot_mv resolves to nothing: readers either
--   see the old matview (before our DROP acquires its lock) or block briefly
--   and, at commit, see the new view. Safe to apply through the standard
--   migration channel or the MCP connector as role postgres (well inside the
--   10-min database-level statement_timeout).
--   No pg_cron change: refresh_dal_mvs_15min ('5,20,35,50 * * * *') already
--   calls refresh_geo_snapshot_mv() as its 2nd statement (verified live in
--   cron.job), and /api/cron/refresh-mvs RPCs the same function name — both
--   keep working because only the function BODY changes.
--   A full pg_depend sweep confirms the old matview's only dependents are its
--   own 2 indexes, its toast table, its self rewrite rule and its rowtype —
--   no other view, matview or table depends on it, so plain DROP suffices.
--   Post-apply: refresh the G16 snapshot (npm run ci:data-access -- --refresh).

begin;

-- 1 ─────────────────────────────────────────────────────────────────────────
-- Freshness state row. public.mv_refresh_state was created (with RLS + read
-- policy + grants) by 20260729193000 and is live with two rows
-- (listing_tile_mv_src, listing_search_mv_src — verified this session). Seed
-- this MV's row first so the serving view below never returns NULL
-- refreshed_at between this commit and the first post-migration refresh.

insert into public.mv_refresh_state (mv_name, refreshed_at)
values ('geo_snapshot_mv_src', now())
on conflict (mv_name) do nothing;

-- 2 ─────────────────────────────────────────────────────────────────────────
-- Build the deterministic source MV under its new name, WITH DATA (the
-- default), while the old matview keeps serving. Body byte-identical to the
-- live definition (per pg_get_viewdef in the authoring session) except the
-- ordinal-9 `now() AS refreshed_at` column, which is gone from all three
-- branches: 9 columns in, 8 out. Branch quirks preserved faithfully, not
-- "fixed": only the city branch counts %Contingent% in pending_count, and the
-- community/neighborhood branches hard-code community_count = 0.

create materialized view public.geo_snapshot_mv_src as
  select 'city'::text as geo_type,
    lower(trim(both from "City")) as geo_key,
    min("City") as geo_label,
    count(*) filter (where "StandardStatus" = 'Active'::text and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as active_sfr_count,
    count(*) filter (where "StandardStatus" = 'Active'::text) as active_all_count,
    count(*) filter (where "StandardStatus" ~~* '%Pending%'::text or "StandardStatus" ~~* '%Under Contract%'::text or "StandardStatus" ~~* '%Contingent%'::text) as pending_count,
    percentile_cont(0.5::double precision) within group (order by ("ListPrice"::double precision)) filter (where "StandardStatus" = 'Active'::text and "ListPrice" > 0::numeric and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as median_list_price,
    count(distinct "SubdivisionName") filter (where "SubdivisionName" is not null and "SubdivisionName" <> 'N/A'::text and "StandardStatus" = 'Active'::text) as community_count
  from public.listings
  where "City" is not null
  group by (lower(trim(both from "City")))
union all
  select 'community'::text as geo_type,
    (lower(trim(both from "City")) || ':'::text) || lower(trim(both from "SubdivisionName")) as geo_key,
    min("SubdivisionName") as geo_label,
    count(*) filter (where "StandardStatus" = 'Active'::text and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as active_sfr_count,
    count(*) filter (where "StandardStatus" = 'Active'::text) as active_all_count,
    count(*) filter (where "StandardStatus" ~~* '%Pending%'::text or "StandardStatus" ~~* '%Under Contract%'::text) as pending_count,
    percentile_cont(0.5::double precision) within group (order by ("ListPrice"::double precision)) filter (where "StandardStatus" = 'Active'::text and "ListPrice" > 0::numeric and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as median_list_price,
    0 as community_count
  from public.listings
  where "City" is not null and "SubdivisionName" is not null and "SubdivisionName" <> 'N/A'::text
  group by ((lower(trim(both from "City")) || ':'::text) || lower(trim(both from "SubdivisionName")))
union all
  select 'neighborhood'::text as geo_type,
    lower(trim(both from boundary_neighborhood)) as geo_key,
    min(boundary_neighborhood) as geo_label,
    count(*) filter (where "StandardStatus" = 'Active'::text and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as active_sfr_count,
    count(*) filter (where "StandardStatus" = 'Active'::text) as active_all_count,
    count(*) filter (where "StandardStatus" ~~* '%Pending%'::text or "StandardStatus" ~~* '%Under Contract%'::text) as pending_count,
    percentile_cont(0.5::double precision) within group (order by ("ListPrice"::double precision)) filter (where "StandardStatus" = 'Active'::text and "ListPrice" > 0::numeric and "PropertyType" = 'A'::text and property_sub_type = 'Single Family Residence'::text) as median_list_price,
    0 as community_count
  from public.listings
  where boundary_neighborhood is not null
  group by (lower(trim(both from boundary_neighborhood)));

comment on materialized view public.geo_snapshot_mv_src is
  'City/community/neighborhood aggregate snapshot over listings. MUST stay a deterministic function of listings: any now()/current_date column makes REFRESH ... CONCURRENTLY rewrite all ~6.9K rows per refresh (measured 816 full rewrites, F7 follow-up 2026-07-30). Refresh timestamp lives in public.mv_refresh_state; served through the geo_snapshot_mv view.';

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Both indexes, definitions verbatim (per pg_indexes in the authoring
-- session), under *_new names because the canonical names are schema-wide
-- unique and still belong to the old matview's indexes until step 4. The
-- unique (geo_type, geo_key) index is the one CONCURRENTLY requires and must
-- exist before the first concurrent refresh.

create unique index geo_snapshot_mv_key_new
  on public.geo_snapshot_mv_src using btree (geo_type, geo_key);

create index geo_snapshot_mv_active_new
  on public.geo_snapshot_mv_src using btree (geo_type, active_sfr_count desc);

-- 4 ─────────────────────────────────────────────────────────────────────────
-- Swap. Everything from here to commit is an instant catalog op, so the
-- AccessExclusive lock on the serving name is held for milliseconds. The DROP
-- also drops the old matview's indexes, freeing the canonical index names.

drop materialized view if exists public.geo_snapshot_mv;

alter index public.geo_snapshot_mv_key_new rename to geo_snapshot_mv_key;
alter index public.geo_snapshot_mv_active_new rename to geo_snapshot_mv_active;

-- 5 ─────────────────────────────────────────────────────────────────────────
-- The serving view. Same 9 columns, same order, same types as the old matview.
-- refreshed_at keeps ordinal 9 as an uncorrelated scalar subquery, evaluated
-- once per statement as an InitPlan, so every DAL reader (select * included)
-- sees the exact shape it saw yesterday.

create view public.geo_snapshot_mv as
  select
    geo_type,
    geo_key,
    geo_label,
    active_sfr_count,
    active_all_count,
    pending_count,
    median_list_price,
    community_count,
    (select s.refreshed_at from public.mv_refresh_state s
      where s.mv_name = 'geo_snapshot_mv_src') as refreshed_at
  from public.geo_snapshot_mv_src;

-- 6 ─────────────────────────────────────────────────────────────────────────
-- Grants. Supabase default privileges just auto-granted full rights to anon,
-- authenticated and service_role on BOTH relations created above. The view
-- keeps that — it reproduces the old matview's exact relacl (anon,
-- authenticated, service_role, postgres all arwdDxtm; the explicit grant
-- documents it). The _src is clawed back to postgres+service_role only,
-- matching every other _src matview and retiring the project's single
-- materialized_view_in_api advisor warning.

revoke all on public.geo_snapshot_mv_src from public, anon, authenticated;
grant all on public.geo_snapshot_mv_src to service_role;  -- explicit; default ACL already supplies it

grant all on public.geo_snapshot_mv to anon, authenticated, service_role, postgres;

-- 7 ─────────────────────────────────────────────────────────────────────────
-- The refresh function now targets the _src and stamps mv_refresh_state. Body
-- otherwise byte-for-byte the live definition (pulled via pg_get_functiondef
-- before this migration): same advisory lock 7102, same CONCURRENTLY, same
-- 900s ceiling, same skip-on-contention return. CREATE OR REPLACE preserves
-- the function's ACL — EXECUTE for postgres + service_role only (verified
-- proacl = {postgres=X, service_role=X}).

create or replace function public.refresh_geo_snapshot_mv()
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '900s'
as $function$
DECLARE
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7102);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_geo_snapshot_mv already running');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.geo_snapshot_mv_src;

    INSERT INTO public.mv_refresh_state (mv_name, refreshed_at)
    VALUES ('geo_snapshot_mv_src', clock_timestamp())
    ON CONFLICT (mv_name) DO UPDATE SET refreshed_at = excluded.refreshed_at;

    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7102);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7102);
      RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

-- 8 ─────────────────────────────────────────────────────────────────────────

analyze public.geo_snapshot_mv_src;

commit;
