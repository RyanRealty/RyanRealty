-- CONTACT360 Phase 4.4 — crm_relationships integrity guards.
--
-- A no-self-link CHECK + a partial-unique on real (non-null) directed pairs so
-- the same relationship cannot be inserted twice (the link/unlink/setType
-- actions in app/actions/crm-relationships.ts already guard this in code; this is
-- the DB-level belt-and-suspenders).
--
-- The 29 legacy rows are FUB name-only imports (related_person_id IS NULL, an
-- unresolved link) — the partial index excludes them, and `IS DISTINCT FROM`
-- passes on NULL. Verified pre-apply against prod: 0 self-links, 0 real-pair
-- duplicates, 29/29 rows null-related.

alter table public.crm_relationships
  add constraint crm_relationships_no_self_link
  check (person_id is distinct from related_person_id);

create unique index if not exists uq_crm_relationships_pair
  on public.crm_relationships (person_id, related_person_id)
  where related_person_id is not null;
