-- TC SYSTEM v1 — Ryan Realty's own transaction-coordination system of record.
-- Replaces SkySlope incrementally (strangler pattern). Design goals, in order:
--   1. Audit defensibility (ORS 696.280 six-year retention): append-only event
--      log, immutable source snapshots, checksummed binaries.
--   2. First-class ARCHIVE semantics — archiving a document is a flag flip with
--      a reason, never a rename, never a UI fight (SkySlope's worst pain).
--   3. Property-centric deals with offer cycles (one deal, N cycles), matching
--      how the brokerage actually thinks, instead of folder-per-offer chaos.
--   4. Document intelligence is native: classification (OREF#, signer status,
--      bundles) lives ON the document row.
-- People/comms stay in FUB; tc_deals carries FUB person links.
-- RLS enabled with NO policies on all tables: service-role only (admin surface).

create extension if not exists pgcrypto;

create table if not exists public.tc_deals (
  id uuid primary key default gen_random_uuid(),
  property_key text not null unique,
  address text not null,
  city text,
  state text,
  zip text,
  broker_name text,
  stage text not null default 'closed'
    check (stage in ('active_listing','pre_contract','pending','closed','dead')),
  stage_detail text,
  fub_person_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tc_cycles (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.tc_deals(id) on delete cascade,
  kind text not null check (kind in ('sale','listing')),
  source text not null default 'skyslope',
  source_guid text not null unique,
  status text,
  mls_number text,
  escrow_number text,
  escrow_company text,
  sellers jsonb not null default '[]'::jsonb,
  buyers jsonb not null default '[]'::jsonb,
  listing_price numeric,
  sale_price numeric,
  office_gross numeric,
  commission_percent numeric,
  earnest_money jsonb,
  listing_date date,
  contract_acceptance_date date,
  escrow_closing_date date,
  actual_closing_date date,
  expiration_date date,
  dead_date date,
  source_created_on timestamptz,
  portal_email text,
  checklist_type text,
  broker_name text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tc_cycles_deal_idx on public.tc_cycles (deal_id);
create index if not exists tc_cycles_status_idx on public.tc_cycles (status);

create table if not exists public.tc_documents (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.tc_cycles(id) on delete cascade,
  source_doc_id text,
  name text not null,
  original_name text,
  storage_path text,
  sha256 text,
  bytes bigint,
  content_type text,
  page_count int,
  source_uploaded_at timestamptz,
  ingested_at timestamptz not null default now(),
  archived boolean not null default false,
  archived_reason text,
  archived_at timestamptz,
  is_broker_notes boolean not null default false,
  classification jsonb not null default '{}'::jsonb,
  unique (cycle_id, source_doc_id)
);
create index if not exists tc_documents_cycle_idx on public.tc_documents (cycle_id);
create index if not exists tc_documents_archived_idx on public.tc_documents (cycle_id, archived);
create index if not exists tc_documents_sha_idx on public.tc_documents (sha256);

create table if not exists public.tc_checklist_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.tc_cycles(id) on delete cascade,
  source_activity_id bigint,
  name text not null,
  type_name text,
  status text not null default 'optional'
    check (status in ('required','optional','in_review','completed','na')),
  sort_order int,
  unique (cycle_id, source_activity_id)
);
create index if not exists tc_checklist_items_cycle_idx on public.tc_checklist_items (cycle_id);

-- m2m: one document can satisfy multiple items (bundles / cross-links)
create table if not exists public.tc_checklist_assignments (
  item_id uuid not null references public.tc_checklist_items(id) on delete cascade,
  document_id uuid not null references public.tc_documents(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (item_id, document_id)
);

-- Append-only audit spine. Never UPDATE or DELETE rows here.
create table if not exists public.tc_events (
  id bigint generated always as identity primary key,
  deal_id uuid references public.tc_deals(id) on delete set null,
  cycle_id uuid references public.tc_cycles(id) on delete set null,
  document_id uuid references public.tc_documents(id) on delete set null,
  actor text not null default 'system',
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tc_events_deal_idx on public.tc_events (deal_id, created_at);

alter table public.tc_deals enable row level security;
alter table public.tc_cycles enable row level security;
alter table public.tc_documents enable row level security;
alter table public.tc_checklist_items enable row level security;
alter table public.tc_checklist_assignments enable row level security;
alter table public.tc_events enable row level security;

-- Block UPDATE/DELETE on the audit log even for table owners running through
-- PostgREST: revoke at the privilege level (service role bypasses RLS but not
-- explicit privilege revocation on the API roles).
revoke update, delete on public.tc_events from anon, authenticated;
