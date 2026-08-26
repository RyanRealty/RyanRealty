/**
 * Weekly DNC / TCPA-litigator re-scrub.
 *
 * WHY THIS EXISTS. A check has a shelf life. crm_phone_dnc_checks treats a row
 * older than 90 days as stale, and the registry gains ~4.7M numbers a year, so a
 * one-time scrub decays into a snapshot that is quietly wrong in the direction
 * that feels safe. The §227(c) safe harbor is a PROCESS, not an event — a cron
 * is what makes it one.
 *
 * IT IS OFF UNTIL SOMEONE TURNS IT ON, ON PURPOSE. BatchData bills per number
 * answered (~$0.03), and a cron that silently spends money every week is not a
 * thing to ship by default. With DNC_SCRUB_PER_RUN unset or 0 this route does
 * nothing and says so. Set it to the number of phones to scrub per weekly run —
 * 500 is about $15/week and clears roughly 26,000 numbers a year, which covers
 * the book inside the 90-day staleness window with room to spare.
 *
 * HARD CEILING regardless of the env value: MAX_PER_RUN. A fat-fingered 50000
 * costs $15, not $1,500.
 *
 * Never throws to the cron caller — every failure returns a JSON status so a
 * Vercel retry never thunders against a 500.
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { runDncScrub } from '@/lib/crm/dnc-scrub-run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** No env value may exceed this. ~$15 at $0.03/number. */
const MAX_PER_RUN = 500

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const startMs = Date.now()

  const raw = Number(process.env.DNC_SCRUB_PER_RUN ?? 0)
  const requested = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
  if (requested === 0) {
    return NextResponse.json({
      ok: true,
      status: 'disabled',
      reason: 'DNC_SCRUB_PER_RUN is unset or 0 — this cron spends money per number and stays off until set.',
      duration_ms: Date.now() - startMs,
    })
  }
  const limit = Math.min(requested, MAX_PER_RUN)

  try {
    const res = await runDncScrub({ limit })
    return NextResponse.json({
      ok: true,
      status: res.asked === 0 ? 'nothing-due' : 'ran',
      ...res,
      // Report the spend rather than leaving it to be inferred from a log.
      approxCostUsd: Number((res.answered * 0.03).toFixed(2)),
      cappedAt: requested > MAX_PER_RUN ? MAX_PER_RUN : null,
      duration_ms: Date.now() - startMs,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
      duration_ms: Date.now() - startMs,
    })
  }
}
