-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: marketing_strategy.
--
-- Stores the quarter-level strategy documents the orchestrator generates in
-- Phase 5B. Each row points to a markdown doc in the repo and carries the
-- high-level targets (north_star_target = seller leads goal, channel_targets
-- per platform). Matt ratifies the active row; the orchestrator references
-- strategy_doc_section on every marketing_brain_actions row to show which
-- part of the strategy triggered that action.
--
-- Status flow:
--   draft -> active (Matt ratifies) -> superseded (new quarter strategy goes active)
--
-- Only one row should be 'active' at a time; the orchestrator enforces this
-- at write time by checking for existing active rows before inserting.
--
-- superseded_by is a self-referential FK so the history chain stays queryable.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING on seed.

CREATE TABLE IF NOT EXISTS public.marketing_strategy (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter          text        NOT NULL,
  north_star_target int,
  channel_targets  jsonb,
  strategy_doc_path text       NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  generated_by     text        NOT NULL DEFAULT 'orchestrator',
  status           text        DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'superseded')),
  superseded_by    uuid        REFERENCES public.marketing_strategy(id) ON DELETE SET NULL,
  notes            text
);

-- Index: orchestrator reads the active strategy for the current quarter.
CREATE INDEX IF NOT EXISTS idx_ms_quarter
  ON public.marketing_strategy (quarter, status);

ALTER TABLE public.marketing_strategy ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_strategy FROM anon;
REVOKE ALL ON TABLE public.marketing_strategy FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_strategy TO service_role;

-- Seed: Q3 2026 strategy row.
-- ON CONFLICT DO NOTHING requires a unique constraint. Because there is no
-- natural unique key on (quarter, generated_by), we use a DO NOTHING guard
-- implemented via a WHERE NOT EXISTS check to stay idempotent.
INSERT INTO public.marketing_strategy (
  quarter,
  strategy_doc_path,
  status,
  generated_by,
  notes
)
SELECT
  '2026Q3',
  'marketing_brain_skills/strategy/Q3-2026-strategy.md',
  'draft',
  'phase-5b-orchestrator',
  'Authored by Phase 5 Part B of AUTONOMOUS_PIPELINE_BRIEF.md. Awaiting Matt ratification per Phase 11.5.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_strategy
  WHERE quarter = '2026Q3'
    AND generated_by = 'phase-5b-orchestrator'
);
