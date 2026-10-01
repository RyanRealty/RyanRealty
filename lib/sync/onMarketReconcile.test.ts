import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The on-market reconciliation against a fake Spark and a fake store: which
 * listings count as drift (a status the MLS changed that we never saw, a
 * listing we lack), which are looked up by key, that a listing the MLS no
 * longer serves is only reported, that a broker's status override is kept,
 * and that the repair is the closings reconciliation's, logged under its own
 * source. Measured 2026-10-01: 20260217210721118597000000 was Active in our
 * copy and Canceled in Spark since 2026-05-12.
 */

type Fields = Record<string, unknown>
const spark = { onMarket: [] as Fields[], byKey: new Map<string, Fields>(), filters: [] as string[] }
const store = {
  onMarket: [] as { key: string; status: string }[],
  rows: new Map<string, Record<string, unknown>>(),
  overrides: new Map<string, { status: boolean; listPrice: boolean }>(),
  cursor: '2026-10-01T09:00:00Z' as string | null,
  cursorFails: false,
  restoreCalls: [] as string[][],
  repairCalls: [] as { keys: string[]; source?: string; reasons: [string, string[]][] }[],
  repairOpts: [] as { leaveModifiedFrom?: number; deadline?: number }[],
  freshAtRepair: new Set<string>(),
  unreachedAtRepair: new Set<string>(),
}

vi.mock('@/lib/spark', async () => {
  const { allPages } = await import('@/test/spark-skip-token-fake')
  return {
    fetchSparkListingsWhere: vi.fn(async (_token: string, opts: { filter: string }) => {
      spark.filters.push(opts.filter)
      return opts.filter.startsWith('StandardStatus Eq ') ? allPages(spark.onMarket) : []
    }),
    fetchSparkListingsPage: vi.fn(async (_token: string, opts: { filter?: string }) => {
      const filter = opts.filter ?? ''
      spark.filters.push(filter)
      const keys = [...filter.matchAll(/ListingKey Eq '([^']+)'/g)].map((m) => m[1]!)
      const hits = keys.flatMap((k) => (spark.byKey.has(k) ? [{ StandardFields: spark.byKey.get(k)! }] : []))
      return { D: { Results: hits, Pagination: { TotalPages: 1 } } }
    }),
  }
})
vi.mock('@/lib/data/sync/closingsReconcile', () => ({
  getOnMarketListingRows: vi.fn(async () =>
    store.onMarket.map((o) => ({ ...(store.rows.get(o.key) ?? {}), ListingKey: o.key, StandardStatus: o.status })),
  ),
  getListingsForReconcile: vi.fn(async (keys: string[]) => {
    const out = new Map<string, Record<string, unknown>>()
    for (const k of keys) if (store.rows.has(k)) out.set(k, store.rows.get(k)!)
    return out
  }),
}))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  getAdminOverrideFlags: vi.fn(async (nums: string[]) => new Map(nums.flatMap((n) => (store.overrides.has(n) ? [[n, store.overrides.get(n)!]] : [])))),
  getDeltaSyncCursor: vi.fn(async () => {
    if (store.cursorFails) throw new Error('[getDeltaSyncCursor] connection reset')
    return store.cursor
  }),
}))
vi.mock('@/lib/sync/mlsRemovedRestore', () => ({
  restoreServedAgain: vi.fn(async (keys: string[]) => {
    store.restoreCalls.push(keys)
    return []
  }),
}))
vi.mock('@/lib/sync/closingsReconcile', async (importOriginal) => {
  const real = await importOriginal<typeof import('./closingsReconcile')>()
  return {
    ...real,
    repairListingsFromSpark: vi.fn(
      async (keys: string[], log: { source?: string; reasons: Map<string, string[]> }, opts: { leaveModifiedFrom?: number; deadline?: number } = {}) => {
        store.repairCalls.push({ keys, source: log.source, reasons: [...log.reasons.entries()] })
        store.repairOpts.push(opts)
        const left = keys.filter((k) => store.freshAtRepair.has(k))
        const unreached = keys.filter((k) => store.unreachedAtRepair.has(k))
        const done = keys.filter((k) => !store.freshAtRepair.has(k) && !store.unreachedAtRepair.has(k))
        return {
          repaired: done.length, repairedKeys: done, repairLogged: done.length, failed: [], historyRefreshed: 0,
          refinalized: 0, membershipRows: 0, leftToDeltaSync: left, unreached,
        }
      },
    ),
  }
})
// The real closings module imports these; this file never reaches them.
vi.mock('@/lib/crm/broker-alerts', () => ({ queueBrokerHealthAlert: vi.fn() }))
vi.mock('@/lib/data/market-report/compute', () => ({ refreshMarketFactSpansForKeys: vi.fn() }))
vi.mock('@/lib/sync/fetchListingHistory', () => ({ fetchAndInsertHistoryCore: vi.fn() }))
vi.mock('@/lib/sync/deltaSync', () => ({ DELTA_SYNC: { EXPAND: '', UPSERT_CHUNK: 50 }, resolveRunMortgageRate: vi.fn(), resultToMappedRow: vi.fn() }))

