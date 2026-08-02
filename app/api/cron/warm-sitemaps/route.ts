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
 * Warming them here means the first REAL request is always a cache hit. The
 * requests are deliberately SEQUENTIAL: firing all five at once is precisely
 * the self-contention that starved the heavy classes in the first place. The
 * in-flight dedupe in app/sitemaps/[cls]/route.ts collapses them onto one
 * shared universe build, so the first child pays for the fan-out and the
 * remaining four are cheap filters over it.
 *
 * Scheduled hourly in vercel.json to match the routes' revalidate: 3600.
 */
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { SITEMAP_CLASSES } from '@/lib/data/sitemap/classify'

// The first child in the sequence pays for the whole universe build.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
}

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req)
  if (unauthorized) return unauthorized

  const baseUrl = siteBaseUrl()
  const results: Array<{
    cls: string
    ok: boolean
    status: number | null
    urls: number | null
    ms: number
    error?: string
  }> = []

  // Sequential on purpose — see the note above. Do not Promise.all this.
  for (const cls of SITEMAP_CLASSES) {
    const startedAt = Date.now()
    try {
      const res = await fetch(`${baseUrl}/sitemaps/${cls}.xml`, {
        cache: 'no-store',
        headers: { 'user-agent': 'ryan-realty-sitemap-warmer' },
      })
      const body = res.ok ? await res.text() : ''
      results.push({
        cls,
        ok: res.ok,
        status: res.status,
        urls: res.ok ? (body.match(/<loc>/g) ?? []).length : null,
        ms: Date.now() - startedAt,
      })
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
