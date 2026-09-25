import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The closings reconciliation against a fake Spark and a fake store: which
 * closings count as drift, and how a closing Spark no longer serves is
 * recorded (repair mode only) and released when Spark serves it again
 * (Matt 2026-09-25: a sale the MLS removed is left out of every statistic).
 */

type Fields = Record<string, unknown>
const spark = { window: [] as Fields[], byKey: new Map<string, Fields>() }
const store = {
  closedInWindow: [] as string[],
  rows: new Map<string, Record<string, unknown>>(),
  absent: new Set<string>(),
  recorded: [] as { listingKey: string; listNumber: string | null; closeDate: string | null }[],
  cleared: [] as string[],
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingsPage: vi.fn(async (_token: string, opts: { filter?: string }) => {
    const filter = opts.filter ?? ''
    if (filter.startsWith("StandardStatus Eq 'Closed'")) {
      return { D: { Results: spark.window.map((f) => ({ StandardFields: f })), Pagination: { TotalPages: 1 } } }
    }
    const keys = [...filter.matchAll(/ListingKey Eq '([^']+)'/g)].map((m) => m[1]!)
    const hits = keys.flatMap((k) => (spark.byKey.has(k) ? [{ StandardFields: spark.byKey.get(k)! }] : []))
    return { D: { Results: hits, Pagination: { TotalPages: 1 } } }
  }),
}))
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
  getAbsentFromMlsKeys: vi.fn(async () => [...store.absent]),
  clearAbsentFromMls: vi.fn(async (keys: string[]) => {
    store.cleared.push(...keys)
    for (const k of keys) store.absent.delete(k)
    return keys.length
  }),
}))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  getAdminOverrideFlags: vi.fn(async () => new Map()),
  getHeldMediaByListNumbers: vi.fn(async () => new Map()),
  setListingFreezeFlags: vi.fn(async () => undefined),
  upsertListingRows: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/data/market-report/compute', () => ({ refreshMarketFactSpansForKeys: vi.fn(async () => ({ rebuilt: 0, missed: [] })) }))
vi.mock('@/lib/sync/fetchListingHistory', () => ({ fetchAndInsertHistoryCore: vi.fn() }))
vi.mock('@/lib/sync/deltaSync', () => ({
  DELTA_SYNC: { EXPAND: '', UPSERT_CHUNK: 50 },
  resolveRunMortgageRate: vi.fn(async () => null),
  resultToMappedRow: vi.fn(),
}))

import { reconcileClosings } from './closingsReconcile'

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
  store.closedInWindow = []
  store.rows = new Map()
  store.absent = new Set()
  store.recorded = []
  store.cleared = []
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

  it('records a closing Spark no longer serves only in repair mode', async () => {
    store.closedInWindow = ['GONE']
    store.rows.set('GONE', ourRow('GONE'))

    const report = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: false })
    expect(report.notInSpark).toEqual(['GONE'])
    expect(report.absentFromMls).toEqual({ recorded: 0, cleared: 0 })
    expect(store.recorded).toEqual([])

    const repair = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(repair.absentFromMls).toEqual({ recorded: 1, cleared: 0 })
    expect(store.recorded).toEqual([{ listingKey: 'GONE', listNumber: 'LGONE', closeDate: '2026-03-10' }])
  })

  it('releases a recorded key once Spark serves it again', async () => {
    store.absent.add('BACK')
    spark.byKey.set('BACK', sparkClosing('BACK', { CloseDate: '2025-02-01' }))
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 1 })
    expect(store.cleared).toEqual(['BACK'])
    expect(store.absent.has('BACK')).toBe(false)
  })

  it('keeps a recorded key Spark still does not serve', async () => {
    store.absent.add('STILL-GONE')
    const r = await reconcileClosings({ from: '2026-03-01', to: '2026-03-31', repair: true })
    expect(r.absentFromMls).toEqual({ recorded: 0, cleared: 0 })
    expect(store.absent.has('STILL-GONE')).toBe(true)
  })
})
