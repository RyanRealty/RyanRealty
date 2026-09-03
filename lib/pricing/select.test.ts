import { describe, expect, it } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import { cmaSubjectToPricing, matchToCompSelection, pickCompSource } from '@/lib/pricing/select'

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

  it('carries remarks and an OWRD irrigation class onto the facts subject', () => {
    const out = cmaSubjectToPricing(subject({ publicRemarks: 'Irrigated hay ground.' }), {
      irrigationClass: 'irrigated',
    })
    expect(out.publicRemarks).toBe('Irrigated hay ground.')
    expect(out.irrigationClass).toBe('irrigated')
  })

  it('does not treat a 1-acre Redmond lot as rural just because Bend GIS has no mesh there', () => {
    const out = cmaSubjectToPricing(
      subject({
        city: 'Redmond',
        latitude: 44.272,
        longitude: -121.174,
        lotAcres: 1.05,
        subdivision: 'Dry Canyon',
      }),
    )
    expect(out.marketArea).toBeNull()
    expect(out.ruralAcreage).toBe(false)
  })
})

describe('matchToCompSelection', () => {
  it('records the resolved market area and rural flag', () => {
    const awbrey = matchToCompSelection(subject(), {
      comps: [],
      tiersUsed: [],
      trace: [],
      reachedTarget: false,
      starved: true,
    })
    expect(awbrey.diagnostics.market_area).toBe('Awbrey Butte')
    expect(awbrey.diagnostics.market_area_resolved).toBe(true)
    expect(awbrey.diagnostics.rural_acreage).toBe(false)

    const rural = matchToCompSelection(subject({ latitude: 44.2, longitude: -121.4, lotAcres: 6.73 }), {
      comps: [],
      tiersUsed: [],
      trace: [],
      reachedTarget: false,
      starved: true,
    })
    expect(rural.diagnostics.market_area).toBeNull()
    expect(rural.diagnostics.market_area_resolved).toBe(false)
    expect(rural.diagnostics.rural_acreage).toBe(true)
  })
})

describe('pickCompSource', () => {
  it('stays on facts when facts produced at least 3 sales', () => {
    expect(pickCompSource({ factsReady: true, comps: [{}, {}, {}] })).toBe('facts')
  })

  it('falls back to listings when facts starve under 3', () => {
    expect(pickCompSource({ factsReady: true, comps: [{}, {}] })).toBe('listings')
    expect(pickCompSource({ factsReady: true, comps: [] })).toBe('listings')
  })

  it('uses the listings ladder when facts are not ready', () => {
    expect(pickCompSource({ factsReady: false, comps: [{}, {}, {}] })).toBe('listings')
  })
})
