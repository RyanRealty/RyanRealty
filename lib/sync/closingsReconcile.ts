/**
 * Closings reconciliation: Spark × Supabase for every closing in a window,
 * with repair.
 *
 * The delta sync sees a listing only when Spark modifies it. Two kinds of row
 * never come back through it on their own: a row written thin (facts blank at
 * the moment we read it, and Spark has not touched it since), and a row frozen
 * before a later MLS correction. On 2026-09-25 Spark held 203 Bend and Redmond
 * closings from Feb-Aug 2026 that our copy lacked, mis-dated or held at an old
 * status. This sweep finds them and re-pulls them.
 *
 *   1. Pull every closing Spark holds with a close date in the window (a light
 *      select), and every key we hold as closed in the same window.
 *   2. Compare each with our row on the facts a market statistic reads
 *      (lib/sync/listingDrift.ts). Keys we count but Spark does not place in
 *      the window are looked up in Spark by key and compared the same way.
 *   3. Repair: first keep each drifted listing's before-image in
 *      listing_mls_repair_log (no listing is rewritten unless its old values
 *      are kept), then fetch it in full (the delta sync's expand), map it with
 *      the delta sync's own mapper, keep a frozen gallery where we hold more
 *      photos than the MLS now serves, upsert, replace its history, and
 *      re-freeze it when it is terminal.
 *
 * A repair writes the listing row and its history only. No activity events and
 * no status-history rows: these sales are weeks or months old, and an event
 * would announce an old sale as news.
 */
import { fetchSparkListingsPage } from '@/lib/spark'
import { DELTA_SYNC, resolveRunMortgageRate, resultToMappedRow, type SparkDeltaResult } from '@/lib/sync/deltaSync'
import { driftReasons, factsFromListingRow, factsFromSparkFields, type DriftFacts, type DriftReason } from '@/lib/sync/listingDrift'
import { mergeFrozenMedia } from '@/lib/sync/frozenMedia'
import { fetchAndInsertHistoryCore } from '@/lib/sync/fetchListingHistory'
import { isTerminalStatus } from '@/lib/sync/terminalStatus'
import {
  clearAbsentFromMls,
  deleteMlsRemovedSales,
  getAbsentFromMlsKeys,
  getUnreportedMlsRemovalNotices,
  markMlsRemovalNoticesReported,
  getClosedListingKeysInWindow,
  getListingRowsForRepairLog,
  getListingsForReconcile,
  rebuildPlaceMembershipForKeys,
  recordAbsentFromMls,
  recordRepairLog,
  setRepairLogNote,
  setRepairLogOutcome,
  type ReconcileListingRow,
  type RemovedSale,
} from '@/lib/data/sync/closingsReconcile'
import {
  getAdminOverrideFlags,
  getHeldMediaByListNumbers,
  setListingFreezeFlags,
  upsertListingRows,
} from '@/lib/data/sync/syncWrites'
import { refreshMarketFactSpansForKeys } from '@/lib/data/market-report/compute'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { heldSalesText, noticeText, removalFailedText } from '@/lib/sync/mlsRemovedText'
import { rebuildRestoredSales, restoreServedAgain } from '@/lib/sync/mlsRemovedRestore'

/**
 * History fetches run two at a time. The delta sync shares this Spark key every
 * 15 minutes, and a large repair must not spend the key's rate window for it.
 */
const REPAIR_HISTORY_CONCURRENCY = 2

export const LITE_SELECT =
  'ListingKey,ListingId,StandardStatus,MlsStatus,CloseDate,ClosePrice,ListPrice,City,PropertyType,PropertySubType,TotalLivingAreaSqFt,BuildingAreaTotal,LivingArea,ModificationTimestamp'

/** Pages of 1,000 a window may take before the pull refuses to guess (200,000 closings). */
const MAX_WINDOW_PAGES = 200

