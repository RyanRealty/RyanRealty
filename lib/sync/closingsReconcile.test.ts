import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The closings reconciliation against a fake Spark and a fake store: which
 * closings count as drift, and how a closing Spark no longer serves is
 * recorded (repair mode only) and released when Spark serves it again
 * (Matt 2026-09-25: a sale the MLS removed is left out of every statistic),
 * then handed to the deletion with the keys this run confirmed and told to
 * Matt (Matt 2026-09-30: "Delete it automatically"; the SQL function's own
 * rules were probed against the database, see
 * lib/data/sync/closingsReconcile-db.int.test.ts),
 * and how a repair keeps each listing's old values before rewriting it.
 */

type Fields = Record<string, unknown>
type RemovedSale = import('@/lib/data/sync/closingsReconcile').RemovedSale
type MlsRemovalNotice = import('@/lib/data/sync/closingsReconcile').MlsRemovalNotice
const spark = { window: [] as Fields[], byKey: new Map<string, Fields>(), windowRequests: [] as string[] }
const store = {
  closedInWindow: [] as string[],
  rows: new Map<string, Record<string, unknown>>(),
  absent: new Set<string>(),
  absentCloseDate: new Map<string, string>(),
  recorded: [] as { listingKey: string; listNumber: string | null; closeDate: string | null }[],
  cleared: [] as string[],
  repairLog: [] as Record<string, unknown>[],
  repairLogFails: false,
  outcomes: [] as { ids: number[]; outcome: string }[],
  notes: [] as { ids: number[]; note: string }[],
  upserted: [] as string[],
  upsertFails: false,
  historyFails: new Set<string>(),
  deleteCalls: [] as { keys: string[]; maxDelete: number; window?: { from: string; to: string } }[],
  deleteResult: {
    removed: [] as RemovedSale[],
    refused: null as 'budget' | 'hold' | null,
    due: 0,
    held: 0,
    waiting: 0,
    budget: null as number | null,
  },
  notices: [] as MlsRemovalNotice[],
  reported: [] as number[],
  restoreCalls: [] as string[][],
  restorable: new Set<string>(),
}
const alerts: { key: string; body: string }[] = []
let alertQueues = true

