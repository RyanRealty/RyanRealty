-- Broker-approval gate on workflow first touches (Matt directive 2026-06-12):
-- new enrollments wait in 'awaiting_broker' until the broker approves the
-- prepared first text (+ CMA); 'paused' added for manual workflow control.
-- Applied to hosted Supabase 2026-06-12 via MCP apply_migration
-- (crm_enrollment_broker_approval).
ALTER TABLE public.crm_sequence_enrollments DROP CONSTRAINT IF EXISTS crm_sequence_enrollments_status_check;
ALTER TABLE public.crm_sequence_enrollments ADD CONSTRAINT crm_sequence_enrollments_status_check
  CHECK (status IN ('awaiting_broker','running','paused','paused_reply','completed','stopped','suppressed'));
ALTER TABLE public.crm_sequence_enrollments
  ADD COLUMN IF NOT EXISTS first_touch_override text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
CREATE INDEX IF NOT EXISTS crm_sequence_enrollments_awaiting_idx
  ON public.crm_sequence_enrollments (status) WHERE status = 'awaiting_broker';
