-- SITE-212. getListingKeysWithPriceChangeSince (lib/data/listings/
-- getListingDetailBundles.ts) reads listing_key WHERE event_date >= since
-- AND price_change IS NOT NULL. idx_listing_history_event_date walked 7,613
-- rows in 3,817 blocks of a 9.8 GB table to keep 1,000; 1,050 calls in two
-- hours, max 3.0 s, the anon cap. A partial index on the dated rows that carry
-- a price change, with listing_key included, answers it index-only.--
-- PRODUCTION: listings is 13 GB and listing_history 9.8 GB, both written every
-- minute by the MLS sync, so build this CONCURRENTLY first (a one-shot pg_cron
-- job, the SITE-211 pattern: schedule `create index concurrently if not exists
-- ...` as its own single-statement job, wait for cron.job_run_details, then
-- unschedule) and let this file's IF NOT EXISTS no-op under `npm run db:push`.
-- Run as written, this file holds writes out for the whole build.
CREATE INDEX IF NOT EXISTS idx_listing_history_price_change_cover
  ON public.listing_history (event_date)
  INCLUDE (listing_key)
  WHERE price_change IS NOT NULL;
