// cron: manual-only operator curl (not registered in vercel.json; refreshes year-finalization MVs)
import { NextResponse } from 'next/server'
import { refreshListingYearSyncStats } from '@/lib/refresh-listing-year-sync-stats'
import { requireCronAuth } from '@/lib/auth/cron-auth'

/** MV refresh can scan full listings; allow long runs on Pro+. */
export const maxDuration = 300

/**
 * Refreshes listing_year_finalization_stats and listing_year_on_market_finalization_stats MVs.
 * Keeps sync-status-report and admin year breakdowns fast without timing out.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const result = await refreshListingYearSyncStats()
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
