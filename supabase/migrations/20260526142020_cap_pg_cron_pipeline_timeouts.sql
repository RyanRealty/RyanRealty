-- Cap statement_timeout on the pg_cron-invoked pipeline functions.
--
-- GAP found 2026-05-26 during CF-522 root-cause analysis: pg_cron jobs run
-- inside Postgres as the `postgres` superuser, which BYPASSES the
-- service_role statement_timeout cap added in
-- 20260526140554_service_role_statement_timeout.sql. The job
-- `post_sync_pipeline_15min` schedule */15 calls
-- `run_post_sync_pipeline()`, which in turn calls `refresh_market_pulse()`
-- (already bounded at 180s) AND `refresh_current_period_stats()` (60 inner
-- calls to `compute_and_cache_period_stats`, previously unbounded).
--
-- During incident verification at 14:14 UTC the pg_cron pipeline was
-- observed running for 146+ seconds on cold cache. With no statement_timeout
-- it could legitimately run for 10 minutes — long enough to overlap the
-- next */15 tick and stack the death-spiral pattern that produced the
-- CF-522 incident, even with the Vercel-side cron stagger in place.
--
-- This migration adds explicit statement_timeout SET clauses so the
-- pg_cron path is bounded the same way the Vercel-cron path is:
--
--   run_post_sync_pipeline    → 240s ceiling (4 min, covers both inner refreshes)
--   compute_and_cache_period_stats → 60s ceiling per geo-period invocation
--
-- run_post_sync_pipeline body preserved byte-identically (pulled via
-- pg_get_functiondef before this migration). Only the SET clauses changed.
-- The existing pg_try_advisory_lock guard inside the function stays — it
-- prevents overlap; the timeout caps blast radius if it's the lone runner.

CREATE OR REPLACE FUNCTION public.run_post_sync_pipeline(p_caller text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '240s'
 SET lock_timeout TO '10s'
AS $function$
DECLARE
  v_run_id        uuid := gen_random_uuid();
  v_started_at    timestamptz := now();
  v_pulse_start   timestamptz;
  v_pulse_result  jsonb;
  v_pulse_seconds numeric;
  v_stats_start   timestamptz;
  v_stats_result  jsonb;
  v_stats_seconds numeric;
  v_total_seconds numeric;
  v_lock_key      bigint := hashtext('run_post_sync_pipeline');
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'another run_post_sync_pipeline is already in progress',
      'caller', p_caller
    );
  END IF;

  INSERT INTO public.post_sync_pipeline_runs (id, caller, started_at, status)
  VALUES (v_run_id, p_caller, v_started_at, 'running');

  BEGIN
    v_pulse_start := now();
    v_pulse_result := public.refresh_market_pulse();
    v_pulse_seconds := EXTRACT(EPOCH FROM (now() - v_pulse_start));

    v_stats_start := now();
    v_stats_result := public.refresh_current_period_stats();
    v_stats_seconds := EXTRACT(EPOCH FROM (now() - v_stats_start));

    v_total_seconds := EXTRACT(EPOCH FROM (now() - v_started_at));

    UPDATE public.post_sync_pipeline_runs
    SET completed_at = now(),
        status = 'ok',
        pulse_seconds = v_pulse_seconds,
        pulse_rows    = (v_pulse_result->>'rows_refreshed')::int,
        stats_seconds = v_stats_seconds,
        stats_runs    = (v_stats_result->>'runs')::int,
        stats_errors  = (v_stats_result->>'errors')::int,
        total_seconds = v_total_seconds,
        result        = jsonb_build_object('pulse', v_pulse_result, 'stats', v_stats_result)
    WHERE id = v_run_id;

    PERFORM pg_advisory_unlock(v_lock_key);

    RETURN jsonb_build_object(
      'ok', true,
      'caller', p_caller,
      'run_id', v_run_id,
      'started_at', v_started_at,
      'completed_at', now(),
      'total_seconds', v_total_seconds,
      'pulse', jsonb_build_object('seconds', v_pulse_seconds, 'rows', (v_pulse_result->>'rows_refreshed')::int),
      'stats', jsonb_build_object('seconds', v_stats_seconds, 'runs', (v_stats_result->>'runs')::int, 'errors', (v_stats_result->>'errors')::int),
      'methodology_version', public.current_cache_methodology_version()
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    UPDATE public.post_sync_pipeline_runs
    SET completed_at = now(),
        status = 'error',
        error_message = SQLERRM,
        total_seconds = EXTRACT(EPOCH FROM (now() - v_started_at))
    WHERE id = v_run_id;
    RAISE;
  END;
END;
$function$;

-- compute_and_cache_period_stats is called 60 times per run_post_sync_pipeline
-- (15 geos x 4 period types). Capping each at 60s means a single slow geo-period
-- cannot drag the whole pipeline past the outer 240s ceiling. The function
-- body is unchanged; we only attach the per-function GUC override.
ALTER FUNCTION public.compute_and_cache_period_stats(text, text, text, date, date)
  SET statement_timeout TO '60s';
ALTER FUNCTION public.compute_and_cache_period_stats(text, text, text, date, date)
  SET lock_timeout TO '5s';

COMMENT ON FUNCTION public.run_post_sync_pipeline(text) IS
  'Post-sync cache refresh pipeline. Called every 15 min by pg_cron job post_sync_pipeline_15min and daily 09:30 UTC by post_sync_pipeline_safety_net. Wraps refresh_market_pulse + refresh_current_period_stats with an advisory lock so overlapping runs skip cleanly. statement_timeout=240s, lock_timeout=10s (set 2026-05-26 after CF-522 incident).';

COMMENT ON FUNCTION public.compute_and_cache_period_stats(text, text, text, date, date) IS
  'Compute + UPSERT one period stats row into market_stats_cache. Called 60x per run_post_sync_pipeline (15 geos x 4 period types). statement_timeout=60s, lock_timeout=5s (set 2026-05-26 after CF-522 incident).';
