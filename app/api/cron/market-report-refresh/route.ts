/**
 * /api/cron/market-report-refresh: keep the monthly market report's store
 * current, and keep our closed sales in step with the MLS.
 *
 * Each run:
 *   1. Closings reconciliation over the trailing 13 months
 *      (lib/sync/closingsReconcile.ts): every closing Spark holds is set against
 *      our copy on the facts a statistic reads, and drifted rows are re-pulled
 *      from Spark. The delta sync only sees a listing when Spark modifies it; a
 *      row written thin, or frozen before a later correction, comes back here.
 *      On 2026-09-25 this found about 1,100 such rows, most of them March to
 *      May 2026 closings.
 *   2. refreshReportWindow over the same 13 months (lib/market-report/pipeline.ts):
 *      sale facts pruned and refreshed, on-market episodes rebuilt, report
 *      attributes and compact copies refreshed, every period recomputed.
 *
 * Any repair is logged in the response; more than REPAIR_ALERT_AT repairs in one
 * run means the delta sync is losing closings again, and queues ONE deduped ops
 * text to the owner through queueBrokerHealthAlert (the internal channel
 * crm-health-check and crawl-probe use). It never messages a client.
 *
 * Schedule: daily 11:17 UTC (vercel.json), ahead of the monthly publish run.
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * ?repair=0 reconciles without writing repairs.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { addMonths } from '@/lib/market-report/format'
import { lastCompleteMonth, refreshReportWindow } from '@/lib/market-report/pipeline'
import { reconcileClosings } from '@/lib/sync/closingsReconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

/** Trailing months reconciled and recomputed each run. */
const WINDOW_MONTHS = 13
/** Repairs capped per run so one bad day cannot spend the whole Spark rate window. */
const MAX_REPAIRS = 400
/** A healthy delta sync leaves a handful; more than this is a sync incident. */
const REPAIR_ALERT_AT = 25

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const repair = url.searchParams.get('repair') !== '0'
  const started = Date.now()
  const log: string[] = []
  const say = (line: string) => {
    log.push(`${((Date.now() - started) / 1000).toFixed(0)}s ${line}`)
    console.log(`[market-report-refresh] ${line}`)
  }

  const lastMonth = lastCompleteMonth()
  const fromMonth = addMonths(lastMonth, -(WINDOW_MONTHS - 1))
  const windowStart = `${fromMonth}-01`

  try {
    const recon = await reconcileClosings({ from: windowStart, to: isoDay(new Date()), repair, maxRepairs: MAX_REPAIRS })
    say(
      `closings ${windowStart}..today: Spark ${recon.sparkClosings}, ours ${recon.ourClosedInWindow}, drifted ${recon.drift.length}, repaired ${recon.repaired}, failed ${recon.repairFailed.length}, not in Spark ${recon.notInSpark.length}`,
    )
    if (recon.drift.length > REPAIR_ALERT_AT) {
      await queueBrokerHealthAlert({
        key: 'closings-drift',
        body: `Closings drift: ${recon.drift.length} closed sales in the last ${WINDOW_MONTHS} months disagreed with the MLS today (${recon.repaired} repaired). The listing sync may be missing updates.`,
        cooldownMinutes: 1440,
      })
    }

    const repairedKeys = recon.drift.map((d) => d.key).filter((k) => !recon.repairFailed.includes(k))
    const refreshed = await refreshReportWindow({
      fromMonth,
      toMonth: lastMonth,
      spanSince: isoDay(new Date(Date.now() - 7 * 86_400_000)),
      attributesSince: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      repairedKeys: repair ? repairedKeys.slice(0, MAX_REPAIRS) : [],
      log: say,
    })

    return NextResponse.json({
      ok: refreshed.periodErrors.length === 0,
      window: { from: fromMonth, to: lastMonth },
      closings: {
        spark: recon.sparkClosings,
        ours: recon.ourClosedInWindow,
        drifted: recon.drift.length,
        repaired: recon.repaired,
        repairFailed: recon.repairFailed,
        notInSpark: recon.notInSpark,
      },
      refreshed,
      log,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    say(`failed: ${message}`)
    await queueBrokerHealthAlert({
      key: 'market-report-refresh',
      body: `The market report refresh failed: ${message.slice(0, 180)}`,
      cooldownMinutes: 1440,
    })
    return NextResponse.json({ ok: false, error: message, log }, { status: 500 })
  }
}
