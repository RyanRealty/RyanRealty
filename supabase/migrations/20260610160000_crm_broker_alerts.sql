-- Instant broker alert queue (Matt directive 2026-06-10: text the right
-- broker the moment a new lead arrives, like FUB did). Webhooks/crons insert;
-- the mac-mini relay LaunchAgent drains via iMessage now, Twilio SMS once the
-- A2P campaign verifies.
create table if not exists public.crm_broker_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  broker text not null,
  to_phone text not null,
  body text not null,
  person_id bigint,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  channel text,
  sent_at timestamptz,
  error text
);
create index if not exists crm_broker_alerts_pending_idx on public.crm_broker_alerts (status) where status = 'pending';
alter table public.crm_broker_alerts enable row level security;