vi.mock('@/lib/spark', async () => {
  const { allPages } = await import('@/test/spark-skip-token-fake')
  return {
    fetchSparkListingsWhere: vi.fn(async (_token: string, opts: { filter: string }) => {
      spark.windowRequests.push(opts.filter)
      return opts.filter.startsWith("StandardStatus Eq 'Closed'") ? allPages(spark.window) : []
    }),
    fetchSparkListingsPage: vi.fn(async (_token: string, opts: { filter?: string }) => {
      const filter = opts.filter ?? ''
      const keys = [...filter.matchAll(/ListingKey Eq '([^']+)'/g)].map((m) => m[1]!)
      const hits = keys.flatMap((k) => (spark.byKey.has(k) ? [{ StandardFields: spark.byKey.get(k)! }] : []))
      return { D: { Results: hits, Pagination: { TotalPages: 1 } } }
    }),
  }
})
vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  getClosedListingKeysInWindow: vi.fn(async () => store.closedInWindow),
  getListingsForReconcile: vi.fn(async (keys: string[]) => {
    const out = new Map<string, Record<string, unknown>>()
    for (const k of keys) if (store.rows.has(k)) out.set(k, store.rows.get(k)!)
    return out
  }),
  rebuildPlaceMembershipForKeys: vi.fn(async () => 0),
  recordAbsentFromMls: vi.fn(async (rows: typeof store.recorded) => {
    store.recorded.push(...rows)
    for (const r of rows) store.absent.add(r.listingKey)
    return rows.length
  }),
  getAbsentFromMlsKeys: vi.fn(async (window?: { from: string; to: string }) =>
    [...store.absent].filter((k) => {
      const d = store.absentCloseDate.get(k)
      return !window || (d != null && d >= window.from && d <= window.to)
    }),
  ),
  clearAbsentFromMls: vi.fn(async (keys: string[]) => {
    store.cleared.push(...keys)
    for (const k of keys) store.absent.delete(k)
    return keys.length
  }),
  recordRepairLog: vi.fn(async (entries: Record<string, unknown>[]) => {
    if (store.repairLogFails) throw new Error('[recordRepairLog] insert failed')
    const ids = new Map<string, number>()
    for (const e of entries) {
      store.repairLog.push(e)
      ids.set(String(e.listingKey), store.repairLog.length)
    }
    return ids
  }),
  setRepairLogOutcome: vi.fn(async (ids: number[], outcome: string) => {
    if (ids.length > 0) store.outcomes.push({ ids, outcome })
    return ids.length
  }),
  setRepairLogNote: vi.fn(async (ids: number[], note: string) => {
    if (ids.length > 0) store.notes.push({ ids, note })
    return ids.length
  }),
  getListingRowsForRepairLog: vi.fn(async (keys: string[]) => {
    const out = new Map<string, Record<string, unknown>>()
    for (const k of keys) if (store.rows.has(k)) out.set(k, store.rows.get(k)!)
    return out
  }),
  deleteMlsRemovedSales: vi.fn(async (keys: string[], opts: { maxDelete: number; window?: { from: string; to: string } }) => {
    store.deleteCalls.push({ keys, ...opts })
    return store.deleteResult
  }),
  getUnreportedMlsRemovalNotices: vi.fn(async () => store.notices.filter((n) => !store.reported.includes(n.logId))),
  markMlsRemovalNoticesReported: vi.fn(async (ids: number[]) => {
    store.reported.push(...ids)
    return ids.length
  }),
}))
const rebuildRestoredSales = vi.fn(async () => 0)
vi.mock('@/lib/sync/mlsRemovedRestore', () => ({
  rebuildRestoredSales: () => rebuildRestoredSales(),
  restoreServedAgain: vi.fn(async (keys: string[]) => {
    store.restoreCalls.push(keys)
    const restored = keys.filter((k) => store.restorable.has(k))
    // The saved row is back: the repair that follows reads it as ours.
    for (const k of restored) store.rows.set(k, ourRow(k, { ClosePrice: 93588000 }))
    return restored
  }),
}))
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: vi.fn(async (a: { key: string; body: string }) => {
    if (!alertQueues) return false
    alerts.push({ key: a.key, body: a.body })
    return true
  }),
}))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  getAdminOverrideFlags: vi.fn(async () => new Map()),
  getHeldMediaByListNumbers: vi.fn(async () => new Map()),
  setListingFreezeFlags: vi.fn(async (listNumbers: string[]) => ({ ok: true, updated: listNumbers.length })),
  upsertListingRows: vi.fn(async (rows: Record<string, unknown>[]) => {
    if (store.upsertFails) return { ok: false, error: 'write refused' }
    store.upserted.push(...rows.map((r) => String(r.ListingKey)))
    return { ok: true }
  }),
}))
vi.mock('@/lib/data/market-report/compute', () => ({ refreshMarketFactSpansForKeys: vi.fn(async () => ({ rebuilt: 0, missed: [] })) }))
vi.mock('@/lib/sync/fetchListingHistory', () => ({
  fetchAndInsertHistoryCore: vi.fn(async (_token: string, key: string) =>
    store.historyFails.has(key) ? { ok: false, inserted: 0, items: [] } : { ok: true, inserted: 0, items: [] },
  ),
}))
vi.mock('@/lib/sync/deltaSync', () => ({
  DELTA_SYNC: { EXPAND: '', UPSERT_CHUNK: 50 },
  resolveRunMortgageRate: vi.fn(async () => null),
  resultToMappedRow: vi.fn((r: { StandardFields: Fields }) => ({
    ListingKey: r.StandardFields.ListingKey,
    ListNumber: r.StandardFields.ListingId,
    StandardStatus: r.StandardFields.StandardStatus,
    ClosePrice: r.StandardFields.ClosePrice,
  })),
}))

import { fetchSparkClosingsInWindow, reconcileClosings, REPAIR_BATCH, repairListingsFromSpark, tellMlsRemovals } from './closingsReconcile'
import { heldSalesText } from './mlsRemovedText'
import { rebuildPlaceMembershipForKeys } from '@/lib/data/sync/closingsReconcile'
import { refreshMarketFactSpansForKeys } from '@/lib/data/market-report/compute'
import type { DriftReason } from './listingDrift'

