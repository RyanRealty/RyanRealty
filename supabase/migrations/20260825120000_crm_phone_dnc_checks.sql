-- crm_phone_dnc_checks — the record that a phone number WAS checked, and what
-- came back.
--
-- The gap this closes: 16,614 contacts carry a phone, 3,207 carry a compliance
-- flag, and the other 13,407 carry nothing — which the send path could not tell
-- apart from "checked and clean". Absence of a flag was being read as consent to
-- text. It is not; it is absence of information.
--
-- Keyed on the LAST 10 DIGITS, not on a person: the Do Not Call registry is a
-- property of the NUMBER, and one number can sit on several contacts (spouses,
-- a merged record, an owner and their LLC). Last-10 is the normalization the
-- rest of the CRM already uses (normalizeCrmPhone, FLEET_TEST_PHONE_LAST10).
--
-- checked_at is the point of the table. A row means "asked the registry on this
-- date"; no row means "never asked". Registry status changes, so a check has a
-- shelf life and the reader treats a stale row as stale, not as clean.
create table if not exists public.crm_phone_dnc_checks (
  phone_last10   text primary key check (phone_last10 ~ '^[0-9]{10}$'),
  on_dnc         boolean not null,
  is_litigator   boolean not null default false,
  line_type      text,
  carrier        text,
  source         text not null default 'batchdata',
  checked_at     timestamptz not null default now(),
  raw            jsonb not null default '{}'::jsonb
);

comment on table public.crm_phone_dnc_checks is
  'Per-number DNC / TCPA-litigator check results. A row means the number was checked on checked_at; no row means never checked, which is NOT the same as clean.';

create index if not exists crm_phone_dnc_checks_checked_at_idx
  on public.crm_phone_dnc_checks (checked_at desc);

-- Partial: the flagged set is the small one and the one every send path asks about.
create index if not exists crm_phone_dnc_checks_flagged_idx
  on public.crm_phone_dnc_checks (phone_last10)
  where on_dnc or is_litigator;

alter table public.crm_phone_dnc_checks enable row level security;
-- No policies: service role only, like the rest of the compliance tables. An
-- anon client must never read who is on the registry.
