-- 20260522200000_mv_refresh_rpcs.sql
-- RPC wrappers for REFRESH MATERIALIZED VIEW CONCURRENTLY so the sync-delta
-- cron can call them via supabase.rpc() through the service-role client
-- instead of needing direct SQL execute privileges.
--
-- Without these, the cron must fall back to a no-op (the inline route.ts
-- already does the soft-fail dance). With them, every 10-min sync-delta
-- cycle keeps listing_tile_mv + geo_snapshot_mv current.
--
-- CONCURRENTLY requires a UNIQUE index on the MV — both views have one
-- (listing_tile_mv_key on listing_key; geo_snapshot_mv_key on
-- (geo_type, geo_key)). If the unique index ever drops, the REFRESH
-- falls back to AccessExclusiveLock which is fine for the cron but
-- noisy for readers.

CREATE OR REPLACE FUNCTION public.refresh_listing_tile_mv()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.refresh_geo_snapshot_mv()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Grant execute to the service-role and authenticated roles so the cron
-- (which runs through service-role client) can call them. anon role is
-- intentionally excluded — public users should never trigger an MV refresh.
GRANT EXECUTE ON FUNCTION public.refresh_listing_tile_mv() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_geo_snapshot_mv() TO service_role, authenticated;

-- Verification:
--
-- SELECT public.refresh_listing_tile_mv();
-- (should return {"ok": true, "duration_ms": <integer>})
--
-- SELECT public.refresh_geo_snapshot_mv();
-- (should return {"ok": true, "duration_ms": <integer>})