/** The facts a drift compares, as recorded for the audit trail (what a repair overwrote). */
export type DriftSnapshot = {
  status: string | null
  city: string | null
  closeDate: string | null
  closePrice: number | null
  listPrice: number | null
  subType: string | null
  sqft: number | null
}

export type ClosingDrift = {
  key: string
  listNumber: string | null
  reasons: DriftReason[]
  /** What Spark says now. */
  mls: DriftSnapshot & { propertyType: string | null }
  /** What we held before any repair: the values a repair replaces, kept so it can be audited or undone. */
  ours: DriftSnapshot | null
}

export type ClosingsReconcileResult = {
  window: { from: string; to: string }
  sparkClosings: number
  ourClosedInWindow: number
  drift: ClosingDrift[]
  /**
   * Keys we hold as closed in the window that Spark returns nothing for, even
   * looked up by key. In repair mode they are recorded in
   * market_listing_absent_from_mls, which leaves them out of every Market
   * Truth statistic (Matt 2026-09-25); with removal on, a sale found missing
   * on three daily checks is deleted from our copy (Matt 2026-09-30).
   */
  notInSpark: string[]
  /** Repair mode only: see AbsentFromMlsResult. */
  absentFromMls: AbsentFromMlsResult
  repaired: number
  /** Keys actually rewritten (their membership and episodes are rebuilt too). */
  repairedKeys: string[]
  /** Before-images kept in listing_mls_repair_log ahead of the repair. */
  repairLogged: number
  repairFailed: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
}

/**
 * What repair mode did with the closings Spark no longer serves: absences
 * recorded this run, earlier ones the MLS serves again (released), and why
 * recording was refused when the pull looked like an outage rather than a few
 * removed listings. Then, with removal on, the deletion (Matt 2026-09-30,
 * "Delete it automatically").
 */
export type AbsentFromMlsResult = {
  recorded: number
  cleared: number
  refused: string | null
  /** Sales deleted this run, each whole row kept first (listing_mls_repair_log). */
  removed: RemovedSale[]
  /** Why nothing was deleted although sales were due: over the day's budget, or an earlier hold. */
  removalHeld: 'budget' | 'hold' | null
  /** Sales held for a person's approval after this run. */
  held: number
  /** Recorded missing but not due yet (fewer than three daily sightings, or inside the 36-hour clock). */
  waiting: number
  /** Deletions and restores texted to the owner this run. */
  told: number
  /** Restored sales whose rows the daily check rebuilt this run (after the day's writes). */
  restoresRebuilt: number
  /** The deletion step's error; the run goes on, and the next one tries again. */
  removalFailed: string | null
}

const NO_ABSENT_WORK: AbsentFromMlsResult = {
  recorded: 0,
  cleared: 0,
  refused: null,
  removed: [],
  removalHeld: null,
  held: 0,
  waiting: 0,
  told: 0,
  restoresRebuilt: 0,
  removalFailed: null,
}

export type SparkLite = { key: string; listNumber: string | null; fields: Record<string, unknown> }

/** The Spark key both reconciliations read with. */
export function sparkToken(): string {
  const t = (process.env.SPARK_API_KEY ?? '').trim()
  if (!t) throw new Error('[closingsReconcile] SPARK_API_KEY is not set')
  return t
}
const token = sparkToken

export function liteFrom(result: { StandardFields?: unknown }): SparkLite | null {
  const f = (result.StandardFields ?? {}) as Record<string, unknown>
  const key = typeof f.ListingKey === 'string' ? f.ListingKey : null
  if (!key) return null
  const ln = typeof f.ListingId === 'string' ? f.ListingId : typeof f.ListNumber === 'string' ? f.ListNumber : null
  return { key, listNumber: ln, fields: f }
}

/**
 * Every listing Spark holds that matches `filter`, as lite records, all
 * property types. Read by skip token, 1,000 at a time: each page starts after
 * the last key the previous one returned, so a listing that leaves the set
 * mid-read never pushes an unread one onto a page already read, as `_page`
 * would (docs/SPARK_API_REFERENCE.md). An empty page ends the read; more than
 * `maxPages` full pages throws with `tooMany`.
 */
