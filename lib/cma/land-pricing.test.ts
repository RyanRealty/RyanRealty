import { describe, expect, it } from 'vitest'
import {
  ACREAGE_THRESHOLD_ACRES,
  subjectNoun,
  subjectPossessive,
  subjectSectionTitle,
  adjustLandComps,
  infrastructureSchedule,
  landProduct,
  priceLandSubject,
} from './land-pricing'
import { adjustComps, computePricing } from './pricing'

const AS_OF = Date.parse('2026-08-27T00:00:00Z')

function comp(over: Partial<Record<string, unknown>> = {}) {
  return {
    listingKey: String(Math.random()),
    mlsNumber: null, address: 'x', city: 'Bend', subdivision: null,
    latitude: null, longitude: null, beds: null, baths: null,
    sqft: 0, lotAcres: 0.25, propertySubType: 'Residential Lots',
    yearBuilt: null, photoUrl: null, publicRemarks: null, viewDescription: null,
    taxAnnual: null, listPrice: null, closePrice: 200_000, closeDate: '2026-05-01',
    ...over,
  } as never
}

const BARE_SITE = {
  water: { source: 'unknown', providerName: null, wellLog: null, irrigationDistrict: null, rights: [], mappedIrrigationAcres: null, primaryIrrigationPriorityDate: null, hasPrivateAppurtenant: false, rightsQueryOk: true, rightsUsedPolygon: true },
  septic: { status: 'unknown', permit: null },
  entitlement: null, zone: null, zoneOverlays: [], flood: { zone: null, inSFHA: null }, wildfireHazard: null,
} as never

describe('landProduct — which subjects are land', () => {
  // Values verified against docs/plans/MARKET_TRUTH/REGISTRY.md §1.
  it('splits lots from acreage at the 1-acre line', () => {
    expect(landProduct({ propertySubType: 'Residential Lots', lotAcres: 0.23 })).toBe('lots')
    expect(landProduct({ propertySubType: 'Residential Lots', lotAcres: 20 })).toBe('acreage')
    expect(ACREAGE_THRESHOLD_ACRES).toBe(1)
  })

  it('treats agriculture and rangeland as acreage at any parcel size', () => {
    expect(landProduct({ propertySubType: 'Agriculture', lotAcres: 0.5 })).toBe('acreage')
    expect(landProduct({ propertySubType: 'Rangeland', lotAcres: 0.5 })).toBe('acreage')
    expect(landProduct({ propertySubType: 'Recreational', lotAcres: 40 })).toBe('acreage')
  })

  it('is not land when a dwelling stands on it', () => {
    // 2,817 of 4,150 farm rows carry a dwelling (REGISTRY §1). Pricing one per
    // acre would value the house at zero.
    expect(landProduct({ propertySubType: 'Agriculture', lotAcres: 38, sqft: 2400 })).toBeNull()
    expect(landProduct({ propertySubType: 'Single Family Residence', lotAcres: 5, sqft: 2100 })).toBeNull()
  })

  it('does not let a shop or shed flip a bare parcel to improved', () => {
    expect(landProduct({ propertySubType: 'Recreational', lotAcres: 40, sqft: 320 })).toBe('acreage')
  })

  it('returns null for an unmapped subtype rather than guessing', () => {
    expect(landProduct({ propertySubType: 'Acreage', lotAcres: 20 })).toBeNull()
    expect(landProduct({ propertySubType: null, lotAcres: 20 })).toBeNull()
  })
})

describe('what the document calls the subject', () => {
  const lot = { propertySubType: 'Residential Lots', lotAcres: 0.23, sqft: null }
  const acreage = { propertySubType: 'Recreational', lotAcres: 40, sqft: null }
  const home = { propertySubType: 'Single Family Residence', lotAcres: 0.2, sqft: 2000 }

  it('names a lot a lot, acreage land, and a house a house', () => {
    expect(subjectNoun(lot)).toBe('lot')
    expect(subjectNoun(acreage)).toBe('land')
    expect(subjectNoun(home)).toBe('home')
  })

  it('uses the possessive the narrative reads with', () => {
    expect(subjectPossessive(lot)).toBe('lot')
    expect(subjectPossessive(acreage)).toBe('land')
    // Never "home" — the document says "as your house".
    expect(subjectPossessive(home)).toBe('house')
  })

  it('titles the subject section per product', () => {
    expect(subjectSectionTitle(lot)).toBe('The lot')
    expect(subjectSectionTitle(acreage)).toBe('The land')
    expect(subjectSectionTitle(home)).toBe('The house')
  })

  it('calls a farm with a dwelling a house, not land', () => {
    expect(subjectSectionTitle({ propertySubType: 'Agriculture', lotAcres: 38, sqft: 2400 })).toBe('The house')
  })
})

