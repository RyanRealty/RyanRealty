import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * IndexNow in the MLS delta sync: the plan records why a row's public page
 * changed, and the execute pass submits the canonical URLs of the rows that
 * actually landed, after the write, without ever failing or stalling the run.
 */

// ── execute-mode harness: every write and remote call is a mock ─────────────
const spark = vi.hoisted(() => ({ results: [] as unknown[] }))
const writes = vi.hoisted(() => ({
  existing: [] as Record<string, unknown>[],
  upsertOk: true,
  upserted: [] as Record<string, unknown>[][],
}))
const indexNow = vi.hoisted(() => ({
  submit: vi.fn(async (urls: Iterable<string>) => ({
    ok: true,
    skipped: null,
    submitted: [...urls].length,
    dropped: 0,
    batches: [],
  })),
}))

vi.mock('@/lib/spark', () => ({
  assertSparkSuccess: () => {},
  fetchSparkListingsPage: vi.fn(async () => ({ D: { Success: true, Results: spark.results } })),
}))
vi.mock('@/lib/sync/mlsRemovedRestore', () => ({ restoreServedAgain: vi.fn(async () => []) }))
vi.mock('@/lib/data/market/getLiveMortgageRate', () => ({ getLiveMortgageRate: vi.fn(async () => null) }))
vi.mock('@/lib/sync/fetchListingHistory', () => ({
  fetchAndInsertHistoryCore: vi.fn(async () => ({ inserted: 0, ok: true, items: [] })),
}))
vi.mock('@/app/api/admin/sync/_shared/listing-completeness', () => ({
  syncAuxiliaryTablesForFinalization: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/expired-listing-processor', () => ({
  processNewExpiredListings: vi.fn(async () => ({ scanned: 0, new_processed: 0, alert_emails_sent: 0, errors: 0 })),
}))
vi.mock('@/lib/expired-listing-select', () => ({ SCHEDULED_EXPIRED_CAPTURE: {} }))
vi.mock('@/app/actions/sync-history', () => ({ recordSyncRun: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({ upsert: async () => ({ error: null }) }),
    rpc: async () => ({ error: null }),
  }),
}))
vi.mock('@/lib/data/sync/syncWrites', () => ({
  getDeltaSyncCursor: vi.fn(async () => '2026-10-14T00:00:00.000Z'),
  getExistingListingsByListNumbers: vi.fn(async (nums: string[]) =>
    writes.existing.filter((r) => nums.includes(String(r.ListNumber))),
  ),
  getAdminOverrideFlags: vi.fn(async () => new Map()),
  getHeldMediaByListNumbers: vi.fn(async () => new Map()),
  setListingFreezeFlags: vi.fn(async () => ({ ok: true })),
  upsertListingRows: vi.fn(async (rows: Record<string, unknown>[]) => {
    writes.upserted.push(rows)
    return writes.upsertOk ? { ok: true } : { ok: false, error: 'boom' }
  }),
  insertPriceHistoryRows: vi.fn(async () => ({ ok: true })),
  insertStatusHistoryRows: vi.fn(async () => ({ ok: true })),
  insertActivityEventRows: vi.fn(async () => ({ ok: true })),
  updateListingPhotoUrl: vi.fn(async () => ({ ok: true })),
  updateSyncStateLastDelta: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/seo/indexnow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo/indexnow')>()),
  submitIndexNow: (urls: Iterable<string>) => indexNow.submit(urls),
}))

import { computeDeltaPlan, runDeltaSync, type ExistingListingLite, type SparkDeltaResult } from './deltaSync'

const NOW = '2026-10-14T12:00:00.000Z'
const PHOTO_A = 'https://cdn.photos.sparkplatform.com/or/a-o.jpg'
const PHOTO_B = 'https://cdn.photos.sparkplatform.com/or/b-o.jpg'

function mkResult(overrides: Record<string, unknown> = {}): SparkDeltaResult {
  const { photo, ...fields } = { photo: PHOTO_A as string | null, ...overrides }
  return {
    Id: String(fields.ListingKey ?? 'KEY1'),
    StandardFields: {
      ListNumber: '220000001',
      ListingKey: 'KEY1',
      StandardStatus: 'Active',
      ListPrice: 500000,
      ModificationTimestamp: '2026-10-14T11:00:00.000Z',
      StreetNumber: '123',
      StreetName: 'Main St',
      City: 'Bend',
      SubdivisionName: 'Tetherow',
      Photos: photo ? [{ Primary: true, Uri1600: photo }] : [],
      ...fields,
    },
  }
}

function existing(overrides: Partial<ExistingListingLite> = {}): ExistingListingLite {
  return {
    ListNumber: '220000001',
    ListingKey: 'KEY1',
    StandardStatus: 'Active',
    ListPrice: 500000,
    is_finalized: false,
    City: 'Bend',
    CloseDate: null,
    ClosePrice: null,
    property_sub_type: null,
    TotalLivingAreaSqFt: null,
    media_finalized: false,
    PhotoURL: PHOTO_A,
    photos_count: null,
    media_suppressed: false,
    ...overrides,
  }
}