export async function fetchSparkLiteWhere(filter: string, maxPages: number, tooMany: string): Promise<Map<string, SparkLite>> {
  const out = new Map<string, SparkLite>()
  let skiptoken = ''
  for (let request = 1; ; request++) {
    const res = await fetchSparkListingsPage(token(), { limit: 1000, filter, select: LITE_SELECT, skiptoken })
    const results = res.D?.Results ?? []
    if (results.length === 0) break
    if (request > maxPages) throw new Error(tooMany)
    for (const r of results) {
      const lite = liteFrom(r)
      if (lite) out.set(lite.key, lite)
    }
    const next = res.D?.SkipToken
    if (!next || next === skiptoken) throw new Error(`[fetchSparkLiteWhere] Spark gave no next skip token after ${out.size} listings`)
    skiptoken = next
  }
  return out
}

/** Every closing Spark holds with a close date in [from, to], all property types. */
export async function fetchSparkClosingsInWindow(from: string, to: string): Promise<Map<string, SparkLite>> {
  return fetchSparkLiteWhere(
    `StandardStatus Eq 'Closed' And CloseDate Ge ${from} And CloseDate Le ${to}`,
    MAX_WINDOW_PAGES,
    `[closingsReconcile] ${from}..${to} runs past ${MAX_WINDOW_PAGES} pages of closings; narrow the window`,
  )
}

function keyFilter(keys: string[]): string {
  return keys.map((k) => `ListingKey Eq '${k.replace(/'/g, '')}'`).join(' Or ')
}

/** Spark's current lite record for each key (missing keys are simply absent). */
export async function fetchSparkLiteByKeys(keys: string[]): Promise<Map<string, SparkLite>> {
  const out = new Map<string, SparkLite>()
  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25)
    const res = await fetchSparkListingsPage(token(), { page: 1, limit: 25, filter: keyFilter(batch), select: LITE_SELECT })
    for (const r of res.D?.Results ?? []) {
      const lite = liteFrom(r)
      if (lite) out.set(lite.key, lite)
    }
  }
  return out
}

/** Find every closing in the window where our copy disagrees with Spark. */
export async function findClosingsDrift(
  from: string,
  to: string,
): Promise<
  Omit<
    ClosingsReconcileResult,
    'repaired' | 'repairedKeys' | 'repairLogged' | 'repairFailed' | 'historyRefreshed' | 'refinalized' | 'membershipRows' | 'absentFromMls'
  >
> {
  const [spark, ourClosed] = await Promise.all([fetchSparkClosingsInWindow(from, to), getClosedListingKeysInWindow(from, to)])
  const reverseKeys = ourClosed.filter((k) => !spark.has(k))
  const reverse = reverseKeys.length > 0 ? await fetchSparkLiteByKeys(reverseKeys) : new Map<string, SparkLite>()
  const notInSpark = reverseKeys.filter((k) => !reverse.has(k))

  const kept = await driftAgainstOurs(new Map<string, SparkLite>([...spark, ...reverse]))
  return { window: { from, to }, sparkClosings: spark.size, ourClosedInWindow: ourClosed.length, drift: kept, notInSpark }
}

/**
 * Each Spark record set against our row on the facts a statistic reads
 * (lib/sync/listingDrift.ts), in ListingKey order: the drift both
 * reconciliations repair. A broker's override of status or list price is our
 * copy on purpose, not drift (the delta sync keeps both the same way), so that
 * reason is dropped where the listing carries one.
 */
