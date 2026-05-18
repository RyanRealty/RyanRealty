-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: producer_change_requests.
--
-- Supports the Phase 10.5 Producer Catalog UI. When Matt reviews the catalog
-- and wants to modify a producer's recipe, add an example, duplicate it with
-- changes, or deprecate it, he files a change request row here.
--
-- The orchestrator picks up 'pending' rows and dispatches a subagent to:
--   1. Draft the requested change (SKILL.md diff or new example file).
--   2. Optionally produce a sample render.
--   3. Transition the row to 'drafted'.
--   4. Surface the diff path to Matt for approval.
--
-- Status flow:
--   pending -> in_progress -> drafted -> approved -> [change applied] -> completed
--                                                 -> rejected (Matt declines draft)
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.producer_change_requests (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_slug             text        NOT NULL,
  requester                 text        NOT NULL DEFAULT 'matt',
  request_text              text        NOT NULL,
  request_type              text        DEFAULT 'edit_recipe'
    CHECK (request_type IN (
      'edit_recipe',
      'add_example',
      'duplicate_with_changes',
      'deprecate',
      'other'
    )),
  requested_at              timestamptz NOT NULL DEFAULT now(),
  status                    text        DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'in_progress',
      'drafted',
      'approved',
      'rejected'
    )),
  drafted_diff_path         text,
  drafted_sample_render_path text,
  completed_at              timestamptz,
  metadata                  jsonb
);

-- Index: catalog UI fetches all open requests for a given producer.
CREATE INDEX IF NOT EXISTS idx_pcr_producer
  ON public.producer_change_requests (producer_slug);

-- Index: orchestrator polls for pending requests.
CREATE INDEX IF NOT EXISTS idx_pcr_status
  ON public.producer_change_requests (status);

ALTER TABLE public.producer_change_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.producer_change_requests FROM anon;
REVOKE ALL ON TABLE public.producer_change_requests FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.producer_change_requests TO service_role;
