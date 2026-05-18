-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: marketing_brain_actions upgrade.
--
-- Adds columns required by the orchestrator loop, the Phase 10.5 Catalog UI,
-- and the producer execution pipeline:
--
--   priority_score              numeric 0..100; brain ranks pending actions by this
--   predicted_north_star_impact numeric predicted seller leads from this action
--   comments                    JSONB array of {author, body, at} review notes
--   scheduled_for               already exists in content_briefs; surfaced explicitly
--   cost_estimate_usd           how much the brain predicts this action will cost
--   failure_log                 JSONB array of {phase, error, at} producer errors
--   assigned_approver           who must approve; defaults to 'matt'
--   killed_reason               free-text explanation when status = 'killed'
--   strategy_doc_section        the strategy doc section that triggered this action
--   needs_changes_at            when Matt flagged the draft as needing changes
--
-- IDEMPOTENT: uses ADD COLUMN IF NOT EXISTS throughout.
-- Apply order: this must run BEFORE 20260516200100 (content_performance_upgrade)
-- so that action_id FK in content_performance resolves cleanly.

ALTER TABLE public.marketing_brain_actions
  ADD COLUMN IF NOT EXISTS priority_score               numeric,
  ADD COLUMN IF NOT EXISTS predicted_north_star_impact  numeric,
  ADD COLUMN IF NOT EXISTS comments                     jsonb    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_for                timestamptz,
  ADD COLUMN IF NOT EXISTS cost_estimate_usd            numeric,
  ADD COLUMN IF NOT EXISTS failure_log                  jsonb    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_approver            text     NOT NULL DEFAULT 'matt',
  ADD COLUMN IF NOT EXISTS killed_reason                text,
  ADD COLUMN IF NOT EXISTS strategy_doc_section         text,
  ADD COLUMN IF NOT EXISTS needs_changes_at             timestamptz;

-- Index for the brain's primary queue read: pending actions ordered by priority.
CREATE INDEX IF NOT EXISTS idx_marketing_brain_actions_status_priority
  ON public.marketing_brain_actions (status, priority_score DESC NULLS LAST);

-- Index for the scheduler: finding actions due to run soon.
CREATE INDEX IF NOT EXISTS idx_marketing_brain_actions_scheduled
  ON public.marketing_brain_actions (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
