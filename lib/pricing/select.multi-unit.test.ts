import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import type { CompSelection } from '@/lib/cma/comps'

/**
 * A MULTI-UNIT HOME PRICES ON THE MULTI-UNIT LADDER (Matt 2026-10-14): the
 * facts pool is never read for a duplex, the listings ladder runs the
 * same-units pass first and the class pass under five, the outcome is
 * stamped on the diagnostics, and a build re-entered on the class pass
 * stamps the review fallback.
 */
const countSalePricingFacts = vi.hoisted(() => vi.fn(async () => 5000))
const selectPricingFactsPool = vi.hoisted(() => vi.fn(async () => []))
const selectPricingFactsNear = vi.hoisted(() => vi.fn(async () => []))
const readOwnGroundSold = vi.hoisted(() => vi.fn(async () => null))
const selectComps = vi.hoisted(() =>
  vi.fn(async (_subject: unknown, _opts: { sameUnitsOnly?: boolean }): Promise<CompSelection> => {
    throw new Error('stubbed per test')
  }),
)

vi.mock('@/lib/cma/comps', () => ({ selectComps, selectCompsByKeys: vi.fn(), MIN_COMPS: 5 }))
vi.mock('@/lib/cma/own-ground-sold', () => ({ readOwnGroundSold }))
vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/geo/subdivision-ring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/geo/subdivision-ring')>()
  return {
    ...actual,
    getSubdivisionRing: async () => null,
    assignSubdivisionSlugs: async (pts: ReadonlyArray<unknown>) => pts.map(() => null),
    assignCommunitySlugs: async () => null,
    readNeighborRings: async () => [],
  }
})
vi.mock('@/lib/data/pricing/facts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/pricing/facts')>()
  return {
    ...actual,
    countSalePricingFacts,
    selectPricingFactsPool,
    selectPricingFactsNear,
    getListingWaterSource: async () => null,
    getPricingMarketIndex: async () => [],
    getPricingSubdivisionCells: async () => new Map(),
    catchUpRecentPricingFacts: async () => ({ since: '2026-09-01', refreshed: [], failed: [], deferred: [] }),
  }
})

import { selectCompsPreferringFacts } from '@/lib/pricing/select'

function selection(n: number, label: string): CompSelection {
  return {
    comps: Array.from({ length: n }, (_, i) => ({ listingKey: `${label}-${i}` }) as unknown as CompSelection['comps'][number]),
    excludedOutliers: [],
    tiersUsed: ['subdivision-6m'],
    trace: [`${label} pass`],
    pricingSource: 'listings',
    diagnostics: { ladder: [], starved: n < 5, starved_reason: null } as unknown as CompSelection['diagnostics'],
  }
}

function duplex(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'IRVING',
    mlsNumber: '220207733',
    streetAddress: '429 Irving',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: null,
    latitude: 44.0587,
    longitude: -121.3001,
    beds: 3,
    baths: 4,
    sqft: 2149,
    lotAcres: 0.1,
    propertySubType: 'Duplex',
    propertyType: 'C',
    multiUnit: { units: 2, propertySubType: 'Duplex', sqft: 2149, sqftBasis: null, basis: 'prior' },
    yearBuilt: 2003,
    garageSpaces: 1,
    photoUrl: null,
    publicRemarks: 'Prime midtown location with built-in income potential! A 1,629 sq ft main home and a 520 sq ft ADU.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 799_900,
    lastListDate: '2025-08-13',
    listingHistoryLine: null,
    ...over,
  }
}

