import { describe, expect, it } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import { cmaSubjectToPricing, pickCompSource } from '@/lib/pricing/select'

function subject(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'S',
    mlsNumber: '220000000',
    streetAddress: '1 Test',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: 'Westridge',
    latitude: 44.081947,
    longitude: -121.331962,
    beds: 3,
    baths: 4,
    sqft: 3756,
    lotAcres: 1.12,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2008,
    garageSpaces: 5,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Active',
    lastListPrice: 2_299_000,
    lastListDate: null,
    listingHistoryLine: null,
    waterRaw: null,
    ...over,
  }
}

describe('cmaSubjectToPricing', () => {
  it('does not treat 1 acre inside a mapped Bend neighborhood as rural', () => {
    const out = cmaSubjectToPricing(subject())
    expect(out.ruralAcreage).toBe(false)
    expect(out.marketArea).toBe('bend-awbrey-butte')
  })

  it('classifies subject water from PK-bounded WaterSource, not the empty typed column', () => {
    const out = cmaSubjectToPricing(subject({ waterRaw: null }), {
      waterRaw: { Public: true, 'Water Meter': true },
    })
    expect(out.waterClass).toBe('public')
  })

  it('is rural only outside the mesh on an acre or more', () => {
    const out = cmaSubjectToPricing(subject({ latitude: 44.2, longitude: -121.4, lotAcres: 6.73 }))
    expect(out.ruralAcreage).toBe(true)
    expect(out.marketArea).toBeNull()
  })
})

describe('pickCompSource', () => {
  it('stays on the facts set when facts ran, even if n is under 3', () => {
    expect(pickCompSource({ factsReady: true, comps: [{}, {}] })).toBe('facts')
    expect(pickCompSource({ factsReady: true, comps: [] })).toBe('facts')
  })

  it('uses the listings ladder only when facts are not ready', () => {
    expect(pickCompSource({ factsReady: false, comps: [] })).toBe('listings')
  })
})
