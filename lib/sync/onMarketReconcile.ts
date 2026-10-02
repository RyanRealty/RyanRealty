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
 *      closings reconciliation's repair (repairListingsFromSpark), in batches:
 *      before-image kept in listing_mls_repair_log first, row re-pulled in
 *      full, history replaced, terminal rows re-frozen, membership and
 *      on-market episodes rebuilt, all before the next batch starts. Past the
 *      caller's deadline no new batch starts, so a run cut off by its host
 *      leaves at most one batch without its rebuilds.
 *
 * A listing we hold for sale or under contract that the MLS no longer serves at
 * all follows the removed-sales rule (Matt 2026-10-01, "Treat like removed
 * sales", "Leave them out now"), in two steps around the repair:
 *
 *   - Before it (recordAndRemoveAbsentOnMarket), on this run's fresh answer:
 *     each daily sighting is recorded in market_listing_absent_from_mls and
 *     left out of the on-market episodes at once (episode builder
 *     20261002010534); on the third sighting, 36 hours or more after the first,
 *     the listing is deleted with its whole row saved first and the owner
 *     texted (delete_mls_removed_sales with the on-market statuses,
 *     20261002010548). A Spark answer that looks like an outage records nothing.
 *   - After it (releaseServedAgainOnMarket): a recorded listing the MLS serves
 *     again is released and its episodes rebuilt from the repaired row.
 *
 * On 2026-10-01 the check found 21, 13 of them Central Oregon single-family
 * homes listed March to July 2026. The daily cron is
 * /api/cron/on-market-reconcile (Matt 2026-10-01, "Fix now and check daily").
 */
import { type DriftReason } from '@/lib/sync/listingDrift'
import { restoreServedAgain } from '@/lib/sync/mlsRemovedRestore'
import {
  absentRefusal,
  DAILY_ALERT_COOLDOWN_MINUTES,
  MLS_REMOVED_DAILY_BUDGET,
  driftAgainstOurs,
  fetchSparkLiteByKeys,
  fetchSparkLiteWhere,
  lookUpByKeys,
  absentRecordLimit,
  removeDueAbsent,
  repairListingsFromSpark,
  tellMlsRemovals,
  type ClosingDrift,
  type RemovalStep,
  type SparkLite,
} from '@/lib/sync/closingsReconcile'
import {
  clearAbsentFromMls,
  getAbsentRecords,
  getListingsForReconcile,
  getOnMarketListingRows,
  getPendingAbsentReleases,
  recordAbsentFromMls,
  recordRepairLog,
  RELEASED_SOURCE,
  setRepairLogOutcome,
  type ReconcileListingRow,
} from '@/lib/data/sync/closingsReconcile'
import { refreshMarketFactSpansForKeys } from '@/lib/data/market-report/compute'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { absentStepFailedText, type AbsentStep } from '@/lib/sync/mlsRemovedText'
import { getDeltaSyncCursor } from '@/lib/data/sync/syncWrites'
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
  notInSpark: { key: string; status: string; listNumber: string | null }[]
  /**
   * The cutoff, epoch ms: the delta-sync cursor less DELTA_SYNC_MARGIN_MS. A
   * listing the MLS changed at or after it is the delta sync's, never repaired here.
   */
  deltaFrom: number
  repaired: number
  repairLogged: number
  repairFailed: string[]
  repairedKeys: string[]
  /** Picked for repair, but the re-pulled record had changed since the cutoff. */
  leftAtRepair: string[]
  /** The deadline passed with drift still to repair: it is drift on the next run. */
  stoppedForTime: boolean
  /** The removed-sales rule for listings the MLS no longer serves; null on a run that does not repair. */
  absent: OnMarketAbsentResult | null
}

