import { describe, expect, it } from 'vitest'
import {
  aggregateUnder500kTowns,
  classifyResidentialSubType,
  headlineUnder500kTotals,
  isUnder500kResidential,
  medianListPrice,
  UNDER_500K_PRICE_CAP,
} from './under-500k-classify'

describe('classifyResidentialSubType', () => {
  it('splits the MLS subtypes the 2026-10-13 Query A used', () => {
    expect(classifyResidentialSubType('Single Family Residence')).toBe('sfr')
    expect(classifyResidentialSubType('Townhouse')).toBe('condoTownhome')
    expect(classifyResidentialSubType('Condominium')).toBe('condoTownhome')
    expect(classifyResidentialSubType('Manufactured On Land')).toBe('manufacturedOnLand')
    expect(classifyResidentialSubType('Tenancy in Common')).toBe('sharedOrLeased')
    expect(classifyResidentialSubType('Residential Leased Land')).toBe('sharedOrLeased')
    expect(classifyResidentialSubType('Timeshare')).toBe('sharedOrLeased')
    expect(classifyResidentialSubType('Something Else')).toBe('otherResidential')
  })
})

describe('isUnder500kResidential', () => {
  it('uses a strict price cap, so $500,000 is out', () => {
    expect(isUnder500kResidential({ cityLower: 'bend', propertySubType: 'Condominium', listPrice: 499_999 })).toBe(true)
    expect(isUnder500kResidential({ cityLower: 'bend', propertySubType: 'Condominium', listPrice: UNDER_500K_PRICE_CAP })).toBe(false)
    expect(isUnder500kResidential({ cityLower: 'bend', propertySubType: 'Condominium', listPrice: null })).toBe(false)
  })
})

describe('medianListPrice', () => {
  it('matches percentile_cont(0.5) on even and odd sets', () => {
    expect(medianListPrice([850_000])).toBe(850_000)
    expect(medianListPrice([800_000, 900_000])).toBe(850_000)
    expect(medianListPrice([100, 200, 300])).toBe(200)
    expect(medianListPrice([])).toBeNull()
  })
})

describe('aggregateUnder500kTowns', () => {
  it('rebuilds the Oct 13 four-city 602 / 288 split and keeps Sisters and Sunriver as footnotes', () => {
    const rows = [
      ...Array.from({ length: 71 }, () => ({ cityLower: 'redmond', propertySubType: 'Single Family Residence', listPrice: 400_000 })),
      ...Array.from({ length: 63 }, () => ({ cityLower: 'redmond', propertySubType: 'Townhouse', listPrice: 350_000 })),
      ...Array.from({ length: 4 }, () => ({ cityLower: 'redmond', propertySubType: 'Condominium', listPrice: 300_000 })),
      ...Array.from({ length: 5 }, () => ({ cityLower: 'redmond', propertySubType: 'Manufactured On Land', listPrice: 280_000 })),
      ...Array.from({ length: 17 }, () => ({ cityLower: 'redmond', propertySubType: 'Tenancy in Common', listPrice: 220_000 })),
      ...Array.from({ length: 20 }, () => ({ cityLower: 'redmond', propertySubType: 'Residential Leased Land', listPrice: 210_000 })),
      ...Array.from({ length: 33 }, () => ({ cityLower: 'bend', propertySubType: 'Single Family Residence', listPrice: 450_000 })),
      ...Array.from({ length: 26 }, () => ({ cityLower: 'bend', propertySubType: 'Townhouse', listPrice: 420_000 })),
      ...Array.from({ length: 50 }, () => ({ cityLower: 'bend', propertySubType: 'Condominium', listPrice: 310_000 })),
      ...Array.from({ length: 32 }, () => ({ cityLower: 'bend', propertySubType: 'Manufactured On Land', listPrice: 290_000 })),
      ...Array.from({ length: 10 }, () => ({ cityLower: 'bend', propertySubType: 'Tenancy in Common', listPrice: 200_000 })),
      ...Array.from({ length: 6 }, () => ({ cityLower: 'bend', propertySubType: 'Residential Leased Land', listPrice: 190_000 })),
      { cityLower: 'bend', propertySubType: 'Timeshare', listPrice: 90_000 },
      ...Array.from({ length: 94 }, () => ({ cityLower: 'la pine', propertySubType: 'Single Family Residence', listPrice: 399_000 })),
      { cityLower: 'la pine', propertySubType: 'Townhouse', listPrice: 375_000 },
      ...Array.from({ length: 49 }, () => ({ cityLower: 'la pine', propertySubType: 'Manufactured On Land', listPrice: 275_000 })),
      ...Array.from({ length: 90 }, () => ({ cityLower: 'prineville', propertySubType: 'Single Family Residence', listPrice: 389_000 })),
      ...Array.from({ length: 27 }, () => ({ cityLower: 'prineville', propertySubType: 'Manufactured On Land', listPrice: 260_000 })),
      ...Array.from({ length: 3 }, () => ({ cityLower: 'prineville', propertySubType: 'Residential Leased Land', listPrice: 180_000 })),
      ...Array.from({ length: 3 }, () => ({ cityLower: 'sisters', propertySubType: 'Single Family Residence', listPrice: 480_000 })),
      ...Array.from({ length: 4 }, () => ({ cityLower: 'sisters', propertySubType: 'Townhouse', listPrice: 410_000 })),
      ...Array.from({ length: 5 }, () => ({ cityLower: 'sisters', propertySubType: 'Condominium', listPrice: 300_000 })),
      ...Array.from({ length: 4 }, () => ({ cityLower: 'sisters', propertySubType: 'Manufactured On Land', listPrice: 270_000 })),
      { cityLower: 'sunriver', propertySubType: 'Single Family Residence', listPrice: 495_000 },
      ...Array.from({ length: 10 }, () => ({ cityLower: 'sunriver', propertySubType: 'Condominium', listPrice: 320_000 })),
      ...Array.from({ length: 29 }, () => ({ cityLower: 'sunriver', propertySubType: 'Tenancy in Common', listPrice: 250_000 })),
      { cityLower: 'bend', propertySubType: 'Single Family Residence', listPrice: 850_000 },
      { cityLower: 'medford', propertySubType: 'Single Family Residence', listPrice: 300_000 },
    ]

    const towns = aggregateUnder500kTowns(rows)
    const headline = headlineUnder500kTotals(towns)
    expect(headline).toEqual({ residential: 602, sfr: 288 })

    const bend = towns.find((t) => t.slug === 'bend')
    expect(bend).toMatchObject({
      residential: 158,
      sfr: 33,
      townhouse: 26,
      condo: 50,
      condoTownhome: 76,
      manufacturedOnLand: 32,
      sharedOrLeased: 17,
      footnote: false,
    })
    expect(bend?.sfrMedianList).toBe(450_000)

    const sisters = towns.find((t) => t.slug === 'sisters')
    const sunriver = towns.find((t) => t.slug === 'sunriver')
    expect(sisters?.footnote).toBe(true)
    expect(sisters?.residential).toBe(16)
    expect(sisters?.sfr).toBe(3)
    expect(sunriver?.footnote).toBe(true)
    expect(sunriver?.residential).toBe(40)
    expect(sunriver?.sfr).toBe(1)
    expect(sunriver?.sharedOrLeased).toBe(29)
  })
})
