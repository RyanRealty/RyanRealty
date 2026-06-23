# Pending migrations — held until Matt's explicit "apply the migrations"

These `.sql` files are written + pre-verified but deliberately kept **OUT of
`supabase/migrations/`** so the `alwaysApply: true` Cursor rule
(`.cursor/rules/supabase-migrations-auto.mdc`, "apply pending migrations without
asking") cannot auto-apply them to the hosted database without Matt's explicit
go. Applying a prod schema + backfill is gated on his sign-off (the auto-mode
classifier also blocks an autonomous apply).

## To apply (when Matt says "apply the migrations")

1. `git mv docs/audit/pending-migrations/<file>.sql supabase/migrations/<file>.sql`
2. Apply via the Supabase MCP `apply_migration` (project `dwvlophlbvvygjfxcrhm`),
   in filename order, using the full SQL from the file.
3. `npm run ci:data-access -- --refresh` to regenerate the schema snapshot, then
   commit the moved file + the refreshed snapshot together.

## Held migrations

- **`20260622190000_crm_person_id_bridge_columns.sql`** (CONTACT360 Phase 1.1).
  Additive `crm_person_id bigint` (FK -> crm_people(id) ON DELETE SET NULL) on
  visitor_identity_map / visitor_sessions / saved_searches / profiles + indexes
  + a backfill (the backfill joins `auth.users` to resolve user_id -> email,
  which only a postgres-role migration can do). Pre-checked safe: saved_searches
  + profiles are 0 rows, visitor_identity_map 1, visitor_sessions ~210 — the
  ideal zero-risk moment. Unblocks Phase 7 (consumer saved-search unification).

- **Phase 4.4 (not yet written as a file):** a `UNIQUE(person_id, related_person_id)`
  + a no-self-link `CHECK` on `crm_relationships`. SQL to finalize from the Wave 3
  relationships deliverable when 4.4 is applied alongside 1.1.
