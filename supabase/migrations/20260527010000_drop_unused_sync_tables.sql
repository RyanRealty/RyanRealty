-- Drop three sync-monitoring tables that have no live readers or writers in the codebase.
-- Verified 2026-05-27 by greping app/, components/, lib/, scripts/, inngest/ for each name:
--   - sync_jobs: 0 rows, defined in 20250308120000_replication_schema.sql but never wired.
--   - sync_state_by_resource: 0 rows, same — defined-but-never-wired.
--   - year_sync_log: 190 rows from the 2026-04 backfill, zero live readers. Backfill complete.
-- Active sync state remains in sync_state, sync_cursor, sync_checkpoints, post_sync_pipeline_runs.

DROP TABLE IF EXISTS sync_jobs CASCADE;
DROP TABLE IF EXISTS sync_state_by_resource CASCADE;
DROP TABLE IF EXISTS year_sync_log CASCADE;
