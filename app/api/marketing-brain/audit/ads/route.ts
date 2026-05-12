/**
 * marketing-brain: audit-ads HTTP endpoint.
 *
 * Runs the full paid Meta Ads audit and returns a structured AdsAuditReport.
 * Auth: Authorization: Bearer $CRON_SECRET (same as other brain endpoints).
 *
 * Query params:
 *   asOfDate   - optional YYYY-MM-DD. Defaults to yesterday.
 *   windowDays - optional integer. Defaults to 30.
 *
 * Returns AdsAuditReport JSON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { auditAds } from '@/lib/marketing-brain/audit-ads'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)

  // Resolve asOfDate — explicit param, else yesterday
  let asOfDate: string
  const asOfParam = url.searchParams.get('asOfDate')?.trim()
  if (asOfParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
      return NextResponse.json(
        { error: 'asOfDate must be YYYY-MM-DD' },
        { status: 400 }
      )
    }
    asOfDate = asOfParam
  } else {
    // Default: yesterday UTC
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    asOfDate = yesterday.toISOString().slice(0, 10)
  }

  // Resolve windowDays — explicit param, else 30
  let windowDays = 30
  const windowParam = url.searchParams.get('windowDays')?.trim()
  if (windowParam) {
    const parsed = parseInt(windowParam, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      return NextResponse.json(
        { error: 'windowDays must be an integer between 1 and 365' },
        { status: 400 }
      )
    }
    windowDays = parsed
  }

  try {
    const report = await auditAds(asOfDate, windowDays)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
