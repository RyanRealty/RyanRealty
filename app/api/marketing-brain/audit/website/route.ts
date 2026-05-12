/**
 * marketing-brain audit: website
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Query params:
 *   asOfDate   - optional YYYY-MM-DD. Defaults to today (server date).
 *   windowDays - optional integer >= 14. Defaults to 30.
 *
 * Returns WebsiteAuditReport as JSON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { auditWebsite } from '@/lib/marketing-brain/audit-website'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // asOfDate defaults to today (server local date in YYYY-MM-DD)
  let asOfDate = searchParams.get('asOfDate')?.trim() ?? ''
  if (!asOfDate) {
    asOfDate = new Date().toISOString().slice(0, 10)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    return NextResponse.json({ error: 'asOfDate must be YYYY-MM-DD' }, { status: 400 })
  }

  const windowParam = searchParams.get('windowDays')?.trim()
  let windowDays = 30
  if (windowParam) {
    const parsed = parseInt(windowParam, 10)
    if (isNaN(parsed) || parsed < 14) {
      return NextResponse.json({ error: 'windowDays must be an integer >= 14' }, { status: 400 })
    }
    windowDays = parsed
  }

  try {
    const report = await auditWebsite(asOfDate, windowDays)
    return NextResponse.json(report)
  } catch (e) {
    console.error('audit/website error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
