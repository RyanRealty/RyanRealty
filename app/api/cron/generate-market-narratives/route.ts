import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { generateNarrativesForReportGeos } from '@/lib/data/market/marketNarrativeWrites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/cron/generate-market-narratives
 *
 * Writes a deterministic, §0-safe market narrative to public.market_narratives
 * for every report city + region, for the current month. Runs after the stats
 * refresh so the narratives reflect fresh numbers. Each narrative's figures come
 * only from the geo's market_stats_cache row (linked via generated_from_stats_id)
 * plus market_pulse_live months-of-supply — never fabricated
 * (ci:market-narrative-integrity). ?period=YYYY-MM-01 overrides the month.
 *
 * Schedule: daily 08:15 UTC (see vercel.json), after refresh-market-stats (07:00).
 * Auth: Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const periodStart = url.searchParams.get('period') ?? undefined
  const periodType = url.searchParams.get('periodType') ?? undefined

  const startedAt = new Date().toISOString()
  const result = await generateNarrativesForReportGeos({ periodStart, periodType })

  return NextResponse.json({
    ok: true,
    ran_at: startedAt,
    written: result.ok,
    skipped: result.skipped,
    detail: result.results.map((r) => ({ geo: r.geoSlug, ok: r.ok, reason: r.reason ?? null })),
  })
}
