-- Teach crm_timeline_kind_check the five kinds the app already writes and
-- Postgres has been refusing, silently, since they were first written.
--
--   email_delivered    app/api/webhooks/resend/route.ts (Resend `email.delivered`)
--   email_bounce       app/api/webhooks/resend/route.ts (Resend `email.bounced`) and
--                      lib/data/crm/gmailBounceWatch.ts (Gmail DSN bounce scan)
--   email_complaint    app/api/webhooks/resend/route.ts (Resend `email.complained`)
--   email_unsubscribe  app/api/webhooks/resend/route.ts (Resend `email.unsubscribed`)
--   cma_replied        lib/data/cma/engagementAlerts.ts (recordCmaRepliedEvent)
--
-- Evidence, read 2026-10-15 (Supabase postgres logs, service postgres_logs):
--   * 418 inserts into crm_timeline failed this constraint in the last 24 h
--     (400 email_delivered, 18 email_bounce); every 24 h window read back to
--     2026-10-04 shows 300-490 email_delivered failures a day. The
--     cma_replied stamp failed 10 times on 2026-10-11 (one contact, repeated
--     at 15-minute intervals).
--   * A row read of crm_timeline (newest first, no date filter) found no row
--     of any of these kinds at any date: none has ever landed.
--   * email_complaint and email_unsubscribe did not appear in the retained
--     log window (those Resend events are rare), but the same route writes
--     them through the same map, so they fail identically the first time one
--     arrives. They are added because the code writes them, nothing more.
--
-- The writers are not sending a wrong value: these are the kinds the code means
-- to record (docs/plans/crm-attribution-coverage-2026-06-24.md expects
-- delivered and bounced rows on the timeline). So the constraint learns them,
-- and the writers now log a refused write (lib/observability/rejected-write.ts)
-- so a future drift is not silent.
--
-- Live definition read 2026-10-15 matched 20261002011238_crm_timeline_email_cc_kind
-- exactly (19 kinds). Every existing kind is kept. Dropped and re-added in ONE
-- ALTER TABLE so there is no instant with no constraint.
--
-- At 03:45Z on 2026-10-15 the four Resend kinds were also applied to production
-- by hand (applied version 20261015034529, `crm_timeline_email_lifecycle_kinds`,
-- no file in this repo); the live constraint read afterwards had those four and
-- still lacked cma_replied. This file is a superset of that one, so it is safe
-- on top of it: drop-if-exists and re-add, every kind the live constraint holds
-- is in the list below, so no row can fail the re-validation.
alter table public.crm_timeline
  drop constraint if exists crm_timeline_kind_check,
  add constraint crm_timeline_kind_check
    check (kind = any (array[
      'note','email_in','email_out','email_cc','email_open','email_click',
      'email_delivered','email_bounce','email_complaint','email_unsubscribe',
      'sms_in','sms_out','sms_click','call','voicemail','web_event',
      'task','stage_change','system','lead_created','home_valuation',
      'subscribe_report','parsed_intent','cma_replied'
    ]));
