-- Plain unique index instead of partial: Postgres treats NULLs as distinct, so
-- rows without a dedupe_key are unaffected, and PostgREST ON CONFLICT (dedupe_key)
-- can now infer the arbiter index (partial indexes are not inferable without a
-- WHERE clause, which PostgREST cannot emit).
drop index if exists crm_timeline_dedupe_uq;
create unique index crm_timeline_dedupe_uq on public.crm_timeline (dedupe_key);
