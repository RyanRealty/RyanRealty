-- Allow the email lifecycle timeline kinds: email_delivered, email_bounce,
-- email_complaint, email_unsubscribe. The Resend webhook
-- (app/api/webhooks/resend/route.ts) and the Gmail bounce watch
-- (lib/data/crm/gmailBounceWatch.ts) have written these kinds all along, and the
-- check refused every one, so a contact's timeline showed opens and clicks but
-- never a delivery, a bounce, a spam complaint or an unsubscribe (probe
-- 2026-10-14: an email_delivered insert fails crm_timeline_kind_check). The same
-- events were already recorded in email_events; only the timeline lost them.
-- Matt 2026-10-15: show all of them on the contact timeline, delivered included.
-- Recreate the constraint with the four kinds added, keeping every existing kind
-- (live definition read 2026-10-15 matched 20261002011238 exactly).
alter table public.crm_timeline drop constraint if exists crm_timeline_kind_check;
alter table public.crm_timeline add constraint crm_timeline_kind_check
  check (kind = any (array[
    'note','email_in','email_out','email_cc','email_open','email_click',
    'email_delivered','email_bounce','email_complaint','email_unsubscribe',
    'sms_in','sms_out','sms_click','call','voicemail','web_event',
    'task','stage_change','system','lead_created','home_valuation',
    'subscribe_report','parsed_intent'
  ]));
