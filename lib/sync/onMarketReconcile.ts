/**
 * On-market reconciliation: every listing our copy holds as for sale or under
 * contract, set against the MLS's current record, with repair.
 *
 * The closings reconciliation (./closingsReconcile.ts) brings back sales the
 * delta sync missed; nothing brought back listings that left the market, or
 * came back to it. On 2026-10-01 a statewide dry run found 1,143 of the 8,918
 * listings Spark holds at an on-market status out of step with our copy (392
 * in Central Oregon): 441 we held as Expired that the MLS had extended or
 * relisted, 162 we held as Active that had expired, 128 canceled, 19 we lacked,
 * 21 Spark no longer serves. Most changed in the MLS before the evening of
 * 2026-09-29 (PR #376), while the delta sync skipped every finalized row
 * unconditionally, or from March to May 2026 (the gap whose closings were
 * repaired 2026-09-25). The site showed
 * the wrong homes for sale, and the monthly report counted them. Example:
 * 20260217210721118597000000, Active in our copy (MLS timestamp 2026-04-17),
 * Canceled in Spark since 2026-05-12.
 *
 *   1. Pull every listing Spark holds at an on-market status (a light select by
 *      skip token, about nine pages of 1,000 statewide) and every row we hold
 *      at one (read once, by key).
 *   2. Our keys Spark does not hold at an on-market status are looked up by key:
 *      served, they are compared like the rest; not served, they are reported.
 *   3. Compare each with our row on the facts a statistic reads; a broker's
 *      override is ours on purpose (driftAgainstOurs).
 *   4. Leave to the delta sync every listing the MLS changed since its cursor
 *      (less a margin): it records the price-drop, status and new-listing events
 *      a repair does not, and repairing first would leave it nothing to see.
 *      The repair checks again on the record it re-pulls.
 *   5. Repair the rest, status first and the longest-stale first, through the
 *      closings reconciliation's repair, REPAIR_BATCH at a time: before-image
 *      kept in listing_mls_repair_log first, row re-pulled in full, history
 *      replaced, terminal rows re-frozen, membership and on-market episodes
 *      rebuilt, all before the next batch starts. Past the caller's deadline no
 *      new batch starts, so a run cut off by its host leaves at most one batch
 *      without its rebuilds.
 *
 * A listing the MLS no longer serves is reported, never changed, here. Matt
 * ruled 2026-10-01 that it follows the removed-sales rule (whole row saved,
 * deleted on the third daily sighting, texted); that step is not built yet.
 * The daily cron is /api/cron/on-market-reconcile (Matt 2026-10-01, "Fix now
 * and check daily").
 */
import { type DriftReason } from '@/lib/sync/listingDrift'
import { restoreServedAgain } from '@/lib/sync/mlsRemovedRestore'
import {
  driftAgainstOurs,
  fetchSparkLiteByKeys,
  fetchSparkLiteWhere,
  repairListingsFromSpark,
  type ClosingDrift,
  type SparkLite,
} from '@/lib/sync/closingsReconcile'
import { getOnMarketListingRows, type ReconcileListingRow } from '@/lib/data/sync/closingsReconcile'
import { getDeltaSyncCursor } from '@/lib/data/sync/syncWrites'
import { LIVE_INVENTORY_STATUSES } from '@/lib/listing-status-public'

/** Pages of 1,000 the on-market pull may take (statewide held 8,918 on 2026-10-01). */
const MAX_ON_MARKET_PAGES = 40

/**
 * Listings per repair call. Each call finishes its own membership and episode
 * rebuilds, so a run stopped between calls leaves nothing half-applied.
 */
export const REPAIR_BATCH = 40

/**
 * A listing the MLS changed after the delta-sync cursor less this margin is the
 * delta sync's (it runs every 15 minutes); the margin covers a tick in flight.
 */
export const DELTA_SYNC_MARGIN_MS = 60 * 60 * 1000

export type OnMarketReconcileResult = {
  sparkOnMarket: number
  ourOnMarket: number
  /** Drift to repair, status and missing listings first, then the longest-stale first. */
  drift: ClosingDrift[]
  /** Drifted listings the MLS changed recently enough that the delta sync takes them. */
  leftToDeltaSync: number
  /** Listings we hold on the market that Spark no longer serves at all. */
  notInSpark: { key: string; status: string }[]
  /** Listings the MLS changed after the cutoff: never repaired here, the delta sync's. */
  deltaFrom: number
  repaired: number
  repairLogged: number
  repairFailed: string[]
  repairedKeys: string[]
  /** Picked for repair, but the re-pulled record had changed since the cutoff. */
  leftAtRepair: string[]
  /** The deadline passed with drift still to repair: it is drift on the next run. */
  stoppedForTime: boolean
}

/** Every listing Spark holds at an on-market or under-contract status, all property types. */
export async function fetchSparkOnMarket(): Promise<Map<string, SparkLite>> {
  return fetchSparkLiteWhere(
    `StandardStatus Eq ${LIVE_INVENTORY_STATUSES.map((s) => `'${s}'`).join(',')}`,
    MAX_ON_MARKET_PAGES,
    `[onMarketReconcile] the on-market pull runs past ${MAX_ON_MARKET_PAGES} pages`,
  )
}

/** Our on-market keys Spark does not hold at an on-market status: each needs a lookup by key. */
export function keysToLookUp(ours: readonly { key: string }[], sparkOnMarket: ReadonlyMap<string, unknown>): string[] {
  return ours.filter((o) => !sparkOnMarket.has(o.key)).map((o) => o.key)
}

