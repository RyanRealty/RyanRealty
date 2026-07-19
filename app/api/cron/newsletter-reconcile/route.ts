/**
 * Newsletter reconcile cron (spec §6 step 4). A tranched issue legitimately stays
 * status='sending' for ~5-7 days (future-tier rows are still queued), so this does
 * NOT finalize on elapsed time. It finalizes to sent/failed only when no queued or
 * in-flight rows remain, resets crashed claims (rows stuck 'sending') back to
 * queued, and flags a STALL when queued rows whose tranche day has passed have not
 * sent — a real stuck drain, distinct from normal waiting for the next day.
 *
 * Never throws to the cron caller. Auth: Authorization: Bearer $CRON_SECRET.
 */
import { NextResponse } from 'next/server'
import { reconcileSending } from '@/lib/newsletter/send-queue'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  try {
    const reports = await reconcileSending()
    const stalled = reports.filter((r) => r.action === 'stalled')
    return NextResponse.json({ ok: true, checked: reports.length, stalled: stalled.length, reports })
  } catch (err) {
    console.error('[cron/newsletter-reconcile]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'reconcile_failed' }, { status: 200 })
  }
}
