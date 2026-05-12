/**
 * marketing-brain weekly-cycle cron route.
 *
 * Runs the full brain pass: diagnose all channels, run all four audits,
 * generate up to 10 content briefs with voice validation, persist a
 * cycle summary to marketing_decisions.
 *
 * Schedule: Sunday 02:00 UTC (Sunday 18:00 PT prior day in summer time)
 * for the weekly review window. Configured in vercel.json.
 *
 * Manual invocation: GET /api/cron/marketing-weekly-cycle
 *   ?asOfDate=YYYY-MM-DD&dryRun=true&windowDays=7
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runWeeklyCycle } from '@/lib/marketing-brain/weekly-cycle'

export const maxDuration = 300

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

  try {
    const report = await runWeeklyCycle(asOfDate, { dryRun, windowDays })
    return NextResponse.json(report)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
