-- Published CMAs on public listing pages (Matt approved 2026-07-30).
--
-- Two things land here.
--
-- 1. A PER-DOCUMENT publish opt-in on public.cmas. Publishing is never
--    inferred and never bulk. A CMA is a client document: of the 226 rows
--    live on 2026-07-30, the only one that is both finalized and attached to
--    an ACTIVE Ryan Realty listing carries a recommended list ($1,050,000)
--    BELOW the seller's ask ($1,095,000). Auto-publishing that would undercut
--    our own client. So the flag defaults false and a human sets it per row,
--    with an audit stamp of who and when.
--
-- 2. public.cma_document_registrations — the registration record behind the
--    "download the full market analysis" funnel. Matt asked for the gate as a
--    lead funnel ("require them to register"). It doubles as the display
--    boundary: ODS Rules (Aug 2024) §5-4 C requires a name, a verified email
--    and an affirmative terms-of-use agreement before a consumer retrieves
--    MLS listing information (which §5-4 A.4 defines to include sold data) on
--    a website. The document itself is unaffected: §7-5 D expressly preserves
--    a broker's right to use sold and comparable data "to support valuations
--    on particular properties for clients and customers", so a delivered CMA
--    carries full comps with no special treatment.
--
-- Additive and back-compatible. No existing row changes behavior: every CMA
-- starts unpublished.

alter table public.cmas
  add column if not exists published_to_listing boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by text,
  add column if not exists publish_note text;

-- doc_type is stable for the life of a row, so this constraint can never block
-- a later status transition (archiving a published document still works).
--
-- It mechanically forbids publishing an `expired-audit`, which is a competitive
-- analysis of ANOTHER participant's failed listing. ODS §7-3 withholds "the
-- right to include in any such advertising or representation information about
-- specific properties, which are listed with other Participants", and §5-4 W.1
-- bars expired and withdrawn listings from display outright. 4 of the 7
-- finalized documents carrying a subject_listing_key on 2026-07-30 were exactly
-- that shape, so this is a live foot-gun, not a hypothetical one.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cmas_publish_requires_cma_doc_type'
  ) then
    alter table public.cmas
      add constraint cmas_publish_requires_cma_doc_type
      check (published_to_listing = false or doc_type = 'cma');
  end if;
end $$;

-- The listing-page lookup: one published CMA per listing key.
create index if not exists cmas_published_listing_idx
  on public.cmas (subject_listing_key)
  where published_to_listing;

create table if not exists public.cma_document_registrations (
  id uuid primary key default gen_random_uuid(),
  cma_id uuid not null references public.cmas(id) on delete cascade,
  listing_key text,
  full_name text not null,
  email text not null,
  phone text,
  -- ODS §5-4 F: the registrant reviews and affirmatively agrees to terms. We
  -- store WHICH terms text they agreed to, so a later revision never
  -- retroactively rewrites what a past registrant accepted.
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  -- Hashed, never raw: an IP is personal data and we only ever need it to
  -- answer an abuse question, which a hash answers just as well.
  ip_hash text,
  user_agent text,
  -- The in-house CRM person this registration created or matched.
  person_id bigint,
  assigned_broker text,
  -- The delivery token is stored hashed. A database read can never mint a
  -- working download link.
  token_hash text not null,
  token_expires_at timestamptz not null,
  first_delivered_at timestamptz,
  delivery_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists cma_doc_reg_token_uidx
  on public.cma_document_registrations (token_hash);
create index if not exists cma_doc_reg_cma_idx
  on public.cma_document_registrations (cma_id);
create index if not exists cma_doc_reg_email_idx
  on public.cma_document_registrations (lower(email));
create index if not exists cma_doc_reg_created_idx
  on public.cma_document_registrations (created_at desc);

-- Service-role only, matching public.cmas and public.cma_comps. RLS on with
-- zero policies means anon and authenticated resolve to zero rows; the explicit
-- revoke means they cannot even reach the relation. Registrant contact details
-- are never publicly readable.
alter table public.cma_document_registrations enable row level security;
revoke all on public.cma_document_registrations from anon;
revoke all on public.cma_document_registrations from authenticated;

-- Hardening on the two tables this feature's boundary depends on.
--
-- On 2026-07-30 `anon` and `authenticated` still held a table-level SELECT
-- grant on public.cmas and public.cma_comps. RLS is enabled with zero policies,
-- so they returned zero ROWS, but that meant a single future permissive policy
-- would have published every sold comp in the table. Every caller of these two
-- tables in lib/, app/ and scripts/ uses the service-role client, so the grant
-- had no consumer to break. Two independent locks beat one.
revoke all on public.cmas from anon;
revoke all on public.cmas from authenticated;
revoke all on public.cma_comps from anon;
revoke all on public.cma_comps from authenticated;

comment on column public.cmas.published_to_listing is
  'Per-document opt-in. When true, the value opinion + methodology may render on the public listing page. Never inferred, never bulk-set. Sold-comp detail stays behind registration regardless.';
comment on table public.cma_document_registrations is
  'Registrations for the gated "download the full market analysis" funnel. Lead capture (Matt 2026-07-30) and the ODS §5-4 C display boundary in one record.';
