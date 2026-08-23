/**
 * GET /api/cron/compute-subdivision-metrics
 * Shadow-compute subdivision mt-v1 COUNT cells (active/pending/closed).
 * REGISTRY §4: never a price statistic. Separate from city and neighborhood
 * jobs so a 300s timeout cannot wipe those cells.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const started = Date.now()
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('compute_market_metrics_subdivision_shadow')
    if (error) {
      console.error('[compute-subdivision-metrics]', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      marketMetricSubdivision: data,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