export async function driftAgainstOurs(
  candidates: ReadonlyMap<string, SparkLite>,
  /** Our rows the caller already read; only the other candidates are read here. */
  held: ReadonlyMap<string, ReconcileListingRow> = new Map(),
): Promise<ClosingDrift[]> {
  const unread = [...candidates.keys()].filter((k) => !held.has(k))
  const ours = new Map<string, ReconcileListingRow>([...held, ...(unread.length > 0 ? await getListingsForReconcile(unread) : [])])
  const drift: ClosingDrift[] = []
  for (const [key, lite] of candidates) {
    const row = ours.get(key)
    const mls = factsFromSparkFields(lite.fields)
    const held = row ? factsFromListingRow(row as unknown as Record<string, unknown>) : null
    const reasons = driftReasons(held, mls)
    if (reasons.length === 0) continue
    drift.push({
      key,
      listNumber: row?.ListNumber ?? lite.listNumber,
      reasons,
      mls: {
        ...snapshot(mls),
        propertyType: typeof lite.fields.PropertyType === 'string' ? lite.fields.PropertyType : null,
      },
      ours: held ? snapshot(held) : null,
    })
  }
  // Overrides are read only for the few candidates that could carry one.
  const overridable = drift.filter((d) => (d.reasons.includes('status') || d.reasons.includes('list_price')) && d.listNumber)
  const overrides = overridable.length > 0 ? await getAdminOverrideFlags(overridable.map((d) => d.listNumber!)) : new Map()
  const kept = drift
    .map((d) => {
      const o = d.listNumber ? overrides.get(d.listNumber) : undefined
      if (!o) return d
      return { ...d, reasons: d.reasons.filter((r) => !(r === 'status' && o.status) && !(r === 'list_price' && o.listPrice)) }
    })
    .filter((d) => d.reasons.length > 0)
  kept.sort((a, b) => a.key.localeCompare(b.key))
  return kept
}

export function snapshot(f: DriftFacts): DriftSnapshot {
  return {
    status: f.status,
    city: f.city,
    closeDate: f.closeDate,
    closePrice: f.closePrice,
    listPrice: f.listPrice,
    subType: f.subType,
    sqft: f.sqft,
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, queue.length)) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item)
    }),
  )
}

/** What a repair writes to listing_mls_repair_log beside each listing it rewrites. */
export type RepairLogContext = {
  window: { from: string; to: string }
  /** Why each key was picked: the drift reasons that selected it. */
  reasons: Map<string, DriftReason[]>
  /** The sweep that found the drift, as the repair log records it (default 'closings-reconcile'). */
  source?: string
}

/**
 * Re-pull these listings from Spark in full and write them back: row, media
 * kept where we hold more, history replaced, terminal rows re-frozen.
 *
 * Batch by batch, each listing's before-image goes to listing_mls_repair_log
 * first (Matt 2026-09-25: old values are kept so a repair can be undone): the
 * whole row as read right before the write, its statistic facts, and what
 * Spark serves. A failed log write stops the repair before that batch is
 * written. Each chunk's rows move to repaired or failed as soon as its upsert
 * answers, so an interrupted run leaves only its unconfirmed chunk pending; a
 * repaired listing whose history or re-freeze did not land gets a note.
 *
 * With `leaveModifiedFrom`, a listing whose fresh record the MLS changed at or
 * after that instant is not written: the delta sync takes it and records the
 * status, price and new-listing events a repair does not (leftToDeltaSync).
 */
