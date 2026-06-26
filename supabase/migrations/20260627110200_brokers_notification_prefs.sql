-- §9 My Settings: per-broker notification preferences + email signature.
-- All columns default-true / null so existing rows are unaffected.
--
--   notify_new_leads     — push/email when a new lead is assigned to this broker.
--   notify_deal_activity — push/email when a deal they own is updated.
--   notify_task_due      — push/email when a task assigned to them is due.
--   email_signature      — plain-text or simple HTML signature appended to emails
--     sent by this broker via the CRM compose screen.

alter table public.brokers
  add column if not exists notify_new_leads     boolean not null default true,
  add column if not exists notify_deal_activity boolean not null default true,
  add column if not exists notify_task_due      boolean not null default true,
  add column if not exists email_signature      text;

comment on column public.brokers.notify_new_leads     is 'Send notification when a new lead is assigned to this broker.';
comment on column public.brokers.notify_deal_activity is 'Send notification on deal activity for deals owned by this broker.';
comment on column public.brokers.notify_task_due      is 'Send notification when a task assigned to this broker is due.';
comment on column public.brokers.email_signature      is 'Email signature appended when this broker sends from the CRM compose screen.';
