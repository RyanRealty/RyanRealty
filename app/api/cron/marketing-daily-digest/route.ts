/**
 * marketing-brain daily-digest cron route.
 *
 * Composes a daily summary of brain activity (pending action rows by
 * category, recent approvals/executions, voice failures) and writes a
 * single `comms:matt_summary` row to `marketing_brain_actions`. The
 * comms-matt-alert producer picks it up and delivers via email +
 * dashboard_card (or iMessage when forceImessage=1).
 *
 * Schedule: daily 14:00 UTC (07:00 PT in summer, 06:00 PT in winter).
 * Configured in vercel.json.
 *
 * Manual invocation: GET /api/cron/marketing-daily-digest
 *   ?asOfDate=YYYY-MM-DD&dryRun=true&forceImessage=true
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runDailyDigest } from '@/lib/marketing-brain/daily-digest'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const asOfDate = url.searchParams.get('asOfDate')?.trim() || new Date().toISOString().slice(0, 10)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const forceImessage = url.searchParams.get('forceImessage') === 'true'

  try {
    const report = await runDailyDigest({ asOfDate, dryRun, forceImessage })
    return NextResponse.json(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('marketing-daily-digest:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
