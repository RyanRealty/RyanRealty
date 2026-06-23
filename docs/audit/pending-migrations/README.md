# Pending migrations — held until Matt's explicit "apply"

Written + pre-verified but kept OUT of `supabase/migrations/` so the
`alwaysApply: true` Cursor rule (`.cursor/rules/supabase-migrations-auto.mdc`)
cannot auto-apply them. Applying a prod schema is gated on Matt's go.

To apply: `git mv` the file into `supabase/migrations/`, apply via the Supabase
MCP `apply_migration` (project `dwvlophlbvvygjfxcrhm`), then
`npm run ci:data-access -- --refresh` and commit.

## Held
- `20260622210000_meta_audience_removal_queue.sql` (Phase 8.4) — the opt-out ->
  audience-removal queue table. Until applied, enqueueAudienceRemoval fails soft
  (the suppression itself still takes effect).
- `20260622211000_meta_audience_log.sql` (Phase 5.6) — the audience-sync ledger.
  Until applied, the cron logs a console summary instead.

Neither is needed until the first LIVE Meta push (Matt's call after the dry-run).
