/**
 * /api/cron/on-market-reconcile: keep our for-sale and under-contract listings
 * in step with the MLS (Matt 2026-10-01: "Fix now and check daily").
 *
 * Each run sets every listing we hold as Active, Active Under Contract, Pending
 * or Coming Soon against Spark's current record, statewide, and every listing
 * Spark holds at one of those statuses against ours (lib/sync/onMarketReconcile.ts).
 * A listing Spark changed since the delta-sync cursor is left to the delta sync,
 * which records its events. The rest are re-pulled from Spark, each one's old
 * row kept first in listing_mls_repair_log (source on-market-reconcile), at most
 * MAX_REPAIRS a run, in batches that each finish their own membership and
 * episode rebuilds. No batch starts after REPAIR_BUDGET_MS; the rest are drift
 * tomorrow.
 *
 * On 2026-10-01 the first check found 1,143 listings out of step (392 in Central
 * Oregon): expired listings the MLS had extended or relisted, which the delta
 * sync skipped as finalized until 2026-09-29, and expiries and cancellations from
 * a March to May 2026 gap. More than REPAIR_ALERT_AT drifted in a repairing run
 * means the delta sync is losing updates again and queues ONE deduped ops text
 * to the owner (queueBrokerHealthAlert). It never messages a client.
 *
 * Listings Spark no longer serves at all are reported, not changed, here.
 *
 * Schedule: daily 10:47 UTC (vercel.json), ahead of the market report refresh,
 * so the report's on-market episodes read the repaired rows.
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * ?repair=0 checks without writing and without texting.
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { DAILY_ALERT_COOLDOWN_MINUTES } from '@/lib/sync/closingsReconcile'
import { reconcileOnMarket } from '@/lib/sync/onMarketReconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

/**
 * Repairs per run, and the time after which no new batch starts. A repair is
 * one expanded Spark read per 20 listings, a history fetch, a membership
 * rebuild and an episode rebuild. Basis: the first sweep on 2026-10-01
 * repaired 1,129 listings in 675 s from a cloud session, about 0.6 s each, so a
 * batch of REPAIR_BATCH (40, lib/sync/closingsReconcile.ts) takes about 24 s
 * and 400 about 240 s. A batch that
 * starts at the budget and runs five times slower still ends before the
 * function's 800 s. The cap also leaves the Spark key's rate window to the
 * delta sync that shares it.
 */
const MAX_REPAIRS = 400
const REPAIR_BUDGET_MS = 540_000
/** A healthy delta sync leaves a handful; more than this is a sync incident. */
const REPAIR_ALERT_AT = 25

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const repair = url.searchParams.get('repair') !== '0'
  const started = Date.now()
  try {
    const r = await reconcileOnMarket({
      repair,
      maxRepairs: MAX_REPAIRS,
      today: new Date().toISOString().slice(0, 10),
      deadline: started + REPAIR_BUDGET_MS,
    })
    const line =
      `on-market: Spark ${r.sparkOnMarket}, ours ${r.ourOnMarket}, drifted ${r.drift.length} ` +
      `(left to the delta sync ${r.leftToDeltaSync + r.leftAtRepair.length}), repaired ${r.repaired} (before-images logged ${r.repairLogged}), ` +
      `failed ${r.repairFailed.length}, not served by the MLS ${r.notInSpark.length}` +
      `${r.stoppedForTime ? ', stopped at the time budget' : ''}, ${((Date.now() - started) / 1000).toFixed(0)}s`
    console.log(`[on-market-reconcile] ${line}`)
    if (repair && r.drift.length > REPAIR_ALERT_AT) {
      await queueBrokerHealthAlert({
        key: 'on-market-drift',
        body: `Listings drift: ${r.drift.length} for-sale or under-contract listings disagreed with the MLS today (${r.repaired} repaired). The listing sync may be missing updates.`,
        cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
      })
    }
    return NextResponse.json({
      ok: r.repairFailed.length === 0,
      sparkOnMarket: r.sparkOnMarket,
      ourOnMarket: r.ourOnMarket,
      drifted: r.drift.length,
      leftToDeltaSync: r.leftToDeltaSync,
      leftAtRepair: r.leftAtRepair,
      stoppedForTime: r.stoppedForTime,
      repaired: r.repaired,
      repairLogged: r.repairLogged,
      repairFailed: r.repairFailed,
      notInSpark: r.notInSpark,
      log: [line],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[on-market-reconcile] failed', err)
    // A ?repair=0 check is read-only and quiet: its failure must not spend the
    // dedupe that the scheduled run's failure text needs.
    if (repair) {
      await queueBrokerHealthAlert({
        key: 'on-market-reconcile',
        body: `The daily listings check against the MLS failed: ${message.slice(0, 180)}`,
        cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
      })
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
