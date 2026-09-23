-- pg_cron owns every DAL materialized-view refresh; the Vercel duplicate goes.
-- Audit DATA-2 (visibility audit 2026-09-22), package P9.
--
-- THE DEFECT. vercel.json scheduled /api/cron/refresh-mvs hourly at :08. It
-- re-ran four refreshes pg_cron already owns (refresh_listing_tile_mv_30min
-- at :02/:32; refresh_dal_mvs_15min at :05/:20/:35/:50 for geo_snapshot,
-- listing_boundary_xref and listing_search) plus
-- refresh_neighborhood_year_pricing_mv, which nothing else ran. Tile, geo and
-- search skip on advisory locks 7101/7102/7106. refresh_listing_boundary_xref_mv
-- and refresh_neighborhood_year_pricing_mv had no lock, so the route's xref
-- REFRESH ... CONCURRENTLY queued behind job refresh_dal_mvs_15min's in-flight
-- refresh of the same MV (its :05 run was still writing at :08), came back
-- ok:false, and the route answered 500 (app/api/cron/refresh-mvs/route.ts).
--
-- THE FIX.
--   1. refresh_listing_boundary_xref_mv: pg_try_advisory_lock(7107),
--      skip-on-contention, and a mv_refresh_state stamp. Body otherwise the
--      20260721091000 definition (refreshes listing_boundary_xref_mv_src).
--   2. refresh_neighborhood_year_pricing_mv: pg_try_advisory_lock(7108),
--      skip-on-contention, a mv_refresh_state stamp, and the 300s budget its
--      siblings carry. Same jsonb return shape ({ok, rows, duration_ms}).
--   3. refresh_dal_mvs_15min gains refresh_neighborhood_year_pricing_mv after
--      refresh_listing_search_mv. The MV reads listing_tile_mv, which job
--      refresh_listing_tile_mv_30min refreshes at :02/:32, so every run reads a
--      tile state at most 30 minutes old (it was up to 60 on the hourly route).
--
-- ORDER. Until this migration is applied, the Vercel route is the only thing
-- refreshing neighborhood_year_pricing_mv, so the route and its vercel.json
-- entry are removed only AFTER this lands (verify: mv_refresh_state row
-- 'neighborhood_year_pricing_mv' gets a stamp at :05/:20/:35/:50).

-- 1 ───────────────────────────────────────────────────────────────────────────
create or replace function public.refresh_listing_boundary_xref_mv()
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
  got_lock := pg_try_advisory_lock(7107);
  if not got_lock then
    return json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_boundary_xref_mv already running');
  end if;

  begin
    refresh materialized view concurrently public.listing_boundary_xref_mv_src;

    insert into public.mv_refresh_state (mv_name, refreshed_at)
    values ('listing_boundary_xref_mv_src', clock_timestamp())
    on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;

    duration_ms := (extract(epoch from (clock_timestamp() - t_start)) * 1000)::integer;
    perform pg_advisory_unlock(7107);
    return json_build_object('ok', true, 'duration_ms', duration_ms);
  exception
    when others then
      perform pg_advisory_unlock(7107);
      return json_build_object('ok', false, 'error', sqlerrm);
  end;
end;
$function$;

revoke all on function public.refresh_listing_boundary_xref_mv() from public, anon, authenticated;
grant execute on function public.refresh_listing_boundary_xref_mv() to service_role;

-- 2 ───────────────────────────────────────────────────────────────────────────
create or replace function public.refresh_neighborhood_year_pricing_mv()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '300s'
as $$
declare
  started  timestamptz := clock_timestamp();
  n        integer;
  got_lock boolean;
begin
  got_lock := pg_try_advisory_lock(7108);
  if not got_lock then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'refresh_neighborhood_year_pricing_mv already running');
  end if;

  begin
    refresh materialized view concurrently public.neighborhood_year_pricing_mv;
    select count(*) into n from public.neighborhood_year_pricing_mv;

    insert into public.mv_refresh_state (mv_name, refreshed_at)
    values ('neighborhood_year_pricing_mv', clock_timestamp())
    on conflict (mv_name) do update set refreshed_at = excluded.refreshed_at;

    perform pg_advisory_unlock(7108);
    return jsonb_build_object(
      'ok', true,
      'rows', n,
      'duration_ms', (extract(epoch from (clock_timestamp() - started)) * 1000)::integer
    );
  exception when others then
    perform pg_advisory_unlock(7108);
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end;
$$;

revoke execute on function public.refresh_neighborhood_year_pricing_mv() from public;
revoke execute on function public.refresh_neighborhood_year_pricing_mv() from anon;
revoke execute on function public.refresh_neighborhood_year_pricing_mv() from authenticated;
grant execute on function public.refresh_neighborhood_year_pricing_mv() to service_role;

comment on materialized view public.neighborhood_year_pricing_mv is
  'Per-Bend-district, per-year closed single-family aggregate from listing_tile_mv polygon assignment (public.boundaries). Same geometry as listing_boundary_xref_mv. geo_slug __bend_districts__ is the union of the thirteen districts. Years with fewer than 3 closings are omitted. Refreshed by pg_cron job refresh_dal_mvs_15min (:05/:20/:35/:50) via refresh_neighborhood_year_pricing_mv(); stamp in mv_refresh_state.';

-- 3 ───────────────────────────────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule('refresh_dal_mvs_15min')
  where exists (select 1 from cron.job where jobname = 'refresh_dal_mvs_15min');

  perform cron.schedule(
    'refresh_dal_mvs_15min',
    '5,20,35,50 * * * *',
    $job$
  set local statement_timeout = '900s';
  select public.refresh_geo_snapshot_mv();
  select public.refresh_listing_boundary_xref_mv();
  select public.refresh_listing_search_mv();
  select public.refresh_neighborhood_year_pricing_mv();
  $job$
  );
end $$;
