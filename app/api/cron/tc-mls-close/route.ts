/**
 * /api/cron/tc-mls-close — a sale the MLS shows closed is closed in the Vault.
 *
 * Daily at 07:24 UTC, after the 06:50 SkySlope intake (which applies the same
 * rule to the deals it touches). This run covers every deal: SkySlope, in-house
 * and email-opened files alike, and it keeps running after the SkySlope
 * cutover. A sale cycle whose own MLS listing is Closed within 3 days of the
 * cycle's escrow closing date, with Ryan Realty on the sale, is recorded
 * closed on the MLS CloseDate whatever SkySlope's status says, and the deal
 * stage follows. Rules: lib/tc/mls-close.ts; docs/TC_SYSTEM.md "A sale the MLS
 * shows closed". Every write is logged first in tc_cycle_repair_log and then
 * in tc_events (actor 'mls-close'). Nothing is sent; SkySlope is not touched.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Lease: 'tc-mls-close'.
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { releaseMlsCloseLease, runMlsCloseSweep, tryTakeMlsCloseLease, writeMlsCloseRunLog } from '@/lib/data/tc/mls-close'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied
  const start = Date.now()
  if (!(await tryTakeMlsCloseLease(120))) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }
  try {
    const res = await runMlsCloseSweep({ apply: true })
    await writeMlsCloseRunLog({
      ok: res.ok,
      durationMs: Date.now() - start,
      records: res.totals.closed + res.totals.stagesUpdated,
      error: res.error ?? (res.deals.some((d) => d.errors.length) ? res.deals.flatMap((d) => d.errors).join('; ').slice(0, 500) : null),
      cycleId: randomUUID(),
    })
    return NextResponse.json(
      {
        ok: res.ok,
        error: res.error,
        dealsChecked: res.dealsChecked,
        totals: res.totals,
        closed: res.deals
          .filter((d) => d.closes.length)
          .map((d) => ({
            deal: d.dealId,
            address: d.address,
            closes: d.closes.map((c) => ({ cycle: c.cycleId, set: c.set, mls: c.evidence, outcome: c.applied?.outcome ?? null })),
            stage: d.stage,
            stageWritten: d.stageWritten,
            errors: d.errors,
          })),
        ms: Date.now() - start,
      },
      { status: res.ok ? 200 : 500 },
    )
  } finally {
    await releaseMlsCloseLease()
  }
}
