-- CRM import hardening (adversarial audit 2026-07-04):
--   * TOCTOU: /api/admin/crm-import gated on status='running' but never claimed
--     the job, so two concurrent POSTs both processed the file and double-created
--     every contact. Add an atomic-claim lease column.
--   * No per-person contact-point uniqueness, so a check-then-insert race (or a
--     re-run) could stack the same email/phone on one person.

-- 1. Per-person contact-point uniqueness: a single person must not carry the
--    same email/phone twice. Verified 0 existing dups before adding. This does
--    NOT constrain the same value across DIFFERENT persons — farm-parcel imports
--    intentionally put one owner email on many person rows, and the sequence
--    engine's same-human dedup relies on that.
create unique index if not exists crm_contact_points_person_kind_value_uidx
  on public.crm_contact_points (person_id, kind, value);

-- 2. Import worker claim: an atomic lease column so two concurrent POSTs to
--    /api/admin/crm-import for the same job cannot both process the file. A fresh
--    claim sets it; a run older than the 60s route maxDuration is stale and
--    re-claimable (prevents a crashed run from wedging the job forever).
alter table public.crm_imports
  add column if not exists processing_started_at timestamptz;