import { COMING_SOON_STATUS, LIVE_INVENTORY_STATUSES } from '@/lib/listing-status-public'
import { findOnMarketDrift, keysToLookUp, planOnMarketRepair, reconcileOnMarket } from './onMarketReconcile'

function mls(key: string, status: string, extra: Fields = {}): Fields {
  return {
    ListingKey: key, ListingId: `n-${key}`, StandardStatus: status, City: 'Bend', ListPrice: 500000,
    PropertySubType: 'Single Family Residence', PropertyType: 'A', ModificationTimestamp: '2026-05-12T18:14:43Z', ...extra,
  }
}
function ours(key: string, status: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ListNumber: `n-${key}`, ListingKey: key, StandardStatus: status, City: 'Bend', ListPrice: 500000, property_sub_type: 'Single Family Residence', ...extra }
}

beforeEach(() => {
  spark.onMarket = []
  spark.byKey = new Map()
  spark.filters = []
  store.onMarket = []
  store.rows = new Map()
  store.overrides = new Map()
  store.cursor = '2026-10-01T09:00:00Z'
  store.cursorFails = false
  store.restoreCalls = []
  store.repairCalls = []
  store.repairOpts = []
  store.freshAtRepair = new Set()
  store.unreachedAtRepair = new Set()
  process.env.SPARK_API_KEY = 'test-token'
})

describe('keysToLookUp', () => {
  it('names our on-market keys the MLS does not hold on the market', () => {
    expect(keysToLookUp([{ key: 'a' }, { key: 'b' }, { key: 'c' }], new Map([['b', 1]]))).toEqual(['a', 'c'])
  })
})

