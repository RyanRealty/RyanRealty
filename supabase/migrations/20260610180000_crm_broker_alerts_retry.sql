-- Relay retry budget: transient send failures (osascript timeout, Twilio 5xx)
-- keep status='pending' and increment attempts; only attempts >= 3 goes 'failed'.
alter table public.crm_broker_alerts
  add column if not exists attempts integer not null default 0;
