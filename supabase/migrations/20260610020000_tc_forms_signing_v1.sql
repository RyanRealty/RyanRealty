-- TC SYSTEM — forms libraries + native e-signature (SkySlope Forms + DigiSign
-- replacement layer). Model mirrors SkySlope's (libraries -> versioned forms ->
-- envelopes -> recipient-assigned fields), informed by their Partnership API
-- spec (tmp/skyslope-master/skyslope-partner-openapi.json) and DigiSign's
-- block/recipient model.
--
-- Legal bar for native signing (ESIGN + Oregon UETA, ORS ch. 84):
--   intent, consent record, attribution (unique tokenized link + IP + UA +
--   timestamps), tamper evidence (sealed sha256 + certificate page), signer
--   copy access, retention. Every action appends a tc_events row.
--
-- Form templates are LICENSED content (OREF especially): blank PDFs load only
-- under Matt's member access; never redistributed. RLS on, no policies.

create table if not exists public.tc_form_libraries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- 'OREF' | 'ODS' | 'OR' | 'RR' (house forms)
  name text not null,
  region text,
  license_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tc_form_versions (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.tc_form_libraries(id) on delete cascade,
  form_number text,                     -- '001', '092', ODS form code, etc.
  name text not null,
  effective_date date,
  retired_at date,
  blank_pdf_storage_path text,          -- bucket tc-documents, tc-forms/<library>/<version>__name.pdf
  sha256 text,
  page_count int,
  -- field_map: [{ key, type: text|date|money|checkbox|signature|initials|date_signed,
  --               page, x, y, w, h, required,
  --               binding: 'cycle.sale_price' | 'deal.address' | null,
  --               signer_role: 'buyer1'|'buyer2'|'seller1'|'seller2'|'listing_broker'|'selling_broker'|null }]
  field_map jsonb not null default '[]'::jsonb,
  field_map_source text not null default 'manual'
    check (field_map_source in ('acroform','manual','imported')),
  signer_profile text,                  -- 'mutual' | 'single_party' (from oref-form-library.md)
  checklist_activity_hint text,         -- auto-assign target on execution
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, form_number, effective_date)
);
create index if not exists tc_form_versions_library_idx on public.tc_form_versions (library_id);

create table if not exists public.tc_envelopes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.tc_cycles(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','sent','partially_signed','completed','voided')),
  created_by text not null default 'matt',
  sent_at timestamptz,
  completed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  sealed_sha256 text,                   -- sha256 of the final flattened executed PDF
  executed_document_id uuid references public.tc_documents(id),
  certificate_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tc_envelopes_cycle_idx on public.tc_envelopes (cycle_id);
create index if not exists tc_envelopes_status_idx on public.tc_envelopes (status);

create table if not exists public.tc_envelope_documents (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.tc_envelopes(id) on delete cascade,
  document_id uuid not null references public.tc_documents(id),   -- the filled, unsigned render
  form_version_id uuid references public.tc_form_versions(id),
  sort_order int not null default 0,
  unique (envelope_id, document_id)
);

create table if not exists public.tc_envelope_recipients (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.tc_envelopes(id) on delete cascade,
  role text not null,                   -- buyer1|seller1|listing_broker|cc|...
  name text not null,
  email text not null,
  fub_person_id bigint,                 -- people stay in FUB
  signing_order int not null default 1,
  auth_token_hash text,                 -- sha256 of the emailed signing token; raw token never stored
  consented_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists tc_envelope_recipients_envelope_idx on public.tc_envelope_recipients (envelope_id);

create table if not exists public.tc_envelope_fields (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.tc_envelopes(id) on delete cascade,
  document_id uuid not null references public.tc_documents(id),
  recipient_id uuid references public.tc_envelope_recipients(id) on delete set null, -- null = prefilled/static
  type text not null
    check (type in ('signature','initials','date_signed','text','checkbox','strike')),
  page int not null,
  x numeric not null,
  y numeric not null,
  w numeric not null,
  h numeric not null,
  required boolean not null default true,
  value jsonb,                          -- typed/drawn signature payload, text value, checked, etc.
  signed_at timestamptz,
  signed_ip text
);
create index if not exists tc_envelope_fields_envelope_idx on public.tc_envelope_fields (envelope_id);
create index if not exists tc_envelope_fields_recipient_idx on public.tc_envelope_fields (recipient_id);

alter table public.tc_form_libraries enable row level security;
alter table public.tc_form_versions enable row level security;
alter table public.tc_envelopes enable row level security;
alter table public.tc_envelope_documents enable row level security;
alter table public.tc_envelope_recipients enable row level security;
alter table public.tc_envelope_fields enable row level security;

-- Seed the three libraries Matt named (license notes are operational reminders)
insert into public.tc_form_libraries (code, name, region, license_note) values
  ('OREF', 'Oregon Real Estate Forms', 'OR', 'Licensed via OREF membership. Blank templates load under member access only; never redistribute.'),
  ('ODS', 'Oregon Data Share MLS Forms', 'OR', 'MLS member forms (listing input, change forms).'),
  ('OR', 'Oregon State Library (SkySlope taxonomy)', 'OR', 'State-tagged forms as named in SkySlope library (e.g. Buyer''s Notice of Termination - OR).'),
  ('RR', 'Ryan Realty House Forms', 'OR', 'Internal: Broker Notes, cover sheets, disclosures authored in-house.')
on conflict (code) do nothing;
