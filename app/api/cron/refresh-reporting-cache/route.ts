import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { getMarketReportData } from '@/app/actions/market-report'
import { getSalesReportCardsData } from '@/app/actions/market-reports'
import { getReportMetrics } from '@/app/actions/reports'
import { PRIMARY_CITIES } from '@/lib/cities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/refresh-reporting-cache
 *
 * Two responsibilities:
 *
 * 1. Recomputes the Supabase reporting_cache payload for the current month for every
 *    active city + the Central Oregon region via compute_reporting_cache_payload RPC.
 *    Runs after overnight delta sync.
 *
 * 2. Pre-warms the Next.js unstable_cache entries that /reports reads so users never
 *    hit a cold ~60s render. Calls:
 *    - getMarketReportData({}) — default cities, default 7-day window; fans out to
 *      getReportMetrics + getReportPriceBands + getReportMetricsTimeSeries per city.
 *    - getSalesReportCardsData(PRIMARY_CITIES) — sales report cards section.
 *    - getReportMetrics per MARKET_REPORT_DEFAULT_CITIES city — the default 7-day window
 *      (belt-and-suspenders: getMarketReportData already calls these, but calling directly
 *      ensures the individual cache keys are populated even if the outer call short-circuits).
 *
 * Scheduled at "0,45 * * * *" (every 45 minutes) so the 3600s revalidate never expires cold.
 *
 * Returns: { ok, ran_at, rows_refreshed, next_cache_warmed, duration_ms }
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const ranAt = new Date().toISOString()

  // ── Phase 1: Supabase reporting_cache RPC ─────────────────────────────────

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[refresh-reporting-cache] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const now = new Date()

  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)

  const geoEntries: Array<{ geo_type: string; geo_name: string }> = [
    ...MARKET_REPORT_DEFAULT_CITIES.map((name) => ({ geo_type: 'city', geo_name: name })),
    { geo_type: 'region', geo_name: 'Central Oregon' },
  ]

  let monthlyCount = 0

  for (const { geo_type, geo_name } of geoEntries) {
    const { error } = await supabase.rpc('compute_reporting_cache_payload', {
      p_geo_type: geo_type,
      p_geo_name: geo_name,
      p_period_type: 'monthly',
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })

    if (error) {
      console.error(
        `[refresh-reporting-cache] compute_reporting_cache_payload ${geo_name} error:`,
        error.message
      )
      return NextResponse.json(
        { ok: false, error: `compute_reporting_cache_payload(${geo_name}): ${error.message}` },
        { status: 500 }
      )
    }
    monthlyCount++
  }

  // ── Phase 2: Pre-warm Next.js unstable_cache entries for /reports ─────────

  const nextCacheWarmed: string[] = []
  const nextCacheErrors: string[] = []

  // 2a. getMarketReportData — default cities, default 7-day window.
  // Internally fans out to getReportMetrics + getReportPriceBands + getReportMetricsTimeSeries
  // for each city in MARKET_REPORT_DEFAULT_CITIES, populating all those cache keys.
  try {
    await getMarketReportData({})
    nextCacheWarmed.push('getMarketReportData(default-7d)')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[refresh-reporting-cache] getMarketReportData failed:', msg)
    nextCacheErrors.push(`getMarketReportData: ${msg}`)
  }

  // 2b. getSalesReportCardsData — the sales report cards shown in the /reports page.
  try {
    await getSalesReportCardsData([...PRIMARY_CITIES])
    nextCacheWarmed.push(`getSalesReportCardsData(${PRIMARY_CITIES.length} cities)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[refresh-reporting-cache] getSalesReportCardsData failed:', msg)
    nextCacheErrors.push(`getSalesReportCardsData: ${msg}`)
  }

  // 2c. getReportMetrics per city for the default 7-day window.
  // Belt-and-suspenders: getMarketReportData already triggers these, but calling directly
  // ensures the individual unstable_cache keys are populated for the exact arguments the
  // /reports page passes when no search params are present.
  const metricsEnd = now.toISOString().slice(0, 10)
  const metricsStartDate = new Date(now)
  metricsStartDate.setDate(metricsStartDate.getDate() - 7)
  const metricsStart = metricsStartDate.toISOString().slice(0, 10)

  const metricsResults = await Promise.allSettled(
    [...MARKET_REPORT_DEFAULT_CITIES].map((city) =>
      getReportMetrics(city, metricsStart, metricsEnd, null, null, {
        includeCondoTown: true,
        includeManufactured: false,
        includeAcreage: false,
      })
    )
  )

  let metricsWarmed = 0
  for (let i = 0; i < metricsResults.length; i++) {
    const result = metricsResults[i]!
    const city = MARKET_REPORT_DEFAULT_CITIES[i]!
    if (result.status === 'fulfilled') {
      metricsWarmed++
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error(`[refresh-reporting-cache] getReportMetrics(${city}) failed:`, msg)
      nextCacheErrors.push(`getReportMetrics(${city}): ${msg}`)
    }
  }
  if (metricsWarmed > 0) {
    nextCacheWarmed.push(`getReportMetrics(${metricsWarmed}/${MARKET_REPORT_DEFAULT_CITIES.length} cities, 7d)`)
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
    next_cache_warmed: nextCacheWarmed,
    next_cache_errors: nextCacheErrors.length > 0 ? nextCacheErrors : undefined,
    duration_ms: Date.now() - startMs,
  })
}
