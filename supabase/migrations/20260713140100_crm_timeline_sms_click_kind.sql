-- Allow the `sms_click` timeline kind (outbound-SMS click tracking, /r/<code>).
-- crm_timeline.kind is CHECK-constrained to a fixed vocabulary; sms_click was
-- missing, so the click-tracker's timeline write silently failed the constraint
-- (caught by the click smoke test 2026-07-13). Recreate the constraint with
-- sms_click added, keeping every existing kind.
alter table public.crm_timeline drop constraint if exists crm_timeline_kind_check;
alter table public.crm_timeline add constraint crm_timeline_kind_check
  check (kind = any (array[
    'note','email_in','email_out','email_open','email_click',
    'sms_in','sms_out','sms_click','call','voicemail','web_event',
    'task','stage_change','system','lead_created','home_valuation',
    'subscribe_report','parsed_intent'
  ]));