function modifiedAt(lite: SparkLite | undefined): number {
  const t = lite && typeof lite.fields.ModificationTimestamp === 'string' ? Date.parse(lite.fields.ModificationTimestamp) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * Split drift into what this sweep repairs and what the delta sync takes, and
 * order the repair: a wrong status or a missing listing before a wrong fact,
 * then the change the MLS made longest ago first, so a cap never starves the
 * stalest rows.
 */
export function planOnMarketRepair(
  drift: readonly ClosingDrift[],
  lites: ReadonlyMap<string, SparkLite>,
  deltaFrom: number,
): { repair: ClosingDrift[]; leftToDeltaSync: number } {
  const repair: ClosingDrift[] = []
  let leftToDeltaSync = 0
  for (const d of drift) {
    if (modifiedAt(lites.get(d.key)) >= deltaFrom) leftToDeltaSync++
    else repair.push(d)
  }
  const rank = (d: ClosingDrift) => (d.reasons.includes('status') || d.reasons.includes('missing') ? 0 : 1)
  repair.sort((a, b) => rank(a) - rank(b) || modifiedAt(lites.get(a.key)) - modifiedAt(lites.get(b.key)) || a.key.localeCompare(b.key))
  return { repair, leftToDeltaSync }
}

type Found = Omit<OnMarketReconcileResult, 'repaired' | 'repairLogged' | 'repairFailed' | 'repairedKeys' | 'leftAtRepair' | 'stoppedForTime'>

/** Find every on-market listing, ours or the MLS's, where the two disagree. */
export async function findOnMarketDrift(now = Date.now()): Promise<Found> {
  const [spark, oursRows, cursorAt] = await Promise.all([fetchSparkOnMarket(), getOnMarketListingRows(), getDeltaSyncCursor()])
  const ours = oursRows.map((r) => ({ key: r.ListingKey!, status: r.StandardStatus ?? '' }))
  const lookups = keysToLookUp(ours, spark)
  const served = lookups.length > 0 ? await fetchSparkLiteByKeys(lookups) : new Map<string, SparkLite>()
  const statusOf = new Map(ours.map((o) => [o.key, o.status]))
  const notInSpark = lookups
    .filter((k) => !served.has(k))
    .map((k) => ({ key: k, status: statusOf.get(k) ?? '' }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const candidates = new Map<string, SparkLite>([...spark, ...served])
  const held = new Map<string, ReconcileListingRow>(oursRows.map((r) => [r.ListingKey!, r]))
  const drift = await driftAgainstOurs(candidates, held)
  // No cursor stored yet: the delta sync's own default window is the newest half
  // hour. A failed read throws above, never lands here.
  const cursor = cursorAt ? Date.parse(cursorAt) : now
  const deltaFrom = (Number.isFinite(cursor) ? cursor : now) - DELTA_SYNC_MARGIN_MS
  const { repair, leftToDeltaSync } = planOnMarketRepair(drift, candidates, deltaFrom)
  return { sparkOnMarket: spark.size, ourOnMarket: ours.length, drift: repair, leftToDeltaSync, notInSpark, deltaFrom }
}

/**
 * Find and, with `repair`, re-pull up to `maxRepairs` drifted listings,
 * REPAIR_BATCH at a time. No batch starts at or after `deadline` (epoch ms);
 * what is left is drift on the next run.
 */
export async function reconcileOnMarket(opts: {
  repair: boolean
  maxRepairs: number
  today: string
  deadline?: number
}): Promise<OnMarketReconcileResult> {
  if (!Number.isInteger(opts.maxRepairs) || opts.maxRepairs < 0) {
    throw new Error(`[onMarketReconcile] maxRepairs must be a whole number, got ${opts.maxRepairs}`)
  }
  const found = await findOnMarketDrift()
  const result: OnMarketReconcileResult = {
    ...found,
    repaired: 0,
    repairLogged: 0,
    repairFailed: [],
    repairedKeys: [],
    leftAtRepair: [],
    stoppedForTime: false,
  }
  if (!opts.repair || found.drift.length === 0 || opts.maxRepairs === 0) return result
  const toRepair = found.drift.slice(0, opts.maxRepairs)
  for (let i = 0; i < toRepair.length; i += REPAIR_BATCH) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      result.stoppedForTime = true
      break
    }
    const batch = toRepair.slice(i, i + REPAIR_BATCH)
    // A key Spark serves that we lack may be a sale we deleted as removed and the
    // MLS now serves again: put the saved row back first (every writer does).
    const missing = batch.filter((d) => d.reasons.includes('missing')).map((d) => d.key)
    if (missing.length > 0) await restoreServedAgain(missing)
    const r = await repairListingsFromSpark(
      batch.map((d) => d.key),
      {
        window: { from: opts.today, to: opts.today },
        reasons: new Map<string, DriftReason[]>(batch.map((d) => [d.key, d.reasons])),
        source: 'on-market-reconcile',
      },
      { leaveModifiedFrom: found.deltaFrom },
    )
    result.repaired += r.repaired
    result.repairLogged += r.repairLogged
    result.repairFailed.push(...r.failed)
    result.repairedKeys.push(...r.repairedKeys)
    result.leftAtRepair.push(...r.leftToDeltaSync)
  }
  return result
}
