-- Re-apply the `delta` run type to sync_history_run_type_check.
--
-- 20260809191000_sync_history_delta_run_type.sql already says this, but it
-- never reached production: no applied migration of that name is in
-- supabase_migrations (list read 2026-10-15), its version is older than the
-- migrations already applied there, and the hosted apply
-- (.github/workflows/supabase-migrations.yml) deliberately does not pass
-- --include-all, which is how a back-dated version gets skipped. The live
-- constraint read 2026-10-15 still allows only
-- ('listings','history','photos','full'), and the newest sync_history row in
-- production is a `full` run from 2026-03-16.
--
-- Writer: lib/sync/deltaSync.ts calls recordSyncRun({ runType: 'delta' })
-- (app/actions/sync-history.ts) on every 15-minute execute tick, and
-- lib/data/oversight/health.ts reads run_type = 'delta'. Evidence: 94 inserts
-- failed this constraint in the 24 h read on 2026-10-15 (96 the day before),
-- every one run_type = 'delta'. Nothing else is rejected: no other run_type
-- value appears in the failures.
--
-- Idempotent and the same vocabulary as the back-dated file; this file only
-- carries it under a version production will apply. One ALTER TABLE, so there
-- is no instant with no constraint.
alter table public.sync_history
  drop constraint if exists sync_history_run_type_check,
  add constraint sync_history_run_type_check
    check (run_type in ('listings', 'history', 'photos', 'full', 'delta'));

comment on table public.sync_history is
  'Admin sync runs: listings, history, photos, full, or delta (15-min keep-fresh).';
