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
 *
 * reconcileListingStatus (2026-09-30) runs the same comparison and the same
 * repair over what is on the market: every listing Spark holds on the market,
 * every listing we hold on the market, and our Expired/Withdrawn/Canceled rows
 * whose status changed recently. Until the 2026-09-30 deploy the delta sync
 * skipped every finalized row outright, so a listing that expired and came back
 * on the market under the same key still read Expired here (97 of 359 sampled
 * recent terminal rows disagreed with Spark that day, 80 of them on the market
 * again), and a few rows still read Active months after Spark closed them out.
 */
import { fetchSparkListingsPage } from '@/lib/spark'
import { DELTA_SYNC, resolveRunMortgageRate, resultToMappedRow, type SparkDeltaResult } from '@/lib/sync/deltaSync'
import { driftReasons, factsFromListingRow, factsFromSparkFields, type DriftFacts, type DriftReason } from '@/lib/sync/listingDrift'
import { mergeFrozenMedia } from '@/lib/sync/frozenMedia'
import { fetchAndInsertHistoryCore } from '@/lib/sync/fetchListingHistory'
import { isTerminalStatus } from '@/lib/sync/terminalStatus'
import {
  clearAbsentFromMls,
  getAbsentFromMlsKeys,
  getClosedListingKeysInWindow,
  getListingRowsForRepairLog,
  getListingsForReconcile,
  getOnMarketListingKeys,
  getRecentUnsoldTerminalKeys,
  ON_MARKET_STATUSES,
  rebuildPlaceMembershipForKeys,
  recordAbsentFromMls,
  recordRepairLog,
  setRepairLogNote,
  setRepairLogOutcome,
  type ReconcileListingRow,
} from '@/lib/data/sync/closingsReconcile'
import {
  getAdminOverrideFlags,
  getHeldMediaByListNumbers,
  setListingFreezeFlags,
  upsertListingRows,
} from '@/lib/data/sync/syncWrites'
import { refreshMarketFactSpansForKeys } from '@/lib/data/market-report/compute'

/**
 * History fetches run two at a time. The delta sync shares this Spark key every
 * 15 minutes, and a large repair must not spend the key's rate window for it.
 */
const REPAIR_HISTORY_CONCURRENCY = 2

const LITE_SELECT =
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
   * looked up by key. Never deleted; in repair mode they are recorded in
   * market_listing_absent_from_mls, which leaves them out of every Market
   * Truth statistic (Matt 2026-09-25).
   */
  notInSpark: string[]
  /**
   * Repair mode only: absences recorded this run, earlier ones the MLS serves
   * again (released), and why recording was refused when the pull looked like
   * an outage rather than a few removed listings.
   */
  absentFromMls: { recorded: number; cleared: number; refused: string | null }
  repaired: number
  /** Keys actually rewritten (their membership and episodes are rebuilt too). */
  repairedKeys: string[]
  /** Before-images kept in listing_mls_repair_log ahead of the repair. */
  repairLogged: number
  repairFailed: string[]
  /** Drifted keys left alone because our row had since been written from a newer MLS record. */
  repairSkippedNewer: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
}

type SparkLite = { key: string; listNumber: string | null; fields: Record<string, unknown> }

function token(): string {
  const t = (process.env.SPARK_API_KEY ?? '').trim()
  if (!t) throw new Error('[closingsReconcile] SPARK_API_KEY is not set')
  return t
}

function liteFrom(result: { StandardFields?: unknown }): SparkLite | null {
  const f = (result.StandardFields ?? {}) as Record<string, unknown>
  const key = typeof f.ListingKey === 'string' ? f.ListingKey : null
  if (!key) return null
  const ln = typeof f.ListingId === 'string' ? f.ListingId : typeof f.ListNumber === 'string' ? f.ListNumber : null
  return { key, listNumber: ln, fields: f }
}