function changes(results: SparkDeltaResult[], held: ExistingListingLite[]): Record<string, string[]> {
  const plan = computeDeltaPlan(results, new Map(held.map((r) => [r.ListNumber, r])), { nowIso: NOW })
  return Object.fromEntries([...plan.pageChanges].map(([k, v]) => [k, [...v].sort()]))
}

describe('computeDeltaPlan: page changes for IndexNow', () => {
  it('a new listing is a change', () => {
    expect(changes([mkResult()], [])).toEqual({ '220000001': ['new'] })
  })

  it('a status change and a price change are changes', () => {
    expect(changes([mkResult({ StandardStatus: 'Pending', ListPrice: 480000 })], [existing()])).toEqual({
      '220000001': ['price', 'status'],
    })
  })

  it('a row Spark touched with nothing visible changed is not', () => {
    expect(changes([mkResult()], [existing()])).toEqual({})
  })

  it('a new lead photo is a change', () => {
    expect(changes([mkResult({ photo: PHOTO_B })], [existing()])).toEqual({ '220000001': ['photo'] })
  })

  it('a different photo count is a change', () => {
    expect(changes([mkResult({ PhotosCount: 31 })], [existing({ photos_count: 30 })])).toEqual({
      '220000001': ['photo'],
    })
  })

  it('a photo change on a media-suppressed listing is not: its page shows no photos', () => {
    expect(changes([mkResult({ photo: PHOTO_B })], [existing({ media_suppressed: true })])).toEqual({})
  })

  it('a row sent without photos is not a photo change yet; the fix pass decides', () => {
    const plan = computeDeltaPlan([mkResult({ photo: null })], new Map([['220000001', existing()]]), { nowIso: NOW })
    expect(plan.pageChanges.size).toBe(0)
    expect(plan.photoBefore.get('220000001')).toBe(PHOTO_A)
  })

  it('a finalized row with no material change is skipped entirely', () => {
    expect(
      changes(
        [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-10-01', ClosePrice: 490000 })],
        [existing({ is_finalized: true, StandardStatus: 'Closed', CloseDate: '2026-10-01T00:00:00+00:00', ClosePrice: 490000 })],
      ),
    ).toEqual({})
  })

  it('a reopened finalized row is a change', () => {
    expect(
      changes(
        [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-10-08', ClosePrice: 495000 })],
        [existing({ is_finalized: true, StandardStatus: 'Closed', CloseDate: '2026-10-01T00:00:00+00:00', ClosePrice: 495000 })],
      ),
    ).toEqual({ '220000001': ['reopened'] })
  })
})

describe('runDeltaSync execute: IndexNow after the write', () => {
  beforeEach(() => {
    spark.results = []
    writes.existing = []
    writes.upsertOk = true
    writes.upserted = []
    indexNow.submit.mockClear()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits the canonical URLs of written rows whose page changed, and nothing else', async () => {
    spark.results = [
      mkResult(), // price change below
      mkResult({ ListNumber: '220000002', ListingKey: 'K2', StreetNumber: '9', StreetName: 'Elm St' }), // new
      mkResult({ ListNumber: '220000003', ListingKey: 'K3', StreetNumber: '7', StreetName: 'Oak St' }), // unchanged
      mkResult({ ListNumber: '220000004', ListingKey: 'K4', StandardStatus: 'Coming Soon' }), // new, never public
      mkResult({ ListNumber: '220000005', ListingKey: 'K5', IDXParticipant: false }), // new, IDX opt-out
    ]
    writes.existing = [
      existing({ ListPrice: 525000 }),
      existing({ ListNumber: '220000003', ListingKey: 'K3' }),
    ]
    const r = await runDeltaSync({ mode: 'execute', accessToken: 't', nowIso: NOW })
    expect(r.ok).toBe(true)
    expect(writes.upserted.flat()).toHaveLength(5)
    expect(indexNow.submit).toHaveBeenCalledTimes(1)
    const urls = [...indexNow.submit.mock.calls[0]![0]]
    expect(urls).toEqual([
      'https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220000001',
      'https://ryan-realty.com/homes-for-sale/bend/tetherow/9-elm-st-220000002',
    ])
    expect(r.indexNow).toEqual({ urls: 2, submitted: 2, ok: true, skipped: null })
  })

  it('submits nothing for rows whose upsert failed', async () => {
    spark.results = [mkResult()]
    writes.upsertOk = false
    const r = await runDeltaSync({ mode: 'execute', accessToken: 't', nowIso: NOW })
    expect(r.ok).toBe(false)
    expect([...indexNow.submit.mock.calls[0]![0]]).toEqual([])
    expect(r.indexNow.urls).toBe(0)
  })

  it('a failed submission never fails the sync', async () => {
    spark.results = [mkResult()]
    indexNow.submit.mockRejectedValueOnce(new Error('engine down'))
    const r = await runDeltaSync({ mode: 'execute', accessToken: 't', nowIso: NOW })
    expect(r.ok).toBe(true)
    expect(r.totalUpserted).toBe(1)
    expect(r.indexNow).toEqual({ urls: 1, submitted: 0, ok: false, skipped: null })
  })

  it('shadow mode never submits', async () => {
    spark.results = [mkResult()]
    await runDeltaSync({ mode: 'shadow', accessToken: 't', nowIso: NOW })
    expect(indexNow.submit).not.toHaveBeenCalled()
  })
})
