/**
 * Prospecting first-touch drip drain.
 *
 * Weekdays from 08:00 America/Los_Angeles, send ONE queued Expired OR FSBO
 * first-touch email per DRIP_SPACING_MINUTES (TBD constant) until the queue is
 * empty. Before each send: fail-closed live-status hard-skip (verifyNotRelisted).
 *
 * Schedule ticks every minute; the spacing constant is the real cadence knob.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { drainProspectingFirstTouchDrip } from '@/lib/data/prospecting/drip-drain'
import { DRIP_SPACING_MINUTES } from '@/lib/data/prospecting/drip-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  try {
    const result = await drainProspectingFirstTouchDrip(new Date())
    return NextResponse.json({
      ok: result.ok,
      spacingMinutes: DRIP_SPACING_MINUTES,
      spacingNote: 'TBD — Matt must confirm DRIP_SPACING_MINUTES before treating as locked',
      ...result,
    })
  } catch (err) {
    console.error('[cron/prospecting-first-touch-drip]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'drain_failed' },
      { status: 200 },
    )
  }
}