describe('selectCompsPreferringFacts on a multi-unit subject (Matt 2026-10-14)', () => {
  beforeEach(() => {
    selectComps.mockReset()
    countSalePricingFacts.mockClear()
    selectPricingFactsPool.mockClear()
    selectPricingFactsNear.mockClear()
  })

  it('never reads the facts pool, and five duplex sales on the same-units pass are the set', async () => {
    selectComps.mockImplementation(async (_s, opts) => (opts.sameUnitsOnly ? selection(5, 'duplex') : selection(9, 'class')))
    const sel = await selectCompsPreferringFacts(duplex(), { asOf: '2026-10-14' })
    expect(countSalePricingFacts).not.toHaveBeenCalled()
    expect(selectPricingFactsPool).not.toHaveBeenCalled()
    expect(selectPricingFactsNear).not.toHaveBeenCalled()
    expect(selectComps.mock.calls.map(([, o]) => o.sameUnitsOnly)).toEqual([true])
    expect(sel.comps).toHaveLength(5)
    expect(sel.pricingSource).toBe('listings')
    expect(sel.diagnostics.multi_unit).toMatchObject({ outcome: 'same-units', units: 2, noun: 'duplex', same_unit_sales_held: 5 })
    expect(sel.trace[0]).toContain('Multi-unit home (duplex, 2 units): priced on the multi-unit ladder over PropertyType C closes')
  })

  it('under five duplexes the class pass prices the home and the letter sentence says so', async () => {
    selectComps.mockImplementation(async (_s, opts) => (opts.sameUnitsOnly ? selection(2, 'duplex') : selection(6, 'class')))
    const sel = await selectCompsPreferringFacts(duplex(), { asOf: '2026-10-14' })
    expect(selectComps.mock.calls.map(([, o]) => o.sameUnitsOnly)).toEqual([true, false])
    expect(sel.comps).toHaveLength(6)
    expect(sel.diagnostics.multi_unit).toMatchObject({ outcome: 'class', fallback_reason: 'short', same_unit_sales_held: 2 })
    expect(sel.diagnostics.multi_unit?.sentence).toContain('Fewer than five closed duplexes were found')
    expect(sel.diagnostics.multi_unit?.first_pass_trace).toEqual(['duplex pass'])
  })

  it('a build re-entered on the class pass stamps the review fallback without a same-units run', async () => {
    selectComps.mockImplementation(async (_s, opts) => (opts.sameUnitsOnly ? selection(5, 'duplex') : selection(7, 'class')))
    const sel = await selectCompsPreferringFacts(duplex(), { asOf: '2026-10-14', unitsPass: 'class', unitSalesHeld: 4 })
    expect(selectComps.mock.calls.map(([, o]) => o.sameUnitsOnly)).toEqual([false])
    expect(sel.comps).toHaveLength(7)
    expect(sel.diagnostics.multi_unit).toMatchObject({ outcome: 'class', fallback_reason: 'review', same_unit_sales_held: 4 })
  })

  it('a custom-built duplex still takes the ladder (there is no facts pool to stay on)', async () => {
    selectComps.mockImplementation(async () => selection(5, 'duplex'))
    const sel = await selectCompsPreferringFacts(
      duplex({ yearBuilt: new Date().getFullYear() - 1, newConstructionYn: true, publicRemarks: 'Custom-built new duplex.' }),
      { asOf: '2026-10-14' },
    )
    expect(countSalePricingFacts).not.toHaveBeenCalled()
    expect(sel.comps).toHaveLength(5)
  })

  it('a bare Multi Family record with no count runs the class pass only and says so', async () => {
    selectComps.mockImplementation(async (_s, opts) => (opts.sameUnitsOnly ? selection(9, 'same') : selection(5, 'class')))
    const sel = await selectCompsPreferringFacts(
      duplex({ propertySubType: 'Multi Family', multiUnit: { units: null, propertySubType: 'Multi Family', sqft: 3000, sqftBasis: null, basis: 'current' } }),
      { asOf: '2026-10-14' },
    )
    expect(selectComps.mock.calls.map(([, o]) => o.sameUnitsOnly)).toEqual([false])
    expect(sel.diagnostics.multi_unit).toMatchObject({ outcome: 'class', fallback_reason: 'no-count', units: null, noun: 'multi-unit home' })
  })
})