describe('findOnMarketDrift', () => {
  it('pulls the on-market set by status, then looks up only the keys it lacks', async () => {
    spark.onMarket = [mls('same', 'Active')]
    spark.byKey.set('canceled', mls('canceled', 'Canceled'))
    store.onMarket = [{ key: 'same', status: 'Active' }, { key: 'canceled', status: 'Active' }]
    store.rows.set('same', ours('same', 'Active'))
    store.rows.set('canceled', ours('canceled', 'Active'))
    const r = await findOnMarketDrift()
    expect(spark.filters[0]).toBe(`StandardStatus Eq ${LIVE_INVENTORY_STATUSES.map((x) => `'${x}'`).join(',')}`)
    expect(spark.filters.filter((f) => !f.startsWith('StandardStatus'))).toEqual(["ListingKey Eq 'canceled'"])
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['canceled', ['status']]])
    expect(r.drift[0]).toMatchObject({ ours: { status: 'Active' }, mls: { status: 'Canceled', propertyType: 'A' } })
    expect(r).toMatchObject({ sparkOnMarket: 1, ourOnMarket: 2, notInSpark: [] })
  })

  it('finds a listing the MLS holds on the market that we lack, and one we hold at another on-market status', async () => {
    spark.onMarket = [mls('new', 'Active'), mls('pending', 'Pending')]
    store.onMarket = [{ key: 'pending', status: 'Active' }]
    store.rows.set('pending', ours('pending', 'Active'))
    const r = await findOnMarketDrift()
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([
      ['new', ['missing']],
      ['pending', ['status']],
    ])
  })

  it('reports a listing the MLS no longer serves and does not call it drift', async () => {
    store.onMarket = [{ key: 'gone', status: COMING_SOON_STATUS }]
    store.rows.set('gone', ours('gone', COMING_SOON_STATUS))
    const r = await findOnMarketDrift()
    expect(r.notInSpark).toEqual([{ key: 'gone', status: COMING_SOON_STATUS }])
    expect(r.drift).toEqual([])
  })

  it("keeps a broker's status override and still repairs the listing's other facts", async () => {
    spark.byKey.set('held', mls('held', 'Expired', { ListPrice: 450000 }))
    store.onMarket = [{ key: 'held', status: 'Active' }]
    store.rows.set('held', ours('held', 'Active'))
    store.overrides.set('n-held', { status: true, listPrice: false })
    const r = await findOnMarketDrift()
    expect(r.drift.map((d) => [d.key, d.reasons])).toEqual([['held', ['list_price']]])
  })

  it("keeps a broker's list-price override: no drift, no daily repair", async () => {
    spark.onMarket = [mls('priced', 'Active', { ListPrice: 450000 })]
    store.onMarket = [{ key: 'priced', status: 'Active' }]
    store.rows.set('priced', ours('priced', 'Active'))
    store.overrides.set('n-priced', { status: false, listPrice: true })
    const r = await findOnMarketDrift()
    expect(r.drift).toEqual([])
  })

  it('leaves to the delta sync a listing the MLS changed since its cursor (less the margin): that sync records the events', async () => {
    spark.onMarket = [mls('fresh', 'Pending', { ModificationTimestamp: '2026-10-01T08:30:00Z' }), mls('fresh-new', 'Active', { ModificationTimestamp: '2026-10-01T09:10:00Z' })]
    spark.byKey.set('stale', mls('stale', 'Expired', { ModificationTimestamp: '2026-04-01T06:30:40Z' }))
    store.onMarket = [{ key: 'fresh', status: 'Active' }, { key: 'stale', status: 'Active' }]
    store.rows.set('fresh', ours('fresh', 'Active'))
    store.rows.set('stale', ours('stale', 'Active'))
    const r = await findOnMarketDrift()
    expect(r.drift.map((d) => d.key)).toEqual(['stale'])
    expect(r.leftToDeltaSync).toBe(2)
  })
})

describe('findOnMarketDrift, the hand-off to the delta sync', () => {
  it('stops when the delta-sync cursor cannot be read, rather than taking listings the sync has not reached', async () => {
    store.cursorFails = true
    await expect(findOnMarketDrift()).rejects.toThrow(/getDeltaSyncCursor/)
  })

  it('reads the whole Spark set through the skip-token reader, past a page of 1,000', async () => {
    spark.onMarket = Array.from({ length: 1500 }, (_, i) => mls(`k${String(i).padStart(4, '0')}`, 'Active'))
    const r = await findOnMarketDrift()
    expect(r.sparkOnMarket).toBe(1500)
  })
})

