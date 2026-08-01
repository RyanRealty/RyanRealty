-- audit: migration — remove the one-shot backfill scaffolding once both projections
-- are fully populated (marker required by the DAL-bypass guard).
--
-- Teardown for 20260731214000_listing_feature_flags_backfill.sql.
--
-- The six pg_cron jobs unschedule themselves when their shard reports done; this
-- migration is the belt to that pair of braces (a job that never reached its last
-- firing would otherwise sit in cron.job forever), and it drops the cursor table
-- and the verification/parity harness that only existed to prove the change.
--
-- The projections themselves, their indexes, listing_feature_flags_of() and the
-- two triggers all STAY. Nothing below touches them.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname LIKE 'lff-backfill-%' OR jobname LIKE 'lff-verify-%';

DROP TABLE IF EXISTS public._lff_backfill_cursor;
DROP TABLE IF EXISTS public._lff_verify;
DROP TABLE IF EXISTS public._parity_runs;
DROP FUNCTION IF EXISTS public._parity_suite(jsonb, int, boolean);
DROP FUNCTION IF EXISTS public._parity_fp(text, text);
DROP FUNCTION IF EXISTS public.search_listings_advanced_preflags(
  text, text, text, numeric, numeric, integer, integer, numeric, numeric,
  numeric, numeric, integer, integer, numeric, numeric, text, text, text, text,
  boolean, integer, boolean, boolean, boolean, boolean, boolean, text, text[],
  text[], integer, boolean, integer, text, text, integer, integer);
