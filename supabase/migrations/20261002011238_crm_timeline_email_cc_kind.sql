-- Allow the `email_cc` timeline kind: an email a CRM person was copied on (or
-- sent to) that none of our brokers sent. The Gmail sync wrote those as
-- `email_out`, so a title company's email copying our client counted as a
-- broker touching that client in the response clock, speed-to-lead and contact
-- attempts (174 of the latest 400 Gmail `email_out` rows on 2026-10-01).
-- Matt 2026-10-02: show them as "Copied on an email". Recreate the constraint
-- with email_cc added, keeping every existing kind (live definition read
-- 2026-10-02 matched 20260713140100 exactly).
alter table public.crm_timeline drop constraint if exists crm_timeline_kind_check;
alter table public.crm_timeline add constraint crm_timeline_kind_check
  check (kind = any (array[
    'note','email_in','email_out','email_cc','email_open','email_click',
    'sms_in','sms_out','sms_click','call','voicemail','web_event',
    'task','stage_change','system','lead_created','home_valuation',
    'subscribe_report','parsed_intent'
  ]));
