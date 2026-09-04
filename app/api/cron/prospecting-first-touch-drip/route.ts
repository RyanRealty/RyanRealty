/**
 * Prospecting first-touch drip drain.
 *
 * Weekdays from 08:00 America/Los_Angeles, send ONE queued Expired OR FSBO
 * first-touch email per DRIP_SPACING_MINUTES (TBD constant) until the queue is
 * empty. Before each send: fail-closed live-status hard-skip (verifyNotRelisted
 * + FSBO still-active probe).
 *
 * Schedule ticks every minute; the spacing constant is the real cadence knob.
 * Do NOT switch vercel cron to a 5-minute crontab until Matt locks DRIP_SPACING_MINUTES.
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
