import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import type { PricingSale } from '@/lib/pricing/match'

/**
 * AN ADU HOME PRICES FROM ADU SALES FIRST (Matt 2026-10-14), end to end on the
 * facts path with the pool reads mocked: the pass, the short fallback, the
 * review fallback a build re-enters on, and the wall for a home without one.
 */
const countSalePricingFacts = vi.hoisted(() => vi.fn(async () => 5000))
const selectPricingFactsPool = vi.hoisted(() => vi.fn(async () => [] as PricingSale[]))
const selectPricingFactsNear = vi.hoisted(() => vi.fn(async () => [] as PricingSale[]))
const getListingWaterSource = vi.hoisted(() => vi.fn(async () => null))
const getPricingMarketIndex = vi.hoisted(() => vi.fn(async () => []))
const getPricingSubdivisionCells = vi.hoisted(() => vi.fn(async () => new Map()))
const catchUpRecentPricingFacts = vi.hoisted(() => vi.fn(async () => ({ since: '2026-09-01', refreshed: [], failed: [], deferred: [] })))
const selectComps = vi.hoisted(() => vi.fn(async () => {
  throw new Error('the listings ladder must not run: the facts pool holds five on every pass here')
}))

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
vi.mock('@/lib/cma/comps', () => ({ selectComps, selectCompsByKeys: vi.fn(), MIN_COMPS: 5 }))
vi.mock('@/lib/cma/own-ground-sold', () => ({ readOwnGroundSold: async () => null }))
vi.mock('@/lib/data/pricing/facts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/pricing/facts')>()
  return {
    ...actual,
    countSalePricingFacts,
    selectPricingFactsPool,
    selectPricingFactsNear,
    getListingWaterSource,
    getPricingMarketIndex,
    getPricingSubdivisionCells,
    catchUpRecentPricingFacts,
  }
})

import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import { aduFromRemarks } from '@/lib/pricing/classes'

const HOME = { latitude: 44.06, longitude: -121.33 }
const ADU_REMARKS = 'Main home plus a permitted detached ADU with its own kitchen and entrance.'
const PLAIN_REMARKS = 'Single level home on a quiet street, fenced yard, two car garage.'

function fact(over: Partial<PricingSale> & Pick<PricingSale, 'listingKey' | 'address'>): PricingSale {
  return {
    listNumber: null,
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Westside Meadows',
    subdivisionNorm: 'westside meadows',
    latitude: HOME.latitude,
    longitude: HOME.longitude,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    yearBuilt: 2005,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 720_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 729_000,
    lastAsk: 720_000,
    daysToOffer: 14,
    cdom: 25,
    dropCount: 0,
    closePpsf: 400,
    photoUrl: null,
    publicRemarks: PLAIN_REMARKS,
    ...over,
  }
}

const aduSales = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    fact({ listingKey: `ADU-${i}`, address: `${100 + i} Meadow Ln`, sqft: 1780 + i * 10, publicRemarks: ADU_REMARKS }),
  )
const plainSales = (n: number) =>
  Array.from({ length: n }, (_, i) => fact({ listingKey: `PLAIN-${i}`, address: `${200 + i} Meadow Ln`, sqft: 1790 + i * 10 }))

function subject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ-1',
    mlsNumber: '220200001',
    streetAddress: '150 Meadow Ln',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: 'Westside Meadows',
    latitude: HOME.latitude,
    longitude: HOME.longitude,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2005,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Craftsman with a permitted detached ADU over the garage.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 749_000,
    lastListDate: '2026-05-01',
    listingHistoryLine: null,
    waterRaw: 'public',
    sewerRaw: 'public',
    levelsRaw: 'One',
    newConstructionYn: false,
    ...over,
  }
}

const asOf = '2026-09-15'

