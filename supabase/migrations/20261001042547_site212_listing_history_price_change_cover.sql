-- SITE-212. getListingKeysWithPriceChangeSince (lib/data/listings/
-- getListingDetailBundles.ts), the search page's "Price reduced" badges,
-- reads listing_key WHERE event_date >= since AND price_change IS NOT NULL.
-- idx_listing_history_event_date walked every event of the window to keep the
-- price changes: 30 days on 2026-10-01 was 8,534 rows and 4,156 buffers of a
-- 4.1 GB heap for 1,128 rows (EXPLAIN (ANALYZE, BUFFERS)), 12 statement
-- timeouts at anon's 3 s between 2026-09-30 23:45Z and 2026-10-01 04:10Z.
--
-- The same read stopped at PostgREST's 1,000 rows, so 128 of the 1,128 events
-- (and the badges they carried) were dropped at random. This partial index
-- was to serve it paged in (event_date, id) order, each page an index-only
-- range read with no sort.
--
-- PRODUCTION: built CONCURRENTLY on 2026-10-01 at 04:24Z by a one-shot pg_cron
-- job (67 MB, 67 s), then dropped at 05:12Z by 20261001051242 when review moved
-- the badge to the price_drop events: price_change also carries raises and
-- every sale's close-to-list difference. Kept so the history reads in order;
-- replayed, this file builds an index the next one drops.
CREATE INDEX IF NOT EXISTS idx_listing_history_price_change_cover
  ON public.listing_history (event_date, id)
  INCLUDE (listing_key)
  WHERE price_change IS NOT NULL;
