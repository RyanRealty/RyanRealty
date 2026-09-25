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
 *   3. Repair: fetch each drifted listing in full (the delta sync's expand),
 *      map it with the delta sync's own mapper, keep a frozen gallery where we
 *      hold more photos than the MLS now serves, upsert, replace its history,
 *      and re-freeze it when it is terminal.
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
  getAbsentFromMlsKeys,
  getClosedListingKeysInWindow,
  getListingsForReconcile,
  rebuildPlaceMembershipForKeys,
  recordAbsentFromMls,
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
  'ListingKey,ListingId,StandardStatus,MlsStatus,CloseDate,ClosePrice,City,PropertyType,PropertySubType,TotalLivingAreaSqFt,BuildingAreaTotal,LivingArea,ModificationTimestamp'

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
  /** Repair mode only: absences recorded this run, and earlier ones the MLS serves again (removed). */
  absentFromMls: { recorded: number; cleared: number }
  repaired: number
  /** Keys actually rewritten (their membership and episodes are rebuilt too). */
  repairedKeys: string[]
  repairFailed: string[]
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

/** Find every closing in the window where our copy disagrees with Spark. */
export async function findClosingsDrift(
  from: string,
  to: string,
): Promise<
  Omit<
    ClosingsReconcileResult,
    'repaired' | 'repairedKeys' | 'repairFailed' | 'historyRefreshed' | 'refinalized' | 'membershipRows' | 'absentFromMls'
  >
> {
  const [spark, ourClosed] = await Promise.all([fetchSparkClosingsInWindow(from, to), getClosedListingKeysInWindow(from, to)])
  const reverseKeys = ourClosed.filter((k) => !spark.has(k))
  const reverse = reverseKeys.length > 0 ? await fetchSparkLiteByKeys(reverseKeys) : new Map<string, SparkLite>()
  const notInSpark = reverseKeys.filter((k) => !reverse.has(k))

  const candidates = new Map<string, SparkLite>([...spark, ...reverse])
  const ours = await getListingsForReconcile([...candidates.keys()])
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
  // A broker override of status is our copy on purpose, not drift: drop that
  // reason where the listing carries one (read only for the few candidates).
  const statusDrift = drift.filter((d) => d.reasons.includes('status') && d.listNumber)
  const overrides = statusDrift.length > 0 ? await getAdminOverrideFlags(statusDrift.map((d) => d.listNumber!)) : new Map()
  const kept = drift
    .map((d) => (d.listNumber && overrides.get(d.listNumber)?.status ? { ...d, reasons: d.reasons.filter((r) => r !== 'status') } : d))
    .filter((d) => d.reasons.length > 0)
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

/**
 * Re-pull these listings from Spark in full and write them back: row, media
 * kept where we hold more, history replaced, terminal rows re-frozen.
 */
export async function repairListingsFromSpark(keys: string[]): Promise<{
  repaired: number
  repairedKeys: string[]
  failed: string[]
  historyRefreshed: number
  refinalized: number
  membershipRows: number
}> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) {
    return { repaired: 0, repairedKeys: [], failed: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0 }
  }
  const mortgageRate = await resolveRunMortgageRate()
  const existing = await getListingsForReconcile(unique)
  const failed: string[] = []
  let repaired = 0
  const written: { key: string; listNumber: string; status: string | null }[] = []

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
    }
    const held = preserve.length > 0 ? await getHeldMediaByListNumbers(preserve) : new Map()
    const merged = rows.map((row) => {
      const h = held.get(String(row.ListNumber))
      return h ? mergeFrozenMedia(row, h) : row
    })
    for (let j = 0; j < merged.length; j += DELTA_SYNC.UPSERT_CHUNK) {
      const chunk = merged.slice(j, j + DELTA_SYNC.UPSERT_CHUNK)
      const w = await upsertListingRows(chunk)
      if (!w.ok) {
        console.error('[closingsReconcile] upsert failed', w.error)
        for (const row of chunk) failed.push(String(row.ListingKey ?? row.ListNumber))
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
    }
  }

  let historyRefreshed = 0
  const refreeze: string[] = []
  await pool(written, REPAIR_HISTORY_CONCURRENCY, async (w) => {
    const h = await fetchAndInsertHistoryCore(token(), w.key)
    if (h.inserted > 0) historyRefreshed += 1
    // Re-freeze only a terminal row whose history actually landed (or had none to land).
    const historySaved = h.ok && (h.inserted > 0 || h.items.length === 0)
    if (historySaved && w.status && isTerminalStatus(w.status)) refreeze.push(w.listNumber)
  })
  let refinalized = 0
  if (refreeze.length > 0) {
    const r = await setListingFreezeFlags(refreeze, { is_finalized: true, history_finalized: true, history_verified_full: true })
    refinalized = r.updated
    if (!r.ok) console.error('[closingsReconcile] re-freeze failed', r.error)
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
  return { repaired, repairedKeys, failed, historyRefreshed, refinalized, membershipRows }
}

/** Find drift in the window and, when asked, repair it (capped). */
/**
 * Record the window's closings Spark no longer serves, and release any key
 * recorded earlier that Spark serves again. The recorded list is short, so
 * every run re-checks all of it by key.
 */
async function syncAbsentFromMls(notInSpark: string[]): Promise<{ recorded: number; cleared: number }> {
  const rows = notInSpark.length > 0 ? await getListingsForReconcile(notInSpark) : new Map()
  const recorded = await recordAbsentFromMls(
    notInSpark.map((key) => {
      const row = rows.get(key)
      return {
        listingKey: key,
        listNumber: row?.ListNumber ?? null,
        closeDate: row ? factsFromListingRow(row as unknown as Record<string, unknown>).closeDate : null,
      }
    }),
  )
  const held = (await getAbsentFromMlsKeys()).filter((k) => !notInSpark.includes(k))
  const back = held.length > 0 ? [...(await fetchSparkLiteByKeys(held)).keys()] : []
  const cleared = await clearAbsentFromMls(back)
  return { recorded, cleared }
}

export async function reconcileClosings(opts: {
  from: string
  to: string
  repair: boolean
  maxRepairs?: number
}): Promise<ClosingsReconcileResult> {
  const found = await findClosingsDrift(opts.from, opts.to)
  const absentFromMls = opts.repair ? await syncAbsentFromMls(found.notInSpark) : { recorded: 0, cleared: 0 }
  if (!opts.repair || found.drift.length === 0) {
    return { ...found, absentFromMls, repaired: 0, repairedKeys: [], repairFailed: [], historyRefreshed: 0, refinalized: 0, membershipRows: 0 }
  }
  const keys = found.drift.map((d) => d.key).slice(0, opts.maxRepairs ?? 2000)
  const r = await repairListingsFromSpark(keys)
  return {
    ...found,
    absentFromMls,
    repaired: r.repaired,
    repairedKeys: r.repairedKeys,
    repairFailed: r.failed,
    historyRefreshed: r.historyRefreshed,
    refinalized: r.refinalized,
    membershipRows: r.membershipRows,
  }
}
