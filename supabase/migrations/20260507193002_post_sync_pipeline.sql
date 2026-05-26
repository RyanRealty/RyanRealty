-- post_sync_pipeline — DB-internal orchestrator that runs after every Spark
-- delta sync. Refreshes the market_pulse_live cache then re-computes the
-- current period stats. Recorded in post_sync_pipeline_runs for audit.
--
-- ORIGINAL APPLY: 2026-05-07 19:30 UTC via MCP `apply_migration` (Supabase
-- migration history version `20260507193002`). The SQL was never written to
-- disk at the time. This file captures the live function + table definition
-- as of 2026-05-26 via `pg_get_functiondef` so `supabase/migrations/`
-- matches `supabase_migrations.schema_migrations`.
--
-- ---------------------------------------------------------------------
-- Repo↔DB parity reconciliation for the 2026-05-24 + 2026-05-26 CF-522
-- incidents. The function captured here INCLUDES the 2026-05-26 timeout
-- caps (statement_timeout='240s', lock_timeout='10s') because that's the
-- current live state. A fresh DB rebuild from migrations would run this
-- file FIRST, then the 20260526141823 `cap_pg_cron_pipeline_timeouts`
-- migration would be a no-op. Both end states match.
--
-- See docs/plans/CROSS_AGENT_HANDOFF.md "What Claude Code should know
-- going forward" for the locked-in habit: "When you apply a migration
-- via MCP `apply_migration`, ALSO write the SQL to
-- supabase/migrations/<applied-version>_<name>.sql." This file is one of
-- the 150-orphan retroactive backfill.
--
-- The companion file `20260507193740_cron_post_sync_pipeline_every_15min.sql`
-- schedules this function via pg_cron.

CREATE TABLE IF NOT EXISTS public.post_sync_pipeline_runs (
  id            uuid PRIMARY KEY,
  caller        text,
  started_at    timestamptz NOT NULL,
  completed_at  timestamptz,
  status        text NOT NULL,
  pulse_seconds numeric,
  pulse_rows    integer,
  stats_seconds numeric,
  stats_runs    integer,
  stats_errors  integer,
  total_seconds numeric,
  error_message text,
  result        jsonb
);

CREATE INDEX IF NOT EXISTS idx_post_sync_pipeline_runs_started_at
  ON public.post_sync_pipeline_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_sync_pipeline_runs_status
  ON public.post_sync_pipeline_runs (status);

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
