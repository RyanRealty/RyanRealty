/**
 * marketing-brain audit: CRM (Follow Up Boss) endpoint.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Query params:
 *   asOfDate   - optional YYYY-MM-DD. Defaults to yesterday.
 *   windowDays - optional integer 1–90. Defaults to 30.
 *
 * Returns CRMAuditReport as JSON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { auditCRM } from '@/lib/marketing-brain/audit-crm'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)

  // Resolve asOfDate
  let asOfDate: string
  const asOfParam = url.searchParams.get('asOfDate')?.trim()
  if (asOfParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
      return NextResponse.json({ error: 'asOfDate must be YYYY-MM-DD' }, { status: 400 })
    }
    asOfDate = asOfParam
  } else {
    // Default to yesterday
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    asOfDate = yesterday.toISOString().slice(0, 10)
  }

  // Resolve windowDays
  let windowDays = 30
  const windowParam = url.searchParams.get('windowDays')?.trim()
  if (windowParam) {
    const parsed = parseInt(windowParam, 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 90) {
      return NextResponse.json({ error: 'windowDays must be an integer between 1 and 90' }, { status: 400 })
    }
    windowDays = parsed
  }

  try {
    const report = await auditCRM(asOfDate, windowDays)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