function sparkClosing(key: string, over: Fields = {}): Fields {
  return {
    ListingKey: key,
    ListingId: `L${key}`,
    StandardStatus: 'Closed',
    CloseDate: '2026-03-10',
    ClosePrice: 500000,
    City: 'Bend',
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    TotalLivingAreaSqFt: 1800,
    ...over,
  }
}

function ourRow(key: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ListNumber: `L${key}`,
    ListingKey: key,
    StandardStatus: 'Closed',
    City: 'Bend',
    CloseDate: '2026-03-10T00:00:00+00:00',
    ClosePrice: 500000,
    ListPrice: 510000,
    property_sub_type: 'Single Family Residence',
    TotalLivingAreaSqFt: 1800,
    is_finalized: true,
    media_finalized: true,
    ...over,
  }
}

beforeEach(() => {
  process.env.SPARK_API_KEY = 'test-key'
  spark.window = []
  spark.byKey = new Map()
  spark.windowRequests = []
  store.closedInWindow = []
  store.rows = new Map()
  store.absent = new Set()
  store.absentCloseDate = new Map()
  store.recorded = []
  store.cleared = []
  store.repairLog = []
  store.repairLogFails = false
  store.outcomes = []
  store.notes = []
  store.upserted = []
  store.upsertFails = false
  store.historyFails = new Set()
  store.deleteCalls = []
  store.deleteResult = { removed: [], refused: null, due: 0, held: 0, waiting: 0, budget: null }
  store.notices = []
  store.reported = []
  store.restoreCalls = []
  store.restorable = new Set()
  alerts.length = 0
  alertQueues = true
})

const NONE_REMOVED = { removed: [], removalHeld: null, held: 0, waiting: 0, told: 0, restoresRebuilt: 0, removalFailed: null }

function removedSale(over: Partial<RemovedSale> = {}): RemovedSale {
  return {
    logId: 3637,
    listingKey: 'GONE',
    listNumber: '220217062',
    streetNumber: '15714',
    streetName: 'Tumble Weed Turn',
    city: 'Sisters',
    closeDate: '2026-03-10',
    closePrice: 735000,
    firstDetectedAt: '2026-09-28T11:20:00Z',
    ...over,
  }
}

function notice(over: Partial<MlsRemovalNotice> = {}): MlsRemovalNotice {
  return {
    logId: 3637,
    kind: 'removed',
    listingKey: 'GONE',
    listNumber: '220217062',
    streetNumber: '15714',
    streetName: 'Tumble Weed Turn',
    city: 'Sisters',
    closeDate: '2026-03-10',
    closePrice: 735000,
    ...over,
  }
}

describe('fetchSparkClosingsInWindow', () => {
  it('reads the window through the skip-token reader, past a page of 1,000', async () => {
    spark.window = Array.from({ length: 2500 }, (_, i) => sparkClosing(`K${String(i).padStart(5, '0')}`))
    const got = await fetchSparkClosingsInWindow('2026-03-01', '2026-03-31')
    expect(got.size).toBe(2500)
    expect(spark.windowRequests).toEqual(["StandardStatus Eq 'Closed' And CloseDate Ge 2026-03-01 And CloseDate Le 2026-03-31"])
  })
})

