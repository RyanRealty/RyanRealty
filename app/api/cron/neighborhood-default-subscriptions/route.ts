import { NextResponse } from 'next/server'
import { provisionNeighborhoodDefaultSubscriptions } from '@/lib/data/crm/neighborhoodDefaultSubscriptions'

/**
 * Cron: provision the DEFAULT saved search + market report for every contact on
 * a CRM neighborhood list (crm_people.neighborhood_slug) — Matt directive
 * 2026-07-06. Insert-only + idempotent (never re-activates an unsubscribed
 * alert, never overwrites an existing report subscription), so the daily run
 * simply tops up contacts who joined a list since the last pass.
 *
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
  const dryRun = url.searchParams.get('dryRun') === '1'

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
