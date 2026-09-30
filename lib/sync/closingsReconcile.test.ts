import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The closings reconciliation against a fake Spark and a fake store: which
 * closings count as drift, and how a closing Spark no longer serves is
 * recorded (repair mode only) and released when Spark serves it again
 * (Matt 2026-09-25: a sale the MLS removed is left out of every statistic),
 * and how a repair keeps each listing's old values before rewriting it.
 */

type Fields = Record<string, unknown>
const spark = { window: [] as Fields[], byKey: new Map<string, Fields>(), onMarket: [] as Fields[], filters: [] as string[] }
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
  onMarketKeys: [] as string[],
  terminalKeys: [] as string[],
  overrides: new Map<string, { status: boolean; listPrice: boolean }>(),
  repairSources: [] as string[],
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingsPage: vi.fn(async (_token: string, opts: { filter?: string }) => {
    const filter = opts.filter ?? ''
    spark.filters.push(filter)
    if (filter.startsWith("StandardStatus Eq 'Active'")) {
      return { D: { Results: spark.onMarket.map((f) => ({ StandardFields: f })), Pagination: { TotalPages: 1 } } }
    }
    if (filter.startsWith("StandardStatus Eq 'Closed'")) {
      return { D: { Results: spark.window.map((f) => ({ StandardFields: f })), Pagination: { TotalPages: 1 } } }
    }
    const keys = [...filter.matchAll(/ListingKey Eq '([^']+)'/g)].map((m) => m[1]!)
    const hits = keys.flatMap((k) => (spark.byKey.has(k) ? [{ StandardFields: spark.byKey.get(k)! }] : []))
    return { D: { Results: hits, Pagination: { TotalPages: 1 } } }
  }),
}))
vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  ON_MARKET_STATUSES: ['Active', 'Active Under Contract', 'Coming Soon', 'Pending'],
  getClosedListingKeysInWindow: vi.fn(async () => store.closedInWindow),
  getOnMarketListingKeys: vi.fn(async () => store.onMarketKeys),
  getRecentUnsoldTerminalKeys: vi.fn(async () => store.terminalKeys),
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
  recordRepairLog: vi.fn(async (entries: Record<string, unknown>[], source?: string) => {
    if (store.repairLogFails) throw new Error('[recordRepairLog] insert failed')
    store.repairSources.push(source ?? 'closings-reconcile')
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
}))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  getAdminOverrideFlags: vi.fn(async (listNumbers: string[]) => {
    const out = new Map<string, { status: boolean; listPrice: boolean }>()
    for (const n of listNumbers) if (store.overrides.has(n)) out.set(n, store.overrides.get(n)!)
    return out
  }),
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
    ModificationTimestamp: r.StandardFields.ModificationTimestamp ?? null,
  })),
}))

import { reconcileClosings, reconcileListingStatus } from './closingsReconcile'

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
  spark.onMarket = []
  spark.filters = []
  store.onMarketKeys = []
  store.terminalKeys = []
  store.overrides = new Map()
  store.repairSources = []
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
    expect(report.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null })
    expect(store.recorded).toEqual([])

    // Spark still serves the window's other closings: one missing sale is a removal, not an outage.
    spark.window = [sparkClosing('K2')]
    store.closedInWindow = ['GONE', 'K2']
    store.rows.set('K2', ourRow('K2'))
    const repair = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(repair.absentFromMls).toEqual({ recorded: 1, cleared: 0, refused: null })
    expect(store.recorded).toEqual([{ listingKey: 'GONE', listNumber: 'LGONE', closeDate: '2026-03-10' }])
  })

  it('releases a recorded key once Spark serves it again', async () => {
    store.absent.add('BACK')
    store.absentCloseDate.set('BACK', '2026-03-12')
    spark.byKey.set('BACK', sparkClosing('BACK', { CloseDate: '2026-03-12' }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 1, refused: null })
    expect(store.cleared).toEqual(['BACK'])
    expect(store.absent.has('BACK')).toBe(false)
  })

  it('re-checks only the recorded keys that closed inside the window', async () => {
    store.absent.add('OLD')
    store.absentCloseDate.set('OLD', '2025-02-01')
    spark.byKey.set('OLD', sparkClosing('OLD', { CloseDate: '2025-02-01' }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null })
    expect(store.absent.has('OLD')).toBe(true)
  })

  it('keeps a recorded key Spark still does not serve', async () => {
    store.absent.add('STILL-GONE')
    store.absentCloseDate.set('STILL-GONE', '2026-03-05')
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 0, refused: null })
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
  })
})

/**
 * Listing status reconciliation (2026-09-30): every listing Spark or we hold on
 * the market, plus our recent Expired/Withdrawn/Canceled rows, set against each
 * other by key. It shares the closings repair path (before-image first, the
 * delta sync's mapper, history, re-freeze), logged as 'status-reconcile'.
 */