describe('adjustLandComps', () => {
  it('drops comps with no usable acreage instead of dividing by zero', () => {
    const rows = adjustLandComps(0.25, [comp({ lotAcres: null }), comp({ lotAcres: 0 }), comp()] as never, null, AS_OF)
    expect(rows).toHaveLength(1)
    expect(Number.isFinite(rows[0]!.pricePerAcre)).toBe(true)
  })

  it('caps the market-conditions adjustment at 20% of the sale price', () => {
    const rows = adjustLandComps(
      0.25,
      [comp({ closePrice: 200_000, closeDate: '2020-01-01' })] as never,
      { yoyMedianPriceDeltaPct: 40 } as never,
      AS_OF,
    )
    expect(Math.abs(rows[0]!.timeAdjustment)).toBeLessThanOrEqual(40_000)
  })
})

describe('priceLandSubject — lots', () => {
  const subject = { streetAddress: 'Lot 12', sqft: null, lotAcres: 0.23, propertySubType: 'Residential Lots' } as never

  it('prices a platted lot from the comp set', () => {
    const p = priceLandSubject({
      subject,
      comps: [
        comp({ closePrice: 210_000, lotAcres: 0.24 }),
        comp({ closePrice: 235_000, lotAcres: 0.22 }),
        comp({ closePrice: 199_000, lotAcres: 0.25 }),
        comp({ closePrice: 221_000, lotAcres: 0.23 }),
      ] as never,
      market: null, minComps: 3, asOfMs: AS_OF,
    })
    expect(p).not.toBeNull()
    expect(p!.recommended).toBeGreaterThan(150_000)
    expect(p!.recommended).toBeLessThan(300_000)
    expect(p!.valueLow).toBeLessThanOrEqual(p!.recommended)
    expect(p!.valueHigh).toBeGreaterThanOrEqual(p!.recommended)
    expect(Number.isFinite(p!.recommended)).toBe(true)
    expect(p!.needsReview).toBe(false)
  })

  it('refuses to price under the comp floor', () => {
    const p = priceLandSubject({
      subject, comps: [comp(), comp()] as never, market: null, minComps: 3, asOfMs: AS_OF,
    })
    expect(p).toBeNull()
  })

  it('flags a set that is not one market', () => {
    const p = priceLandSubject({
      subject,
      comps: [
        comp({ closePrice: 90_000, lotAcres: 0.25 }),
        comp({ closePrice: 240_000, lotAcres: 0.24 }),
        comp({ closePrice: 610_000, lotAcres: 0.23 }),
      ] as never,
      market: null, minComps: 3, asOfMs: AS_OF,
    })
    expect(p!.needsReview).toBe(true)
    expect(p!.reviewReason).toMatch(/per-acre/)
  })
})

describe('priceLandSubject — acreage', () => {
  const subject = { streetAddress: 'Rural', sqft: null, lotAcres: 19.6, propertySubType: 'Recreational' } as never
  const comps = [
    comp({ closePrice: 520_000, lotAcres: 20, propertySubType: 'Recreational' }),
    comp({ closePrice: 610_000, lotAcres: 24, propertySubType: 'Recreational' }),
    comp({ closePrice: 445_000, lotAcres: 17, propertySubType: 'Recreational' }),
  ] as never

  it('always routes acreage to broker review', () => {
    const p = priceLandSubject({ subject, comps, market: null, site: BARE_SITE, minComps: 3, asOfMs: AS_OF })
    expect(p!.needsReview).toBe(true)
    expect(p!.confidence).toBe('Supportable')
  })

  it('carries the infrastructure of record and never a dollar value for it', () => {
    const p = priceLandSubject({
      subject, comps, market: null, minComps: 3, asOfMs: AS_OF,
      site: { ...(BARE_SITE as never as Record<string, unknown>), septic: { status: 'site-evaluation-only', permit: '247-21-000123' } } as never,
    })
    const schedule = p!.notes.filter((n) => n.startsWith('Septic'))
    expect(schedule[0]).toContain('247-21-000123')
    // §0: a contributory value per well or per irrigated acre is an appraisal
    // judgement, not a query result. No line item may carry a dollar figure.
    for (const line of p!.notes.slice(1)) expect(line).not.toMatch(/\$[\d,]/)
  })
})

