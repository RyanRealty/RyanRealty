-- CRM segment-AST resolver — supporting indexes.
--
-- The filter-AST resolver (lib/data/crm/buildCrmPeopleQuery.ts) compiles every
-- list view, headline count, bulk id-set, and Meta audience into ONE query on
-- crm_people. That query always baselines `deleted = false`, frequently filters
-- on source / custom-field keys, orders by last_activity_at then fub_created_at,
-- and (with the 200-id contact-point cap removed) searches the emails/phones
-- jsonb directly. The crm_core migration already covers tags, stage,
-- assigned_broker, and name; these add the access paths the resolver introduces.
--
-- All indexes are IF NOT EXISTS so this is safe to re-run. pg_trgm is already
-- enabled by the crm_core migration (crm_people_name_trgm uses gin_trgm_ops).

-- 1. The `deleted = false` baseline on every resolver query. A partial index on
--    the not-deleted rows keeps the working set tight (soft-deletes never grow it)
--    and pairs with the order-by for the default list scan.
create index if not exists crm_people_active_activity_idx
  on public.crm_people (last_activity_at desc nulls last, fub_created_at desc nulls last)
  where deleted = false;

-- 2. Date-window conditions + the default ordering on fub_created_at.
create index if not exists crm_people_fub_created_idx
  on public.crm_people (fub_created_at desc nulls last);

-- 3. The `source` exact-match condition.
create index if not exists crm_people_source_idx
  on public.crm_people (source);

-- 4. Custom-field conditions (custom->>key eq/has/missing/contains). A GIN index
--    on the jsonb supports key-presence and containment lookups.
create index if not exists crm_people_custom_gin
  on public.crm_people using gin (custom);

-- 5. The uncapped free-text q search hits the emails/phones jsonb cast to text via
--    ilike. Trigram GIN indexes on the text projection keep that fast at scale.
create index if not exists crm_people_emails_trgm
  on public.crm_people using gin ((emails::text) gin_trgm_ops);

create index if not exists crm_people_phones_trgm
  on public.crm_people using gin ((phones::text) gin_trgm_ops);
