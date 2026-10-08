/**
 * The exclusive pocket's same-subdivision floor reads the subject's own
 * subdivision by the picker's own-plat stamp (Matt 2026-10-08, "Yes,
 * everywhere"), not only by the subject's typed MLS name. A Kenwood First
 * Addition sale the picker seated as own plat is a same-subdivision sale here
 * too, whatever MLS name its row carries.
 */
import { describe, expect, it } from 'vitest'
import { finishExclusivePocketPricing } from '@/lib/cma/pocket-pricing'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

function adjusted(over: Partial<CmaAdjustedComp>): CmaAdjustedComp {
  return {
    listingKey: 'K',
    mlsNumber: null,
    address: '1 Kenwood',
    city: 'Bend',
    subdivision: 'Kenwood',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1940,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: null,
    closePrice: 725_000,
    closeDate: '2026-06-01',
    daysToOffer: null,
    domTotal: null,
    selectionTier: 'subdivision-6mo',
    ownPlat: true,
    monthsSinceClose: 4,
    timeAdjustment: -5_000,
    timeAdjustedPrice: 720_000,
    ppsfTimeAdjusted: 400,
    sizeAdjustment: 0,
    adjustedPrice: 720_000,
    weight: 3,
    ...over,
  } as CmaAdjustedComp
}

function pricing(): CmaPricing {
  return {
    valueLow: 650_000,
    valueHigh: 760_000,
    recommended: 700_000,
    conservative: 660_000,
    notes: [],
    timeAdjustment: null,
    rangeRule: null,
  } as unknown as CmaPricing
}

describe('the same-subdivision floor counts an own-plat addition sale', () => {
  const subject = { city: 'Bend', subdivision: 'Kenwood' } as CmaSubject
  const adj = [
    adjusted({ listingKey: 'KEN', address: '1 Kenwood' }),
    adjusted({
      listingKey: 'ADD',
      address: '733 Saginaw',
      subdivision: 'Kenwood First Addition',
      closePrice: 700_000,
      timeAdjustment: -10_000,
      timeAdjustedPrice: 690_000,
      adjustedPrice: 690_000,
    }),
  ]

  it('floors at the addition sale, the lowest meaningful own-subdivision adjusted price', () => {
    const p = pricing()
    finishExclusivePocketPricing(p, { subject, adj, set: adj })
    expect(p.notes.some((n) => n.includes('same-subdivision adjusted sale at $690,000'))).toBe(true)
    expect(p.valueLow).toBe(690_000)
  })

  it('without the stamp the row is another subdivision by name, as before', () => {
    const p = pricing()
    const unstamped = adj.map((c) => (c.listingKey === 'ADD' ? { ...c, ownPlat: false } : c))
    finishExclusivePocketPricing(p, { subject, adj: unstamped, set: unstamped })
    expect(p.notes.some((n) => n.includes('same-subdivision adjusted sale at $720,000'))).toBe(true)
  })
})
