import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'

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
 * Recomputes reporting_cache payload for the current month for every active city
 * + the Central Oregon region. Runs daily at 03:15 UTC (after overnight delta sync).
 *
 * Calls: compute_reporting_cache_payload(geo_type, geo_name, period_type, period_start, period_end)
 *
 * Returns: { ok, ran_at, rows_refreshed: { rolling: 0, monthly: N, quarterly: 0, ytd: 0 }, duration_ms }
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const ranAt = new Date().toISOString()

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

  // Current month period_start = first day of this month
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  // Current month period_end = last day of this month
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)

  // Geos: each city by display name + region
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