describe('repairListingsFromSpark', () => {
  it('leaves to the delta sync a listing the MLS changed after the cutoff, and repairs the rest', async () => {
    spark.byKey.set('OLD', sparkClosing('OLD', { ModificationTimestamp: '2026-05-12T18:14:43Z' }))
    spark.byKey.set('NEW', sparkClosing('NEW', { ModificationTimestamp: '2026-10-01T10:30:00Z' }))
    store.rows.set('OLD', ourRow('OLD'))
    store.rows.set('NEW', ourRow('NEW'))
    const r = await repairListingsFromSpark(
      ['OLD', 'NEW'],
      { window: { from: '2026-10-01', to: '2026-10-01' }, reasons: new Map([['OLD', ['status']], ['NEW', ['status']]]) },
      { leaveModifiedFrom: Date.parse('2026-10-01T09:00:00Z') },
    )
    expect(r.leftToDeltaSync).toEqual(['NEW'])
    expect(r.repairedKeys).toEqual(['OLD'])
    expect(store.upserted).toEqual(['OLD'])
    expect(store.repairLog.map((e) => e.listingKey)).toEqual(['OLD'])
  })

  const many = (n: number) => {
    const keys = Array.from({ length: n }, (_, i) => `R${String(i).padStart(3, '0')}`)
    for (const k of keys) {
      spark.byKey.set(k, sparkClosing(k, { ClosePrice: 93588 }))
      store.rows.set(k, ourRow(k, { ClosePrice: 93588000 }))
    }
    return keys
  }
  const ctx = (keys: string[]) => ({ window: { from: '2026-03-01', to: '2026-03-31' }, reasons: new Map(keys.map((k) => [k, ['close_price'] as DriftReason[]])) })

  it('repairs REPAIR_BATCH at a time, each batch rebuilding its own membership and episodes', async () => {
    const keys = many(90)
    const membership = vi.mocked(rebuildPlaceMembershipForKeys)
    const spans = vi.mocked(refreshMarketFactSpansForKeys)
    membership.mockClear()
    spans.mockClear()
    const r = await repairListingsFromSpark(keys, ctx(keys))
    expect(r.repaired).toBe(90)
    expect(membership.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([REPAIR_BATCH, REPAIR_BATCH, 90 - 2 * REPAIR_BATCH])
    expect(spans.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([REPAIR_BATCH, REPAIR_BATCH, 90 - 2 * REPAIR_BATCH])
    expect(r.unreached).toEqual([])
  })

  it('starts no batch past the deadline and returns the keys it did not reach', async () => {
    const keys = many(90)
    const membership = vi.mocked(rebuildPlaceMembershipForKeys)
    membership.mockClear()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.parse('2026-10-01T10:47:00Z'))
      const deadline = Date.parse('2026-10-01T10:56:00Z')
      membership.mockImplementationOnce(async () => {
        vi.setSystemTime(deadline)
        return 0
      })
      const r = await repairListingsFromSpark(keys, ctx(keys), { deadline })
      expect(r.repaired).toBe(REPAIR_BATCH)
      expect(r.unreached).toEqual(keys.slice(REPAIR_BATCH))
      expect(store.upserted).toHaveLength(REPAIR_BATCH)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('reconcileClosings', () => {
  it('reports a close price the MLS corrected as drift, with both values kept', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: false })
    expect(r.drift).toHaveLength(1)
    expect(r.drift[0]!.reasons).toEqual(['close_price'])
    expect(r.drift[0]!.ours?.closePrice).toBe(93588000)
    expect(r.drift[0]!.mls.closePrice).toBe(93588)
  })

  it('keeps the whole row and its facts in the repair log before rewriting the listing', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.repaired).toBe(1)
    expect(r.repairLogged).toBe(1)
    expect(store.repairLog).toHaveLength(1)
    expect(store.repairLog[0]).toMatchObject({
      listingKey: 'K1',
      listNumber: 'LK1',
      reasons: ['close_price'],
      ours: { closePrice: 93588000 },
      beforeRow: { ListingKey: 'K1', ClosePrice: 93588000 },
      mls: { closePrice: 93588, propertyType: 'A' },
      windowFrom: '2026-03-01',
      windowTo: '2026-03-31',
    })
    expect(store.upserted).toEqual(['K1'])
    expect(store.outcomes).toEqual([{ ids: [1], outcome: 'repaired' }])
    expect(store.notes).toEqual([])
  })

  it('marks a chunk whose write was refused as a failed repair', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    store.upsertFails = true
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.repaired).toBe(0)
    expect(r.repairFailed).toEqual(['K1'])
    expect(store.repairLog).toHaveLength(1)
    expect(store.outcomes).toEqual([{ ids: [1], outcome: 'failed' }])
  })

  it('notes a repaired listing whose history did not land', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    store.historyFails.add('K1')
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.repaired).toBe(1)
    expect(r.refinalized).toBe(0)
    expect(store.outcomes).toEqual([{ ids: [1], outcome: 'repaired' }])
    expect(store.notes).toHaveLength(1)
    expect(store.notes[0]).toMatchObject({ ids: [1] })
    expect(store.notes[0]!.note).toMatch(/history was not replaced/)
  })

  it('rewrites nothing when the old values cannot be kept', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    store.repairLogFails = true
    await expect(reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })).rejects.toThrow(/recordRepairLog/)
    expect(store.upserted).toEqual([])
  })

  it('logs nothing for a listing Spark would not serve in full, and counts it failed', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    // The window pull has it; the full re-pull by key returns nothing, so nothing is rewritten.
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.repaired).toBe(0)
    expect(r.repairFailed).toEqual(['K1'])
    expect(store.repairLog).toEqual([])
    expect(store.upserted).toEqual([])
  })

  it('records a closing Spark no longer serves only in repair mode', async () => {
    store.closedInWindow = ['GONE']
    store.rows.set('GONE', ourRow('GONE'))

    const report = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: false })
    expect(report.notInSpark).toEqual(['GONE'])
    expect(report.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null, ...NONE_REMOVED })
    expect(store.recorded).toEqual([])

    // Spark still serves the window's other closings: one missing sale is a removal, not an outage.
    spark.window = [sparkClosing('K2')]
    store.closedInWindow = ['GONE', 'K2']
    store.rows.set('K2', ourRow('K2'))
    const repair = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(repair.absentFromMls).toEqual({ recorded: 1, cleared: 0, refused: null, ...NONE_REMOVED })
    expect(store.recorded).toEqual([{ listingKey: 'GONE', listNumber: 'LGONE', closeDate: '2026-03-10' }])
  })

  it('releases a recorded key once Spark serves it again', async () => {
    store.absent.add('BACK')
    store.absentCloseDate.set('BACK', '2026-03-12')
    spark.byKey.set('BACK', sparkClosing('BACK', { CloseDate: '2026-03-12' }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 1, refused: null, ...NONE_REMOVED })
    expect(store.cleared).toEqual(['BACK'])
    expect(store.absent.has('BACK')).toBe(false)
  })

  it('re-checks only the recorded keys that closed inside the window', async () => {
    store.absent.add('OLD')
    store.absentCloseDate.set('OLD', '2025-02-01')
    spark.byKey.set('OLD', sparkClosing('OLD', { CloseDate: '2025-02-01' }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null, ...NONE_REMOVED })
    expect(store.absent.has('OLD')).toBe(true)
  })

  it('keeps a recorded key Spark still does not serve', async () => {
    store.absent.add('STILL-GONE')
    store.absentCloseDate.set('STILL-GONE', '2026-03-05')
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null, ...NONE_REMOVED })
    expect(store.absent.has('STILL-GONE')).toBe(true)
  })

  it('records nothing when Spark returns no closings at all (an outage, not removals)', async () => {
    store.closedInWindow = ['A', 'B', 'C']
    for (const k of store.closedInWindow) store.rows.set(k, ourRow(k))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.notInSpark).toEqual(['A', 'B', 'C'])
    expect(r.absentFromMls.recorded).toBe(0)
    expect(r.absentFromMls.refused).toMatch(/no closings/)
    expect(store.recorded).toEqual([])
  })

  it('records nothing when far more go missing than removed listings explain', async () => {
    const ours = Array.from({ length: 1000 }, (_, i) => `K${i}`)
    store.closedInWindow = ours
    for (const k of ours) store.rows.set(k, ourRow(k))
    // Spark serves the first 900; 100 missing is past max(10, 0.5% of 1,000 = 5).
    spark.window = ours.slice(0, 900).map((k) => sparkClosing(k))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.notInSpark).toHaveLength(100)
    expect(r.absentFromMls.recorded).toBe(0)
    expect(r.absentFromMls.refused).toMatch(/more than removed listings explain/)
    // Nothing recorded is nothing to delete.
    expect(store.deleteCalls).toEqual([])
  })
})