describe('reconcileOnMarket', () => {
  it('repairs through the closings repair under its own source, restoring a deleted sale first', async () => {
    spark.onMarket = [mls('new', 'Active')]
    spark.byKey.set('expired', mls('expired', 'Expired'))
    store.onMarket = [{ key: 'expired', status: 'Active' }]
    store.rows.set('expired', ours('expired', 'Active'))
    const r = await reconcileOnMarket({ repair: true, maxRepairs: 10, today: '2026-10-01' })
    expect(store.restoreCalls).toEqual([['new']])
    expect(store.repairCalls).toEqual([
      { keys: ['expired', 'new'], source: 'on-market-reconcile', reasons: [['expired', ['status']], ['new', ['missing']]] },
    ])
    expect(r).toMatchObject({ repaired: 2, repairFailed: [], repairedKeys: ['expired', 'new'] })
  })

  it('caps the repair and writes nothing without repair', async () => {
    spark.byKey.set('a', mls('a', 'Expired'))
    spark.byKey.set('b', mls('b', 'Canceled'))
    store.onMarket = [{ key: 'a', status: 'Active' }, { key: 'b', status: 'Active' }]
    store.rows.set('a', ours('a', 'Active'))
    store.rows.set('b', ours('b', 'Active'))
    const dry = await reconcileOnMarket({ repair: false, maxRepairs: 10, today: '2026-10-01' })
    expect(dry.drift).toHaveLength(2)
    expect(store.repairCalls).toEqual([])
    await reconcileOnMarket({ repair: true, maxRepairs: 1, today: '2026-10-01' })
    expect(store.repairCalls.map((c) => c.keys)).toEqual([['a']])
  })
})

describe('planOnMarketRepair', () => {
  const lite = (key: string, mod: string) => [key, { key, listNumber: key, fields: { ModificationTimestamp: mod } }] as const
  const d = (key: string, reasons: string[]) => ({ key, listNumber: key, reasons, mls: {}, ours: null }) as never
  it('repairs a wrong status or a missing listing before a wrong fact, the longest-stale first', () => {
    const lites = new Map([lite('a', '2026-06-01T00:00:00Z'), lite('b', '2026-03-01T00:00:00Z'), lite('c', '2026-01-01T00:00:00Z'), lite('d', '2026-02-01T00:00:00Z')])
    const plan = planOnMarketRepair([d('a', ['status']), d('b', ['missing']), d('c', ['list_price']), d('d', ['status'])], lites, Date.parse('2026-09-01T00:00:00Z'))
    expect(plan.repair.map((x: { key: string }) => x.key)).toEqual(['d', 'b', 'a', 'c'])
    expect(plan.leftToDeltaSync).toBe(0)
  })
})

describe('reconcileOnMarket arguments', () => {
  it('refuses a repair cap that is not a whole number', async () => {
    await expect(reconcileOnMarket({ repair: true, maxRepairs: Number.NaN, today: '2026-10-01' })).rejects.toThrow(/whole number/)
  })
})

describe('reconcileOnMarket hands the repair its cutoff and deadline', () => {
  function drifted(n: number) {
    for (let i = 0; i < n; i++) {
      const k = `e${String(i).padStart(3, '0')}`
      spark.byKey.set(k, mls(k, 'Expired'))
      store.onMarket.push({ key: k, status: 'Active' })
      store.rows.set(k, ours(k, 'Active'))
    }
  }

  it('passes the delta-sync cutoff and the deadline in one call', async () => {
    drifted(3)
    const deadline = Date.parse('2026-10-01T10:56:00Z')
    const r = await reconcileOnMarket({ repair: true, maxRepairs: 400, today: '2026-10-01', deadline })
    expect(store.repairCalls).toHaveLength(1)
    expect(store.repairOpts).toEqual([{ leaveModifiedFrom: Date.parse('2026-10-01T08:00:00Z'), deadline }])
    expect(r).toMatchObject({ repaired: 3, stoppedForTime: false, leftAtRepair: [] })
  })

  it('reports a stop at the deadline, and a listing the MLS changed again by the time it was re-pulled', async () => {
    drifted(3)
    store.freshAtRepair = new Set(['e001'])
    store.unreachedAtRepair = new Set(['e002'])
    const r = await reconcileOnMarket({ repair: true, maxRepairs: 400, today: '2026-10-01', deadline: Date.now() + 60_000 })
    expect(r.leftAtRepair).toEqual(['e001'])
    expect(r.repairedKeys).toEqual(['e000'])
    expect(r.stoppedForTime).toBe(true)
  })
})
