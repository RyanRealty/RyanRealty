/**
 * CRM market-report send cron — fires due market-report subscriptions on cadence
 * (Wave 8).
 *
 * A thin auth + invoke shell over runMarketReportSend() (lib/crm/market-report-send),
 * which owns the whole per-contact path: cadence gate (isDue) -> §0-accurate data
 * (getMarketReportData, cache-only) -> render -> suppression chokepoint
 * (isSuppressed, fail-closed) -> prepare (multipart + List-Unsubscribe + CAN-SPAM)
 * -> attribute (broker + tracking) -> send -> record 'market-report' event ->
 * stamp last_sent_at so the contact is not re-sent inside their window.
 *
 * Wiring (vercel.json): this runs as a DAILY tick. It is cadence-aware — each
 * contact is only sent when their own weekly/monthly/quarterly window has elapsed
 * (per crm_report_subscriptions.frequency + last_sent_at), so a daily tick emits
 * each contact's report exactly on their chosen cadence and no more often. A
 * separate monthly entry is optional; the daily tick alone is sufficient and the
 * one that guarantees weekly subscribers go out on time.
 *
 * Bounded per run (MAX_SENDS) so it never times out; never throws to the caller —
 * every outcome is a JSON status so a Vercel retry never hits a 500.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same posture as the other CRM crons).
 */

import { NextResponse } from 'next/server'
import { runMarketReportSend } from '@/lib/crm/market-report-send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Max actual sends per invocation — chunk so one run never times out. */
const MAX_SENDS = 200
/** Max active rows to scan per invocation. */
const SCAN_LIMIT = 1000

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
    const summary = await runMarketReportSend({
      maxSends: MAX_SENDS,
      scanLimit: SCAN_LIMIT,
      runId,
    })
    return NextResponse.json({
      ok: true,
      runId,
      scanned: summary.scanned,
      due: summary.due,
      sent: summary.sent,
      skipped: summary.skipped,
      skippedByReason: summary.skippedByReason,
      duration_ms: summary.durationMs,
    })
  } catch (e) {
    // Defensive: runMarketReportSend never throws, but the shell still degrades
    // to a JSON error rather than a 500 if anything unexpected does.
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