describe('deleting the sales the MLS removed (Matt 2026-09-30)', () => {
  function oneMissing() {
    spark.window = [sparkClosing('K2')]
    store.closedInWindow = ['GONE', 'K2']
    store.rows.set('GONE', ourRow('GONE'))
    store.rows.set('K2', ourRow('K2'))
  }
  const WINDOW = { from: '2026-03-01', to: '2026-03-31' }

  it('hands the deletion only the keys this run confirmed missing, with the day budget and the window', async () => {
    oneMissing()
    // Recorded earlier and still missing, but not held as closed in the window any more: not this run's to delete.
    store.absent.add('OLDER')
    store.absentCloseDate.set('OLDER', '2026-03-02')
    await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(store.deleteCalls).toEqual([{ keys: ['GONE'], maxDelete: 10, window: WINDOW }])
  })

  it('deletes nothing unless removal is on: report mode, or a repair without it', async () => {
    oneMissing()
    await reconcileClosings({ ...WINDOW, repair: false, removeAbsent: true })
    await reconcileClosings({ ...WINDOW, repair: true })
    expect(store.deleteCalls).toEqual([])
    expect(alerts).toEqual([])
  })

  it('recording refused as an outage passes no key: the call only reports a standing hold', async () => {
    oneMissing()
    spark.window = []
    store.deleteResult = { removed: [], refused: null, due: 0, held: 3, waiting: 0, budget: 10 }
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls.refused).toMatch(/no closings/)
    expect(store.deleteCalls).toEqual([{ keys: [], maxDelete: 10, window: WINDOW }])
    expect(r.absentFromMls).toMatchObject({ removed: [], held: 3 })
  })

  it('texts what was deleted from the log, once, and marks it told', async () => {
    oneMissing()
    store.deleteResult = { removed: [removedSale()], refused: null, due: 1, held: 0, waiting: 0, budget: 9 }
    store.notices = [notice()]
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls).toMatchObject({ told: 1, removalHeld: null })
    expect(r.absentFromMls.removed.map((x) => x.listingKey)).toEqual(['GONE'])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.key).toBe('mls-removed-3637')
    expect(alerts[0]!.body).toContain('15714 Tumble Weed Turn, Sisters, MLS 220217062, closed Mar 10, 2026, $735,000')
    expect(alerts[0]!.body).toContain('repair log id 3637')
    expect(store.reported).toEqual([3637])

    alerts.length = 0
    await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(alerts).toEqual([])
  })

  it('a deletion whose answer was lost is still told on a later run, from the log', async () => {
    oneMissing()
    const { deleteMlsRemovedSales } = await import('@/lib/data/sync/closingsReconcile')
    vi.mocked(deleteMlsRemovedSales).mockRejectedValueOnce(new Error('[deleteMlsRemovedSales] fetch failed'))
    // The delete committed; only its answer was lost. The log still has the row.
    store.notices = [notice()]
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls.removalFailed).toBe('[deleteMlsRemovedSales] fetch failed')
    expect(alerts.map((a) => a.key)).toEqual(['mls-removed-failed', 'mls-removed-3637'])
    // The failure text never claims nothing was removed: the removal is texted on its own.
    expect(alerts[0]!.body).toContain('Any it did remove are texted separately')
    expect(store.reported).toEqual([3637])
  })

  it('a text that did not queue stays untold, and is tried again', async () => {
    store.notices = [notice()]
    alertQueues = false
    expect(await tellMlsRemovals()).toBe(0)
    expect(store.reported).toEqual([])
    alertQueues = true
    expect(await tellMlsRemovals()).toBe(1)
    expect(store.reported).toEqual([3637])
  })

  it('tells restores apart from deletions, one text each', async () => {
    store.notices = [notice(), notice({ logId: 3640, kind: 'restored', listingKey: 'BACK', listNumber: '220216130', streetNumber: '18581', streetName: 'Couch Market', city: 'Bend' })]
    expect(await tellMlsRemovals()).toBe(2)
    expect(alerts.map((a) => a.key)).toEqual(['mls-removed-3637', 'mls-restored-3640'])
    expect(alerts[1]!.body).toMatch(/^The MLS has 1 closed sale again/)
  })

  it('texts a held batch with the reason the SQL gave, and deletes nothing', async () => {
    oneMissing()
    store.deleteResult = { removed: [], refused: 'budget', due: 14, held: 14, waiting: 2, budget: 7 }
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls).toMatchObject({ removed: [], removalHeld: 'budget', held: 14, waiting: 2 })
    expect(alerts).toEqual([{ key: 'mls-removed-held', body: heldSalesText({ reason: 'budget', due: 14, held: 14, budget: 7 }) }])
    expect(alerts[0]!.body).toContain('more than the 7 the daily check may still remove today')

    alerts.length = 0
    store.deleteResult = { removed: [], refused: 'hold', due: 1, held: 15, waiting: 0, budget: 10 }
    await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(alerts[0]!.body).toMatch(/^15 closed sales the MLS no longer has are held until someone checks and approves/)
  })

  it('a failed deletion is told and never stops the run: the repair still happens', async () => {
    oneMissing()
    spark.window.push(sparkClosing('K3', { ClosePrice: 93588 }))
    spark.byKey.set('K3', sparkClosing('K3', { ClosePrice: 93588 }))
    store.closedInWindow.push('K3')
    store.rows.set('K3', ourRow('K3', { ClosePrice: 93588000 }))
    const { deleteMlsRemovedSales } = await import('@/lib/data/sync/closingsReconcile')
    vi.mocked(deleteMlsRemovedSales).mockRejectedValueOnce(new Error('[deleteMlsRemovedSales] statement timeout'))
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls).toMatchObject({ recorded: 1, removed: [], removalFailed: '[deleteMlsRemovedSales] statement timeout' })
    expect(r.repaired).toBe(1)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.key).toBe('mls-removed-failed')
    expect(alerts[0]!.body).toContain('tries again tomorrow')
  })

  it('says nothing while a sale is not due yet', async () => {
    oneMissing()
    store.deleteResult = { removed: [], refused: null, due: 0, held: 0, waiting: 1, budget: 10 }
    const r = await reconcileClosings({ ...WINDOW, repair: true, removeAbsent: true })
    expect(r.absentFromMls.waiting).toBe(1)
    expect(alerts).toEqual([])
  })
})

