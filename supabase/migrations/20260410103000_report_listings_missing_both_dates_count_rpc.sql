-- Count listings where both ListDate and OnMarketDate are null (sync-status-report.mjs).
-- Chained PostgREST filters for two null checks can fail or time out at scale; COUNT(*) in Postgres is reliable.

CREATE OR REPLACE FUNCTION public.report_listings_missing_both_dates_count()
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  SET LOCAL statement_timeout = '120s';
  SELECT count(*)::bigint
  INTO n
  FROM public.listings
  WHERE "ListDate" IS NULL
    AND "OnMarketDate" IS NULL;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.report_listings_missing_both_dates_count() IS
  'Rows with both ListDate and OnMarketDate null; for sync status report. Service role only.';

ALTER FUNCTION public.report_listings_missing_both_dates_count() SET statement_timeout = '120s';

REVOKE ALL ON FUNCTION public.report_listings_missing_both_dates_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_listings_missing_both_dates_count() TO service_role;