export async function repairListingsFromSpark(
  keys: string[],
  log: RepairLogContext,
  opts: { leaveModifiedFrom?: number } = {},
): Promise<{
  repaired: number
  repairedKeys: string[]
  repairLogged: number
  failed: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
  leftToDeltaSync: string[]
}> {
  const unique = [...new Set(keys)]
  const leftToDeltaSync: string[] = []
  if (unique.length === 0) {
    return { repaired: 0, repairedKeys: [], repairLogged: 0, failed: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0, leftToDeltaSync }
  }
  const mortgageRate = await resolveRunMortgageRate()
  const existing = await getListingsForReconcile(unique)
  const failed: string[] = []
  let repaired = 0
  const written: { key: string; listNumber: string; status: string | null }[] = []
  const logId = new Map<string, number>()
  const idsFor = (ks: string[]) => ks.flatMap((k) => (logId.has(k) ? [logId.get(k)!] : []))
  // The listings are already written when an outcome or a note is recorded, so a
  // failed log update is reported, never allowed to stop the rest of the repair.
  const logUpdate = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      console.error(`[closingsReconcile] repair log ${what} not recorded`, err)
    }
  }

  for (let i = 0; i < unique.length; i += 20) {
    const batch = unique.slice(i, i + 20)
    const res = await fetchSparkListingsPage(token(), {
      page: 1,
      limit: 25,
      filter: keyFilter(batch),
      expand: DELTA_SYNC.EXPAND,
    })
    const results = (res.D?.Results ?? []) as SparkDeltaResult[]
    const byKey = new Map<string, SparkDeltaResult>()
    for (const r of results) {
      const k = (r.StandardFields as Record<string, unknown> | undefined)?.ListingKey
      if (typeof k === 'string') byKey.set(k, r)
    }
    const rows: Record<string, unknown>[] = []
    const served = new Map<string, Record<string, unknown>>()
    const preserve: string[] = []
    for (const key of batch) {
      const r = byKey.get(key)
      if (!r) {
        failed.push(key)
        continue
      }
      if (opts.leaveModifiedFrom !== undefined) {
        const modified = Date.parse(String((r.StandardFields as Record<string, unknown> | undefined)?.ModificationTimestamp ?? ''))
        if (Number.isFinite(modified) && modified >= opts.leaveModifiedFrom) {
          leftToDeltaSync.push(key)
          continue
        }
      }
      const row = resultToMappedRow(r, { mortgageRate })
      const listNumber = String(row.ListNumber ?? '').trim()
      if (!listNumber) {
        failed.push(key)
        continue
      }
      // Unfreeze; a terminal row re-freezes once its history is replaced below.
      row.is_finalized = false
      row.history_finalized = false
      if (existing.get(key)?.media_finalized) preserve.push(listNumber)
      rows.push(row)
      served.set(key, (r.StandardFields ?? {}) as Record<string, unknown>)
    }
    if (rows.length === 0) continue
    const held = preserve.length > 0 ? await getHeldMediaByListNumbers(preserve) : new Map()
    const merged = rows.map((row) => {
      const h = held.get(String(row.ListNumber))
      return h ? mergeFrozenMedia(row, h) : row
    })

    // The before-image, read right before the write it records.
    const before = await getListingRowsForRepairLog(merged.map((row) => String(row.ListingKey)))
    const ids = await recordRepairLog(
      merged.map((row) => {
        const key = String(row.ListingKey)
        const prior = before.get(key) ?? null
        const fields = served.get(key) ?? {}
        return {
          listingKey: key,
          listNumber: String(row.ListNumber),
          reasons: log.reasons.get(key) ?? [],
          ours: prior ? snapshot(factsFromListingRow(prior)) : null,
          beforeRow: prior,
          mls: {
            ...snapshot(factsFromSparkFields(fields)),
            propertyType: typeof fields.PropertyType === 'string' ? fields.PropertyType : null,
          },
          windowFrom: log.window.from,
          windowTo: log.window.to,
        }
      }),
      log.source,
    )
    for (const [k, id] of ids) logId.set(k, id)

    for (let j = 0; j < merged.length; j += DELTA_SYNC.UPSERT_CHUNK) {
      const chunk = merged.slice(j, j + DELTA_SYNC.UPSERT_CHUNK)
      const chunkKeys = chunk.map((row) => String(row.ListingKey ?? row.ListNumber))
      const w = await upsertListingRows(chunk)
      if (!w.ok) {
        console.error('[closingsReconcile] upsert failed', w.error)
        failed.push(...chunkKeys)
        await logUpdate('outcome', () => setRepairLogOutcome(idsFor(chunkKeys), 'failed'))
        continue
      }
      repaired += chunk.length
      for (const row of chunk) {
        written.push({
          key: String(row.ListingKey ?? row.ListNumber),
          listNumber: String(row.ListNumber),
          status: typeof row.StandardStatus === 'string' ? row.StandardStatus : null,
        })
      }
      await logUpdate('outcome', () => setRepairLogOutcome(idsFor(chunkKeys), 'repaired'))
    }
  }

  let historyRefreshed = 0
  const refreeze: { key: string; listNumber: string }[] = []
  const historyMissed: string[] = []
  await pool(written, REPAIR_HISTORY_CONCURRENCY, async (w) => {
    const h = await fetchAndInsertHistoryCore(token(), w.key)
    if (h.inserted > 0) historyRefreshed += 1
    // Re-freeze only a terminal row whose history actually landed (or had none to land).
    const historySaved = h.ok && (h.inserted > 0 || h.items.length === 0)
    if (!historySaved) historyMissed.push(w.key)
    else if (w.status && isTerminalStatus(w.status)) refreeze.push({ key: w.key, listNumber: w.listNumber })
  })
  let refinalized = 0
  if (refreeze.length > 0) {
    const r = await setListingFreezeFlags(
      refreeze.map((f) => f.listNumber),
      { is_finalized: true, history_finalized: true, history_verified_full: true },
    )
    refinalized = r.updated
    if (!r.ok) {
      console.error('[closingsReconcile] re-freeze failed', r.error)
      await logUpdate('note', () =>
        setRepairLogNote(idsFor(refreeze.map((f) => f.key)), 'Row and history rewritten; the re-freeze write failed.'),
      )
    }
  }
  if (historyMissed.length > 0) {
    await logUpdate('note', () =>
      setRepairLogNote(idsFor(historyMissed), 'Row rewritten; its history was not replaced, so it was left unfrozen.'),
    )
  }

  // Everything downstream of a listing row that a repair can move: its place
  // membership (the city can change, and the pg_cron refresh skips a row whose
  // MLS timestamp is old) and its on-market episodes (rebuilt from the history
  // just replaced). Done here, per repair, so a later step that times out never
  // leaves a repaired listing half-applied.
  const repairedKeys = written.map((w) => w.key)
  const membershipRows = repairedKeys.length > 0 ? await rebuildPlaceMembershipForKeys(repairedKeys) : 0
  if (repairedKeys.length > 0) {
    const spans = await refreshMarketFactSpansForKeys(repairedKeys)
    if (spans.missed.length > 0) console.warn(`[closingsReconcile] episodes not rebuilt for ${spans.missed.join(', ')}`)
  }
  return { repaired, repairedKeys, repairLogged: logId.size, failed, historyRefreshed, refinalized, membershipRows, leftToDeltaSync }
}

