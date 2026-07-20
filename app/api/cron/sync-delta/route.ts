import { NextResponse } from 'next/server'
import { runDeltaSync } from '@/lib/sync/deltaSync'

/**
 * Delta Sync Cron — runs every 15 minutes. Thin wrapper over the unified
 * delta-sync core (lib/sync/deltaSync.ts). SCOPE: non-finalized listings only.
 *
 * The core fetches listings modified since the stored cursor, upserts them,
 * records price/status history + activity events, finalizes terminal listings
 * (with full history + auxiliary hydration), fixes missing photos, refreshes
 * market pulse, and runs the expired-listing pipeline. The fetch to diff to
 * upsert to finalize logic is shared with the action lane (syncSparkListingsDelta)
 * so the two can never drift. See docs/plans/DELTA_SYNC_UNIFICATION_HANDOFF.md.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Multi-minute work (up to MAX_PAGES Spark pages + per-listing history fetches +
// photo fixes). Matches the cron-fleet convention.
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
  if (!process.env.SPARK_API_KEY?.trim()) {
    return NextResponse.json({ error: 'SPARK_API_KEY not set' }, { status: 503 })
  }

  try {
    const r = await runDeltaSync({ mode: 'execute' })

    const summary = [
      `${r.totalUpserted} listings synced`,
      `${r.newListings} new`,
      `${r.priceChanges} price changes`,
      `${r.statusChanges} status changes`,
      `${r.listingsFinalized} finalized`,
      `${r.historyRowsInserted} history rows`,
      `${r.photosFixed} photos fixed`,
      r.skippedFinalized > 0 ? `${r.skippedFinalized} skipped (already finalized)` : null,
      r.expired && r.expired.new_processed > 0
        ? `${r.expired.new_processed} expired listings processed (${r.expired.alert_emails_sent} alerts)`
        : null,
    ]
      .filter(Boolean)
      .join(', ')

    return NextResponse.json({
      ok: r.ok,
      partial: r.partial,
      summary,
      totalFetched: r.totalFetched,
      totalUpserted: r.totalUpserted,
      newListings: r.newListings,
      priceChanges: r.priceChanges,
      statusChanges: r.statusChanges,
      listingsFinalized: r.listingsFinalized,
      historyRowsInserted: r.historyRowsInserted,
      photosFixed: r.photosFixed,
      skippedFinalized: r.skippedFinalized,
      pages: r.pages,
      sinceIso: r.sinceIso,
      expired: r.expired,
    })
  } catch (err) {
    console.error('[sync-delta] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delta sync failed' },
      { status: 500 },
    )
  }
}
