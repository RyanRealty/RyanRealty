/**
 * GET /api/cron/compute-neighborhood-metrics
 * Shadow-compute neighborhood mt-v1 cells after place_membership.
 * Separate from refresh-sale-pricing-facts so a 300s city job cannot skip this.
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
    const { data, error } = await supabase.rpc('compute_market_metrics_neighborhood_shadow')
    if (error) {
      console.error('[compute-neighborhood-metrics]', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      marketMetricNeighborhood: data,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
