-- Spec 07 (prospecting hub) §4.5 — at-most-once send claim (Defect 8).
-- Replaces the unconditional "stamp sent" with a claim/finalize/release trio so
-- two concurrent taps (two devices/tabs inside the Twilio window) can never both
-- send. Order: claim -> send Twilio -> finalize (status='sent', sent_at, sid) ->
-- on failure release (status=null). A concurrent second tap claims 0 rows and
-- aborts BEFORE Twilio. The 2-minute stale-claim window frees a row orphaned by a
-- crash between claim and finalize.
--
-- Additive + back-compatible: all nullable, nothing reads them yet.

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS outreach_sms_status text,          -- null | 'sending' | 'sent'
  ADD COLUMN IF NOT EXISTS outreach_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_idempotency_key text;

ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS outreach_sms_status text,
  ADD COLUMN IF NOT EXISTS outreach_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_idempotency_key text;

COMMENT ON COLUMN public.expired_listings.outreach_sms_status IS
  'Send-claim state (spec 07 §4.5): null (unsent) | sending (claimed, Twilio in flight) | sent (finalized).';
COMMENT ON COLUMN public.fsbo_listings.outreach_sms_status IS
  'Send-claim state (spec 07 §4.5): null (unsent) | sending (claimed, Twilio in flight) | sent (finalized).';
