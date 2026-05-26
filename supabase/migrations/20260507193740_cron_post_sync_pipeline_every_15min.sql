-- Schedule run_post_sync_pipeline via pg_cron every 15 min + daily safety-net.
--
-- ORIGINAL APPLY: 2026-05-07 19:37 UTC via MCP `apply_migration` (Supabase
-- migration history version `20260507193740`). The SQL was never written to
-- disk at the time. **This migration is the second of two repo-DB drifts
-- that caused both the 2026-05-24 and 2026-05-26 CF-522 production
-- incidents.** A pg_cron job scheduled here runs as `postgres` superuser
-- (because pg_cron operates as the role that owns the job — historically
-- the superuser), which bypassed every role-level statement_timeout cap
-- we added later. The 2026-05-26 incident remediation session added a
-- function-level cap via `cap_pg_cron_pipeline_timeouts` migration
-- (statement_timeout='240s' on run_post_sync_pipeline) which closes the
-- hole at the function level regardless of the calling role.
--
-- See docs/plans/CROSS_AGENT_HANDOFF.md and the companion migration file
-- `20260507193002_post_sync_pipeline.sql` for full context.
--
-- Live state captured 2026-05-26 from cron.job:
--   jobid 146  schedule */15 * * * *  jobname post_sync_pipeline_15min       active
--   jobid 147  schedule  30 9 * * *   jobname post_sync_pipeline_safety_net  active

DO $$
BEGIN
  -- pg_cron lives in the cron schema and is enabled by Supabase platform
  -- defaults. Schedule the 15-min run + the daily 09:30 safety-net.
  -- cron.schedule is idempotent on (jobname) so re-running this migration
  -- is safe.
  PERFORM cron.schedule(
    'post_sync_pipeline_15min',
    '*/15 * * * *',
    $cmd$SELECT public.run_post_sync_pipeline('cron-15min')$cmd$
  );

  PERFORM cron.schedule(
    'post_sync_pipeline_safety_net',
    '30 9 * * *',
    $cmd$SELECT public.run_post_sync_pipeline('cron-safety-net')$cmd$
  );
END $$;
