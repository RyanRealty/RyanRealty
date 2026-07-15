-- FSBO dashboard outreach tracking (mirrors expired_listings' 2026-07-12 cols):
-- manual approve-and-send posture, stamped at send time from /admin/fsbos.
-- Applied to hosted Supabase 2026-07-14 via MCP apply_migration.
ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS outreach_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_sms_sid text,
  ADD COLUMN IF NOT EXISTS outreach_crm_person_id bigint;

COMMENT ON COLUMN public.fsbo_listings.outreach_sms_sent_at IS
  'Stamped when the FSBO intro SMS is manually approved + sent from /admin/fsbos.';
