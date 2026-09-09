/**
 * getTileRefreshInProgress — is pg_cron job 164 refreshing listing_tile_mv_src
 * right now?
 *
 * WHY (SITE-54, 2026-09-09). public.refresh_listing_tile_mv() holds advisory
 * lock 7101 for the whole REFRESH MATERIALIZED VIEW CONCURRENTLY (migration
 * 20260729193000, step 7). Measured over 24h on 2026-09-09: 47 runs, avg 632s,
 * max 1,283s, 8.25 of 24 hours refreshing, and 13-21 minutes of every
 * 30-minute slot overnight. PostgREST roles run with statement_timeout=8s
 * (authenticator/authenticated) and 3s (anon), so reads issued inside that
 * window die at 8s.
 *
 * The hourly sitemap warmer used to start at :00, two minutes before the :02
 * refresh, and ran straight into it every hour — the 06:00:38Z run on
 * 2026-09-09 logged a failed subdivision-inventory read for all eight cities
 * plus a matrix statement timeout, so the geo class it was there to cache was
 * never filled and every cold /sitemaps/geo.xml request rebuilt the whole
 * universe and hit the 300s ceiling.
 *
 * The warmer now runs at :26 (a minute the refresh cannot reach even at its
 * measured worst) AND asks this before building, so a refresh that overruns
 * its window skips the run rather than burning a 300s invocation on reads that
 * will time out.
 *
 * NOT unstable_cache'd, deliberately: this is a liveness probe. A cached
 * "false" would defeat the entire point of asking.
 */

import { createServiceClient } from '@/lib/supabase/service'

/**
 * True while the refresh holds the lock, false while it does not, and false
 * when the probe itself fails.
 *
 * FAILING OPEN IS THE RIGHT DEFAULT. This gate only decides whether to SKIP
 * work. An unavailable probe that answered "true" would skip the warm forever
 * and leave every sitemap class cold — the exact outage this node exists to
 * end. Answering "false" costs, at worst, one warm run that hits the timeouts
 * it would have hit anyway.
 */
export async function getTileRefreshInProgress(): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('listing_tile_mv_refresh_in_progress')
    if (error) {
      console.error('[tile-refresh-probe] rpc failed:', error.message)
      return false
    }
    return data === true
  } catch (err) {
    console.error('[tile-refresh-probe] rpc threw:', err instanceof Error ? err.message : err)
    return false
  }
}
