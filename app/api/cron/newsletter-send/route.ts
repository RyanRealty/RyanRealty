/**
 * Newsletter send-drain cron (spec §6). Drains every newsletter currently in
 * status='sending': claims queued recipients tier-by-tier as their tranche day
 * arrives, re-checks suppression + active per recipient, renders per-broker, sends
 * via Resend, and finalizes. Replaces the old in-request send loop (which could
 * time out and strand a newsletter mid-send). Idempotent + resumable — a crash
 * re-runs only the still-queued rows.
 *
 * Never throws to the cron caller (a 500 triggers a Vercel retry storm); every
 * failure is a 200 JSON status. Auth: Authorization: Bearer $CRON_SECRET.
 */
import { NextResponse } from 'next/server'
import { drainAllSending } from '@/lib/newsletter/send-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const reports = await drainAllSending()
    const totals = reports.reduce(
      (a, r) => ({ sent: a.sent + r.sent, skipped: a.skipped + r.skipped, failed: a.failed + r.failed }),
      { sent: 0, skipped: 0, failed: 0 },
    )
    return NextResponse.json({ ok: true, newsletters: reports.length, ...totals, reports })
  } catch (err) {
    console.error('[cron/newsletter-send]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'drain_failed' }, { status: 200 })
  }
}
