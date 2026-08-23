/**
 * GET /api/cron/rebuild-analytics-marts
 * Rebuilds CO closed-sales annual marts for current + prior calendar year.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { assertMartFloorYear } from '@/lib/data/analytics/getCoMarketAnnual'
import { rebuildAnalyticsMarts } from '@/lib/data/analytics/rebuildAnalyticsMarts'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const y = new Date().getUTCFullYear()
  const start = Date.now()
  try {
    const supabase = createServiceClient()
    const result = await rebuildAnalyticsMarts({ fromYear: y - 1, toYear: y, supabase })
    const floor = await assertMartFloorYear()
    const ok = floor.ok
    return NextResponse.json(
      {
        ok,
        years: [y - 1, y],
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
