import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'

const selectComps = vi.hoisted(() =>
  vi.fn(async () => {
    throw new Error('listings selectComps must not run for custom/new')
  }),
)

vi.mock('@/lib/cma/comps', () => ({
  selectComps,
  selectCompsByKeys: vi.fn(),
  MIN_COMPS: 3,
}))

const countSalePricingFacts = vi.hoisted(() => vi.fn(async () => 5000))
const selectPricingFactsPool = vi.hoisted(() => vi.fn(async () => []))
const getListingWaterSource = vi.hoisted(() => vi.fn(async () => null))
const getPricingMarketIndex = vi.hoisted(() => vi.fn(async () => []))
const getPricingSubdivisionCells = vi.hoisted(() => vi.fn(async () => []))

vi.mock('@/lib/data/pricing/facts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/pricing/facts')>()
  return {
    ...actual,
    countSalePricingFacts,
    selectPricingFactsPool,
    getListingWaterSource,
    getPricingMarketIndex,
    getPricingSubdivisionCells,
  }
})

import { selectCompsPreferringFacts, pickCompSource } from '@/lib/pricing/select'
import { isCustomOrNewSubject } from '@/lib/pricing/classes'

const liveRemarks =
  'Introducing a stunning mid-century modern home perched over a turn in Tumalo Creek. This to-be-built masterpiece offers 4 beds.'

function rimSubject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: '20240507184011418651000000',
    mlsNumber: '220182032',
    streetAddress: '19365 Rim View',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: 'Lakes At Tanager PUD',
    latitude: 44.1005,
    longitude: -121.356541,
    beds: 4,
    baths: 4,
    sqft: 4972,
    lotAcres: 2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2024,
    garageSpaces: null,
    photoUrl: null,
    publicRemarks: liveRemarks,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Canceled',
    lastListPrice: null,
    lastListDate: null,
    listingHistoryLine: null,
    waterRaw: null,
    sewerRaw: null,
    levelsRaw: null,
    newConstructionYn: true,
    ...over,
  } as CmaSubject
}

describe('selectCompsPreferringFacts — Rim #187 FAIL shape stays facts-only', () => {
  beforeEach(() => {
    selectComps.mockClear()
    countSalePricingFacts.mockClear()
    selectPricingFactsPool.mockResolvedValue([])
  })

  it('never invokes listings selectComps for live year/YN/mid-century/to-be-built shape', async () => {
    const subject = rimSubject()
    expect(
      isCustomOrNewSubject(
        {
          yearBuilt: subject.yearBuilt,
          newConstructionYn: subject.newConstructionYn,
          remarks: subject.publicRemarks,
          propertySubType: subject.propertySubType,
          standardStatus: subject.standardStatus,
        },
        2026,
      ),
    ).toBe(true)

    const sel = await selectCompsPreferringFacts(subject)
    expect(selectComps).not.toHaveBeenCalled()
    expect(sel.pricingSource).toBe('facts')
    expect(sel.diagnostics.pricing_source).toBe('facts')
    expect(sel.diagnostics.custom_or_new).toBe(true)
    // Must not look like the listings FAIL banner (competing-area / citywide SQL).
    expect(sel.tiersUsed.join(' ')).not.toMatch(/competing-area|citywide/)
    expect(sel.diagnostics.tiers_used.join(' ')).not.toMatch(/competing-area|citywide/)
    expect(sel.diagnostics.ladder.map((t) => t.tier).join(' ')).not.toMatch(
      /competing-area|citywide/,
    )
    expect(sel.trace.join(' ')).not.toMatch(/listings WHERE StandardStatus/i)
  })

  it('still refuses listings when NewConstructionYN is false but year + remarks classify', async () => {
    const subject = rimSubject({ newConstructionYn: false })
    const custom = isCustomOrNewSubject(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstructionYn,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      2026,
    )
    expect(custom).toBe(true)
    expect(pickCompSource({ factsReady: true, comps: [], customOrNew: custom })).toBe('facts')

    const sel = await selectCompsPreferringFacts(subject)
    expect(selectComps).not.toHaveBeenCalled()
    expect(sel.pricingSource).toBe('facts')
    expect(sel.diagnostics.custom_or_new).toBe(true)
  })

  it('remarks-only Lakes At Tanager shape (lost year/YN) still never listings-falls-back', async () => {
    const subject = rimSubject({ yearBuilt: null, newConstructionYn: null })
    const sel = await selectCompsPreferringFacts(subject)
    expect(selectComps).not.toHaveBeenCalled()
    expect(sel.pricingSource).toBe('facts')
    expect(sel.diagnostics.custom_or_new).toBe(true)
    expect(sel.diagnostics.starved_reason ?? '').not.toMatch(/listings path/i)
  })
})
