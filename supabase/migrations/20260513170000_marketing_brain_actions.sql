-- marketing_brain_actions: replaces content_briefs as the central dispatch
-- table for the marketing brain → producers architecture.
--
-- Every row is one discrete action the brain wants a producer to execute.
-- action_type encodes the producer category + specific action
--   e.g. 'content:listing_reel', 'site:copy_update', 'ops:meta_ads_pause'
-- target identifies the subject of the action
--   e.g. 'mls:220189422', '/listings', 'campaign_id:abc123'
-- assigned_producer is the path to the SKILL.md that executes this action.
-- payload is action-type-specific data the producer needs.
-- data_evidence is the raw signal evidence from audits that triggered this.
-- executor_response is captured after the producer runs (nullable).
-- executed_at is set when the producer transitions to 'in_production'.
--
-- status flow:
--   pending → in_production → ready → [Matt approves] → approved →
--   executed → measured
--   'killed' is a terminal state for retired actions.
--
-- Backward-compat view: public.content_briefs reads from this table so
-- existing code (generate-briefs.ts, marketing dashboard) keeps working
-- during transition.

-- ============================================================
-- 1. RENAME content_briefs → marketing_brain_actions
-- ============================================================

ALTER TABLE IF EXISTS public.content_briefs
  RENAME TO marketing_brain_actions;

-- ============================================================
-- 2. ADD NEW COLUMNS
-- ============================================================

ALTER TABLE public.marketing_brain_actions
  ADD COLUMN IF NOT EXISTS action_type       text,
  ADD COLUMN IF NOT EXISTS target            text,
  ADD COLUMN IF NOT EXISTS assigned_producer text,
  ADD COLUMN IF NOT EXISTS payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS data_evidence     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS executor_response jsonb,
  ADD COLUMN IF NOT EXISTS executed_at       timestamptz;

-- ============================================================
-- 3. BACKFILL THE 2 EXISTING ROWS
-- ============================================================

UPDATE public.marketing_brain_actions
SET
  action_type       = 'content:fb_lead_gen_ad',
  assigned_producer = 'social_media_skills/facebook-lead-gen-ad',
  target            = 'legacy:auto'
WHERE format = 'fb_ad_creative';

UPDATE public.marketing_brain_actions
SET
  action_type       = 'content:listing_reel',
  assigned_producer = 'video_production_skills/listing_reveal',
  target            = 'legacy:auto'
WHERE format = 'ig_reel';

-- ============================================================
-- 4. MAKE NEW COLUMNS NOT NULL AFTER BACKFILL
-- ============================================================

ALTER TABLE public.marketing_brain_actions
  ALTER COLUMN action_type       SET NOT NULL,
  ALTER COLUMN target            SET NOT NULL,
  ALTER COLUMN assigned_producer SET NOT NULL;

-- ============================================================
-- 5. DROP OLD STATUS CHECK, ADD EXPANDED ONE
-- ============================================================

-- Drop the old constraint by name if it exists; fall back to
-- dropping all check constraints named after the old table.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.marketing_brain_actions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.marketing_brain_actions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.marketing_brain_actions
  ADD CONSTRAINT marketing_brain_actions_status_check
  CHECK (status IN (
    'pending',
    'in_production',
    'ready',
    'approved',
    'executed',
    'measured',
    'killed'
  ));

-- ============================================================
-- 6. ADD NEW INDEXES
-- ============================================================

-- Rename old indexes to match new table name (best effort)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'marketing_brain_actions'
      AND indexname = 'content_briefs_status_idx'
  ) THEN
    ALTER INDEX IF EXISTS content_briefs_status_idx
      RENAME TO marketing_brain_actions_status_idx;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'marketing_brain_actions'
      AND indexname = 'content_briefs_scheduled_idx'
  ) THEN
    ALTER INDEX IF EXISTS content_briefs_scheduled_idx
      RENAME TO marketing_brain_actions_scheduled_idx;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'marketing_brain_actions'
      AND indexname = 'content_briefs_format_idx'
  ) THEN
    ALTER INDEX IF EXISTS content_briefs_format_idx
      RENAME TO marketing_brain_actions_format_idx;
  END IF;
END;
$$;

-- New brain read-pattern indexes
CREATE INDEX IF NOT EXISTS marketing_brain_actions_action_type_idx
  ON public.marketing_brain_actions (action_type);

CREATE INDEX IF NOT EXISTS marketing_brain_actions_producer_idx
  ON public.marketing_brain_actions (assigned_producer);

CREATE INDEX IF NOT EXISTS marketing_brain_actions_status_scheduled_idx
  ON public.marketing_brain_actions (status, scheduled_for);

-- ============================================================
-- 7. UPDATE FK CONSTRAINTS IN DEPENDENT TABLES
-- ============================================================

-- content_calendar.brief_id → marketing_brain_actions(id)
ALTER TABLE public.content_calendar
  DROP CONSTRAINT IF EXISTS content_calendar_brief_id_fkey;

ALTER TABLE public.content_calendar
  ADD CONSTRAINT content_calendar_brief_id_fkey
  FOREIGN KEY (brief_id)
  REFERENCES public.marketing_brain_actions(id)
  ON DELETE CASCADE;

-- content_performance.brief_id → marketing_brain_actions(id)
ALTER TABLE public.content_performance
  DROP CONSTRAINT IF EXISTS content_performance_brief_id_fkey;

ALTER TABLE public.content_performance
  ADD CONSTRAINT content_performance_brief_id_fkey
  FOREIGN KEY (brief_id)
  REFERENCES public.marketing_brain_actions(id)
  ON DELETE SET NULL;

-- marketing_decisions.related_brief_id → marketing_brain_actions(id)
ALTER TABLE public.marketing_decisions
  DROP CONSTRAINT IF EXISTS marketing_decisions_related_brief_id_fkey;

ALTER TABLE public.marketing_decisions
  ADD CONSTRAINT marketing_decisions_related_brief_id_fkey
  FOREIGN KEY (related_brief_id)
  REFERENCES public.marketing_brain_actions(id)
  ON DELETE SET NULL;

-- ============================================================
-- 8. BACKWARD-COMPAT VIEW
-- ============================================================

-- Existing code that does .from('content_briefs') keeps working.
CREATE OR REPLACE VIEW public.content_briefs AS
  SELECT * FROM public.marketing_brain_actions;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_brain_actions TO service_role;
GRANT SELECT ON public.content_briefs TO service_role;
