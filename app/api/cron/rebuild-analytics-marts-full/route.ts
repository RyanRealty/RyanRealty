/**
 * GET /api/cron/rebuild-analytics-marts-full
 * Weekly full rebuild of CO closed-sales annual marts from 1998.
 * Nightly last-2-years stays on /api/cron/rebuild-analytics-marts.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { assertMartFloorYear, MART_FLOOR_YEAR } from '@/lib/data/analytics/getCoMarketAnnual'
import { rebuildAnalyticsMarts } from '@/lib/data/analytics/rebuildAnalyticsMarts'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const y = new Date().getUTCFullYear()
  const start = Date.now()
  try {
    const supabase = createServiceClient()
    const result = await rebuildAnalyticsMarts({ fromYear: MART_FLOOR_YEAR, toYear: y, supabase })
    const floor = await assertMartFloorYear()
    const ok = floor.ok
    return NextResponse.json(
      {
        ok,
        years: [MART_FLOOR_YEAR, y],
        duration_ms: Date.now() - start,
        floor,
        rebuilt: result.years,
      },
      { status: ok ? 200 : 500 },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
