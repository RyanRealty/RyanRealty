/**
 * Prospecting first-touch drip drain.
 *
 * Weekdays from 08:00 America/Los_Angeles, send ONE queued Expired OR FSBO
 * first-touch email per DRIP_SPACING_MINUTES (TBD constant) until the queue is
 * empty. Before each send: fail-closed live-status hard-skip (verifyNotRelisted
 * + FSBO still-active probe).
 *
 * A second queue (lib/data/prospecting/drip-sunday-drain.ts) rides this same
 * minute tick but is not the weekday drip. It cannot send before Sunday
 * 2026-10-04 08:00 America/Los_Angeles, and its rows are not status `queued`.
 *
 * Schedule ticks every minute; the spacing constant is the real cadence knob.
 * Do NOT switch vercel cron to a 5-minute crontab until Matt locks spacing.
 * Each tick first settles any send whose function died mid-flight, and stands
 * down while another send holds a fresh claim (lib/data/prospecting/drip-drain.ts).
 *
 * maxDuration: one send is a whole CMA send (live MLS check, CRM lead,
 * suppression, claim, Chromium PDF render, ~7 MB Gmail message). At 60 s the
 * first real run timed out mid-send (2026-09-29 22:54 UTC). 300 matches every
 * other CMA send path; see DRIP_ROUTE_MAX_DURATION_S, which route.test.ts pins
 * to the literal below (Next reads it statically, so it cannot be imported).
 * The PDF render stack is traced into this function by next.config.ts
 * (PDF_SEND_TRACE_ROUTES, held by ci:pdf-trace-guard).
 *
 * One run at a time, by lease. The drain's in-flight read happens before this
 * run's own claim, so two overlapping ticks could each pass it, and each email
 * a different owner seconds apart with neither 5-minute gap honored (review of
 * the 2026-09-29 fix). crm_try_cron_lease is an atomic upsert: exactly one
 * caller gets true. The lease outlives maxDuration, so a run the platform
 * killed still holds it until it is certainly gone. A lease read that fails
 * sends nothing.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { drainProspectingFirstTouchDrip } from '@/lib/data/prospecting/drip-drain'
import { drainSundayFirstTouchQueue } from '@/lib/data/prospecting/drip-sunday-drain'
import {
  DRIP_LEASE_NAME,
  DRIP_LEASE_SECONDS,
  DRIP_SPACING_MINUTES,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
  SUNDAY_QUEUE_OPENS_AT_ISO,
} from '@/lib/data/prospecting/drip-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const sb = createServiceClient()
  const { data: gotLease, error: leaseError } = await sb.rpc('crm_try_cron_lease', {
    p_name: DRIP_LEASE_NAME,
    p_lease_seconds: DRIP_LEASE_SECONDS,
  })
  if (leaseError) {
    console.error('[cron/prospecting-first-touch-drip] lease read failed, sending nothing:', leaseError.message)
    return NextResponse.json({ ok: false, error: 'lease_failed' }, { status: 200 })
  }
  if (gotLease !== true) {
    return NextResponse.json({ ok: true, action: 'busy', reason: 'lease' })
  }
  try {
    const now = new Date()
    const result = await drainProspectingFirstTouchDrip(now)
    // Sunday queue is a separate FIFO (status sunday-queue, own open instant).
    // This tick is only the clock. Skip it when the weekday drain already sent
    // or is still inside a claim, so one invocation still sends at most one email.
    const weekdayOwnsTick =
      !result.ok || result.action === 'sent' || result.action === 'busy' || result.action === 'recovered'
    const sundayQueue = weekdayOwnsTick ? null : await drainSundayFirstTouchQueue(now)
    const { ok: _ignored, ...rest } = result as { ok: boolean } & Record<string, unknown>
    return NextResponse.json({
      ok: result.ok,
      timezone: DRIP_TIMEZONE,
      weekdayStartMinutes: DRIP_WEEKDAY_START_MINUTES,
      spacingMinutes: DRIP_SPACING_MINUTES,
      spacingNote: 'TBD — Matt must confirm DRIP_SPACING_MINUTES before treating as locked',
      sundayQueueOpensAt: SUNDAY_QUEUE_OPENS_AT_ISO,
      sundayQueueSpacingMinutes: DRIP_SPACING_MINUTES,
      sundayQueue,
      ...rest,
    })
  } catch (err) {
    console.error('[cron/prospecting-first-touch-drip]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'drain_failed' },
      { status: 200 },
    )
  } finally {
    await sb.rpc('crm_release_cron_lease', { p_name: DRIP_LEASE_NAME }).then(
      ({ error }) => {
        if (error) console.error('[cron/prospecting-first-touch-drip] lease release failed:', error.message)
      },
      (e: unknown) => console.error('[cron/prospecting-first-touch-drip] lease release failed:', e),
    )
  }
}
