import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject, CmaPricing } from '@/lib/cma/types'
import type { CompArea } from '@/lib/pricing/comp-area'

const getCmaBandInventory = vi.fn()
const getCmaAreaBandInventory = vi.fn()
const getCmaCityClosedSkinny = vi.fn(async () => [])
const getCmaSubdivisionClosed = vi.fn(async () => [])
const getCmaMarketAreaRows = vi.fn(async () => [])

type AnyFn = (...args: unknown[]) => unknown
vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaBandInventory: (...args: unknown[]) => (getCmaBandInventory as AnyFn)(...args),
  getCmaCityClosedSkinny: (...args: unknown[]) => (getCmaCityClosedSkinny as AnyFn)(...args),
  getCmaSubdivisionClosed: (...args: unknown[]) => (getCmaSubdivisionClosed as AnyFn)(...args),
}))

vi.mock('@/lib/data/cma/bandInventory', () => ({
  getCmaAreaBandInventory: (...args: unknown[]) => (getCmaAreaBandInventory as AnyFn)(...args),
}))

vi.mock('@/lib/data/cma/marketAreaReads', () => ({
  getCmaMarketAreaRows: (...args: unknown[]) => (getCmaMarketAreaRows as AnyFn)(...args),
}))

import { buildCmaExtras } from '@/lib/cma/extras'

function subject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '22000000',
    streetAddress: '1121 Canter Ct',
    city: 'Sisters',
    state: 'OR',
    postalCode: '97759',
    subdivision: 'Rolling Horse Meadow',
    latitude: 44.2908,
    longitude: -121.5493,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Active',
    lastListPrice: 500000,
    lastListDate: '2026-06-01',
    listingHistoryLine: null,
    ...over,
  }
}

function pricing(recommended = 500_000): CmaPricing {
  return {
    method1Low: recommended,
    method1Mid: recommended,
    method1High: recommended,
    method2: null,
    method3: recommended,
    convergenceSpreadPct: null,
    converged: true,
    conservative: recommended,
    recommended,
    highEnd: recommended,
    valueLow: recommended,
    valueHigh: recommended,
    confidence: 'Moderate',
    confidenceReason: 'test',
    needsReview: false,
    reviewReason: null,
    compPpsfCv: 0.05,
    priceOverride: null,
    improvementsValueAdd: null,
    notes: [],
  }
}

const pocketArea: CompArea = {
  kind: 'subdivisions',
  names: ['Rolling Horse Meadow', 'SaddleStone'],
  radiusMiles: null,
  centre: { lat: 44.2908, lng: -121.5493 },
  source: 'test CompArea',
  sentence: 'Rolling Horse Meadow and the one subdivision next to it.',
}

const pocketInventory = {
  activeAsks: Array.from({ length: 12 }, () => 495000),
  activeDaysOnMarket: Array.from({ length: 12 }, () => 14),
  activeCount: 12,
  pendingCount: 1,
  truncated: false,
  activeRows: [],
  pendingRows: [],
}

const cityInventory = {
  activeAsks: Array.from({ length: 21 }, () => 495000),
  activeDaysOnMarket: Array.from({ length: 21 }, () => 14),
  activeCount: 21,
  pendingCount: 4,
  truncated: false,
  activeRows: [],
  pendingRows: [],
}

describe('buildCmaExtras — CompArea-scoped band', () => {
  beforeEach(() => {
    getCmaBandInventory.mockReset()
    getCmaAreaBandInventory.mockReset()
    getCmaCityClosedSkinny.mockReset()
    getCmaSubdivisionClosed.mockReset()
    getCmaMarketAreaRows.mockReset()
    getCmaCityClosedSkinny.mockResolvedValue([])
    getCmaSubdivisionClosed.mockResolvedValue([])
    getCmaMarketAreaRows.mockResolvedValue([])
    getCmaBandInventory.mockImplementation(async () => {
      throw new Error('city-wide getCmaBandInventory must not run when CompArea is set')
    })
    getCmaAreaBandInventory.mockResolvedValue(pocketInventory)
  })

  it('uses a passed area inventory and never calls city-wide getCmaBandInventory', async () => {
    const extras = await buildCmaExtras({
      subject: subject(),
      comps: [],
      pricing: pricing(),
      subjectPhotosCount: null,
      compArea: pocketArea,
      areaInventory: pocketInventory,
      band: { lo: 450000, hi: 550000 },
    })
    expect(getCmaBandInventory).not.toHaveBeenCalled()
    expect(getCmaAreaBandInventory).not.toHaveBeenCalled()
    expect(extras.band).not.toBeNull()
    expect(extras.band!.activeCount).toBe(12)
    expect(extras.band!.source).toContain('CompArea')
    expect(extras.band!.source).not.toMatch(/city-wide|City='Sisters'/)
  })

  it('fetches getCmaAreaBandInventory when CompArea is set without a prefetched inventory', async () => {
    const extras = await buildCmaExtras({
      subject: subject(),
      comps: [],
      pricing: pricing(),
      subjectPhotosCount: null,
      compArea: pocketArea,
    })
    expect(getCmaBandInventory).not.toHaveBeenCalled()
    expect(getCmaAreaBandInventory).toHaveBeenCalledTimes(1)
    expect(getCmaAreaBandInventory.mock.calls[0]![0]).toMatchObject({
      area: pocketArea,
      city: 'Sisters',
    })
    expect(extras.band!.activeCount).toBe(12)
    expect(extras.band!.source).toContain('CompArea subdivisions')
  })

  it('falls back to city-wide getCmaBandInventory only when CompArea is absent', async () => {
    getCmaBandInventory.mockResolvedValue(cityInventory)
    const extras = await buildCmaExtras({
      subject: subject(),
      comps: [],
      pricing: pricing(),
      subjectPhotosCount: null,
    })
    expect(getCmaAreaBandInventory).not.toHaveBeenCalled()
    expect(getCmaBandInventory).toHaveBeenCalledTimes(1)
    expect(extras.band!.activeCount).toBe(21)
    expect(extras.band!.source).toContain("City='Sisters'")
  })
})