/** What the removed-sales rule did with the listings the MLS no longer serves. */
export type OnMarketAbsentResult = RemovalStep & {
  /** Sighted and recorded this run (left out of the on-market episodes). */
  recorded: number
  /** Recorded earlier, served by the MLS again, and released (episodes rebuilt here or on a later run). */
  released: number
  /** Released listings whose episodes this run rebuilt (this run's and any earlier one left pending). */
  rebuilt: number
  /** Why nothing was recorded: a Spark answer that looks like an outage. */
  refused: string | null
  /** A step other than the deletion that failed, as "<step>: <error>"; each is texted on its own. */
  stepFailures: string[]
  /** Removals and restores texted to the owner this run. */
  told: number
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

type Found = Omit<
  OnMarketReconcileResult,
  'repaired' | 'repairLogged' | 'repairFailed' | 'repairedKeys' | 'leftAtRepair' | 'stoppedForTime' | 'absent'
> & {
  /** Every row we hold at an on-market status, by key, read once (kept off the result: a Map prints as {}). */
  held: ReadonlyMap<string, ReconcileListingRow>
  /** Every drifted key, the delta sync's included: a release waits until its repair lands. */
  driftKeys: ReadonlySet<string>
}

/** Find every on-market listing, ours or the MLS's, where the two disagree. */
export async function findOnMarketDrift(now = Date.now()): Promise<Found> {
  const [spark, oursRows, cursorAt] = await Promise.all([fetchSparkOnMarket(), getOnMarketListingRows(), getDeltaSyncCursor()])
  const held = new Map<string, ReconcileListingRow>(oursRows.map((r) => [r.ListingKey!, r]))
  const lookups = keysToLookUp([...held.keys()].map((key) => ({ key })), spark)
  // A key the lookup misses is asked again on its own before it counts as not served.
  const { served, notServed } = await lookUpByKeys(lookups, absentRecordLimit(held.size))
  const notInSpark = notServed
    .map((k) => ({ key: k, status: held.get(k)?.StandardStatus ?? '', listNumber: held.get(k)?.ListNumber ?? null }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const candidates = new Map<string, SparkLite>([...spark, ...served])
  const drift = await driftAgainstOurs(candidates, held)
  // No cursor stored yet: the delta sync's own default window is the newest half
  // hour. A failed read throws above, never lands here.
  const cursor = cursorAt ? Date.parse(cursorAt) : now
  const deltaFrom = (Number.isFinite(cursor) ? cursor : now) - DELTA_SYNC_MARGIN_MS
  const { repair, leftToDeltaSync } = planOnMarketRepair(drift, candidates, deltaFrom)
  return {
    sparkOnMarket: spark.size,
    ourOnMarket: held.size,
    drift: repair,
    leftToDeltaSync,
    notInSpark,
    deltaFrom,
    held,
    driftKeys: new Set(drift.map((d) => d.key)),
  }
}

const ON_MARKET_NOUNS = { spark: 'on-market listings', ours: 'on-market listings' }

/** Record a step's failure on the result and text it, once a day per step. */
async function stepFailed(out: OnMarketAbsentResult, step: AbsentStep, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[onMarketReconcile] the ${step} step for listings the MLS removed failed`, err)
  out.stepFailures.push(`${step}: ${message}`)
  await queueBrokerHealthAlert({
    key: `mls-removed-listings-${step}-failed`,
    body: absentStepFailedText(step, message),
    cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
  })
}

/**
 * The removed-sales rule's first step for listings we hold for sale or under
 * contract that the MLS no longer serves (Matt 2026-10-01, "Treat like removed
 * sales", "Leave them out now"), the same rule as for closed sales
 * (syncAbsentFromMls in ./closingsReconcile.ts) with the on-market class:
 *
 *   1. Record each daily sighting (no close date), which leaves the listing out
 *      of the on-market episodes; its episodes are rebuilt here, since its row
 *      did not change and nothing else would.
 *   2. Delete the ones on their third sighting, within the on-market class and
 *      the same daily budget as closed sales (removeDueAbsent): more due at
 *      once deletes nothing and holds them for a person. Then text the owner.
 *
 * A Spark answer that looks like an outage records nothing (absentRefusal). A
 * failed recording deletes nothing that day; a failed rebuild does not stop the
 * deletion. Never throws: each failure is texted and the next run tries again.
 */
export async function recordAndRemoveAbsentOnMarket(
  found: Pick<Found, 'notInSpark' | 'sparkOnMarket' | 'ourOnMarket'>,
): Promise<OnMarketAbsentResult> {
  const out: OnMarketAbsentResult = {
    recorded: 0,
    released: 0,
    rebuilt: 0,
    refused: absentRefusal(found.notInSpark.length, found.sparkOnMarket, found.ourOnMarket, ON_MARKET_NOUNS),
    removed: [],
    removalHeld: null,
    held: 0,
    waiting: 0,
    removalFailed: null,
    stepFailures: [],
    told: 0,
  }
  if (out.refused) {
    await queueBrokerHealthAlert({
      key: 'on-market-absent-refused',
      body: `The listings check did not record missing listings today: ${out.refused.slice(0, 200)}. Spark may be down or answering empty.`,
      cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
    })
  }
  const toRecord = out.refused ? [] : found.notInSpark
  try {
    out.recorded = await recordAbsentFromMls(toRecord.map((x) => ({ listingKey: x.key, listNumber: x.listNumber, closeDate: null })))
  } catch (err) {
    // The deletion counts on today's sighting: without it, nothing is deleted today.
    await stepFailed(out, 'record', err)
    return out
  }
  const keys = toRecord.map((x) => x.key)
  if (keys.length > 0) {
    try {
      await refreshMarketFactSpansForKeys(keys)
    } catch (err) {
      await stepFailed(out, 'rebuild', err)
    }
  }
  Object.assign(out, await removeDueAbsent(keys, 'listing', { maxDelete: MLS_REMOVED_DAILY_BUDGET, statuses: LIVE_INVENTORY_STATUSES }))
  out.told = await tellMlsRemovals()
  return out
}

/**
 * The rule's last step, after the repair: release a recorded listing the MLS
 * serves again, and rebuild its episodes from the repaired row.
 *
 * Released: a listing we held on the market at the start of the run that this
 * run did not find missing (whatever its record's class), unless it drifted and
 * its repair has not landed (`unsettled`): that one waits a run, so its
 * episodes are never rebuilt from a row the MLS has moved on from. And an
 * on-market record whose row was off the market already, asked of Spark by
 * key; a deleted listing has no row and is never asked again. A release logs a
 * pending marker (source absent-from-mls-release) before its record goes, and
 * the marker is closed only when the episodes are rebuilt, so a rebuild cut
 * short is retried on the next run. Never throws.
 */
export async function releaseServedAgainOnMarket(
  found: Pick<Found, 'notInSpark' | 'held'>,
  unsettled: ReadonlySet<string>,
  out: OnMarketAbsentResult,
): Promise<void> {
  const missing = new Set(found.notInSpark.map((x) => x.key))
  try {
    const records = (await getAbsentRecords()).filter((r) => !missing.has(r.listingKey))
    const servedOnMarket = records
      .filter((r) => found.held.has(r.listingKey) && !unsettled.has(r.listingKey))
      .map((r) => r.listingKey)
    const offMarket = records.filter((r) => r.closeDate == null && !found.held.has(r.listingKey)).map((r) => r.listingKey)
    const rows = offMarket.length > 0 ? await getListingsForReconcile(offMarket) : new Map<string, ReconcileListingRow>()
    const ask = offMarket.filter((k) => rows.has(k))
    const servedOff = ask.length > 0 ? [...(await fetchSparkLiteByKeys(ask)).keys()] : []
    const back = [...servedOnMarket, ...servedOff]
    if (back.length > 0) {
      await recordRepairLog(
        back.map((k) => ({
          listingKey: k,
          listNumber: found.held.get(k)?.ListNumber ?? rows.get(k)?.ListNumber ?? null,
          reasons: ['served_again'],
          ours: null,
          mls: { servedAgain: true },
          windowFrom: null,
          windowTo: null,
          note: 'The MLS serves this listing again: its absent-from-MLS record is released and its on-market episodes rebuilt. Pending until they are.',
        })),
        RELEASED_SOURCE,
      )
      out.released = await clearAbsentFromMls(back)
    }
  } catch (err) {
    await stepFailed(out, 'release', err)
  }
  try {
    const pending = await getPendingAbsentReleases()
    if (pending.length > 0) {
      const r = await refreshMarketFactSpansForKeys(pending.map((p) => p.listingKey))
      const missed = new Set(r.missed)
      const done = pending.filter((p) => !missed.has(p.listingKey))
      await setRepairLogOutcome(done.map((p) => p.id), 'repaired')
      out.rebuilt = done.length
    }
  } catch (err) {
    await stepFailed(out, 'rebuild', err)
  }
}

/**
 * Find and, with `repair`, re-pull up to `maxRepairs` drifted listings. No
 * repair batch starts at or after `deadline` (epoch ms); what is left is drift
 * on the next run. A repairing run applies the removed-sales rule to the
 * listings the MLS no longer serves whatever `maxRepairs`: it records and
 * deletes before the repair, inside the time budget, and releases after it.
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
  // The rows and drift keys stay internal: the result is printed as JSON.
  const result: OnMarketReconcileResult = {
    sparkOnMarket: found.sparkOnMarket,
    ourOnMarket: found.ourOnMarket,
    drift: found.drift,
    leftToDeltaSync: found.leftToDeltaSync,
    notInSpark: found.notInSpark,
    deltaFrom: found.deltaFrom,
    repaired: 0,
    repairLogged: 0,
    repairFailed: [],
    repairedKeys: [],
    leftAtRepair: [],
    stoppedForTime: false,
    absent: null,
  }
  if (!opts.repair) return result
  result.absent = await recordAndRemoveAbsentOnMarket(found)
  const toRepair = found.drift.slice(0, opts.maxRepairs)
  if (toRepair.length > 0) {
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
      { leaveModifiedFrom: found.deltaFrom, deadline: opts.deadline },
    )
    result.repaired = r.repaired
    result.repairLogged = r.repairLogged
    result.repairFailed = r.failed
    result.repairedKeys = r.repairedKeys
    result.leftAtRepair = r.leftToDeltaSync
    result.stoppedForTime = r.unreached.length > 0
  }
  const repaired = new Set(result.repairedKeys)
  await releaseServedAgainOnMarket(found, new Set([...found.driftKeys].filter((k) => !repaired.has(k))), result.absent)
  return result
}
