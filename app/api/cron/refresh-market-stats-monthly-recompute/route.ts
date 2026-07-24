import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/refresh-market-stats-monthly-recompute
 *
 * Weekly recompute of the last 6 calendar months for every geo to catch
 * late-arriving closings (a sale closed in March may not appear until April).
 *
 * Runs: Sunday 04:00 UTC
 *
 * Iterates: every city + region × last 6 months
 * Calls: compute_and_cache_period_stats(geo_type, geo_slug, 'monthly', period_start)
 *
 * Returns: { ok, ran_at, rows_refreshed: { rolling: 0, monthly: N, quarterly: 0, ytd: 0 }, duration_ms }
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const startMs = Date.now()
  const ranAt = new Date().toISOString()

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[refresh-market-stats-monthly-recompute] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  // §0: compute_and_cache_period_stats matches a city by lower("City")=lower(p_geo_slug)
  // and stores verbatim, so the geo_slug MUST be the lowercased SPACE form
  // (lower("City")), never slugify() (which never matches a multi-word city and
  // wrote stale stubs for La Pine/Powell Butte/Crooked River Ranch). Same as the
  // sibling refresh-market-stats route. ci:market-city-slug-canon holds both.
  const citySlugs = MARKET_REPORT_DEFAULT_CITIES.map((name) => name.toLowerCase())

  // All geos: cities + region
  const geoEntries: Array<{ geo_type: string; geo_slug: string }> = [
    ...citySlugs.map((slug) => ({ geo_type: 'city', geo_slug: slug })),
    { geo_type: 'region', geo_slug: 'central-oregon' },
  ]

  // Last 6 calendar months (n=1 is last month, n=6 is six months ago)
  const now = new Date()
  const monthStarts: string[] = []
  for (let n = 1; n <= 6; n++) {
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1)
    monthStarts.push(d.toISOString().slice(0, 10))
  }

  let monthlyCount = 0

  for (const periodStart of monthStarts) {
    for (const { geo_type, geo_slug } of geoEntries) {
      const { error } = await supabase.rpc('compute_and_cache_period_stats', {
        p_geo_type: geo_type,
        p_geo_slug: geo_slug,
        p_period_type: 'monthly',
        p_period_start: periodStart,
      })

      if (error) {
        console.error(
          `[refresh-market-stats-monthly-recompute] compute_and_cache_period_stats ${geo_slug} ${periodStart} error:`,
          error.message
        )
        return NextResponse.json(
          {
            ok: false,
            error: `compute_and_cache_period_stats(monthly,${geo_slug},${periodStart}): ${error.message}`,
          },
          { status: 500 }
        )
      }
      monthlyCount++
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: ranAt,
    rows_refreshed: {
      rolling: 0,
      monthly: monthlyCount,
      quarterly: 0,
      ytd: 0,
    },
    duration_ms: Date.now() - startMs,
  })
}
