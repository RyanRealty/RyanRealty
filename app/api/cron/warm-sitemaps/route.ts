/**
 * Sitemap cache warmer.
 *
 * WHY (2026-08-02 audit, P0): the five child sitemaps render on first request
 * and cache for an hour. That kept the heavy build off the deploy critical path
 * — the 2026-07-30 failure where every production deploy went ERROR after
 * /sitemaps/core.xml blew the 1800s per-route build ceiling — but it moved the
 * cost onto whoever asks first. In practice that was Googlebot, and it never
 * got an answer: listings.xml and matrix.xml returned http=000 with zero bytes
 * after 100s, reproduced across four attempts.
 *
 * Warming them here means the first REAL request is always a cache hit.
 *
 * IN-PROCESS, NOT OVER HTTP (fixed 2026-08-02, third pass). This used to fetch
 * the five public URLs in sequence, on the stated theory that "the in-flight
 * dedupe collapses them onto one shared universe build". It does not. Each
 * fetch is a separate lambda invocation with its own module scope, so the
 * memo is never shared, and sequential calls have no in-flight overlap to
 * dedupe anyway. Every class paid a full ~10.7K-URL fan-out.
 *
 * Measured in production right after deploy, sequential, cold:
 *   core 504 @300.6s · geo 504 @300.6s · content 200 @146.7s · listings 504 @300.2s
 *
 * One build is ~147s. Five do not fit a 300s ceiling; one plus four in-memory
 * filters does. Calling getClassRows() directly keeps all five inside ONE
 * invocation, which is the only place the memo can actually apply, and writes
 * every per-class unstable_cache entry for the hour ahead.
 *
 * Scheduled hourly in vercel.json to match the routes' revalidate: 3600.
 *
 * THE MINUTE MATTERS (SITE-54, 2026-09-09). This ran at :00. pg_cron job 164
 * refresh_listing_tile_mv_30min fires at :02 and :32 and holds
 * listing_tile_mv_src under REFRESH ... CONCURRENTLY for 13-21 minutes of every
 * 30-minute slot overnight (47 runs in 24h, avg 632s, max 1,283s). PostgREST
 * roles time out at 8s, so a warm that starts at :00 spends its first two
 * minutes on real work and the rest inside a refresh window losing every read:
 * the 06:00:38Z run logged a failed subdivision-inventory read for redmond,
 * sunriver, bend, sisters, la-pine, prineville, madras and black-butte-ranch
 * plus a matrix statement timeout, returned 200, and cached nothing. With the
 * geo class never filled, every cold /sitemaps/geo.xml request rebuilt the
 * universe and returned 504 'Task timed out after 300 seconds'.
 *
 * At worst the refresh holds :02-:24 and :32-:54, so the clear windows are
 * :25-:31 and :55-:01. The schedule is now `26 * * * *`, and the run also asks
 * the database whether a refresh is in progress before it builds, so an
 * overrunning refresh costs a skipped warm rather than a burnt 300s invocation.
 */
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { SITEMAP_CLASSES } from '@/lib/data/sitemap/classify'
import { getClassRows } from '@/lib/sitemap-class-rows'
import { getTileRefreshInProgress } from '@/lib/data/mv/getTileRefreshInProgress'

// The first class pays for the whole universe build (~147s); the rest are
// in-memory filters over it.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req)
  if (unauthorized) return unauthorized

  const startedAtIso = new Date().toISOString()

  // A build started inside a tile-refresh window loses its reads to the 8s
  // PostgREST statement timeout and caches nothing. Skipping says so out loud
  // and leaves the previous hour's cache in place; the next run is 60 minutes
  // away and the refresh has never come close to that.
  if (await getTileRefreshInProgress()) {
    const body = {
      skipped: true,
      reason: 'listing_tile_mv_src refresh in progress (advisory lock 7101)',
      startedAt: startedAtIso,
      warmed: 0,
      failed: 0,
      results: [],
    }
    console.log('[warm-sitemaps] skipped:', JSON.stringify(body))
    return new Response(JSON.stringify(body, null, 2), {
      // 200, not 500: a deliberate skip is correct behaviour, not a failure.
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }

  const results: Array<{
    cls: string
    ok: boolean
    status: number | null
    urls: number | null
    ms: number
    error?: string
  }> = []

  // Sequential and IN-PROCESS. The first call builds the universe; the other
  // four reuse it through the module memo, which only works because all five
  // run inside this one invocation. Do not turn this back into fetch().
  for (const cls of SITEMAP_CLASSES) {
    const startedAt = Date.now()
    try {
      const rows = await getClassRows(cls)
      results.push({ cls, ok: true, status: 200, urls: rows.length, ms: Date.now() - startedAt })
    } catch (err) {
      results.push({
        cls,
        ok: false,
        status: null,
        urls: null,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const failed = results.filter((r) => !r.ok)
  const summary = {
    skipped: false,
    startedAt: startedAtIso,
    totalMs: results.reduce((sum, r) => sum + r.ms, 0),
    warmed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  }

  // LOGGED, not only returned. The accept for SITE-54 is read off the Vercel
  // runtime log for this route on the deployed SHA — a response body Vercel
  // never records cannot answer "did the warmer complete, and with what
  // per-class counts". One line, machine-readable, every class named.
  console.log(
    '[warm-sitemaps] completed:',
    results.map((r) => `${r.cls}=${r.ok ? r.urls : 'FAILED'}@${r.ms}ms`).join(' '),
  )
  if (failed.length > 0) console.error('[warm-sitemaps] failures:', JSON.stringify(failed))

  return new Response(
    JSON.stringify(summary, null, 2),
    {
      // A failed warm is a real signal, not a silent no-op: surface it as 500 so
      // the cron shows red instead of reporting success while sitemaps are dead.
      status: failed.length > 0 ? 500 : 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    },
  )
}
