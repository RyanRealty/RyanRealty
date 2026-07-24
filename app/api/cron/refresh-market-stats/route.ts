import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { cacheTag } from '@/lib/data/cache/unstable-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/refresh-market-stats
 *
 * Refreshes market_stats_cache for all Central Oregon geos. Runs every 6 hours.
 *
 * Step 1 — Rolling windows via compute_and_cache_period_stats (SFR-only):
 *   rolling_30d, rolling_90d, rolling_365d for every geo
 *
 * Step 2 — Current month (full 30-column row via compute_and_cache_period_stats):
 *   Each city + region
 *
 * Step 3 — Current quarter + YTD for each geo.
 *
 * Returns: { ok, ran_at, rows_refreshed: { rolling, monthly, quarterly, ytd }, duration_ms }
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
    console.error('[refresh-market-stats] Supabase init failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  // §0 data accuracy: compute_and_cache_period_stats matches a city by
  // `lower("City") = lower(p_geo_slug)` and STORES the row under p_geo_slug
  // verbatim (migration 20260425090000, lines 263 + 719). listings."City" is
  // the display value ("La Pine"), so the geo_slug MUST be its lowercased
  // SPACE form ("la pine") — never slugify() ("la-pine"), which never matches a
  // multi-word city and wrote stale/empty stubs for La Pine, Powell Butte, and
  // Crooked River Ranch (single-word cities matched by coincidence). This also
  // aligns with the in-DB pg_cron writer, which keys on lower("City") too, so
  // the two writers no longer diverge. ci:market-city-slug-canon holds this.
  const citySlugs = MARKET_REPORT_DEFAULT_CITIES.map((name) => name.toLowerCase())

  // Pull every geo_type='neighborhood' slug from public.boundaries so resort
  // communities (Tetherow, Sunriver, Eagle Crest, Three Rivers, etc.) and Bend
  // neighborhood districts (Awbrey Butte, Larkspur, etc.) get refreshed each cycle.
  // Source: data/resort-communities.json + Bend neighborhood districts in boundaries.
  void supabase
  const { getBoundariesByGeoType } = await import('@/lib/data')
  const neighborhoodRows = await getBoundariesByGeoType({
    geoType: 'neighborhood',
    columns: 'geo_slug',
  })
  const nbhdErr: { message?: string } | null = null
  if (nbhdErr) {
    console.error('[refresh-market-stats] failed to load neighborhood slugs:', (nbhdErr as { message?: string }).message)
    return NextResponse.json(
      { ok: false, error: `load neighborhoods: ${(nbhdErr as { message?: string }).message}` },
      { status: 500 }
    )
  }
  const neighborhoodSlugs: string[] = (neighborhoodRows ?? [])
    .map((r) => String((r as { geo_slug?: string }).geo_slug ?? ''))
    .filter((s) => s.length > 0)

  // All geos: cities + region + neighborhoods (resort communities + Bend districts)
  const geoEntries: Array<{ geo_type: string; geo_slug: string }> = [
    ...citySlugs.map((slug) => ({ geo_type: 'city', geo_slug: slug })),
    { geo_type: 'region', geo_slug: 'central-oregon' },
    ...neighborhoodSlugs.map((slug) => ({ geo_type: 'neighborhood', geo_slug: slug })),
  ]

  let rollingCount = 0
  const failedRolling: Array<{ period_type: string; geo_slug: string; error: string }> = []
  let monthlyCount = 0
  let quarterlyCount = 0
  let ytdCount = 0

  // ── Step 1: Rolling windows ──────────────────────────────────────────────
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

  // §0 METHODOLOGY: every rolling row goes through compute_and_cache_period_stats,
  // the SAME function that writes monthly/quarterly/ytd here and every row the
  // in-DB refresh_current_period_stats() writes.
  //
  // This used to call `backfill_rolling` for city + region (set-based, faster) and
  // the per-geo RPC only for neighborhoods. That was a §0 defect: backfill_rolling
  // filters ONLY StandardStatus='Closed' + CloseDate-in-window + ClosePrice>=1000 —
  // it has no PropertyType='A', no property_sub_type='Single Family Residence', no
  // polygon, and no OnMarketDate check. It therefore wrote ALL-property-type counts
  // into rows whose methodology_version still read "SFR-only", and its upsert omits
  // methodology + period_end, so the row also kept a window it never measured.
  // Bend's twelve-month sales published 2,819 against a true SFR 1,657 — 70% high —
  // beside an SFR-only months-of-supply from the pulse, i.e. one row built from two
  // different property universes. That is the exact defect class W8.1 exists to
  // remove, so the fast path is retired rather than papered over.
  //
  // period_end is passed explicitly (matching refresh_current_period_stats) so the
  // stored window is the one actually measured.
  const todayIso = new Date().toISOString().slice(0, 10)

  for (const { period_type, period_start } of rollingWindows) {
    for (const { geo_type, geo_slug } of geoEntries) {
      const { error } = await supabase.rpc('compute_and_cache_period_stats', {
        p_geo_type: geo_type,
        p_geo_slug: geo_slug,
        p_period_type: period_type,
        p_period_start: period_start,
        p_period_end: todayIso,
      })
      if (error) {
        console.error(
          `[refresh-market-stats] compute_and_cache_period_stats ${period_type} ${geo_type}/${geo_slug} error:`,
          error.message
        )
        // Non-fatal: log and continue so one bad geo doesn't break the whole cron.
        failedRolling.push({ period_type, geo_slug, error: error.message })
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

  // Per-geo errors in Steps 2, 3a, 3b are non-fatal: log and continue so a
  // single bad geo or RPC blip doesn't block the rest of the refresh. The
  // route still returns 200 with per-step counts; the failed_geos array
  // surfaces which geos missed so a follow-up cron can re-attempt them.
  // Fixed 2026-05-22 alongside the deep-audit D1 follow-up — the old
  // early-return pattern caused quarterly + ytd to stop refreshing entirely
  // once any geo in monthly errored, leaving them 6+ days stale.
  const failedGeos: Array<{ period_type: string; geo_slug: string; error: string }> = [...failedRolling]

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
      failedGeos.push({ period_type: 'monthly', geo_slug, error: error.message })
    } else {
      monthlyCount++
    }
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
      failedGeos.push({ period_type: 'quarterly', geo_slug, error: error.message })
    } else {
      quarterlyCount++
    }
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
      failedGeos.push({ period_type: 'ytd', geo_slug, error: error.message })
    } else {
      ytdCount++
    }
  }

  // §0 FRESHNESS: writing market_stats_cache is only half the job — every reader
  // goes through the DAL's 6-hour `unstable_cache` under the `market` tag, so a
  // row this run just computed is not visible until that window lapses. Worse, a
  // null cached while a row was MISSING outlives the row's creation for the full
  // 6h: that is exactly how La Pine's newly-written YTD row kept rendering as
  // em-dashes on /reports while the correct numbers sat in the table.
  // Belt-and-braces — the 6h window still bounds staleness on its own; this asks
  // for the tagged entries to drop sooner so a refresh is observable promptly.
  revalidateTag(cacheTag.market, 'max')

  return NextResponse.json({
    ok: true,
    ran_at: ranAt,
    revalidated_tag: cacheTag.market,
    rows_refreshed: {
      rolling: rollingCount,
      monthly: monthlyCount,
      quarterly: quarterlyCount,
      ytd: ytdCount,
    },
    failed_geos: failedGeos,
    failed_count: failedGeos.length,
    duration_ms: Date.now() - startMs,
  })
}
