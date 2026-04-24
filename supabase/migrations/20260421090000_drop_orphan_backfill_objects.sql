-- Drop orphan database objects left over from one-off backfill work
-- (the trg_compute_listing_fields era — Tier 1/2/3 backfills completed
-- 2026-04-18). None of these are referenced by active code, cron, or
-- migrations. Confirmed orphan 2026-04-21 via audit of pg_proc,
-- information_schema.tables, pg_indexes, and cron.job.
--
-- Governance purge chapter 5: code+DB drift cleanup.

-- 1) Orphan temp tables (used for chunked backfill cursors / staging)
DROP TABLE IF EXISTS public._bf_cursors CASCADE;
DROP TABLE IF EXISTS public._pm_agg_final CASCADE;
DROP TABLE IF EXISTS public._pm_agg_stage CASCADE;
DROP TABLE IF EXISTS public._staging_price_metrics CASCADE;
DROP TABLE IF EXISTS public._sync_rotation CASCADE;

-- 2) Orphan backfill procedures (one-shot, completed). Uses a DO block so any
--    function signature variant is dropped safely without needing to hard-code
--    argument lists. IF-EXISTS semantics come from the SELECT returning 0 rows.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        '_bf_all_date_fields',
        '_bf_back_on_market_count',
        '_bf_cumulative_dom',
        '_bf_days_on_market',
        '_bf_days_pending_to_close',
        '_bf_days_to_pending',
        '_bf_last_price_change',
        '_bf_populate_price_history',
        '_bf_price_history_metrics',
        '_bf_status_change_count',
        '_bf_total_price_change',
        '_bf_was_relisted',
        '_bulk_agg_year',
        '_do_full_agg',
        '_do_full_agg_wrapper',
        '_sync_orchestrator'
      )
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig::text || ' CASCADE';
  END LOOP;
END $$;

-- 3) Orphan partial index (remnant of days-on-market backfill; no longer
--    serves any query)
DROP INDEX IF EXISTS public.idx_bf_dom_null;
