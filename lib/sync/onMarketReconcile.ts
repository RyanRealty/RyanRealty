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
 * 21 Spark no longer serves. Most changed in the MLS before 2026-09-25, while
 * the delta sync skipped every finalized row unconditionally, or from March to
 * May 2026 (the gap whose closings were repaired 2026-09-25). The site showed
 * the wrong homes for sale, and the monthly report counted them. Example:
 * 20260217210721118597000000, Active in our copy (MLS timestamp 2026-04-17),
 * Canceled in Spark since 2026-05-12.
 *
 *   1. Pull every listing Spark holds at an on-market status (a light select,
 *      about nine pages of 1,000 statewide) and every key we hold at one.
 *   2. Our keys Spark does not hold at an on-market status are looked up by key:
 *      served, they are compared like the rest; not served, they are reported.
 *   3. Compare each with our row on the facts a statistic reads; a broker's
 *      override is ours on purpose (driftAgainstOurs).
 *   4. Leave to the delta sync every listing the MLS changed since its cursor
 *      (less a margin): it records the price-drop, status and new-listing events
 *      a repair does not, and repairing first would leave it nothing to see.
 *   5. Repair the rest, status first and the longest-stale first, through the
 *      closings reconciliation's repair: before-image kept in
 *      listing_mls_repair_log first, row re-pulled in full, history replaced,
 *      terminal rows re-frozen, membership and on-market episodes rebuilt.
 *
 * A listing the MLS no longer serves is reported, never changed, here. Matt
 * ruled 2026-10-01 that it follows the removed-sales rule (whole row saved,
 * deleted on the third daily sighting, texted); that step is not built yet.
 * The daily cron is /api/cron/on-market-reconcile (Matt 2026-10-01, "Fix now
 * and check daily").
 */
import { fetchSparkListingsPage } from '@/lib/spark'
import { type DriftReason } from '@/lib/sync/listingDrift'
import { restoreServedAgain } from '@/lib/sync/mlsRemovedRestore'
import {
  driftAgainstOurs,
  fetchSparkLiteByKeys,
  LITE_SELECT,
  liteFrom,
  repairListingsFromSpark,
  sparkToken,
  type ClosingDrift,
  type SparkLite,
} from '@/lib/sync/closingsReconcile'
import { getOnMarketListingKeys } from '@/lib/data/sync/closingsReconcile'
import { getSyncState } from '@/lib/data/sync/syncWrites'
import { LIVE_INVENTORY_STATUSES } from '@/lib/listing-status-public'

/** Pages of 1,000 the on-market pull may take (statewide held 8,918 on 2026-10-01). */
const MAX_ON_MARKET_PAGES = 40

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
  repaired: number
  repairLogged: number
  repairFailed: string[]
  repairedKeys: string[]
}

/** Every listing Spark holds at an on-market or under-contract status, all property types. */
export async function fetchSparkOnMarket(): Promise<Map<string, SparkLite>> {
  const out = new Map<string, SparkLite>()
  const filter = `StandardStatus Eq ${LIVE_INVENTORY_STATUSES.map((s) => `'${s}'`).join(',')}`
  for (let page = 1; ; page++) {
    const res = await fetchSparkListingsPage(sparkToken(), { page, limit: 1000, filter, select: LITE_SELECT, orderby: '+ListingKey' })
    for (const r of res.D?.Results ?? []) {
      const lite = liteFrom(r)
      if (lite) out.set(lite.key, lite)
    }
    const pages = res.D?.Pagination?.TotalPages ?? 1
    if (page >= pages) break
    if (page >= MAX_ON_MARKET_PAGES) throw new Error(`[onMarketReconcile] the on-market pull runs past ${MAX_ON_MARKET_PAGES} pages`)
  }
  return out
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

/** Find every on-market listing, ours or the MLS's, where the two disagree. */
export async function findOnMarketDrift(
  now = Date.now(),
): Promise<Omit<OnMarketReconcileResult, 'repaired' | 'repairLogged' | 'repairFailed' | 'repairedKeys'>> {
  const [spark, ours, state] = await Promise.all([fetchSparkOnMarket(), getOnMarketListingKeys(), getSyncState()])
  const lookups = keysToLookUp(ours, spark)
  const served = lookups.length > 0 ? await fetchSparkLiteByKeys(lookups) : new Map<string, SparkLite>()
  const statusOf = new Map(ours.map((o) => [o.key, o.status]))
  const notInSpark = lookups
    .filter((k) => !served.has(k))
    .map((k) => ({ key: k, status: statusOf.get(k) ?? '' }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const candidates = new Map<string, SparkLite>([...spark, ...served])
  const drift = await driftAgainstOurs(candidates)
  // No cursor yet: the delta sync's own default window is the newest half hour.
  const cursor = state?.last_delta_sync_at ? Date.parse(state.last_delta_sync_at) : now
  const { repair, leftToDeltaSync } = planOnMarketRepair(drift, candidates, (Number.isFinite(cursor) ? cursor : now) - DELTA_SYNC_MARGIN_MS)
  return { sparkOnMarket: spark.size, ourOnMarket: ours.length, drift: repair, leftToDeltaSync, notInSpark }
}

/** Find and, with `repair`, re-pull up to `maxRepairs` drifted listings (the rest are drift next run). */
export async function reconcileOnMarket(opts: { repair: boolean; maxRepairs: number; today: string }): Promise<OnMarketReconcileResult> {
  if (!Number.isInteger(opts.maxRepairs) || opts.maxRepairs < 0) {
    throw new Error(`[onMarketReconcile] maxRepairs must be a whole number, got ${opts.maxRepairs}`)
  }
  const found = await findOnMarketDrift()
  if (!opts.repair || found.drift.length === 0 || opts.maxRepairs === 0) {
    return { ...found, repaired: 0, repairLogged: 0, repairFailed: [], repairedKeys: [] }
  }
  const toRepair = found.drift.slice(0, opts.maxRepairs)
  // A key Spark serves that we lack may be a sale we deleted as removed and the
  // MLS now serves again: put the saved row back first (every writer does).
  const missing = toRepair.filter((d) => d.reasons.includes('missing')).map((d) => d.key)
  if (missing.length > 0) await restoreServedAgain(missing)
  const r = await repairListingsFromSpark(
    toRepair.map((d) => d.key),
    {
      window: { from: opts.today, to: opts.today },
      reasons: new Map<string, DriftReason[]>(toRepair.map((d) => [d.key, d.reasons])),
      source: 'on-market-reconcile',
    },
  )
  return { ...found, repaired: r.repaired, repairLogged: r.repairLogged, repairFailed: r.failed, repairedKeys: r.repairedKeys }
}
