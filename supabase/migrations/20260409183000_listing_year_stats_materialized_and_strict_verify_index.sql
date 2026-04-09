-- Year cohort rollups: views scanned all listings on every sync-status-report (statement timeouts).
-- Materialized views make reads O(rows) ~40 years; refresh does one full scan on a schedule.
-- Strict verify cron: partial index for terminal + finalized + not verified, ordered by OnMarketDate.

DROP VIEW IF EXISTS public.listing_year_finalization_stats CASCADE;
DROP VIEW IF EXISTS public.listing_year_on_market_finalization_stats CASCADE;

CREATE MATERIALIZED VIEW public.listing_year_finalization_stats AS
SELECT
  extract(year FROM coalesce(l."ListDate", l."OnMarketDate"))::integer AS list_year,
  count(*)::bigint AS total_listings,
  count(*) FILTER (WHERE l.history_finalized IS TRUE)::bigint AS finalized_listings,
  count(*) FILTER (WHERE l.history_verified_full IS TRUE)::bigint AS verified_full_listings
FROM public.listings l
WHERE coalesce(l."ListDate", l."OnMarketDate") IS NOT NULL
GROUP BY 1;

CREATE UNIQUE INDEX listing_year_finalization_stats_list_year_key
  ON public.listing_year_finalization_stats (list_year);

COMMENT ON MATERIALIZED VIEW public.listing_year_finalization_stats IS
  'Per list-year cohort for history_finalized / history_verified_full. Refreshed by refresh_listing_year_sync_stats() (cron).';

CREATE MATERIALIZED VIEW public.listing_year_on_market_finalization_stats AS
SELECT
  extract(year FROM l."OnMarketDate")::integer AS list_year,
  count(*)::bigint AS total_listings,
  count(*) FILTER (WHERE l.history_finalized IS TRUE)::bigint AS finalized_listings,
  count(*) FILTER (WHERE l.history_verified_full IS TRUE)::bigint AS verified_full_listings
FROM public.listings l
WHERE l."OnMarketDate" IS NOT NULL
GROUP BY 1;

CREATE UNIQUE INDEX listing_year_on_market_finalization_stats_list_year_key
  ON public.listing_year_on_market_finalization_stats (list_year);

COMMENT ON MATERIALIZED VIEW public.listing_year_on_market_finalization_stats IS
  'Per OnMarketDate calendar year rollup. Refreshed by refresh_listing_year_sync_stats() (cron).';

GRANT SELECT ON public.listing_year_finalization_stats TO service_role;
GRANT SELECT ON public.listing_year_on_market_finalization_stats TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_listing_year_sync_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.listing_year_finalization_stats;
  REFRESH MATERIALIZED VIEW public.listing_year_on_market_finalization_stats;
END;
$$;

COMMENT ON FUNCTION public.refresh_listing_year_sync_stats() IS
  'Rebuilds listing year cohort materialized views (heavy scan; run from cron, not per HTTP request).';

ALTER FUNCTION public.refresh_listing_year_sync_stats() SET statement_timeout = '600s';

REVOKE ALL ON FUNCTION public.refresh_listing_year_sync_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_listing_year_sync_stats() TO service_role;

-- Strict verify: match route.ts terminal OR filter + finalized + not fully verified
CREATE INDEX IF NOT EXISTS idx_listings_strict_verify_terminal_backlog
  ON public.listings ("OnMarketDate" DESC NULLS LAST)
  WHERE history_finalized IS TRUE
    AND COALESCE(history_verified_full, false) IS NOT TRUE
    AND (
      "StandardStatus" ILIKE '%closed%'
      OR "StandardStatus" ILIKE '%expired%'
      OR "StandardStatus" ILIKE '%withdrawn%'
      OR "StandardStatus" ILIKE '%cancel%'
    );
