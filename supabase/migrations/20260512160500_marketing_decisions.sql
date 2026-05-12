-- marketing_decisions: audit log for every decision the marketing brain
-- (or a human) makes. This is the brain's memory, so a year from now we
-- can see exactly why a budget was reallocated, why a piece was killed,
-- which voice rule blocked a publish, what trend signal triggered a brief.
--
-- decision_type:
--   'brief_generated' | 'brief_killed' | 'budget_reallocate_proposed' |
--   'budget_reallocate_applied' | 'voice_violation' | 'qa_fail' |
--   'publish_approved' | 'publish_rejected' | 'experiment_started' |
--   'experiment_concluded' | 'anomaly_flagged' | 'competitor_signal'
-- reviewer: 'brain' | 'matt' | 'cowork_agent' | system identifier
-- final_decision: 'approved' | 'rejected' | 'modified' | 'auto_applied' |
--                 'awaiting_review'

CREATE TABLE IF NOT EXISTS public.marketing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decided_at timestamptz NOT NULL DEFAULT now(),

  decision_type text NOT NULL,
  decision_summary text NOT NULL,
  data_observed jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules_cited text[] NOT NULL DEFAULT '{}'::text[],

  predicted_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,

  reviewer text NOT NULL,
  final_decision text NOT NULL DEFAULT 'awaiting_review',

  related_brief_id uuid REFERENCES public.content_briefs(id) ON DELETE SET NULL,
  related_campaign text,
  related_post_id text
);

CREATE INDEX IF NOT EXISTS marketing_decisions_decided_at_idx
  ON public.marketing_decisions (decided_at DESC);
CREATE INDEX IF NOT EXISTS marketing_decisions_type_idx
  ON public.marketing_decisions (decision_type);
CREATE INDEX IF NOT EXISTS marketing_decisions_reviewer_idx
  ON public.marketing_decisions (reviewer);

ALTER TABLE public.marketing_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_decisions FROM anon;
REVOKE ALL ON TABLE public.marketing_decisions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_decisions TO service_role;
