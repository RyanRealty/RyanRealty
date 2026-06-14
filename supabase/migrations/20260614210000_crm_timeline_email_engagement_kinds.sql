-- Add email_open + email_click to the crm_timeline kind check so email
-- open/click tracking events can be recorded on the communications chain.
-- (Email tracking: lib/email-tracking.ts + app/api/track/e/{open,click}.)
ALTER TABLE public.crm_timeline DROP CONSTRAINT crm_timeline_kind_check;
ALTER TABLE public.crm_timeline ADD CONSTRAINT crm_timeline_kind_check
  CHECK (kind = ANY (ARRAY[
    'note','email_in','email_out','email_open','email_click',
    'sms_in','sms_out','call','voicemail','web_event','task','stage_change','system'
  ]));
