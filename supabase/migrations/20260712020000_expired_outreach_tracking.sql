-- Expired-listing manual outreach queue (Matt directive 2026-07-11):
-- track the one-time intro SMS per expired owner so the approve-and-send
-- queue knows what is sendable vs already contacted.
-- Applied to hosted dwvlophlbvvygjfxcrhm 2026-07-11 via mcp apply_migration.
alter table public.expired_listings
  add column if not exists outreach_sms_sent_at timestamptz,
  add column if not exists outreach_crm_person_id bigint,
  add column if not exists outreach_sms_sid text;

comment on column public.expired_listings.outreach_sms_sent_at is 'When the manual expired-outreach intro SMS was sent (admin queue, template expired-first-touch-sell-v1).';
comment on column public.expired_listings.outreach_crm_person_id is 'crm_people.id the intro SMS was sent to (created on send when missing).';
comment on column public.expired_listings.outreach_sms_sid is 'Twilio message SID of the intro SMS.';
