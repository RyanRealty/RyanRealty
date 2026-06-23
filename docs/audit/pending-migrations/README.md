# Pending migrations — held until Matt's explicit "apply"

Written + pre-verified but kept OUT of `supabase/migrations/` so the
`alwaysApply: true` Cursor rule (`.cursor/rules/supabase-migrations-auto.mdc`)
cannot auto-apply them. Applying a prod schema is gated on Matt's go.

To apply: `git mv` the file into `supabase/migrations/`, apply via the Supabase
MCP `apply_migration` (project `dwvlophlbvvygjfxcrhm`), then
`npm run ci:data-access -- --refresh` and commit.

## Held
_(none currently)_

## Applied
- `20260622210000_meta_audience_removal_queue.sql` (Phase 8.4) + `20260622211000_meta_audience_log.sql` (Phase 5.6)
  — APPLIED to prod 2026-06-23 at the first LIVE Meta push (Matt: "set the
  variable and wire it so new leads flow in"). Moved into `supabase/migrations/`.
  Both are idempotent (`create table if not exists`).
