/**
 * /api/cron/listing-status-reconcile: keep what is on the market here in step
 * with the MLS.
 *
 * Each run (lib/sync/closingsReconcile.ts reconcileListingStatus) sets every
 * listing Spark holds on the market, every listing we hold on the market, and
 * our Expired/Withdrawn/Canceled rows whose status changed in the last 120 days
 * against each other by key, on the facts a statistic reads. Drifted rows are
 * re-pulled from Spark through the closings repair path: old values kept first
 * in listing_mls_repair_log (source 'status-reconcile'), the delta sync's own
 * mapper, history replaced, terminal rows re-frozen, non-terminal rows left
 * unfrozen so the delta sync follows them again.
 *
 * Why it exists (2026-09-30): until that day's deploy the delta sync skipped
 * every finalized row, so a listing that expired and came back on the market
 * under the same key kept reading Expired here, and the expired-listing outreach
 * could solicit a home listed again with another broker. 97 of 359 sampled
 * recent Expired/Withdrawn/Canceled rows disagreed with Spark, 80 of them on the
 * market again; 74 of 552 outreach targets had their own listing key on the
 * market. The delta sync now reopens such rows when Spark next touches them;
 * this sweep repairs the ones Spark will not touch again, and any drift a
 * future sync fault leaves behind.
 *
 * Repairs are capped per run (MAX_REPAIRS) so one bad day cannot spend the
 * shared Spark key or the function's 800 s; the rest is still drift tomorrow.
 * More than DRIFT_ALERT_AT drifted listings in a run means the sync is losing
 * updates again and queues ONE deduped ops text to the owner through
 * queueBrokerHealthAlert (the internal channel market-report-refresh uses). It
 * never messages a client.
 *
 * Schedule: daily 10:41 UTC (vercel.json). Auth: requireCronAuth.
 * ?repair=0 is a dry run: it reconciles and reports, and writes and sends
 * nothing, the ops text included (a person running it by hand is reading the
 * answer already).
 */
import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { reconcileListingStatus, STATUS_RECONCILE_TERMINAL_DAYS } from '@/lib/sync/closingsReconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

/** A repair is one expanded Spark read per 20, a history fetch, a membership and an episode rebuild. */
const MAX_REPAIRS = 250
/** A healthy delta sync leaves a handful; more than this is a sync incident. */
const DRIFT_ALERT_AT = 25

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const repair = new URL(request.url).searchParams.get('repair') !== '0'
  const started = Date.now()
  try {
    const r = await reconcileListingStatus({ repair, maxRepairs: MAX_REPAIRS, terminalSinceDays: STATUS_RECONCILE_TERMINAL_DAYS })
    const pairs: Record<string, number> = {}
    for (const d of r.drift) {
      const k = `${d.ours?.status ?? '(not held)'} -> ${d.mls.status ?? '?'}`
      pairs[k] = (pairs[k] ?? 0) + 1
    }
    const summary =
      `on the market: Spark ${r.sparkOnMarket}, ours ${r.ourOnMarket}; terminal re-checked ${r.terminalChecked}; ` +
      `drifted ${r.drift.length}, repaired ${r.repaired} (before-images logged ${r.repairLogged}), failed ${r.repairFailed.length}, ` +
      `left alone as newer here ${r.skippedNewer.length}; on the market here but not served by Spark ${r.notInSpark.length}` +
      (r.refused ? `; refused: ${r.refused}` : '')
    console.log(`[listing-status-reconcile] ${summary}`)

    if (!repair) {
      // A dry run sends nothing.
    } else if (r.refused) {
      await queueBrokerHealthAlert({
        key: 'listing-status-reconcile-refused',
        body: `The MLS status check did not run today: ${r.refused.slice(0, 180)}. Spark may be down or answering empty.`,
        cooldownMinutes: 1440,
      })
    } else if (r.drift.length > DRIFT_ALERT_AT) {
      await queueBrokerHealthAlert({
        key: 'listing-status-drift',
        body: `Listing status drift: ${r.drift.length} listings disagreed with the MLS today (${r.repaired} repaired). The listing sync may be missing updates.`,
        cooldownMinutes: 1440,
      })
    }

    return NextResponse.json({
      ok: r.refused === null && r.repairFailed.length === 0,
      repair,
      summary,
      sparkOnMarket: r.sparkOnMarket,
      ourOnMarket: r.ourOnMarket,
      terminalChecked: r.terminalChecked,
      terminalSince: r.terminalSince,
      drifted: r.drift.length,
      pairs,
      repaired: r.repaired,
      repairLogged: r.repairLogged,
      repairFailed: r.repairFailed,
      skippedNewer: r.skippedNewer,
      notInSpark: r.notInSpark,
      refused: r.refused,
      seconds: Math.round((Date.now() - started) / 1000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[listing-status-reconcile] failed: ${message}`)
    if (repair) {
      await queueBrokerHealthAlert({
        key: 'listing-status-reconcile',
        body: `The MLS status check failed: ${message.slice(0, 180)}`,
        cooldownMinutes: 1440,
      })
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