describe('the published band follows the same convention as a home', () => {
  const subject = { streetAddress: 'Lot 12', sqft: null, lotAcres: 0.23, propertySubType: 'Residential Lots' } as never
  const wide = [
    comp({ closePrice: 90_000, lotAcres: 0.25 }),
    comp({ closePrice: 240_000, lotAcres: 0.24 }),
    comp({ closePrice: 610_000, lotAcres: 0.23 }),
    comp({ closePrice: 180_000, lotAcres: 0.22 }),
  ] as never

  it('reports one band, not two pairs of numbers', () => {
    const p = priceLandSubject({ subject, comps: wide, market: null, minComps: 3, asOfMs: AS_OF })!
    expect(p.valueLow).toBe(p.conservative)
    expect(p.valueHigh).toBe(p.highEnd)
  })

  it('keeps the band ordered around the recommendation', () => {
    const p = priceLandSubject({ subject, comps: wide, market: null, minComps: 3, asOfMs: AS_OF })!
    expect(p.conservative).toBeLessThanOrEqual(p.recommended)
    expect(p.recommended).toBeLessThanOrEqual(p.highEnd)
  })

  it('caps the ceiling at 8% over the recommendation', () => {
    const p = priceLandSubject({ subject, comps: wide, market: null, minComps: 3, asOfMs: AS_OF })!
    expect(p.highEnd).toBeLessThanOrEqual(Math.ceil(p.recommended * 1.08) + 1000)
  })
})

describe('infrastructureSchedule', () => {
  it('never pairs a permit with "no record found"', () => {
    const lines = infrastructureSchedule({ ...(BARE_SITE as never as Record<string, unknown>), septic: { status: 'unknown', permit: '247-19-000988' } } as never)
    const septic = lines.find((l) => l.startsWith('Septic'))!
    expect(septic).toContain('247-19-000988')
    expect(septic).not.toMatch(/no onsite record/)
  })

  it('distinguishes a failed water-rights query from a dry parcel', () => {
    const failed = infrastructureSchedule({ ...(BARE_SITE as never as Record<string, unknown>), water: { ...(BARE_SITE as never as { water: Record<string, unknown> }).water, rightsQueryOk: false } } as never)
    expect(failed.join(' ')).toMatch(/did not complete/)
    const dry = infrastructureSchedule(BARE_SITE)
    expect(dry.join(' ')).toMatch(/No perfected primary irrigation right/)
  })
})

describe('the shared engine dispatches land', () => {
  it('no longer yields Infinity $/sqft for a comp with no living area', () => {
    const subject = { streetAddress: 'Lot 12', sqft: null, lotAcres: 0.23, propertySubType: 'Residential Lots' } as never
    const adj = adjustComps(subject, [comp(), comp(), comp()] as never, null, AS_OF)
    for (const a of adj) expect(Number.isFinite(a.ppsfTimeAdjusted)).toBe(true)
  })

  it('prices a lot through computePricing, which used to return null', () => {
    const subject = { streetAddress: 'Lot 12', sqft: null, lotAcres: 0.23, propertySubType: 'Residential Lots' } as never
    const comps = [
      comp({ closePrice: 210_000, lotAcres: 0.24 }),
      comp({ closePrice: 235_000, lotAcres: 0.22 }),
      comp({ closePrice: 199_000, lotAcres: 0.25 }),
    ] as never
    const p = computePricing(subject, adjustComps(subject, comps, null, AS_OF), null)
    expect(p).not.toBeNull()
    expect(p!.recommended).toBeGreaterThan(0)
  })

  it('still prices an improved home the ordinary way', () => {
    const subject = { streetAddress: '1 Main', sqft: 2000, lotAcres: 0.2, propertySubType: 'Single Family Residence' } as never
    const comps = [
      comp({ closePrice: 600_000, sqft: 1950, propertySubType: 'Single Family Residence', lotAcres: 0.2 }),
      comp({ closePrice: 640_000, sqft: 2100, propertySubType: 'Single Family Residence', lotAcres: 0.21 }),
      comp({ closePrice: 585_000, sqft: 1900, propertySubType: 'Single Family Residence', lotAcres: 0.19 }),
    ] as never
    const p = computePricing(subject, adjustComps(subject, comps, null, AS_OF), null)
    expect(p).not.toBeNull()
    expect(p!.recommended).toBeGreaterThan(400_000)
  })
})