/** Every closing Spark holds with a close date in [from, to], all property types. */
export async function fetchSparkClosingsInWindow(from: string, to: string): Promise<Map<string, SparkLite>> {
  const out = new Map<string, SparkLite>()
  const filter = `StandardStatus Eq 'Closed' And CloseDate Ge ${from} And CloseDate Le ${to}`
  for (let page = 1; ; page++) {
    const res = await fetchSparkListingsPage(token(), { page, limit: 1000, filter, select: LITE_SELECT, orderby: '+ListingKey' })
    for (const r of res.D?.Results ?? []) {
      const lite = liteFrom(r)
      if (lite) out.set(lite.key, lite)
    }
    const pages = res.D?.Pagination?.TotalPages ?? 1
    if (page >= pages) break
    if (page >= MAX_WINDOW_PAGES) {
      throw new Error(`[closingsReconcile] ${from}..${to} runs past ${MAX_WINDOW_PAGES} pages of closings; narrow the window`)
    }
  }
  return out
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

/**
 * Set each candidate's MLS record against our row on the facts a statistic
 * reads, and return the ones that disagree. A broker override of status or list
 * price is our copy on purpose, not drift (a repair would only re-apply it,
 * since upsertListingRows merges overrides back): that reason is dropped where
 * the listing carries one, the same rule the delta sync's reopen follows (read
 * only for the few candidates). Shared by the closings and the status
 * reconciliation so the two can never disagree about what drift is.
 */
async function compareWithSpark(
  candidates: Map<string, SparkLite>,
  ours: Map<string, ReconcileListingRow>,
): Promise<ClosingDrift[]> {
  const drift: ClosingDrift[] = []
  for (const [key, lite] of candidates) {
    const row = ours.get(key)
    const mls = factsFromSparkFields(lite.fields)
    const held = row ? factsFromListingRow(row as unknown as Record<string, unknown>) : null
    const reasons = driftReasons(held, mls)
    // A frozen row that is not terminal misses every later MLS change (the
    // delta sync reopens it only when Spark next touches it): a repair
    // rewrites it unfrozen.
    if (row?.is_finalized && !isTerminalStatus(row.StandardStatus)) reasons.push('frozen_not_terminal')
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
  const overridable = drift.filter((d) => d.listNumber && (d.reasons.includes('status') || d.reasons.includes('list_price')))
  const overrides = overridable.length > 0 ? await getAdminOverrideFlags(overridable.map((d) => d.listNumber!)) : new Map()
  return drift
    .map((d) => {
      const o = d.listNumber ? overrides.get(d.listNumber) : undefined
      if (!o) return d
      return { ...d, reasons: d.reasons.filter((r) => !(r === 'status' && o.status) && !(r === 'list_price' && o.listPrice)) }
    })
    .filter((d) => d.reasons.length > 0)
}

/** Find every closing in the window where our copy disagrees with Spark. */
export async function findClosingsDrift(
  from: string,
  to: string,
): Promise<
  Omit<
    ClosingsReconcileResult,
    | 'repaired'
    | 'repairedKeys'
    | 'repairLogged'
    | 'repairFailed'
    | 'repairSkippedNewer'
    | 'historyRefreshed'
    | 'refinalized'
    | 'membershipRows'
    | 'absentFromMls'
  >
> {
  const [spark, ourClosed] = await Promise.all([fetchSparkClosingsInWindow(from, to), getClosedListingKeysInWindow(from, to)])
  const reverseKeys = ourClosed.filter((k) => !spark.has(k))
  const reverse = reverseKeys.length > 0 ? await fetchSparkLiteByKeys(reverseKeys) : new Map<string, SparkLite>()
  const notInSpark = reverseKeys.filter((k) => !reverse.has(k))

  const candidates = new Map<string, SparkLite>([...spark, ...reverse])
  const ours = await getListingsForReconcile([...candidates.keys()])
  const kept = await compareWithSpark(candidates, ours)
  kept.sort((a, b) => a.key.localeCompare(b.key))
  return { window: { from, to }, sparkClosings: spark.size, ourClosedInWindow: ourClosed.length, drift: kept, notInSpark }
}

function snapshot(f: DriftFacts): DriftSnapshot {
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
  /** The close-date window the drift came from; null for the status reconciliation. */
  window: { from: string; to: string } | null
  /** Why each key was picked: the drift reasons that selected it. */
  reasons: Map<string, DriftReason[]>
  /** listing_mls_repair_log.source; defaults to 'closings-reconcile'. */
  source?: string
}

/** Is stamp `a` strictly later than stamp `b` (both parse)? */
function isLater(a: unknown, b: unknown): boolean {
  const ta = typeof a === 'string' ? Date.parse(a) : Number.NaN
  const tb = typeof b === 'string' ? Date.parse(b) : Number.NaN
  return Number.isFinite(ta) && Number.isFinite(tb) && ta > tb
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
 * A listing whose row, read right before the write, carries a later MLS stamp
 * than the record just fetched is left alone (skippedNewer): the delta sync
 * wrote it again in the meantime, and a repair never moves a row backwards.
 */
export async function repairListingsFromSpark(keys: string[], log: RepairLogContext): Promise<{
  repaired: number
  repairedKeys: string[]
  repairLogged: number
  failed: string[]
  skippedNewer: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
}> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) {
    return { repaired: 0, repairedKeys: [], repairLogged: 0, failed: [], skippedNewer: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0 }
  }
  const mortgageRate = await resolveRunMortgageRate()
  const existing = await getListingsForReconcile(unique)
  const failed: string[] = []
  const skippedNewer: string[] = []
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
    const writable = merged.filter((row) => {
      const key = String(row.ListingKey)
      if (!isLater(before.get(key)?.ModificationTimestamp, row.ModificationTimestamp)) return true
      skippedNewer.push(key)
      return false
    })
    if (writable.length === 0) continue
    const ids = await recordRepairLog(
      writable.map((row) => {
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
          windowFrom: log.window?.from ?? null,
          windowTo: log.window?.to ?? null,
        }
      }),
      log.source ?? 'closings-reconcile',
    )
    for (const [k, id] of ids) logId.set(k, id)

    for (let j = 0; j < writable.length; j += DELTA_SYNC.UPSERT_CHUNK) {
      const chunk = writable.slice(j, j + DELTA_SYNC.UPSERT_CHUNK)
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
  return { repaired, repairedKeys, repairLogged: logId.size, failed, skippedNewer, historyRefreshed, refinalized, membershipRows }
}

/** Find drift in the window and, when asked, repair it (capped). */
/** Absences one window may record before the pull is treated as an outage: 10, or 0.5% of our closings. */
export function absentRecordLimit(ourClosedInWindow: number): number {
  return Math.max(10, Math.ceil(ourClosedInWindow * 0.005))
}

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
 */
async function syncAbsentFromMls(
  notInSpark: string[],
  window: { from: string; to: string; sparkClosings: number; ourClosedInWindow: number },
): Promise<{ recorded: number; cleared: number; refused: string | null }> {
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
  return { recorded, cleared, refused }
}

export async function reconcileClosings(opts: {
  from: string
  to: string
  repair: boolean
  maxRepairs?: number
}): Promise<ClosingsReconcileResult> {
  const found = await findClosingsDrift(opts.from, opts.to)
  const absentFromMls = opts.repair
    ? await syncAbsentFromMls(found.notInSpark, {
        from: opts.from,
        to: opts.to,
        sparkClosings: found.sparkClosings,
        ourClosedInWindow: found.ourClosedInWindow,
      })
    : { recorded: 0, cleared: 0, refused: null }
  if (!opts.repair || found.drift.length === 0) {
    return { ...found, absentFromMls, repaired: 0, repairedKeys: [], repairLogged: 0, repairFailed: [], repairSkippedNewer: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0 }
  }
  const toRepair = found.drift.slice(0, opts.maxRepairs ?? 2000)
  const r = await repairListingsFromSpark(
    toRepair.map((d) => d.key),
    { window: { from: opts.from, to: opts.to }, reasons: new Map(toRepair.map((d) => [d.key, d.reasons])) },
  )
  return {
    ...found,
    absentFromMls,
    repaired: r.repaired,
    repairedKeys: r.repairedKeys,
    repairLogged: r.repairLogged,
    repairFailed: r.failed,
    repairSkippedNewer: r.skippedNewer,
    historyRefreshed: r.historyRefreshed,
    refinalized: r.refinalized,
    membershipRows: r.membershipRows,
  }
}

// ── Listing status reconciliation (2026-09-30) ──────────────────────────────

/** Spark's filter for a listing on the market: the statuses in ON_MARKET_STATUSES. */
const ON_MARKET_FILTER = ON_MARKET_STATUSES.map((s) => `StandardStatus Eq '${s}'`).join(' Or ')

/** Our Expired/Withdrawn/Canceled rows whose status changed this recently are re-checked by key. */
export const STATUS_RECONCILE_TERMINAL_DAYS = 120

/**
 * A Spark on-market pull under this share of our own on-market count reads as
 * an outage or a broken filter, not a market: nothing is looked up or repaired.
 */
const ON_MARKET_OUTAGE_SHARE = 0.5

export type StatusReconcileResult = {
  /** Listings Spark holds on the market right now. */
  sparkOnMarket: number
  /** Listings we hold on the market (ON_MARKET_STATUSES). */
  ourOnMarket: number
  /** Our recent Expired/Withdrawn/Canceled keys set against Spark. */
  terminalChecked: number
  /** Status-change floor for that terminal re-check; null when it was skipped. */
  terminalSince: string | null
  /** Every listing where our copy disagrees with Spark; status drift first. */
  drift: ClosingDrift[]
  /** Keys we hold on the market that Spark does not serve at all, even by key. Reported, never written. */
  notInSpark: string[]
  /** Why nothing was looked up or repaired, when the Spark pull looked like an outage. */
  refused: string | null
  repaired: number
  repairedKeys: string[]
  repairLogged: number
  repairFailed: string[]
  skippedNewer: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
}

/** Every listing Spark holds on the market right now, all property types (light select). */
export async function fetchSparkOnMarket(): Promise<Map<string, SparkLite>> {
  const out = new Map<string, SparkLite>()
  for (let page = 1; ; page++) {
    const res = await fetchSparkListingsPage(token(), { page, limit: 1000, filter: ON_MARKET_FILTER, select: LITE_SELECT, orderby: '+ListingKey' })
    for (const r of res.D?.Results ?? []) {
      const lite = liteFrom(r)
      if (lite) out.set(lite.key, lite)
    }
    const pages = res.D?.Pagination?.TotalPages ?? 1
    if (page >= pages) break
    if (page >= MAX_WINDOW_PAGES) {
      throw new Error(`[closingsReconcile] the on-market pull runs past ${MAX_WINDOW_PAGES} pages; refusing to guess`)
    }
  }
  return out
}

/** Status drift first (a listing on or off the market, or missing), then the rest; by key within each. */
function byRepairPriority(a: ClosingDrift, b: ClosingDrift): number {
  const rank = (d: ClosingDrift) => (d.reasons.some((r) => r === 'status' || r === 'missing') ? 0 : 1)
  return rank(a) - rank(b) || a.key.localeCompare(b.key)
}

/**
 * Find every listing where our copy and Spark disagree about what is on the
 * market: each listing Spark holds on the market, each listing we hold on the
 * market (looked up by key when Spark's pull does not carry it), and our
 * Expired/Withdrawn/Canceled rows whose status changed within
 * `terminalSinceDays` (0 skips them).
 */
export async function findStatusDrift(opts: {
  terminalSinceDays: number
  now?: number
}): Promise<
  Omit<
    StatusReconcileResult,
    'repaired' | 'repairedKeys' | 'repairLogged' | 'repairFailed' | 'skippedNewer' | 'historyRefreshed' | 'refinalized' | 'membershipRows'
  >
> {
  const now = opts.now ?? Date.now()
  const terminalSince = opts.terminalSinceDays > 0 ? new Date(now - opts.terminalSinceDays * 86_400_000).toISOString() : null
  const [spark, ourOnMarket, ourTerminal] = await Promise.all([
    fetchSparkOnMarket(),
    getOnMarketListingKeys(),
    terminalSince ? getRecentUnsoldTerminalKeys(terminalSince) : Promise.resolve([] as string[]),
  ])
  const base = { sparkOnMarket: spark.size, ourOnMarket: ourOnMarket.length, terminalChecked: ourTerminal.length, terminalSince }
  if (spark.size < ourOnMarket.length * ON_MARKET_OUTAGE_SHARE) {
    return {
      ...base,
      drift: [],
      notInSpark: [],
      refused: `Spark returned ${spark.size} on-market listings while we hold ${ourOnMarket.length}; that reads as an outage, so nothing was checked by key or repaired`,
    }
  }
  const lookup = [...new Set([...ourOnMarket, ...ourTerminal])].filter((k) => !spark.has(k))
  const byKey = lookup.length > 0 ? await fetchSparkLiteByKeys(lookup) : new Map<string, SparkLite>()
  const notInSpark = ourOnMarket.filter((k) => !spark.has(k) && !byKey.has(k)).sort()
  const candidates = new Map<string, SparkLite>([...spark, ...byKey])
  const ours = await getListingsForReconcile([...candidates.keys()])
  const drift = await compareWithSpark(candidates, ours)
  drift.sort(byRepairPriority)
  return { ...base, drift, notInSpark, refused: null }
}

/**
 * Find status drift and, when asked, repair it through the closings repair
 * path (capped, status drift first), logged in listing_mls_repair_log as
 * 'status-reconcile'. A repaired row that is no longer terminal is written
 * unfrozen, so the delta sync follows it again; a terminal one re-freezes once
 * its history lands.
 */
export async function reconcileListingStatus(opts: {
  repair: boolean
  maxRepairs?: number
  terminalSinceDays?: number
}): Promise<StatusReconcileResult> {
  const found = await findStatusDrift({ terminalSinceDays: opts.terminalSinceDays ?? STATUS_RECONCILE_TERMINAL_DAYS })
  if (!opts.repair || found.refused || found.drift.length === 0) {
    return { ...found, repaired: 0, repairedKeys: [], repairLogged: 0, repairFailed: [], skippedNewer: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0 }
  }
  const toRepair = found.drift.slice(0, opts.maxRepairs ?? 2000)
  const r = await repairListingsFromSpark(
    toRepair.map((d) => d.key),
    { window: null, reasons: new Map(toRepair.map((d) => [d.key, d.reasons])), source: 'status-reconcile' },
  )
  return {
    ...found,
    repaired: r.repaired,
    repairedKeys: r.repairedKeys,
    repairLogged: r.repairLogged,
    repairFailed: r.failed,
    skippedNewer: r.skippedNewer,
    historyRefreshed: r.historyRefreshed,
    refinalized: r.refinalized,
    membershipRows: r.membershipRows,
  }
}