describe('selectCompsPreferringFacts prices an ADU home from ADU sales first (Matt 2026-10-14)', () => {
  beforeEach(() => {
    selectComps.mockClear()
  })

  it('five ADU sales in the pool are the set, and every priced sale states an ADU', async () => {
    const pool = [...aduSales(5), ...plainSales(5)]
    selectPricingFactsPool.mockResolvedValue(pool)
    selectPricingFactsNear.mockResolvedValue(pool)
    const sel = await selectCompsPreferringFacts(subject(), { asOf })
    expect(sel.pricingSource).toBe('facts')
    expect(sel.comps).toHaveLength(5)
    expect(sel.comps.every((c) => aduFromRemarks(c.publicRemarks))).toBe(true)
    expect(sel.diagnostics.adu_preference).toMatchObject({ outcome: 'adu-sales', adu_sales_held: 5, minimum: 5 })
    expect(sel.diagnostics.adu_preference?.sentence).toContain('read from closed sales that also have one')
    expect(sel.trace.some((t) => t.startsWith('ADU home: priced from ADU sales first'))).toBe(true)
    expect(selectComps).not.toHaveBeenCalled()
  })

  it('four ADU sales fall back to the whole pool, say so, and keep the first pass trace', async () => {
    const pool = [...aduSales(4), ...plainSales(5)]
    selectPricingFactsPool.mockResolvedValue(pool)
    selectPricingFactsNear.mockResolvedValue(pool)
    const sel = await selectCompsPreferringFacts(subject(), { asOf })
    expect(sel.comps).toHaveLength(5)
    expect(sel.comps.some((c) => !aduFromRemarks(c.publicRemarks))).toBe(true)
    expect(sel.diagnostics.adu_preference).toMatchObject({ outcome: 'fallback', fallback_reason: 'short', adu_sales_held: 4 })
    expect(sel.diagnostics.adu_preference?.first_pass_trace?.length ?? 0).toBeGreaterThan(0)
    expect(sel.diagnostics.adu_preference?.sentence).toContain('with and without an ADU')
  })

  it('a build re-entered on the ordinary pass after a review drop prices from the whole pool and stamps the review fallback', async () => {
    const pool = [...aduSales(5), ...plainSales(5)]
    selectPricingFactsPool.mockResolvedValue(pool)
    selectPricingFactsNear.mockResolvedValue(pool)
    const sel = await selectCompsPreferringFacts(subject(), { asOf, aduPass: 'ordinary', aduSalesHeld: 4 })
    expect(sel.comps).toHaveLength(5)
    expect(sel.diagnostics.adu_preference).toMatchObject({ outcome: 'fallback', fallback_reason: 'review', adu_sales_held: 4 })
    expect(sel.trace.some((t) => t.includes('after the comparability review'))).toBe(true)
  })

  it('the MLS details alone make it an ADU home: silent remarks with Accessory Dwelling Unit YN still run the pass', async () => {
    const pool = [...aduSales(5), ...plainSales(5)]
    selectPricingFactsPool.mockResolvedValue(pool)
    selectPricingFactsNear.mockResolvedValue(pool)
    const sel = await selectCompsPreferringFacts(
      subject({
        publicRemarks: 'Well kept home close to the river trail.',
        units: { multiUnit: false, reasons: [], unitsTotal: null, aduYn: true, aduSqft: 480, aduType: 'Detached', priorMultiUnit: null },
      }),
      { asOf },
    )
    expect(sel.diagnostics.adu_preference?.outcome).toBe('adu-sales')
    expect(sel.comps.every((c) => aduFromRemarks(c.publicRemarks))).toBe(true)
  })

  it('a home without an ADU runs no pass and the wall keeps every ADU sale out', async () => {
    const pool = [...aduSales(5), ...plainSales(5)]
    selectPricingFactsPool.mockResolvedValue(pool)
    selectPricingFactsNear.mockResolvedValue(pool)
    const sel = await selectCompsPreferringFacts(subject({ publicRemarks: 'Room to add an ADU out back.' }), { asOf })
    expect(sel.diagnostics.adu_preference).toBeUndefined()
    expect(sel.comps).toHaveLength(5)
    expect(sel.comps.every((c) => !aduFromRemarks(c.publicRemarks))).toBe(true)
    expect(sel.diagnostics.excluded_totals.adu_sale).toBe(5)
  })
})
