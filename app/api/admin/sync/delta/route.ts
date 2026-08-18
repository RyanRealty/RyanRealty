/**
 * POST: manually trigger a delta sync (super_admin only).
 *
 * Same core as GET /api/cron/sync-delta — runDeltaSync({ mode: 'execute' }).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { isSuperuserAdmin } from '@/lib/admin'
import { runDeltaSync, type ExecuteRunResult } from '@/lib/sync/deltaSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function deltaSummary(r: ExecuteRunResult): string {
  return [
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
}

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperuserAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden: super_admin only' }, { status: 403 })
    }
    if (!process.env.SPARK_API_KEY?.trim()) {
      return NextResponse.json({ error: 'SPARK_API_KEY not set' }, { status: 503 })
    }

    const r = await runDeltaSync({ mode: 'execute' })
    const summary = deltaSummary(r)

    return NextResponse.json({
      ok: r.ok,
      partial: r.partial,
      message: r.ok ? 'Delta sync completed' : 'Delta sync completed with errors',
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
  } catch (e) {
    console.error('POST /api/admin/sync/delta', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
