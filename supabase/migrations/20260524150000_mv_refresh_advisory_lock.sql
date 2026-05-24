-- Wrap the MV refresh functions in pg_try_advisory_lock so overlapping
-- runs no-op instead of piling up on top of each other.
--
-- Trigger that drove this fix: 2026-05-24 production incident where the
-- DB pool exhausted and every REST request returned Cloudflare 522. Root
-- cause was the Vercel `*/15 * * * *` refresh-mvs cron firing while a
-- previous run was still in flight (the listing_tile_mv refresh takes
-- ~52s and geo_snapshot_mv ~33s — close enough to the 15-min cadence
-- that any slow run pushes the next one into overlap). On overlap, each
-- additional REFRESH MATERIALIZED VIEW CONCURRENTLY pegs CPU + IO, the
-- pool saturates, and every other query times out — including the
-- autovacuum workers, which then fall behind, which makes future
-- refreshes even slower. Death spiral.
--
-- pg_try_advisory_lock returns false immediately if the lock is held.
-- We bail with a structured "skipped" response so the cron handler
-- can log it without alarm.
--
-- Lock IDs are arbitrary stable integers — anything that doesn't collide
-- with other advisory locks. Using 7100 + offset for MV refreshes.

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
  -- Bail immediately if another run is in flight. The next 15-min tick
  -- will pick up where we left off.
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
