-- P12 send-integrity: per-attempt block ledger.
--
-- Manual/bulk/governed-send drops previously lived only in log lines, so a
-- compliance audit could not query "why was this person not texted". Every
-- refusal from lib/comms/checkSendGuards now inserts a row here (best-effort).
-- Service role writes; authenticated superusers may read for the audit log.

CREATE TABLE IF NOT EXISTS public.crm_send_block_events (
  id            bigserial PRIMARY KEY,
  person_id     bigint NOT NULL,
  channel       text NOT NULL CHECK (channel IN ('email', 'sms', 'call')),
  stage         text NOT NULL,
  reasons       text[] NOT NULL DEFAULT '{}',
  source        text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_send_block_events_person_created_idx
  ON public.crm_send_block_events (person_id, created_at DESC);

CREATE INDEX IF NOT EXISTS crm_send_block_events_created_idx
  ON public.crm_send_block_events (created_at DESC);

COMMENT ON TABLE public.crm_send_block_events IS
  'Per-attempt send block ledger (P12). One row per refused governed send — not an opt-out store.';

ALTER TABLE public.crm_send_block_events ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS; authenticated superusers can read for audit.
DROP POLICY IF EXISTS "superuser read crm_send_block_events" ON public.crm_send_block_events;
CREATE POLICY "superuser read crm_send_block_events"
  ON public.crm_send_block_events
  FOR SELECT
  TO authenticated
  USING (public.caller_is_superuser());
