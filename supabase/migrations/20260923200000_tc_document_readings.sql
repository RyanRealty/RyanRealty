-- Vault document reader: every read of a transaction PDF, kept.
--
-- The reader (lib/tc/doc-read) renders the pages that matter (each form's
-- first page and its signature pages), has a vision model transcribe the form,
-- its number, the parties and every signature line, and decides in code
-- whether each form is fully executed. One row per read: what it saw, what it
-- concluded, what it cost. The newest read of a document's current bytes is
-- the one the Vault acts on; older reads stay as the audit trail.
--
-- tc_documents.superseded_by points an archived copy at the copy that replaced
-- it (the fully executed version of the same form instance).

create table if not exists public.tc_document_readings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.tc_documents(id) on delete cascade,
  sha256 text,
  reader_version text not null,
  model text not null,
  purpose text not null default 'read' check (purpose in ('read', 'confirm')),
  status text not null check (status in ('read', 'failed')),
  page_count integer,
  pages_read integer[] not null default '{}',
  anatomy jsonb not null default '{}'::jsonb,
  reading jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  cost_usd numeric(10, 5),
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);

comment on table public.tc_document_readings is
  'Vault document reader: one row per read of a tc_documents PDF. reading = what the vision model transcribed (forms, parties, signature lines); verdict = what lib/tc/doc-read/verdict.ts concluded (per-form execution state, who signed, who is missing). purpose confirm = a second model''s read taken before the Vault removes a document from a checklist on the strength of "not fully executed".';

create index if not exists tc_document_readings_doc on public.tc_document_readings (document_id, created_at desc);
create index if not exists tc_document_readings_sha on public.tc_document_readings (sha256) where sha256 is not null;

alter table public.tc_document_readings enable row level security;
grant select, insert, update, delete on public.tc_document_readings to service_role;

alter table public.tc_documents
  add column if not exists superseded_by uuid references public.tc_documents(id) on delete set null;

comment on column public.tc_documents.superseded_by is
  'The document that replaced this one: the fully executed (or more complete) copy of the same form instance. Set by the document reader when it archives a copy.';
