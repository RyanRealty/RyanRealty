/**
 * Prospecting first-touch drip drain.
 *
 * Weekdays from 08:00 America/Los_Angeles, send ONE queued Expired OR FSBO
 * first-touch email per DRIP_SPACING_MINUTES (HARDCODE 5) until the queue is
 * empty. Before each send: fail-closed live-status hard-skip (verifyNotRelisted
 * + FSBO still-active probe).
 *
 * Cron may tick every minute; DRIP_SPACING_MINUTES is the real cadence knob.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { drainProspectingFirstTouchDrip } from '@/lib/data/prospecting/drip-drain'
import { DRIP_SPACING_MINUTES, DRIP_TIMEZONE, DRIP_WEEKDAY_START_MINUTES } from '@/lib/data/prospecting/drip-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
