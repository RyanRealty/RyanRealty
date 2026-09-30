/**
 * CRM market-report send cron — fires due market-report subscriptions on cadence
 * (Wave 8).
 *
 * A thin auth + invoke shell over runMarketReportSend() (lib/crm/market-report-send),
 * which owns the whole per-contact path: the 8am to 8pm Pacific window ->
 * deleted contacts skipped -> cadence gate (isDue) -> the first-send approval
 * (held until a broker approves after a preview) -> §0-accurate data
 * (getMarketReportData) -> the freshness hold -> render -> the §0 Spark gate
 * (a STOP or an unreconciled figure holds the report and pages Matt) -> a
 * re-read of the subscription -> claim the send key for this due cycle ->
 * suppression chokepoint (her record and her address, fail-closed) -> prepare
 * (multipart + List-Unsubscribe + one CAN-SPAM footer) -> attribute (broker +
 * tracking) -> send (the send key as the idempotency key) -> record
 * 'market-report' event + the email_out timeline row -> stamp last_sent_at.
 *
 * Wiring (vercel.json): `0 4,10,16,22 * * *` UTC. Only the 16:00 and 22:00 runs
 * fall inside 8am to 8pm America/Los_Angeles (9am/3pm PDT, 8am/2pm PST); the
 * other two return outside_window without reading anything. It is
 * cadence-aware — each contact is only sent when their own
 * weekly/monthly/quarterly window has elapsed.
 *
 * Bounded per run (MAX_SENDS, and a time budget: each delivery pulls Spark, so
 * past RUN_TIME_BUDGET_MS the rest are `deferred` to the next run) so it never
 * times out; never throws to the caller — every outcome is a JSON status so a
 * Vercel retry never hits a 500.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same posture as the other CRM crons).
 */

import { NextResponse } from 'next/server'
import { runMarketReportSend } from '@/lib/crm/market-report-send'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Max actual sends per invocation — chunk so one run never times out. */
const MAX_SENDS = 200
/** Max active rows to scan per invocation. */
const SCAN_LIMIT = 1000

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

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
      outside_window: summary.outsideWindow,
      scanned: summary.scanned,
      due: summary.due,
      sent: summary.sent,
      skipped: summary.skipped,
      deferred: summary.deferred,
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
