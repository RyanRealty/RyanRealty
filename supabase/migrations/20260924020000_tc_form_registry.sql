-- Vault form registry: every form the document reader has met, and who signs it.
--
-- OREF and Oregon REALTORS® revise and renumber their forms every year. The
-- reader no longer depends on a hand-kept list: each copy it reads adds to the
-- registry (which parties the form prints signature lines for, the number and
-- release printed on it), and the registry works out who must sign from the
-- law that names the signers, the kind of instrument, and the blocks printed
-- across every copy (lib/tc/doc-read/form-rules.ts). A form the curated
-- library already lists keeps its verified profile; the registry records it
-- too, and notes when a new release prints blocks the library does not expect.
--
-- tc_form_registry_copies holds one row per form per document read, so the
-- tally is recomputed from the copies themselves and a re-read never counts
-- twice.

create table if not exists public.tc_form_registry (
  identity text primary key,
  title text not null,
  numbers jsonb not null default '{}'::jsonb,
  releases jsonb not null default '{}'::jsonb,
  category text not null,
  obligation jsonb not null,
  outcome text check (outcome in ('seller_response', 'counter')),
  numbered boolean not null default false,
  offer boolean not null default false,
  basis text not null check (basis in ('library', 'law', 'category', 'blocks', 'person')),
  rule text not null,
  confidence text not null check (confidence in ('library', 'rule', 'consensus', 'new')),
  copies integer not null default 0,
  party_copies jsonb not null default '{}'::jsonb,
  library_key text,
  library_disagrees boolean not null default false,
  decided_by text not null default 'vault-reader',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tc_form_registry is
  'Vault form registry: one row per form (identity = its title without numbers or punctuation). obligation = who must sign ({kind: all|one_side|reference, parties, optional}); basis = what decided it: library (curated oref-form-library.md), law (a statute or rule, cited in rule), category (the kind of instrument), blocks (signature lines printed across copies), person (set by a person; never overwritten by the reader). confidence new = seen on fewer than 3 copies and not decided by law or kind: the reader reports it but does not act on it alone.';

create table if not exists public.tc_form_registry_copies (
  identity text not null,
  document_id uuid not null references public.tc_documents(id) on delete cascade,
  form_index integer not null,
  parties text[] not null default '{}',
  form_number text,
  release text,
  seen_at timestamptz not null default now(),
  primary key (identity, document_id, form_index)
);

comment on table public.tc_form_registry_copies is
  'One row per form per document read: the parties the copy prints signature lines for, and the number and release printed on it. The registry row is recomputed from these.';

create index if not exists tc_form_registry_copies_doc on public.tc_form_registry_copies (document_id);

alter table public.tc_form_registry enable row level security;
alter table public.tc_form_registry_copies enable row level security;
grant select, insert, update, delete on public.tc_form_registry to service_role;
grant select, insert, update, delete on public.tc_form_registry_copies to service_role;
