-- Broker Google Calendar OAuth tokens (one row per broker)
create table if not exists public.broker_gcal_tokens (
  broker_id        uuid        not null references public.brokers(id) on delete cascade,
  access_token     text        not null,
  refresh_token    text,
  expires_at       timestamptz not null,
  scope            text,
  token_type       text,
  calendar_id      text        default 'primary',
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (broker_id)
);

alter table public.broker_gcal_tokens enable row level security;

-- Service role only (brokers connect via API routes, not direct DB)
create policy "service role only" on public.broker_gcal_tokens
  using (false)
  with check (false);