describe('rebuilding restored sales after the day\'s writes', () => {
  it('the daily run rebuilds every pending restore after its repairs, and reports how many', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    let upsertedAtRebuild: string[] = []
    rebuildRestoredSales.mockImplementationOnce(async () => {
      upsertedAtRebuild = [...store.upserted]
      return 2
    })
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true, removeAbsent: true })
    expect(r.absentFromMls.restoresRebuilt).toBe(2)
    // The repair's write landed first.
    expect(upsertedAtRebuild).toEqual(['K1'])
  })

  it('runs with nothing to repair too, and never outside the daily run', async () => {
    rebuildRestoredSales.mockClear()
    await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true, removeAbsent: true })
    expect(rebuildRestoredSales).toHaveBeenCalledTimes(1)
    await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: false, removeAbsent: true })
    expect(rebuildRestoredSales).toHaveBeenCalledTimes(1)
  })
})

describe('a deleted sale the MLS serves again', () => {
  it('gets its saved row back before the repair re-pulls it, so the repair updates our full record', async () => {
    spark.window = [sparkClosing('BACK', { ClosePrice: 93588 })]
    spark.byKey.set('BACK', sparkClosing('BACK', { ClosePrice: 93588 }))
    store.restorable.add('BACK')
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(store.restoreCalls).toEqual([['BACK']])
    expect(r.repaired).toBe(1)
    // The repair logged the restored row as its before-image.
    expect(store.repairLog[0]).toMatchObject({ listingKey: 'BACK', beforeRow: { ListingKey: 'BACK', ClosePrice: 93588000 } })
  })

  it('restores nothing for drift that is not a missing row', async () => {
    spark.window = [sparkClosing('K1', { ClosePrice: 93588 })]
    spark.byKey.set('K1', sparkClosing('K1', { ClosePrice: 93588 }))
    store.closedInWindow = ['K1']
    store.rows.set('K1', ourRow('K1', { ClosePrice: 93588000 }))
    await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(store.restoreCalls).toEqual([])
  })
})
