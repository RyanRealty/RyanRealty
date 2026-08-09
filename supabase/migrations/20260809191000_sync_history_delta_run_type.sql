-- P12: the job that actually keeps listings fresh is the 15-minute delta sync,
-- and it never wrote sync_history — only completed FULL runs did (last rows
-- from 2026-03). Allow run_type='delta' so the operational record includes the
-- work that actually runs.

ALTER TABLE public.sync_history
  DROP CONSTRAINT IF EXISTS sync_history_run_type_check;

ALTER TABLE public.sync_history
  ADD CONSTRAINT sync_history_run_type_check
  CHECK (run_type IN ('listings', 'history', 'photos', 'full', 'delta'));

COMMENT ON TABLE public.sync_history IS
  'Admin sync runs: listings, history, photos, full, or delta (15-min keep-fresh).';
