import { NextResponse } from 'next/server'
import { runSavedSearchAlerts, runGuestSearchAlerts } from '@/app/actions/saved-search-alerts'

/**
 * Cron endpoint to send saved-search alert emails.
 * Protect with Authorization: Bearer CRON_SECRET (same pattern as other cron routes).
 *
 * 300s budget: the guest scan can walk hundreds of rows (neighborhood-default
 * rollout) even though sends per run are capped in runGuestSearchAlerts.
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
  // neighborhood-default cohort (thousands of guest rows, mostly not-due
  // skips against a cached search result) fully cycles every day across the
  // 4x-daily cron. Emails per run stay capped inside runGuestSearchAlerts.
  const maxSearches = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? '600') || 600))
  const dryRun = url.searchParams.get('dryRun') === '1'

  // Both alert paths are now CAN-SPAM compliant (postal footer + one-click token
  // List-Unsubscribe) and FUB-tracked (?_fuid). saved_searches was empty when
  // this was enabled (2026-06-07), so there is no dormant cohort to surprise.
  const SIGNED_IN_ALERTS_ENABLED = true

  try {
    // Guest /search alerts (compliant) always run; the signed-in saved searches
    // are gated above. allSettled so a failure in one pass never discards the other.
    const emptySummary = { scanned: 0, sent: 0, skipped: 0, errors: [] as Array<{ searchId: string; error: string }> }
    const [authSettled, guestSettled] = await Promise.allSettled([
      SIGNED_IN_ALERTS_ENABLED ? runSavedSearchAlerts({ maxSearches, dryRun }) : Promise.resolve(emptySummary),
      runGuestSearchAlerts({ maxAlerts: maxSearches, dryRun }),
    ])
    const result =
      authSettled.status === 'fulfilled'
        ? authSettled.value
        : { scanned: 0, sent: 0, skipped: 0, errors: [{ searchId: 'auth', error: String(authSettled.reason) }] }
    const guest =
      guestSettled.status === 'fulfilled'
        ? guestSettled.value
        : { scanned: 0, sent: 0, skipped: 0, errors: [{ searchId: 'guest', error: String(guestSettled.reason) }] }
    return NextResponse.json({ ok: true, signedInEnabled: SIGNED_IN_ALERTS_ENABLED, ...result, guest })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
