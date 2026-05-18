-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: marketing_cost_ledger.
--
-- Tracks every API cost the autonomous pipeline incurs on behalf of a
-- marketing_brain_actions row. One ledger row per API call or quota unit.
--
-- The brain writes a ledger row whenever a producer spends:
--   - Anthropic tokens (prompt + completion)
--   - Replicate GPU seconds (Kling, Hailuo, Seedance, Wan, Luma, Veo)
--   - Apify actor runs
--   - OpenAI calls (embeddings, vision, etc.)
--   - ElevenLabs character quota
--   - Platform quota (Meta ad spend, Maps API, etc.)
--   - Google Maps / Static Maps API
--   - Virtual staging renders
--   - Any other third-party cost
--
-- cost_type is a closed enum; add new values here + in CLAUDE.md if a new
-- API is onboarded. amount_usd is always positive.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.
-- Depends on: 20260516200000 (marketing_brain_actions_upgrade) for action_id FK.

CREATE TABLE IF NOT EXISTS public.marketing_cost_ledger (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   uuid        REFERENCES public.marketing_brain_actions(id) ON DELETE SET NULL,
  cost_type   text        NOT NULL
    CHECK (cost_type IN (
      'anthropic_tokens',
      'replicate',
      'apify',
      'openai',
      'elevenlabs',
      'platform_quota',
      'google_maps',
      'virtual_staging',
      'other'
    )),
  amount_usd  numeric     NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb
);

-- Index: look up all costs for a given action.
CREATE INDEX IF NOT EXISTS idx_mcl_action
  ON public.marketing_cost_ledger (action_id)
  WHERE action_id IS NOT NULL;

-- Index: the brain's cost-by-type time-series query (how much did Replicate
-- cost this week?).
CREATE INDEX IF NOT EXISTS idx_mcl_type_date
  ON public.marketing_cost_ledger (cost_type, recorded_at DESC);

ALTER TABLE public.marketing_cost_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_cost_ledger FROM anon;
REVOKE ALL ON TABLE public.marketing_cost_ledger FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_cost_ledger TO service_role;