/** Absences one window may record before the pull is treated as an outage: 10, or 0.5% of our closings. */
export function absentRecordLimit(ourClosedInWindow: number): number {
  return Math.max(10, Math.ceil(ourClosedInWindow * 0.005))
}

/**
 * Closed sales the daily check may delete in one Bend calendar day (the SQL
 * function counts every deletion since midnight). The trailing 13 months held
 * three on 2026-09-30, found after a year of drift; more due at once looks like
 * a bad Spark answer, not removals, and is held for a person.
 */
export const MLS_REMOVED_DAILY_BUDGET = 10

/**
 * Record the window's closings Spark no longer serves, and release any key
 * recorded earlier, with a close date in the same window, that Spark serves
 * again. A run re-checks only its own window's keys by key, so the daily cron
 * never re-reads the whole history from Spark; an older key is re-checked when
 * its window is reconciled (scripts/closings-reconcile.ts).
 *
 * A Spark outage (an error page read as an empty result, a rejected filter)
 * would make every closing we hold look removed, and recording them would
 * drop every sale from every statistic. So nothing is recorded when Spark
 * returned no closings for the window, or when more go missing than a few
 * removed listings explain (absentRecordLimit); the caller alerts instead.
 *
 * With removal on (the daily cron), the keys just confirmed missing then go to
 * deleteMlsRemovedSales (Matt 2026-09-30: "The daily check deletes it after
 * saving the full record, and texts you what it removed"). It deletes a sale
 * found missing on three daily checks, the first 36 hours or more ago, so one
 * bad answer from Spark never deletes anything; a day's budget, or an earlier
 * hold, holds the due sales for a person instead. Then the owner is texted
 * every deletion and restore not told yet (tellMlsRemovals).
 */