function sparkListing(key: string, over: Fields = {}): Fields {
  return {
    ListingKey: key,
    ListingId: `L${key}`,
    StandardStatus: 'Active',
    ListPrice: 625000,
    City: 'Bend',
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    TotalLivingAreaSqFt: 1800,
    ModificationTimestamp: '2026-08-18T22:14:24Z',
    ...over,
  }
}

function ourListing(key: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ListNumber: `L${key}`,
    ListingKey: key,
    StandardStatus: 'Active',
    City: 'Bend',
    CloseDate: null,
    ClosePrice: null,
    ListPrice: 625000,
    property_sub_type: 'Single Family Residence',
    TotalLivingAreaSqFt: 1800,
    is_finalized: false,
    media_finalized: false,
    ...over,
  }
}

/** Enough steady on-market listings that one drifted row is not read as an outage. */
function steadyMarket(n: number): string[] {
  const keys = Array.from({ length: n }, (_, i) => `S${i}`)
  for (const k of keys) {
    spark.onMarket.push(sparkListing(k))
    store.rows.set(k, ourListing(k))
  }
  store.onMarketKeys.push(...keys)
  return keys
}

describe('reconcileListingStatus', () => {
  it('finds a relist the delta sync skipped: Spark holds the key on the market, we hold it Expired and frozen', async () => {
    steadyMarket(3)
    const key = '20260120200524195349000000'
    spark.onMarket.push(sparkListing(key))
    store.rows.set(key, ourListing(key, { StandardStatus: 'Expired', is_finalized: true }))
    const r = await reconcileListingStatus({ repair: false, terminalSinceDays: 120 })
    expect(r.sparkOnMarket).toBe(4)
    expect(r.ourOnMarket).toBe(3)
    expect(r.drift).toEqual([
      expect.objectContaining({ key, reasons: ['status'], ours: expect.objectContaining({ status: 'Expired' }), mls: expect.objectContaining({ status: 'Active' }) }),
    ])
    expect(r.repaired).toBe(0)
    expect(store.upserted).toEqual([])
    expect(store.repairLog).toEqual([])
  })

  it('repairs it through the closings repair path, logged as status-reconcile, and leaves it unfrozen', async () => {
    steadyMarket(3)
    const key = '20260120200524195349000000'
    spark.onMarket.push(sparkListing(key))
    spark.byKey.set(key, sparkListing(key))
    store.rows.set(key, ourListing(key, { StandardStatus: 'Expired', is_finalized: true }))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.repaired).toBe(1)
    expect(r.repairedKeys).toEqual([key])
    expect(r.refinalized).toBe(0)
    expect(store.upserted).toEqual([key])
    expect(store.repairSources).toEqual(['status-reconcile'])
    expect(store.repairLog[0]).toMatchObject({ listingKey: key, reasons: ['status'], windowFrom: null, windowTo: null, ours: { status: 'Expired' } })
  })

  it('finds a ghost on-market row by key: we hold it Active, Spark holds it Canceled; a repair re-freezes it', async () => {
    steadyMarket(3)
    store.onMarketKeys.push('GHOST')
    store.rows.set('GHOST', ourListing('GHOST'))
    spark.byKey.set('GHOST', sparkListing('GHOST', { StandardStatus: 'Canceled', ModificationTimestamp: '2026-05-13T18:57:12Z' }))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['GHOST', ['status']]])
    expect(r.repaired).toBe(1)
    expect(r.refinalized).toBe(1)
  })

  it('reports an on-market row Spark does not serve at all, and never writes it', async () => {
    steadyMarket(3)
    store.onMarketKeys.push('VANISHED')
    store.rows.set('VANISHED', ourListing('VANISHED'))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.notInSpark).toEqual(['VANISHED'])
    expect(r.drift).toEqual([])
    expect(store.upserted).toEqual([])
  })

  it('re-checks our recent Expired/Withdrawn/Canceled rows by key', async () => {
    steadyMarket(3)
    store.terminalKeys = ['T1', 'T2']
    store.rows.set('T1', ourListing('T1', { StandardStatus: 'Withdrawn', is_finalized: true }))
    store.rows.set('T2', ourListing('T2', { StandardStatus: 'Expired', is_finalized: true }))
    spark.byKey.set('T1', sparkListing('T1', { StandardStatus: 'Canceled' }))
    spark.byKey.set('T2', sparkListing('T2', { StandardStatus: 'Expired' }))
    const r = await reconcileListingStatus({ repair: false, terminalSinceDays: 120 })
    expect(r.terminalChecked).toBe(2)
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['T1', ['status']]])
  })

  it('skips the terminal re-check when asked (terminalSinceDays 0)', async () => {
    steadyMarket(3)
    store.terminalKeys = ['T1']
    store.rows.set('T1', ourListing('T1', { StandardStatus: 'Withdrawn', is_finalized: true }))
    spark.byKey.set('T1', sparkListing('T1', { StandardStatus: 'Canceled' }))
    const r = await reconcileListingStatus({ repair: false, terminalSinceDays: 0 })
    expect(r.terminalChecked).toBe(0)
    expect(r.drift).toEqual([])
  })

  it('a listing Spark holds on the market that we do not hold at all is missing, and a repair writes it', async () => {
    steadyMarket(3)
    spark.onMarket.push(sparkListing('NEW'))
    spark.byKey.set('NEW', sparkListing('NEW'))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['NEW', ['missing']]])
    expect(store.upserted).toEqual(['NEW'])
  })

  it('a broker override of status is our copy on purpose, not drift', async () => {
    steadyMarket(3)
    spark.onMarket.push(sparkListing('OVR'))
    store.rows.set('OVR', ourListing('OVR', { StandardStatus: 'Withdrawn', is_finalized: true }))
    store.overrides.set('LOVR', { status: true, listPrice: false })
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift).toEqual([])
    expect(store.upserted).toEqual([])
  })

  it('an on-market row we hold frozen is repaired (and so unfrozen) even when every fact agrees', async () => {
    steadyMarket(3)
    spark.onMarket.push(sparkListing('FROZEN'))
    spark.byKey.set('FROZEN', sparkListing('FROZEN'))
    store.rows.set('FROZEN', ourListing('FROZEN', { is_finalized: true }))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['FROZEN', ['frozen_not_terminal']]])
    expect(store.upserted).toEqual(['FROZEN'])
    expect(r.refinalized).toBe(0)
  })

  it('a broker override of list price is not drift either (a repair would only re-apply it, every day)', async () => {
    steadyMarket(3)
    spark.onMarket.push(sparkListing('LPO', { ListPrice: 600000 }))
    store.rows.set('LPO', ourListing('LPO', { ListPrice: 625000 }))
    store.overrides.set('LLPO', { status: false, listPrice: true })
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift).toEqual([])
    expect(store.upserted).toEqual([])
  })

  it('status drift is repaired first when the cap bites', async () => {
    steadyMarket(3)
    // A list-price-only drift sorts ahead by key, a status drift behind it.
    spark.onMarket.push(sparkListing('A-PRICE', { ListPrice: 600000 }))
    store.rows.set('A-PRICE', ourListing('A-PRICE'))
    spark.onMarket.push(sparkListing('Z-STATUS'))
    store.rows.set('Z-STATUS', ourListing('Z-STATUS', { StandardStatus: 'Expired', is_finalized: true }))
    spark.byKey.set('Z-STATUS', sparkListing('Z-STATUS'))
    spark.byKey.set('A-PRICE', sparkListing('A-PRICE', { ListPrice: 600000 }))
    const r = await reconcileListingStatus({ repair: true, maxRepairs: 1, terminalSinceDays: 120 })
    expect(r.drift.map((d) => d.key)).toEqual(['Z-STATUS', 'A-PRICE'])
    expect(store.upserted).toEqual(['Z-STATUS'])
  })

  it('refuses to repair when Spark returns far fewer on-market listings than we hold (an outage, not a market)', async () => {
    const ours = Array.from({ length: 10 }, (_, i) => `O${i}`)
    store.onMarketKeys = ours
    for (const k of ours) store.rows.set(k, ourListing(k))
    spark.onMarket = [sparkListing('O0'), sparkListing('O1')]
    spark.byKey.set('O2', sparkListing('O2', { StandardStatus: 'Canceled' }))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.refused).toMatch(/Spark returned 2 on-market listings while we hold 10/)
    expect(r.repaired).toBe(0)
    expect(store.upserted).toEqual([])
    // No per-key lookups are spent on a pull that looks like an outage.
    expect(spark.filters.some((f) => f.includes('ListingKey Eq'))).toBe(false)
  })

  it('never writes an older MLS record over a row the delta sync has since written newer', async () => {
    steadyMarket(3)
    spark.onMarket.push(sparkListing('RACE'))
    spark.byKey.set('RACE', sparkListing('RACE', { ModificationTimestamp: '2026-09-29T10:00:00Z' }))
    store.rows.set('RACE', ourListing('RACE', { StandardStatus: 'Expired', is_finalized: true, ModificationTimestamp: '2026-09-29T10:05:00+00:00' }))
    const r = await reconcileListingStatus({ repair: true, terminalSinceDays: 120 })
    expect(r.drift.map((d) => d.key)).toEqual(['RACE'])
    expect(r.repaired).toBe(0)
    expect(r.skippedNewer).toEqual(['RACE'])
    expect(r.repairFailed).toEqual([])
    expect(store.upserted).toEqual([])
    expect(store.repairLog).toEqual([])
  })
})
