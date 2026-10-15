/**
 * GET /api/cron/compute-market-metric-windows
 * Recompute the Market Truth cells that are NOT part of the daily shadow:
 * the window = 1 monthly series (city + region, neighborhood, zip) and the
 * HUD windows (closed_count_30d, new_listings_30d, median_days_to_contract_90d).
 *
 * Why this is its own route. These four functions read market_fact_sale,
 * place_membership and listings, never the daily shadow's output, yet they
 * used to run at the tail of /api/cron/refresh-sale-pricing-facts and only
 * when compute_market_metrics_shadow had returned without an error. From
 * 2026-10-12 12:20Z every run of that route lost the shadow call to the API
 * gateway's upstream timeout (the function itself finishes in the database)
 * or ran out its 300 s, so these cells were last written 2026-10-12 06:24Z.
 * getMetrics only answers from cells computed in the last 14 days (#634), so
 * they would have stopped answering on 2026-10-26 and the zip and community
 * pages would have lost their sections. Same pattern as
 * compute-neighborhood-metrics and compute-subdivision-metrics: a job that
 * must not be skipped gets its own invocation.
 *
 * Each step runs whatever happened to the one before it; the response lists
 * every step and the route answers 500 if any failed, so the failure is seen
 * and the next step still ran.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Months of window = 1 history each monthly function rewrites. */
const MONTHLY_MONTHS = 36

const WINDOW_METRIC_STEPS = [
  { step: 'monthly_city_region', fn: 'compute_market_metrics_monthly_shadow', args: { p_months: MONTHLY_MONTHS } },
  {
    step: 'monthly_neighborhood',
    fn: 'compute_market_metrics_monthly_neighborhood_shadow',
    args: { p_months: MONTHLY_MONTHS },
  },
  { step: 'monthly_zip', fn: 'compute_market_metrics_monthly_zip_shadow', args: { p_months: MONTHLY_MONTHS } },
  { step: 'hud_windows', fn: 'compute_market_metrics_hud_windows_shadow', args: undefined },
] as const

type StepResult = { step: string; ok: boolean; duration_ms: number; error?: string; result?: unknown }

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const started = Date.now()
  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[compute-market-metric-windows] init', err)
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const steps: StepResult[] = []
  for (const { step, fn, args } of WINDOW_METRIC_STEPS) {
    const stepStarted = Date.now()
    try {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) {
        console.error(`[compute-market-metric-windows] ${fn}`, error.message)
        steps.push({ step, ok: false, duration_ms: Date.now() - stepStarted, error: error.message })
      } else {
        steps.push({ step, ok: true, duration_ms: Date.now() - stepStarted, result: data })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[compute-market-metric-windows] ${fn}`, message)
      steps.push({ step, ok: false, duration_ms: Date.now() - stepStarted, error: message })
    }
  }

  const ok = steps.every((s) => s.ok)
  return NextResponse.json({ ok, steps, duration_ms: Date.now() - started }, { status: ok ? 200 : 500 })
}
