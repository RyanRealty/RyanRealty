-- CONTACT360 Phase 1.1 — crm_person_id bridge columns.
--
-- Resolves the identity fork: the self-owned CRM keys on crm_people.id (bigint),
-- while the auth/visitor tables key on auth uuid / rr_vid / fub id. crm_person_id
-- is the durable join from those tables to the CRM. Nullable + FK ON DELETE SET
-- NULL (a deleted/ re-synced person nulls the bridge, never blocks the dependent
-- row). Adding a nullable column with no default is metadata-only (instant, no
-- table rewrite). The tables are near-empty today (saved_searches/profiles = 0
-- rows) so this is the ideal, zero-risk moment to install the bridge.
--
-- Backfill matches each table's identity to crm_contact_points — email is the
-- FUB-independent join key. This migration runs as the postgres role, so the
-- backfill can read auth.users to resolve user_id -> email (the clean place to do
-- it; PostgREST/service-role app code cannot read auth.users by email).

alter table public.visitor_identity_map add column if not exists crm_person_id bigint
  references public.crm_people(id) on delete set null;
alter table public.visitor_sessions add column if not exists crm_person_id bigint
  references public.crm_people(id) on delete set null;
alter table public.saved_searches add column if not exists crm_person_id bigint
  references public.crm_people(id) on delete set null;
alter table public.profiles add column if not exists crm_person_id bigint
  references public.crm_people(id) on delete set null;

create index if not exists idx_vim_crm_person_id on public.visitor_identity_map(crm_person_id);
create index if not exists idx_vsessions_crm_person_id on public.visitor_sessions(crm_person_id);
create index if not exists idx_saved_searches_crm_person_id on public.saved_searches(crm_person_id);
create index if not exists idx_profiles_crm_person_id on public.profiles(crm_person_id);

-- visitor_identity_map: carries email + fub_person_id directly.
update public.visitor_identity_map vim
set crm_person_id = cp.person_id
from public.crm_contact_points cp
where cp.kind = 'email' and lower(cp.value) = lower(vim.email)
  and vim.email is not null and vim.crm_person_id is null;

update public.visitor_identity_map vim
set crm_person_id = p.id
from public.crm_people p
where p.fub_legacy_id = vim.fub_person_id
  and vim.fub_person_id is not null and vim.crm_person_id is null;

-- saved_searches + profiles: user_id -> auth.users.email -> contact point.
update public.saved_searches ss
set crm_person_id = cp.person_id
from auth.users au
join public.crm_contact_points cp on cp.kind = 'email' and lower(cp.value) = lower(au.email)
where ss.user_id = au.id and ss.crm_person_id is null;

update public.profiles pr
set crm_person_id = cp.person_id
from auth.users au
join public.crm_contact_points cp on cp.kind = 'email' and lower(cp.value) = lower(au.email)
where pr.user_id = au.id and pr.crm_person_id is null;

-- visitor_sessions: identity comes via visitor_identity_map (session_id join).
update public.visitor_sessions vs
set crm_person_id = vim.crm_person_id
from public.visitor_identity_map vim
where vim.session_id = vs.session_id and vim.crm_person_id is not null
  and vs.crm_person_id is null;
