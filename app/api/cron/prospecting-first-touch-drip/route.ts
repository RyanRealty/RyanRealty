/**
 * Prospecting first-touch drip drain.
 *
 * Weekdays from 08:00 America/Los_Angeles, send ONE queued Expired OR FSBO
 * first-touch email per DRIP_SPACING_MINUTES (TBD constant) until the queue is
 * empty. Before each send: fail-closed live-status hard-skip (verifyNotRelisted
 * + FSBO still-active probe).
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
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { drainProspectingFirstTouchDrip } from '@/lib/data/prospecting/drip-drain'
import { DRIP_SPACING_MINUTES, DRIP_TIMEZONE, DRIP_WEEKDAY_START_MINUTES } from '@/lib/data/prospecting/drip-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  try {
    const result = await drainProspectingFirstTouchDrip(new Date())
    const { ok: _ignored, ...rest } = result as { ok: boolean } & Record<string, unknown>
    return NextResponse.json({
      ok: result.ok,
      timezone: DRIP_TIMEZONE,
      weekdayStartMinutes: DRIP_WEEKDAY_START_MINUTES,
      spacingMinutes: DRIP_SPACING_MINUTES,
      spacingNote: 'TBD — Matt must confirm DRIP_SPACING_MINUTES before treating as locked',
      ...rest,
    })
  } catch (err) {
    console.error('[cron/prospecting-first-touch-drip]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'drain_failed' },
      { status: 200 },
    )
  }
}
