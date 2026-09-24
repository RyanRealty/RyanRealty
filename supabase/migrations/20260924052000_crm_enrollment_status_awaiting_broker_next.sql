-- crm_sequence_enrollments.status accepts 'awaiting_broker_next' (2026-09-24).
--
-- THE DEFECT. Since 2026-06-13 (commit 0d0080e72, "broker-confirmed steps")
-- the sequence engine parks an enrollment whose NEXT step is confirm:true as
-- status 'awaiting_broker_next' (app/api/cron/crm-sequence-engine/route.ts),
-- and the broker's "send next step" action writes the same value
-- (app/actions/crm.ts). The status CHECK written the day before
-- (20260612134500_crm_enrollment_broker_approval.sql) never listed it, so
-- every such write failed with 23514 and, because the engine's finish()
-- ignored the error, failed silently: the enrollment stayed on the step it
-- had just run and re-ran it every 15 minutes. The per-step send claim kept
-- that from re-sending anything, but the enrollment never reached its
-- confirm step, the contact page's recommended-next-step card (which reads
-- status = 'awaiting_broker_next') never showed it, and each 15-minute pass
-- wrote two system rows to the contact's timeline. Seen live 2026-09-24 on
-- enrollment 62 (seller workflow) and person 64134 (buyer workflow).
--
-- THE FIX. The same list plus 'awaiting_broker_next', the one value the code
-- writes that the table refused. Every other status the code writes or reads
-- is already on it. lib/crm/enrollment-status.ts holds the list the code
-- uses, and its test holds it equal to this CHECK.

ALTER TABLE public.crm_sequence_enrollments DROP CONSTRAINT IF EXISTS crm_sequence_enrollments_status_check;
ALTER TABLE public.crm_sequence_enrollments ADD CONSTRAINT crm_sequence_enrollments_status_check
  CHECK (status IN ('awaiting_broker','awaiting_broker_next','running','paused','paused_reply','completed','stopped','suppressed'));
