import { NextResponse } from 'next/server'
import { provisionNeighborhoodDefaultSubscriptions } from '@/lib/data/crm/neighborhoodDefaultSubscriptions'

/**
 * MANUAL-TRIGGER ONLY (not scheduled in vercel.json) — Matt directive
 * 2026-07-06: assignment of contacts to these defaults is Matt's call, so this
 * endpoint never runs automatically.
 *
 * When invoked it provisions the DEFAULT saved search + market report for every
 * contact on a CRM neighborhood list (crm_people.neighborhood_slug).
 * Insert-only + idempotent (never re-activates an unsubscribed alert, never
 * overwrites an existing report subscription).
 *
 * Safety: dry-run by default. A live run requires BOTH confirm=1 and dryRun=0.
 * Protect with Authorization: Bearer CRON_SECRET (same pattern as other crons).
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
  const maxEnrollments = Math.min(
    20000,
    Math.max(1, Number(url.searchParams.get('limit') ?? '3000') || 3000),
  )
  // Live enrollment must be explicitly requested twice over; anything else is a dry run.
  const dryRun = !(url.searchParams.get('confirm') === '1' && url.searchParams.get('dryRun') === '0')

  try {
    const summary = await provisionNeighborhoodDefaultSubscriptions({ maxEnrollments, dryRun })
    return NextResponse.json({ ok: summary.errors.length === 0, dryRun, ...summary })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
