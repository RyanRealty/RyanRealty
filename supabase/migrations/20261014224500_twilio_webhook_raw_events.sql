-- Durable raw Twilio webhook inbox (Matt 2026-10-14).
-- Per docs/DATABASE_FOR_AI_AGENTS.md §0 / §2k: inbound SMS + voice/voicemail
-- webhooks persist one small row, return TwiML/200, then CRM work runs after
-- the ack (or /api/cron/twilio-webhook-replay replays unprocessed rows).
-- Unique on (kind, provider_sid) so MessageSid / CallSid / RecordingSid
-- retries collapse. The insert RPC carries a 2s statement_timeout so a
-- stalled Supabase session cannot hold Twilio past its 15s 11200/11203
-- deadline (SM872130d80ef66b91a9a3f1bd837eb53e).

create table if not exists public.twilio_webhook_raw_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('inbound-sms', 'voice', 'voice-complete', 'recording')),
  provider_sid text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_started_at timestamptz,
  process_attempts integer not null default 0,
  last_error text,
  unique (kind, provider_sid)
);

create index if not exists twilio_webhook_raw_events_unprocessed_idx
  on public.twilio_webhook_raw_events (received_at)
  where processed_at is null;

comment on table public.twilio_webhook_raw_events is
  'Raw Twilio inbound webhook payloads. Webhooks insert then ack; CRM/timeline/opt-out run after or via cron replay. Unique (kind, provider_sid).';

alter table public.twilio_webhook_raw_events enable row level security;

revoke all on public.twilio_webhook_raw_events from public, anon, authenticated;
grant all on public.twilio_webhook_raw_events to service_role;

create or replace function public.insert_twilio_webhook_raw_event(
  p_kind text,
  p_provider_sid text,
  p_payload jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
set statement_timeout = '2s'
as $$
declare
  v_id bigint;
begin
  insert into public.twilio_webhook_raw_events (kind, provider_sid, payload)
  values (p_kind, p_provider_sid, p_payload)
  on conflict (kind, provider_sid) do update
    set payload = excluded.payload
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.insert_twilio_webhook_raw_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_twilio_webhook_raw_event(text, text, jsonb) to service_role;

comment on function public.insert_twilio_webhook_raw_event(text, text, jsonb) is
  'Fast idempotent raw Twilio webhook insert. 2s statement_timeout. Service role only.';
