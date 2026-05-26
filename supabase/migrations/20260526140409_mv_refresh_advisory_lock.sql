-- Wrap the MV refresh functions in pg_try_advisory_lock so overlapping
-- runs no-op instead of piling up on top of each other.
--
-- ORIGINALLY DRAFTED 2026-05-24 (commit 200c1a5) after the first CF-522
-- incident. The file was committed under 20260524150000 but NEVER applied
-- to the hosted DB (commit msg said "needs to apply once the DB is
-- responsive again" — agent at the time forgot to follow up). That gap
-- caused the 2026-05-26 13:00 UTC repeat incident. Applied 2026-05-26
-- 14:04:09 UTC under today's timestamp; the original 5/24 file was
-- deleted as superseded.
--
-- Root cause: the Vercel `*/15 * * * *` refresh-mvs cron was firing while
-- a previous run was still in flight. listing_tile_mv refresh takes ~52s,
-- geo_snapshot_mv ~33s on the 589K-row source. On overlap, each additional
-- REFRESH MATERIALIZED VIEW CONCURRENTLY pegs CPU + IO, the pool saturates,
-- every other query times out, autovacuum falls behind, future refreshes
-- get slower. Death spiral.
--
-- pg_try_advisory_lock returns false instantly if the lock is held.
-- We bail with a structured "skipped" response so the cron handler
-- can log it without alarm.
--
-- Lock IDs: 7101 = listing_tile_mv, 7102 = geo_snapshot_mv,
--           7103 = refresh_market_pulse (added in companion migration
--           20260526140535_refresh_market_pulse_advisory_lock.sql).

CREATE OR REPLACE FUNCTION public.refresh_listing_tile_mv()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7101);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_tile_mv already running');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_tile_mv;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7101);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7101);
      RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_geo_snapshot_mv()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.geo_snapshot_mv;
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
