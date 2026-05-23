-- Raise statement_timeout inside the MV refresh functions so the cron has
-- enough wall-clock to actually finish the REFRESH MATERIALIZED VIEW
-- CONCURRENTLY. Default Postgres statement_timeout was killing both calls
-- at ~20s and returning "canceling statement due to statement timeout"
-- to the cron handler. Standalone timings:
--   refresh_listing_tile_mv: ~52s (589K-row listings → MV)
--   refresh_geo_snapshot_mv: ~33s (aggregate over the same source)
--
-- 300s is generous but bounded. The function still raises if the refresh
-- genuinely hangs, the EXCEPTION handler captures it, and the cron
-- handler surfaces the error in the JSON response.

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
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_tile_mv;
  duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
  RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
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
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.geo_snapshot_mv;
  duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
  RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$function$;