async function syncAbsentFromMls(
  notInSpark: string[],
  window: { from: string; to: string; sparkClosings: number; ourClosedInWindow: number },
  removal: { remove: boolean; maxRemovals: number },
): Promise<AbsentFromMlsResult> {
  let refused: string | null = null
  if (notInSpark.length > 0 && window.sparkClosings === 0) {
    refused = `Spark returned no closings for the window while we hold ${window.ourClosedInWindow}`
  } else if (notInSpark.length > absentRecordLimit(window.ourClosedInWindow)) {
    refused = `${notInSpark.length} of our ${window.ourClosedInWindow} closings are missing from Spark, more than removed listings explain (limit ${absentRecordLimit(window.ourClosedInWindow)})`
  }
  const toRecord = refused ? [] : notInSpark
  const rows = toRecord.length > 0 ? await getListingsForReconcile(toRecord) : new Map()
  const recorded = await recordAbsentFromMls(
    toRecord.map((key) => {
      const row = rows.get(key)
      return {
        listingKey: key,
        listNumber: row?.ListNumber ?? null,
        closeDate: row ? factsFromListingRow(row as unknown as Record<string, unknown>).closeDate : null,
      }
    }),
  )
  const missing = new Set(notInSpark)
  const held = (await getAbsentFromMlsKeys({ from: window.from, to: window.to })).filter((k) => !missing.has(k))
  const back = held.length > 0 ? [...(await fetchSparkLiteByKeys(held)).keys()] : []
  const cleared = await clearAbsentFromMls(back)

  const out: AbsentFromMlsResult = { ...NO_ABSENT_WORK, recorded, cleared, refused }
  if (!removal.remove) return out

  // Called even with no key: the answer carries a standing hold. A failed
  // deletion must not stop the day's report refresh: the sales stay recorded
  // (out of Market Truth), Matt is told, and tomorrow's run tries again.
  try {
    const r = await deleteMlsRemovedSales(toRecord, { maxDelete: removal.maxRemovals, window: { from: window.from, to: window.to } })
    Object.assign(out, { removed: r.removed, removalHeld: r.refused, held: r.held, waiting: r.waiting })
    if (r.refused) {
      await queueBrokerHealthAlert({
        key: 'mls-removed-held',
        body: heldSalesText({ reason: r.refused, due: r.due, held: r.held, budget: r.budget }),
        cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[closingsReconcile] deleting MLS-removed sales failed', err)
    await queueBrokerHealthAlert({ key: 'mls-removed-failed', body: removalFailedText(message), cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES })
    out.removalFailed = message
  }
  out.told = await tellMlsRemovals()
  return out
}

/**
 * Once a day at most, for a check that runs once a day: shorter than 24 hours,
 * so a run that reaches the same step a few seconds earlier than yesterday's
 * still texts (a 1,440-minute cooldown swallowed about every other day's).
 * The daily report refresh cron uses it for its own texts too.
 */
export const DAILY_ALERT_COOLDOWN_MINUTES = 20 * 60

/**
 * Text the owner every deletion and restore of an MLS-removed sale not told yet
 * (listing_mls_repair_log.reported_at), one text per kind, then mark them told.
 * Read from the log rather than from the call that deleted them, so a deletion
 * whose response was lost, or one a person approved by hand, is still told on
 * the next run; a text that did not queue stays unmarked and is tried again.
 * Never throws. Returns how many notices were told.
 */
export async function tellMlsRemovals(): Promise<number> {
  try {
    const notices = await getUnreportedMlsRemovalNotices()
    let told = 0
    for (const kind of ['removed', 'restored'] as const) {
      const batch = notices.filter((n) => n.kind === kind)
      if (batch.length === 0) continue
      const queued = await queueBrokerHealthAlert({
        key: `mls-${kind}-${batch[0]!.logId}`,
        body: noticeText(kind, batch),
        cooldownMinutes: DAILY_ALERT_COOLDOWN_MINUTES,
      })
      if (!queued) continue
      await markMlsRemovalNoticesReported(batch.map((n) => n.logId))
      told += batch.length
    }
    return told
  } catch (err) {
    console.error('[closingsReconcile] telling MLS-removed sales failed', err)
    return 0
  }
}

/**
 * Find drift in the window and, when asked, repair it (capped). Repair mode
 * also records the closings Spark no longer serves and deletes the ones due.
 */
export async function reconcileClosings(opts: {
  from: string
  to: string
  repair: boolean
  maxRepairs?: number
  /**
   * Delete the sales the MLS removed once due, and text the owner (Matt
   * 2026-09-30). On for the daily cron, whose window the report refresh then
   * recomputes; off by default, so a repair of an older window never deletes
   * sales in periods nothing recomputes (scripts/closings-reconcile.ts
   * --delete-removed turns it on).
   */
  removeAbsent?: boolean
  /** Deletions a Bend calendar day may take (MLS_REMOVED_DAILY_BUDGET). */
  maxRemovals?: number
}): Promise<ClosingsReconcileResult> {
  const found = await findClosingsDrift(opts.from, opts.to)
  const absentFromMls = opts.repair
    ? await syncAbsentFromMls(
        found.notInSpark,
        {
          from: opts.from,
          to: opts.to,
          sparkClosings: found.sparkClosings,
          ourClosedInWindow: found.ourClosedInWindow,
        },
        { remove: opts.removeAbsent === true, maxRemovals: opts.maxRemovals ?? MLS_REMOVED_DAILY_BUDGET },
      )
    : { ...NO_ABSENT_WORK }
  let r: Awaited<ReturnType<typeof repairListingsFromSpark>> = {
    repaired: 0,
    repairedKeys: [],
    repairLogged: 0,
    failed: [],
    historyRefreshed: 0,
    refinalized: 0,
    membershipRows: 0,
    leftToDeltaSync: [],
  }
  if (opts.repair && found.drift.length > 0) {
    const toRepair = found.drift.slice(0, opts.maxRepairs ?? 2000)
    // A closing Spark has and we do not may be one we deleted as removed and the
    // MLS now serves again: put the saved row back first, so the repair updates
    // our full record (frozen gallery, broker overrides, counters) and logs it.
    const missingKeys = toRepair.filter((d) => d.reasons.includes('missing')).map((d) => d.key)
    if (missingKeys.length > 0) await restoreServedAgain(missingKeys)
    r = await repairListingsFromSpark(
      toRepair.map((d) => d.key),
      { window: { from: opts.from, to: opts.to }, reasons: new Map(toRepair.map((d) => [d.key, d.reasons])) },
    )
  }
  // After the day's writes, including the repair above: every restored sale
  // still pending gets its rows rebuilt from the listing as it stands now.
  if (opts.repair && opts.removeAbsent === true) absentFromMls.restoresRebuilt = await rebuildRestoredSales()
  return {
    ...found,
    absentFromMls,
    repaired: r.repaired,
    repairedKeys: r.repairedKeys,
    repairLogged: r.repairLogged,
    repairFailed: r.failed,
    historyRefreshed: r.historyRefreshed,
    refinalized: r.refinalized,
    membershipRows: r.membershipRows,
  }
}
