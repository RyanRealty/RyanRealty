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
 */
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { SITEMAP_CLASSES } from '@/lib/data/sitemap/classify'
import { getClassRows } from '@/lib/sitemap-class-rows'

// The first class pays for the whole universe build (~147s); the rest are
// in-memory filters over it.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req)
  if (unauthorized) return unauthorized

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
  return new Response(
    JSON.stringify(
      {
        warmed: results.filter((r) => r.ok).length,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
    {
      // A failed warm is a real signal, not a silent no-op: surface it as 500 so
      // the cron shows red instead of reporting success while sitemaps are dead.
      status: failed.length > 0 ? 500 : 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    },
  )
}
