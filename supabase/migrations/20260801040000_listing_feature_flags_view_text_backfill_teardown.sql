-- audit: migration — tear down the view_text backfill scaffolding now that all six
-- shards report done (marker required by the DAL-bypass guard).
--
-- Mirrors 20260731232000, which tore down the equivalent scaffolding for the
-- flags/remarks backfill.
--
-- COMPLETION EVIDENCE, read off _lfvt_backfill_cursor before this ran:
--   rows_seen 594,196 = total_rows 594,196 · rows_written 424,393 · 6/6 done
--   every lfvt-backfill-N job had already unscheduled itself (cron.job empty).
--
-- CORRECTNESS EVIDENCE, before search_listings_advanced was repointed at the
-- column in 20260801030000:
--   coverage      594,196 listings = 594,196 listing_feature_flags rows,
--                 0 listings without a flags row
--   equality      view_text IS NOT DISTINCT FROM details->>'View' on
--                 7,742 rows (the ENTIRE active population, which is what the
--                 preset pages serve) and on an 8,789-row 1.5% block sample
--                 spanning all 8 distinct statuses — 0 mismatches in 16,531 rows
--   predicate     old `details->>'View' ILIKE %term%` vs new
--                 `view_text ILIKE %term%` over the whole active population:
--                 Mountain 2877/2877 · River 282/282 · Golf 280/280 ·
--                 Lake 222/222 · Water 0/0
--   end to end    two RPC parity shapes fingerprinted identically before and
--                 after the swap (Culver viewContains=Mountain, Sisters
--                 viewContains=Cascade), same md5 over row order, identity,
--                 price, status, mod-stamp and the full details document.
--
-- The trigger from 20260801020000 maintains the column from here on. Nothing
-- below is needed again; a future re-backfill would re-create it from that
-- migration.
--
-- The jobs unschedule themselves, but cron.unschedule is called defensively in
-- case teardown runs while a shard is mid-flight on a re-applied database.

DO $$
DECLARE
  s int;
BEGIN
  FOR s IN 1..6 LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lfvt-backfill-' || s) THEN
      PERFORM cron.unschedule('lfvt-backfill-' || s);
    END IF;
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public._lfvt_backfill_cursor;
