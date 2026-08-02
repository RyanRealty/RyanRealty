-- Broker SMS agent (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.3/R1.4/R4.1):
-- conversational session store, per-broker enable flag, Oregon law corpus.
-- Applied live 2026-07-31 via MCP as broker_sms_agent_tables.

create table if not exists public.broker_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  broker_slug text not null,
  state jsonb not null default '{}'::jsonb,
  active_action_ids uuid[] not null default '{}'::uuid[],
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expired_at timestamptz
);
create index if not exists broker_agent_sessions_broker_idx
  on public.broker_agent_sessions (broker_slug, last_activity_at desc);

create table if not exists public.broker_agent_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.broker_agent_sessions(id) on delete cascade,
  role text not null check (role in ('broker', 'agent', 'system', 'tool')),
  content jsonb not null default '{}'::jsonb,
  message_sid text,
  tool_calls jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  cost_usd numeric,
  created_at timestamptz not null default now()
);
-- Twilio retries inbound webhooks; MessageSid is the idempotency key.
create unique index if not exists broker_agent_turns_message_sid_key
  on public.broker_agent_turns (message_sid) where message_sid is not null;
create index if not exists broker_agent_turns_session_idx
  on public.broker_agent_turns (session_id, created_at);

alter table public.brokers
  add column if not exists sms_agent_enabled boolean not null default false;

create table if not exists public.legal_corpus (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  citation text not null,
  heading text,
  body text not null,
  url text,
  effective_date date,
  corpus_version text not null,
  checksum text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists legal_corpus_citation_version_key
  on public.legal_corpus (source, citation, corpus_version);
create index if not exists legal_corpus_fts_idx
  on public.legal_corpus
  using gin (to_tsvector('english', coalesce(heading, '') || ' ' || body));

-- Service-role only: RLS on with zero policies. The anon key must never read
-- agent sessions or the corpus directly.
alter table public.broker_agent_sessions enable row level security;
alter table public.broker_agent_turns enable row level security;
alter table public.legal_corpus enable row level security;

-- (appended, applied live 2026-08-01 as marketing_cost_ledger_broker_agent_tokens)
-- Agent turn spend gets its own cost_type for the daily cap + digest queries.
alter table public.marketing_cost_ledger
  drop constraint if exists marketing_cost_ledger_cost_type_check;
alter table public.marketing_cost_ledger
  add constraint marketing_cost_ledger_cost_type_check
  check (cost_type = any (array[
    'anthropic_tokens'::text, 'broker_agent_tokens'::text, 'replicate'::text,
    'apify'::text, 'openai'::text, 'elevenlabs'::text, 'platform_quota'::text,
    'google_maps'::text, 'virtual_staging'::text, 'other'::text
  ]));
