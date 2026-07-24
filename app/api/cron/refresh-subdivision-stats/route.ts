import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { refreshSubdivisionStats } from '@/lib/data/market/subdivisionStatsWrites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/refresh-subdivision-stats
 *
 * Computes + caches ytd market stats for every curated resort-community
 * subdivision (public.compute_subdivision_period_stats, city+SubdivisionName
 * scoped). Feeds getMarketStats({geoType:'subdivision'}) on /subdivisions/[slug].
 * Write-key = slugify(alias) = the page read-key. §0: every number traces to
 * listings under the canonical SFR methodology (ci:subdivision-stats-integrity).
 *
 * Schedule: daily 08:30 UTC (see vercel.json), after the city refresh.
 * Auth: Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const periodStart = url.searchParams.get('period') ?? undefined

  const startedAt = new Date().toISOString()
  const result = await refreshSubdivisionStats({ periodStart })

  return NextResponse.json({
    ok: true,
    ran_at: startedAt,
    written: result.ok,
    skipped: result.skipped,
    with_sales: result.results.filter((r) => (r.soldCount ?? 0) > 0).length,
  })
}
