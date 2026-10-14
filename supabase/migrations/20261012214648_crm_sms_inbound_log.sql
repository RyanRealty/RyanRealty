-- One row per inbound text the Twilio webhook handled, with what happened to it.
-- A text received by Twilio with no row here never reached the CRM; a row with
-- outcome 'forward_failed' (or a forward Twilio reports undelivered) never
-- reached the broker's phone. The crm-health-check cron pages on both.
-- Deliberate drops (a broker texting their own line, a blocked number, a STOP
-- keyword) are recorded with their reason so they are visible, not silent.
create table if not exists public.crm_sms_inbound_log (
  message_sid text primary key,
  ts timestamptz not null default now(),
  from_number text,
  to_number text,
  outcome text not null check (outcome in ('forwarded', 'dropped', 'forward_failed', 'agent')),
  reason text,
  forward_to text,
  forward_sid text,
  forward_error text
);

create index if not exists crm_sms_inbound_log_ts_idx on public.crm_sms_inbound_log (ts desc);

alter table public.crm_sms_inbound_log enable row level security;
