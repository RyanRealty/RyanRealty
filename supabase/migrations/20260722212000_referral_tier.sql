-- Referral tier (W12) — receivables ledger for out-of-area referral handoffs.
--
-- The MLS feed is statewide but Ryan Realty works Central Oregon. Out-of-area
-- inquiries (buyer intake classified geo:out-of-area / referral:candidate, plus
-- the /oregon/[city] capture form) are never dripped locally — they get referred
-- to a broker who works that market, with a referral-fee agreement. This table
-- is the money trail: one row per referral made, from first handoff to paid.
--
-- Code FEATURE-DETECTS this table (lib/data/crm/referralReceivables.ts returns
-- { available: false } on undefined_table) so the admin surface ships before
-- the orchestrator applies this migration. Nothing breaks unapplied.
--
-- RLS: enabled with NO policies — the same service-role-only pattern as the
-- other crm_* tables (e.g. 20260713140000_crm_short_links.sql). The service
-- client (server-side, behind admin auth) is the only reader/writer; anon and
-- authenticated get nothing.

create table if not exists public.referral_receivables (
  id            bigint generated always as identity primary key,
  person_id     bigint not null references public.crm_people(id) on delete cascade,
  -- Receiving broker/brokerage, free text: "Jane Smith, Windermere Medford".
  referred_to   text not null,
  -- Referral fee as a percent of the receiving side's gross commission.
  fee_basis_pct numeric not null default 25,
  -- pending -> agreement-sent -> active -> closed -> paid | dead
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

create index if not exists referral_receivables_person_idx
  on public.referral_receivables (person_id);
create index if not exists referral_receivables_status_idx
  on public.referral_receivables (status, created_at desc);

alter table public.referral_receivables enable row level security;

comment on table public.referral_receivables is
  'Out-of-area referral handoffs (W12 referral tier): person referred, receiving broker, fee basis pct, lifecycle status. Service-role only (RLS on, no policies); admin surface reads via the server service client.';
comment on column public.referral_receivables.fee_basis_pct is
  'Referral fee as percent of the receiving side gross commission (default 25).';
comment on column public.referral_receivables.status is
  'pending | agreement-sent | active | closed | paid | dead';
