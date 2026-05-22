-- Dedup audit log for Meta Lead Ads webhook.
-- Per ultrareview deferral UR-H17. The lead-webhook handler (app/api/meta/lead-webhook/route.ts)
-- processes each Meta `leadgen` change by creating a FUB person + adding a note + firing
-- a realtime task. Meta retries delivery on 5xx and on network failures, so without a
-- dedup key we create duplicate FUB persons + duplicate notes + duplicate tasks for
-- every retry.
--
-- The leadgen_id is Meta's lead identifier — unique per inbound Lead Ad submission.
-- Using it as PRIMARY KEY means a duplicate webhook fire will hit a unique-violation
-- (code 23505) on INSERT, and the handler short-circuits without touching FUB.

CREATE TABLE IF NOT EXISTS public.processed_meta_leads (
  leadgen_id      TEXT        PRIMARY KEY,
  fub_person_id   BIGINT,
  status          TEXT        NOT NULL DEFAULT 'processing',
  ad_name         TEXT,
  campaign_name   TEXT,
  audience        TEXT,
  intent          TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT processed_meta_leads_status_check
    CHECK (status IN ('processing', 'completed', 'failed', 'duplicate'))
);

CREATE INDEX processed_meta_leads_status_created_idx
  ON public.processed_meta_leads (status, created_at DESC);

CREATE INDEX processed_meta_leads_fub_person_id_idx
  ON public.processed_meta_leads (fub_person_id)
  WHERE fub_person_id IS NOT NULL;

ALTER TABLE public.processed_meta_leads ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only. Webhook handler uses SUPABASE_SERVICE_ROLE_KEY.

COMMENT ON TABLE public.processed_meta_leads IS
  'Dedup audit log for Meta Lead Ads webhook. PRIMARY KEY on leadgen_id prevents duplicate FUB person creation when Meta retries webhook delivery (which happens on 5xx responses and network errors). status: processing | completed | failed | duplicate.';
