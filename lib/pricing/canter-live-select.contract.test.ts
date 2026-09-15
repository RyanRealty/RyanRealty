/**
 * Live 2026-09-15 07:28 PT rebuild of cma-1130-canter-sisters-usa.
 * selectCompsPreferringFacts is the buildCmaAdmin / cli-rebuild path.
 * Unit walk fixtures passed while this path still inferred Rolling Horse Meadow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import type { PricingSale } from '@/lib/pricing/match'

const CANTER = { latitude: 44.2908, longitude: -121.5493 }

const getSubdivisionRing = vi.hoisted(() =>
  vi.fn(async () => ({
    homeSlug: 'rolling-horse-meadow',
    homeLabel: 'Rolling Horse Meadow',
    neighborhoodSlug: null,
    ring: [],
  })),
)
const assignSubdivisionSlugs = vi.hoisted(() =>
  vi.fn(async (pts: ReadonlyArray<unknown>) => pts.map(() => null)),
)
const countSalePricingFacts = vi.hoisted(() => vi.fn(async () => 5000))
const selectPricingFactsPool = vi.hoisted(() => vi.fn(async () => [] as PricingSale[]))
const selectPricingFactsNear = vi.hoisted(() => vi.fn(async () => [] as PricingSale[]))
const getListingWaterSource = vi.hoisted(() => vi.fn(async () => null))
const getPricingMarketIndex = vi.hoisted(() => vi.fn(async () => []))
const getPricingSubdivisionCells = vi.hoisted(() => vi.fn(async () => new Map()))

vi.mock('@/lib/pricing/sale-zoning', () => ({ resolveSaleZones: async () => new Map() }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({
  getSubdivisionRing,
  assignSubdivisionSlugs,
}))
vi.mock('@/lib/cma/comps', () => ({
  selectComps: vi.fn(async () => {
    throw new Error('listings selectComps must not run for Canter custom/new')
  }),
  selectCompsByKeys: vi.fn(),
  MIN_COMPS: 3,
}))
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
  }
})

import { selectCompsPreferringFacts } from '@/lib/pricing/select'

function fact(over: Partial<PricingSale> & Pick<PricingSale, 'listingKey' | 'address'>): PricingSale {
  return {
    listNumber: null,
    city: 'Sisters',
    citySlug: 'sisters',
    subdivision: 'SaddleStone',
    subdivisionNorm: 'saddlestone',
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1900,
    lotAcres: 0.2,
    yearBuilt: 2008,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 675_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 685_000,
    lastAsk: 675_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 355,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

function atMiles(miles: number) {
  return { latitude: CANTER.latitude + miles / 69, longitude: CANTER.longitude }
}

const liveFacts: PricingSale[] = [
  fact({
    listingKey: 'RHM-1121',
    address: '1121 Canter Ct',
    subdivision: 'Rolling Horse Meadow',
    subdivisionNorm: 'rolling horse meadow',
    ...atMiles(0.04),
    closePrice: 720_000,
    lastAsk: 720_000,
    yearBuilt: 1998,
    sqft: 2100,
    closeDate: '2024-08-01',
  }),
  fact({
    listingKey: 'RHM-MEADOW',
    address: '200 Meadow Ln',
    subdivision: 'Rolling Horse Meadow',
    subdivisionNorm: 'rolling horse meadow',
    ...atMiles(0.08),
    closePrice: 710_000,
    lastAsk: 710_000,
    yearBuilt: 1995,
    sqft: 2000,
    closeDate: '2025-11-01',
  }),
  fact({
    listingKey: 'HB-945',
    address: '945 Horse Back',
    listNumber: '220199945',
    subdivision: 'SaddleStone',
    subdivisionNorm: 'saddlestone',
    ...atMiles(0.18),
    closePrice: 710_000,
    lastAsk: 710_000,
    yearBuilt: 2023,
    sqft: 1900,
    closeDate: '2025-10-01',
  }),
  fact({
    listingKey: 'RANCH-1058',
    listNumber: '220218584',
    address: '1058 E Ranch',
    subdivision: 'SaddleStone',
    subdivisionNorm: 'saddlestone',
    ...atMiles(0.16),
    closePrice: 685_000,
    lastAsk: 685_000,
    closePpsf: 360,
    yearBuilt: 2006,
    sqft: 1920,
    closeDate: '2026-05-12',
  }),
  fact({
    listingKey: 'HB-1025',
    listNumber: '220214720',
    address: '1025 E Horse Back',
    subdivision: 'Horse Back',
    subdivisionNorm: 'horse back',
    ...atMiles(0.12),
    closePrice: 675_000,
    lastAsk: 675_000,
    closePpsf: 355,
    yearBuilt: 2008,
    sqft: 1900,
    closeDate: '2026-04-20',
  }),
  fact({
    listingKey: 'UP-Clearpine',
    address: '191 Clearpine Dr',
    subdivision: 'Clearpine',
    subdivisionNorm: 'clearpine',
    ...atMiles(2.1),
    yearBuilt: 2024,
    sqft: 2000,
    closePrice: 890_000,
    lastAsk: 890_000,
    closePpsf: 445,
    closeDate: '2026-07-01',
    publicRemarks: 'Custom built modern home. New construction.',
    newConstruction: true,
  }),
  fact({
    listingKey: 'UP-ForestEdge',
    address: '191 Forest Edge Dr',
    subdivision: 'Forest Edge',
    subdivisionNorm: 'forest edge',
    ...atMiles(2.4),
    yearBuilt: 2024,
    sqft: 2000,
    closePrice: 860_000,
    lastAsk: 860_000,
    closePpsf: 430,
    closeDate: '2026-07-01',
    publicRemarks: 'Custom built modern home. New construction.',
    newConstruction: true,
  }),
  fact({
    listingKey: 'UP-GrandPeaks',
    address: '191 Grand Peaks Dr',
    subdivision: 'Grand Peaks',
    subdivisionNorm: 'grand peaks',
    ...atMiles(2.6),
    yearBuilt: 2024,
    sqft: 2000,
    closePrice: 840_000,
    lastAsk: 840_000,
    closePpsf: 420,
    closeDate: '2026-07-01',
    publicRemarks: 'Custom built modern home. New construction.',
    newConstruction: true,
  }),
]

function canterSubject(): CmaSubject {
  return {
    listingKey: 'SUBJ-1130',
    mlsNumber: '220213342',
    streetAddress: '1130 E Canter',
    city: 'Sisters',
    state: 'OR',
    postalCode: '97759',
    subdivision: null,
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1883,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2025,
    garageSpaces: null,
    photoUrl: null,
    publicRemarks: 'New construction 2025.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Active',
    lastListPrice: 675_000,
    lastListDate: '2026-06-01',
    listingHistoryLine: null,
    waterRaw: 'public',
    sewerRaw: 'public',
    levelsRaw: 'One',
    newConstructionYn: true,
  }
}

describe('1130 E Canter live selectPricingComps path', () => {
  beforeEach(() => {
    selectPricingFactsPool.mockResolvedValue(liveFacts)
    selectPricingFactsNear.mockResolvedValue(liveFacts)
    getSubdivisionRing.mockResolvedValue({
      homeSlug: 'rolling-horse-meadow',
      homeLabel: 'Rolling Horse Meadow',
      neighborhoodSlug: null,
      ring: [],
    })
  })

  it('contract: live-select-path-rhm-plat-does-not-widen', async () => {
    const sel = await selectCompsPreferringFacts(canterSubject(), { asOf: '2026-09-15' })
    expect(sel.pricingSource).toBe('facts')
    expect(sel.diagnostics.subject.subdivision).not.toMatch(/rolling horse meadow/i)
    const keys = sel.comps.map((c) => c.listingKey)
    const numbers = sel.comps.map((c) => c.mlsNumber)
    expect(keys).toContain('RANCH-1058')
    expect(keys).toContain('HB-1025')
    expect(numbers).toContain('220218584')
    expect(numbers).toContain('220214720')
    expect(keys).not.toContain('UP-Clearpine')
    expect(keys).not.toContain('UP-ForestEdge')
    expect(keys).not.toContain('UP-GrandPeaks')
    expect(sel.comps.every((c) => !/clearpine|forest edge|grand peaks/i.test(c.subdivision ?? ''))).toBe(
      true,
    )
    expect(sel.tiersUsed.some((t) => t.startsWith('nearby-') || t.startsWith('widened-'))).toBe(false)
    const closes = sel.comps.map((c) => c.closePrice).sort((a, b) => a - b)
    const mid = closes[Math.floor(closes.length / 2)]!
    expect(mid).toBeGreaterThanOrEqual(649_000)
    expect(mid).toBeLessThanOrEqual(710_000)
    expect(mid).toBeLessThan(849_000)
  })
})
