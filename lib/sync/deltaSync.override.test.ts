/**
 * A broker's status override against the delta sync, three ticks in a row
 * (2026-09-30 review). Every admin edit stamps standard_status_set
 * (lib/data/admin/listingEdit.ts), the finalize pass freezes on the MLS's
 * terminal status, and the upsert merges the broker's status back. Until this
 * review the frozen row read as frozen_not_terminal on every Spark touch:
 * reopened, rewritten, re-frozen, its "Expired" news written again, forever.
 *
 * The run is the real runDeltaSync execute path over an in-memory listings
 * table whose upsert re-applies the override, as upsertListingRows does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const store = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  pinned: new Map<string, { status?: string; listPrice?: number }>(),
  spark: [] as Record<string, unknown>[],
  upserts: [] as string[],
  freezes: [] as string[],
  statusHistory: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/data/sync/syncWrites', () => ({
  getSyncState: vi.fn(async () => ({ last_delta_sync_at: '2026-09-30T00:00:00.000Z' })),
  getExistingListingsByListNumbers: vi.fn(async (nums: string[]) => nums.flatMap((n) => (store.rows.has(n) ? [{ ...store.rows.get(n)! }] : []))),
  getAdminOverrideFlags: vi.fn(async (nums: string[]) => {
    const out = new Map<string, { status: boolean; listPrice: boolean }>()
    for (const n of nums) {
      const p = store.pinned.get(n)
      if (p) out.set(n, { status: p.status !== undefined, listPrice: p.listPrice !== undefined })
    }
    return out
  }),
  getHeldMediaByListNumbers: vi.fn(async () => new Map()),
  setListingFreezeFlags: vi.fn(async (nums: string[], flags: Record<string, unknown>) => {
    for (const n of nums) {
      const r = store.rows.get(n)
      if (r) Object.assign(r, flags)
      store.freezes.push(n)
    }
    return { ok: true, updated: nums.length }
  }),
  upsertListingRows: vi.fn(async (rows: Row[]) => {
    for (const row of rows) {
      const n = String(row.ListNumber)
      const p = store.pinned.get(n)
      store.rows.set(n, {
        ...(store.rows.get(n) ?? {}),
        ...row,
        ...(p?.status !== undefined ? { StandardStatus: p.status } : {}),
        ...(p?.listPrice !== undefined ? { ListPrice: p.listPrice } : {}),
      })
      store.upserts.push(n)
    }
    return { ok: true }
  }),
  insertPriceHistoryRows: vi.fn(async () => ({ ok: true })),
  insertStatusHistoryRows: vi.fn(async (rows: Row[]) => {
    store.statusHistory.push(...rows)
    return { ok: true }
  }),
  insertActivityEventRows: vi.fn(async (rows: Row[]) => {
    store.events.push(...rows)
    return { ok: true }
  }),
  updateListingPhotoUrl: vi.fn(async () => ({ ok: true })),
  updateSyncStateLastDelta: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/spark', () => ({
  fetchSparkListingsPage: vi.fn(async () => ({
    D: { Success: true, Results: store.spark.map((f) => ({ Id: String(f.ListingKey), StandardFields: f })), Pagination: { TotalPages: 1 } },
  })),
}))
vi.mock('@/lib/sync/fetchListingHistory', () => ({ fetchAndInsertHistoryCore: vi.fn(async () => ({ inserted: 0, ok: true, items: [] })) }))
vi.mock('@/app/api/admin/sync/_shared/listing-completeness', () => ({ syncAuxiliaryTablesForFinalization: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/expired-listing-processor', () => ({
  processNewExpiredListings: vi.fn(async () => ({ scanned: 0, new_processed: 0, alert_emails_sent: 0, errors: 0 })),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => ({ upsert: async () => ({ error: null }) }), rpc: async () => ({ error: null }) }),
}))
vi.mock('@/lib/data/market/getLiveMortgageRate', () => ({ getLiveMortgageRate: vi.fn(async () => null) }))
vi.mock('@/app/actions/sync-history', () => ({ recordSyncRun: vi.fn(async () => undefined) }))

import { runDeltaSync } from './deltaSync'

const LN = '220188411'
const KEY = '20260301000000000000000001'

function sparkRow(over: Record<string, unknown> = {}) {
  return {
    ListNumber: LN,
    ListingKey: KEY,
    StandardStatus: 'Expired',
    ListPrice: 725000,
    City: 'Bend',
    ModificationTimestamp: '2026-09-30T08:00:00.000Z',
    PhotoURL: 'https://cdn.example/photo.jpg',
    ...over,
  }
}

beforeEach(() => {
  process.env.SPARK_API_KEY = 'test-key'
  store.rows = new Map([
    [
      LN,
      {
        ListNumber: LN,
        ListingKey: KEY,
        // A broker edited this listing while it was Active: status and price pinned.
        StandardStatus: 'Active',
        ListPrice: 725000,
        is_finalized: false,
        City: 'Bend',
        CloseDate: null,
        ClosePrice: null,
        property_sub_type: null,
        TotalLivingAreaSqFt: null,
        media_finalized: false,
      },
    ],
  ])
  store.pinned = new Map([[LN, { status: 'Active', listPrice: 725000 }]])
  store.spark = [sparkRow()]
  store.upserts = []
  store.freezes = []
  store.statusHistory = []
  store.events = []
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runDeltaSync with a broker status override', () => {
  it('three ticks of the same MLS record make one change, not three', async () => {
    const ticks = []
    for (let i = 0; i < 3; i++) ticks.push(await runDeltaSync({ mode: 'execute', sinceOverride: '2026-09-30T00:00:00.000Z' }))

    // Tick 1 writes the MLS record (the merge keeps the broker's Active) and
    // freezes on Spark's terminal status. Ticks 2 and 3 reopen the frozen row
    // (status + frozen_not_terminal), and the override explains both: no write.
    expect(store.upserts).toEqual([LN])
    expect(store.freezes).toEqual([LN])
    expect(store.statusHistory).toHaveLength(1)
    expect(store.events.filter((e) => String(e.event_type).startsWith('status_'))).toHaveLength(1)
    expect(ticks.map((t) => t.totalUpserted)).toEqual([1, 0, 0])
    expect(store.rows.get(LN)).toMatchObject({ StandardStatus: 'Active', is_finalized: true })
  })

  it('a real change on top of the override still reopens (the MLS closed it)', async () => {
    await runDeltaSync({ mode: 'execute', sinceOverride: '2026-09-30T00:00:00.000Z' })
    store.spark = [sparkRow({ StandardStatus: 'Closed', CloseDate: '2026-09-29', ClosePrice: 700000, ModificationTimestamp: '2026-09-30T09:00:00.000Z' })]
    await runDeltaSync({ mode: 'execute', sinceOverride: '2026-09-30T00:00:00.000Z' })
    expect(store.upserts).toEqual([LN, LN])
    expect(store.rows.get(LN)).toMatchObject({ CloseDate: '2026-09-29', is_finalized: true })
  })
})
