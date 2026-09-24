-- Vault form templates: the printed form alone, page by page, for every form
-- and release the Vault can check a copy against.
--
-- Emailed copies of forms are flattened prints: the text inside them is often
-- unreadable and they carry no form fields, so a copy is checked against the
-- form itself. A template page is the form's ink (a 1-bit mask at 1 px per
-- point, stored in the tc-forms bucket under templates/) plus what the page
-- asks for: its footer (form, release, page of), each signature line with its
-- party, date and print boxes and whether the form marks it required, and its
-- initials boxes. A copy of the same release carries all of the template's
-- ink; the ink a copy adds inside a signature box is the signature.
--
-- source = library: built from the licensed blank in tc_form_versions.
-- source = learned: built from our own copies of a release the library does
-- not hold (older releases, or a new release before the library has it): the
-- ink every copy shares is the printed form.
--
-- tc_document_checks holds one row per document per checker version: which
-- template page each document page matched (or the nearest, when none did),
-- and for each form instance its missing pages and every line and initials
-- box, signed or not.

create table if not exists public.tc_form_templates (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  form_number text not null,
  release text,
  edition text not null default 'a',
  title text not null,
  page_count integer not null,
  source text not null check (source in ('library', 'learned')),
  form_version_id uuid references public.tc_form_versions(id) on delete set null,
  copies integer not null default 0,
  pages jsonb not null default '[]'::jsonb,
  masks_path text not null,
  status text not null default 'active' check (status in ('active', 'candidate', 'retired')),
  builder_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tc_form_templates_identity
  on public.tc_form_templates (family, form_number, coalesce(release, ''), edition);

comment on table public.tc_form_templates is
  'Vault form templates: one row per form + release (+ edition when two printings of one release differ). pages = [{page, w, h, footer, descriptor (base64 16x20 ink grid), signatures, initials}]; masks_path = gzip of the packed 1-bit page masks in the tc-forms bucket. source library = the licensed blank; learned = the ink shared by our own copies of that release.';

create table if not exists public.tc_document_checks (
  document_id uuid not null references public.tc_documents(id) on delete cascade,
  checker_version text not null,
  sha256 text,
  page_count integer,
  pages jsonb not null default '[]'::jsonb,
  forms jsonb not null default '[]'::jsonb,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now(),
  primary key (document_id, checker_version)
);

comment on table public.tc_document_checks is
  'Vault form checks: per document page, the template page it matched (coverage, offset) or the nearest one; per form instance, missing pages and every signature line (signed, dated, printed) and initials box. Recomputed when the checker version changes.';

alter table public.tc_form_templates enable row level security;
alter table public.tc_document_checks enable row level security;
grant select, insert, update, delete on public.tc_form_templates to service_role;
grant select, insert, update, delete on public.tc_document_checks to service_role;
