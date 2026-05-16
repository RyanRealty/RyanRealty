import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { slugify } from '@/lib/slug'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  return true // No secret = allow (dev)
}

/**
 * GET /api/cron/refresh-market-stats
 *
 * Refreshes market_stats_cache for all Central Oregon geos. Runs every 6 hours.
 *
 * Step 1 — Hot rolling windows (fast, set-based via backfill_rolling):
 *   rolling_30d, rolling_90d, rolling_365d
 *
 * Step 2 — Current month (full 30-column row via compute_and_cache_period_stats):
 *   Each city + region
 *
 * Step 3 — Current quarter + YTD for each geo.
 *
 * Returns: { ok, ran_at, rows_refreshed: { rolling, monthly, quarterly, ytd }, duration_ms }
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
    console.error('[refresh-market-stats] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const citySlugs = MARKET_REPORT_DEFAULT_CITIES.map((name) => slugify(name))

  // Pull every geo_type='neighborhood' slug from public.boundaries so resort
  // communities (Tetherow, Sunriver, Eagle Crest, Three Rivers, etc.) and Bend
  // neighborhood districts (Awbrey Butte, Larkspur, etc.) get refreshed each cycle.
  // Source: data/resort-communities.json + Bend neighborhood districts in boundaries.
  const { data: neighborhoodRows, error: nbhdErr } = await supabase
    .from('boundaries')
    .select('geo_slug')
    .eq('geo_type', 'neighborhood')
  if (nbhdErr) {
    console.error('[refresh-market-stats] failed to load neighborhood slugs:', nbhdErr.message)
    return NextResponse.json(
      { ok: false, error: `load neighborhoods: ${nbhdErr.message}` },
      { status: 500 }
    )
  }
  const neighborhoodSlugs: string[] = (neighborhoodRows ?? []).map((r) => r.geo_slug)

  // All geos: cities + region + neighborhoods (resort communities + Bend districts)
  const geoEntries: Array<{ geo_type: string; geo_slug: string }> = [
    ...citySlugs.map((slug) => ({ geo_type: 'city', geo_slug: slug })),
    { geo_type: 'region', geo_slug: 'central-oregon' },
    ...neighborhoodSlugs.map((slug) => ({ geo_type: 'neighborhood', geo_slug: slug })),
  ]

  let rollingCount = 0
  let monthlyCount = 0
  let quarterlyCount = 0
  let ytdCount = 0

  // ── Step 1: Rolling windows (backfill_rolling) ───────────────────────────
  // Compute period_start dates in JS — Supabase RPC args are values, not SQL expressions.
  function daysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  const rollingWindows: Array<{ period_type: string; period_start: string }> = [
    { period_type: 'rolling_30d', period_start: daysAgo(30) },
    { period_type: 'rolling_90d', period_start: daysAgo(90) },
    { period_type: 'rolling_365d', period_start: daysAgo(365) },
  ]

  for (const { period_type, period_start } of rollingWindows) {
    const { data, error } = await supabase.rpc('backfill_rolling', {
      p_period_type: period_type,
      p_period_start: period_start,
    })

    if (error) {
      console.error(`[refresh-market-stats] backfill_rolling ${period_type} error:`, error.message)
      return NextResponse.json(
        { ok: false, error: `backfill_rolling(${period_type}): ${error.message}` },
        { status: 500 }
      )
    }
    rollingCount += typeof data === 'number' ? data : 1

    // backfill_rolling only handles city + region (it GROUPs BY listings.City).
    // For neighborhoods (resort communities + Bend districts), call the per-geo RPC.
    for (const slug of neighborhoodSlugs) {
      const { error: nErr } = await supabase.rpc('compute_and_cache_period_stats', {
        p_geo_type: 'neighborhood',
        p_geo_slug: slug,
        p_period_type: period_type,
        p_period_start: period_start,
      })
      if (nErr) {
        console.error(
          `[refresh-market-stats] compute_and_cache_period_stats ${period_type} neighborhood/${slug} error:`,
          nErr.message
        )
        // Non-fatal: log and continue so one bad neighborhood doesn't break the whole cron
      } else {
        rollingCount++
      }
    }
  }

  // ── Step 2: Current month ────────────────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  for (const { geo_type, geo_slug } of geoEntries) {
    const { error } = await supabase.rpc('compute_and_cache_period_stats', {
      p_geo_type: geo_type,
      p_geo_slug: geo_slug,
      p_period_type: 'monthly',
      p_period_start: monthStart,
    })

    if (error) {
      console.error(
        `[refresh-market-stats] compute_and_cache_period_stats monthly ${geo_slug} error:`,
        error.message
      )
      return NextResponse.json(
        { ok: false, error: `compute_and_cache_period_stats(monthly,${geo_slug}): ${error.message}` },
        { status: 500 }
      )
    }
    monthlyCount++
  }

  // ── Step 3a: Current quarter ─────────────────────────────────────────────
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1)
    .toISOString()
    .slice(0, 10)

  for (const { geo_type, geo_slug } of geoEntries) {
    const { error } = await supabase.rpc('compute_and_cache_period_stats', {
      p_geo_type: geo_type,
      p_geo_slug: geo_slug,
      p_period_type: 'quarterly',
      p_period_start: quarterStart,
    })

    if (error) {
      console.error(
        `[refresh-market-stats] compute_and_cache_period_stats quarterly ${geo_slug} error:`,
        error.message
      )
      return NextResponse.json(
        { ok: false, error: `compute_and_cache_period_stats(quarterly,${geo_slug}): ${error.message}` },
        { status: 500 }
      )
    }
    quarterlyCount++
  }

  // ── Step 3b: YTD ─────────────────────────────────────────────────────────
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)

  for (const { geo_type, geo_slug } of geoEntries) {
    const { error } = await supabase.rpc('compute_and_cache_period_stats', {
      p_geo_type: geo_type,
      p_geo_slug: geo_slug,
      p_period_type: 'ytd',
      p_period_start: ytdStart,
    })

    if (error) {
      console.error(
        `[refresh-market-stats] compute_and_cache_period_stats ytd ${geo_slug} error:`,
        error.message
      )
      return NextResponse.json(
        { ok: false, error: `compute_and_cache_period_stats(ytd,${geo_slug}): ${error.message}` },
        { status: 500 }
      )
    }
    ytdCount++
  }

  return NextResponse.json({
    ok: true,
    ran_at: ranAt,
    rows_refreshed: {
      rolling: rollingCount,
      monthly: monthlyCount,
      quarterly: quarterlyCount,
      ytd: ytdCount,
    },
    duration_ms: Date.now() - startMs,
  })
}
