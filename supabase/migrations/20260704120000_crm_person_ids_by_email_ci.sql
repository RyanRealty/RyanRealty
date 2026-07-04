-- Case-insensitive email → crm_people id lookup.
--
-- Why: crm_people.emails is jsonb ([{value,...}]) and ~25% of stored addresses
-- carry uppercase (never normalized at write time). Suppression / scope / CMA
-- lookups query with a lowercased email via jsonb `@>`, which is BYTE-EXACT and
-- case-sensitive — so a person suppressed by a compliance tag whose email is stored
-- "Jane@X.com" is silently missed and could be emailed (a CAN-SPAM / license risk).
--
-- This function matches case-insensitively over the jsonb array so the lookup is
-- correct regardless of stored case, without mutating the CRM data. SECURITY DEFINER
-- so it runs with the owner's rights (callers use the service client anyway); STABLE
-- since it only reads. Callers: isSuppressedByEmail, resolveLeadAssignedBroker,
-- cma-deliver.
create or replace function public.crm_person_ids_by_email_ci(p_email text)
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from crm_people p
  where p.emails is not null
    and jsonb_typeof(p.emails) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(p.emails) as e
      where lower(e->>'value') = lower(btrim(p_email))
    )
$$;

comment on function public.crm_person_ids_by_email_ci(text) is
  'Case-insensitive email -> crm_people.id lookup over the jsonb emails array. Fixes the case-sensitive jsonb @> suppression-bypass (2026-07-04).';

grant execute on function public.crm_person_ids_by_email_ci(text) to service_role;
