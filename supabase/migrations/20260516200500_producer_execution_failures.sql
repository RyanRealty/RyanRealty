-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: producer_execution_failures.
--
-- Every time a producer throws an unhandled exception, the content engine
-- catches it and writes a row here. The orchestrator reads this table to:
--   1. Decide whether to retry the parent action (retry_count < 2).
--   2. Transition the action to 'killed' after 2 retries (failure_log on the
--      action row also captures the summary).
--   3. Surface a digest to Matt in the next run_brain cycle.
--
-- phase is a free-text label the producer sets at the point of failure
-- (e.g. 'data-fetch', 'vo-synthesis', 'remotion-render', 'publish').
-- resolved_at + resolution_note are written when a retry succeeds or Matt
-- manually marks the failure as resolved.
--
-- DELETE CASCADE: removing a marketing_brain_actions row also removes all its
-- failure records (no orphaned rows in the audit trail).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.
-- Depends on: 20260516200000 (marketing_brain_actions_upgrade) for action_id FK.

CREATE TABLE IF NOT EXISTS public.producer_execution_failures (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id       uuid        REFERENCES public.marketing_brain_actions(id) ON DELETE CASCADE,
  producer_slug   text        NOT NULL,
  phase           text,
  error_message   text,
  error_stack     text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  retry_count     int         NOT NULL DEFAULT 0,
  resolved_at     timestamptz,
  resolution_note text
);

-- Index: fetch all failures for an action (join from marketing_brain_actions).
CREATE INDEX IF NOT EXISTS idx_pef_action
  ON public.producer_execution_failures (action_id)
  WHERE action_id IS NOT NULL;

-- Index: failure digest ordered by producer + time (which producers are most
-- error-prone this week?).
CREATE INDEX IF NOT EXISTS idx_pef_producer
  ON public.producer_execution_failures (producer_slug, occurred_at DESC);

ALTER TABLE public.producer_execution_failures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.producer_execution_failures FROM anon;
REVOKE ALL ON TABLE public.producer_execution_failures FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.producer_execution_failures TO service_role;
