import { NextResponse } from 'next/server'
import { refreshListingYearSyncStats } from '@/lib/refresh-listing-year-sync-stats'

/** MV refresh can scan full listings; allow long runs on Pro+. */
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret?.trim()) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  return true
}

/**
 * Refreshes listing_year_finalization_stats and listing_year_on_market_finalization_stats MVs.
 * Keeps sync-status-report and admin year breakdowns fast without timing out.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refreshListingYearSyncStats()
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
