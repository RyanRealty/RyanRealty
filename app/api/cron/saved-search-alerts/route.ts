import { NextResponse } from 'next/server'
import { runListingAlerts } from '@/app/actions/saved-search-alerts'

/**
 * Cron endpoint to send listing-alert emails (ONE scan over the unified
 * public.listing_alerts table — the old dual saved_searches +
 * guest_search_alerts split is gone).
 * Protect with Authorization: Bearer CRON_SECRET (same pattern as other cron routes).
 *
 * 300s budget: the scan can walk hundreds of rows (neighborhood-default
 * rollout) even though sends per run are capped inside runListingAlerts.
 */
export const maxDuration = 300
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) {
    if (isProd) return false
    return true
  }
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  // 600-row default scan budget: large enough that the weekly-cadence
  // neighborhood-default cohort (thousands of rows, mostly not-due skips
  // against a cached search result) fully cycles every day across the
  // 4x-daily cron. Emails per run stay capped inside runListingAlerts (200).
  const maxAlerts = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? '600') || 600))
  const dryRun = url.searchParams.get('dryRun') === '1'

  try {
    const result = await runListingAlerts({ maxAlerts, dryRun })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
