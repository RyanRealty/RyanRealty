import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'

/**
 * 3037 Purcell (2026-10-07): the comp search must read the facts pool only
 * after the recent closes the facts sweep has not reached are caught up, so
 * the pool holds every sale the letter's live-listings charts can print.
 */

const calls = vi.hoisted(() => [] as string[])

vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  getSubdivisionRing: async () => null,
  assignSubdivisionSlugs: async (pts: ReadonlyArray<unknown>) => pts.map(() => null),
  assignCommunitySlugs: async () => null,
}))
vi.mock('@/lib/cma/comps', () => ({ selectComps: vi.fn(), selectCompsByKeys: vi.fn(), MIN_COMPS: 5 }))

const catchUpRecentPricingFacts = vi.hoisted(() =>
  vi.fn(async (opts: { since: string }) => {
    calls.push('catch-up')
    return {
      since: opts.since,
      checked: 2,
      missing: ['20260728231643861137000000'],
      refreshed: ['20260728231643861137000000'],
      skipped: [],
      failed: [],
      deferred: [],
      error: null,
    }
  }),
)
const selectPricingFactsPool = vi.hoisted(() =>
  vi.fn(async () => {
    calls.push('pool')
    return []
  }),
)
const selectPricingFactsNear = vi.hoisted(() =>
  vi.fn(async () => {
    calls.push('near')
    return []
  }),
)

vi.mock('@/lib/data/pricing/facts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/pricing/facts')>()
  return {
    ...actual,
    catchUpRecentPricingFacts,
    countSalePricingFacts: async () => 5000,
    selectPricingFactsPool,
    selectPricingFactsNear,
    getListingWaterSource: async () => null,
    getPricingMarketIndex: async () => [],
    getPricingSubdivisionCells: async () => new Map(),
    selectSeniorCommunityListingKeys: async () => new Set(),
  }
})

import { catchUpTraceLines, selectPricingComps } from '@/lib/pricing/select'

// An illustrative subject: the address names the case, the figures are not its record.
function purcell(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'P',
    mlsNumber: '220000001',
    streetAddress: '3037 Purcell',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: 'Silver Sage',
    latitude: 44.0745,
    longitude: -121.2667,
    beds: 3,
    baths: 2,
    sqft: 1600,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 559000,
    lastListDate: null,
    listingHistoryLine: null,
    waterRaw: null,
    ...over,
  } as CmaSubject
}

describe('selectPricingComps catches recent closes up before it reads the pool', () => {
  beforeEach(() => {
    calls.length = 0
    catchUpRecentPricingFacts.mockClear()
  })

  it('runs the catch-up first, over the last 90 days, the subject city and its 3-mile box', async () => {
    const out = await selectPricingComps(purcell(), { asOf: '2026-10-07' })
    expect(calls[0]).toBe('catch-up')
    expect(calls.slice(1).sort()).toEqual(['near', 'pool'])
    expect(catchUpRecentPricingFacts).toHaveBeenCalledWith({
      since: '2026-07-09',
      cities: ['Bend'],
      near: { latitude: 44.0745, longitude: -121.2667, radiusMiles: 3 },
      maxRefresh: 60,
    })
    expect(out.trace[0]).toMatch(/Recent closes caught up: 1 sale\(s\) closed since 2026-07-09/)
    expect(out.trace[0]).toContain('20260728231643861137000000')
  })

  it('skips the catch-up only when the caller says the window was just caught up (the facts cron stamp)', async () => {
    const out = await selectPricingComps(purcell(), { asOf: '2026-10-07', catchUpRecent: false })
    expect(catchUpRecentPricingFacts).not.toHaveBeenCalled()
    expect(calls.sort()).toEqual(['near', 'pool'])
    expect(out.trace.some((l) => /Recent closes/.test(l))).toBe(false)
  })
})

describe('catchUpTraceLines', () => {
  const base = {
    since: '2026-07-09',
    checked: 0,
    missing: [],
    refreshed: [],
    skipped: [],
    failed: [],
    deferred: [],
    error: null,
  }

  it('says nothing when the pool already held every recent close', () => {
    expect(catchUpTraceLines(base)).toEqual([])
  })

  it('names the closes it could not add, so a reviewer sees the pool may miss a charted sale', () => {
    const lines = catchUpTraceLines({
      ...base,
      failed: [{ listingKey: 'a', error: 'x' }],
      deferred: ['b'],
      error: 'refresh: rpc down',
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/NOT caught up: 2 sale\(s\).*\(a, b\); refresh: rpc down\. The charts can print a sale this search did not see\./)
  })
})
