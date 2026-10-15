-- The newest definition of crm_timeline_kind_check: every kind the app writes.
--
-- Adds email_delivered, email_bounce, email_complaint, email_unsubscribe (the
-- Resend webhook, the Gmail bounce watch, the listing-alert unsubscribe) and
-- cma_replied (lib/data/cma/engagementAlerts.ts). Matt 2026-10-15: show every
-- email event on the contact timeline, delivered included.
--
-- 20261015030000_crm_timeline_resend_and_cma_reply_kinds.sql defines the same
-- list, with the evidence. Production got it by hand: the four email kinds at
-- 03:45Z on 2026-10-15 (applied version 20261015034529), then this full list
-- at about 05:20Z (live definition read back with cma_replied, validated). The
-- Hosted migrations workflow could not apply either file (its Supabase secrets
-- are empty). This file is the newest definition in the repo, so a fresh build
-- gets every kind. Every existing kind is kept; dropped and re-added in one
-- ALTER TABLE so there is no instant with no constraint.
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
