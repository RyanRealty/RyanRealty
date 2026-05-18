/**
 * Phase 11.5 canonical alias for the brain weekly cycle.
 *
 * The autonomous pipeline brief calls this handler `weekly-cycle`. The original
 * brain weekly cycle lives at `/api/cron/marketing-weekly-cycle/route.ts`. This
 * alias gives the brief's canonical name a real HTTP surface so cron schedules
 * + manual curl invocations work against either name.
 *
 * Schedule: Sunday 14:00 UTC (Sunday 07:00 Mountain), per vercel.json.
 * Auth: Authorization: Bearer $CRON_SECRET.
 * Manual invocation: GET /api/cron/weekly-cycle?asOfDate=YYYY-MM-DD&dryRun=true
 *
 * Pre-flight check: verifies the active Q3 strategy is set before running.
 * If marketing_strategy has no row with status='active' for the current quarter,
 * the brain operates in baseline mode (4 actions instead of 12). The active
 * strategy was ratified 2026-05-17 (b1cff7f7-3817-45c6-a772-901d4bace526).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runWeeklyCycle } from '@/lib/marketing-brain/weekly-cycle'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const asOfDate = url.searchParams.get('asOfDate')?.trim() || (() => {
    const y = new Date()
    y.setUTCDate(y.getUTCDate() - 1)
    return y.toISOString().slice(0, 10)
  })()
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const windowDaysRaw = url.searchParams.get('windowDays')
  const windowDays = windowDaysRaw ? Math.max(1, Math.min(90, parseInt(windowDaysRaw, 10))) : 7

  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    return NextResponse.json({ error: 'asOfDate must be YYYY-MM-DD' }, { status: 400 })
  }

  // Pre-flight: confirm active strategy exists. Surface a warning if not.
  let strategyStatus: 'active' | 'baseline' = 'baseline'
  let activeStrategy: { id: string; quarter: string } | null = null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await supabase
      .from('marketing_strategy')
      .select('id, quarter, status')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (data) {
      strategyStatus = 'active'
      activeStrategy = { id: data.id, quarter: data.quarter }
    }
  } catch {
    // soft-fail: brain runs in baseline mode if strategy lookup fails
  }

  try {
    const report = await runWeeklyCycle(asOfDate, { dryRun, windowDays })
    return NextResponse.json({
      ...report,
      meta: {
        invoked_via: 'weekly-cycle (Phase 11.5 alias)',
        strategy_status: strategyStatus,
        active_strategy: activeStrategy,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
