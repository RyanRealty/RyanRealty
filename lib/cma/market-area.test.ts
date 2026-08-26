/**
 * Market-area primitives for comp selection (Brain Dump 2, A5).
 *
 * Locks the two rules Matt confirmed and the disclosure Fannie Mae B4-1.3-08
 * requires. The regression these prevent: comp selection had NO geographic
 * constraint at all, so the city tier pulled candidates up to 21 miles away
 * (measured 2026-07-28 on 4 real Bend subjects: max 14-21 mi, median 2.2-5.0 mi,
 * 29-45 of 50 candidates over 2 miles).
 */

import { describe, expect, it } from 'vitest'
import {
  bearingLabel,
  distanceMiles,
  lotCharacterCompatible,
  productClass,
  productTypeCompatible,
  keepSameProductType,
  compPoolPropertySubType,
  DETACHED_PROPERTY_SUB_TYPE,
  bathCountCompatible,
  marketAreaName,
  proximityLabel,
  resolveMarketArea,
} from './market-area'

// Awbrey Butte's published centroid, from the City of Bend GIS mesh.
const AWBREY = { lat: 44.081947, lng: -121.331962 }

describe('resolveMarketArea', () => {
  it('resolves a point inside a mapped neighborhood to that neighborhood', () => {
    const slug = resolveMarketArea(AWBREY.lat, AWBREY.lng)
    expect(slug).toBeTruthy()
    expect(marketAreaName(slug)).toBeTruthy()
  })

  it('returns null well outside the Bend mesh rather than guessing', () => {
    expect(resolveMarketArea(45.52, -122.68)).toBeNull() // Portland
  })

  it('returns null on missing or non-finite coordinates', () => {
    expect(resolveMarketArea(null, null)).toBeNull()
    expect(resolveMarketArea(44.05, null)).toBeNull()
    expect(resolveMarketArea(Number.NaN, -121.3)).toBeNull()
  })
})

describe('distance + direction (Fannie Mae B4-1.3-08 reporting)', () => {
  it('is zero for the same point and symmetric between two points', () => {
    expect(distanceMiles(AWBREY, AWBREY)).toBeCloseTo(0, 6)
    const b = { lat: 44.0, lng: -121.3 }
    expect(distanceMiles(AWBREY, b)).toBeCloseTo(distanceMiles(b, AWBREY)!, 6)
  })

  it('measures a known separation to within a tolerance', () => {
    // ~1 degree of latitude is ~69 miles.
    const d = distanceMiles({ lat: 44, lng: -121 }, { lat: 45, lng: -121 })
    expect(d).toBeGreaterThan(68)
    expect(d).toBeLessThan(70)
  })

  it('names the compass direction', () => {
    expect(bearingLabel({ lat: 44, lng: -121 }, { lat: 45, lng: -121 })).toBe('N')
    expect(bearingLabel({ lat: 44, lng: -121 }, { lat: 43, lng: -121 })).toBe('S')
    expect(bearingLabel({ lat: 44, lng: -121 }, { lat: 44, lng: -120 })).toBe('E')
  })

  it('formats proximity the way the guideline states it', () => {
    const label = proximityLabel({ lat: 44, lng: -121 }, { lat: 44.02, lng: -121.02 })
    expect(label).toMatch(/^\d+\.\d{2} miles (N|NE|E|SE|S|SW|W|NW)$/)
  })

  it('returns null rather than a fabricated distance when a point lacks coordinates', () => {
    expect(distanceMiles(AWBREY, { lat: null, lng: null })).toBeNull()
    expect(proximityLabel(AWBREY, { lat: null, lng: null })).toBeNull()
  })
})

describe('lotCharacterCompatible — Matt hard exclusion, any distance', () => {
  it('never compares acreage to an in-town lot', () => {
    expect(lotCharacterCompatible(5, 0.18)).toBe(false)
    expect(lotCharacterCompatible(0.18, 5)).toBe(false)
  })

  it('compares two in-town lots regardless of exact size', () => {
    expect(lotCharacterCompatible(0.12, 0.9)).toBe(true)
  })

  it('keeps acreage within a comparable band', () => {
    expect(lotCharacterCompatible(10, 8)).toBe(true)
    expect(lotCharacterCompatible(1, 40)).toBe(false)
  })

  it('fails OPEN on unknown lot size — absent data must not silently drop good comps', () => {
    expect(lotCharacterCompatible(null, 0.2)).toBe(true)
    expect(lotCharacterCompatible(5, null)).toBe(true)
  })
})

describe('productTypeCompatible — product-class hard exclusion', () => {
  it('classifies the sub-types the MLS actually returns', () => {
    expect(productClass('Single Family Residence')).toBe('detached')
    expect(productClass('Townhouse')).toBe('attached')
    expect(productClass('Condominium')).toBe('attached')
    expect(productClass('Tenancy in Common')).toBe('attached')
    expect(productClass('Manufactured On Land')).toBe('manufactured')
    expect(productClass('Residential Leased Land')).toBe('leased-land')
    expect(productClass('Stock Cooperative')).toBe('coop')
    expect(productClass(null)).toBeNull()
  })

  it('rejects a townhome comp for a detached subject at any distance', () => {
    // The cma-922-ogden regression: two townhomes sat in a 4-comp detached
    // analysis and the auditor called the resulting price indefensible.
    expect(productTypeCompatible('Single Family Residence', 'Townhouse')).toBe(false)
    expect(productTypeCompatible('Single Family Residence', 'Condominium')).toBe(false)
  })

  it('rejects a manufactured home for a detached subject — financing differs', () => {
    expect(productTypeCompatible('Single Family Residence', 'Manufactured On Land')).toBe(false)
  })

  it('rejects leased land and co-ops — neither is fee-simple ownership of a house', () => {
    // Both sit under PropertyType='A' and both used to fall through to null,
    // which fails OPEN, so they could be priced against a detached house.
    expect(productTypeCompatible('Single Family Residence', 'Residential Leased Land')).toBe(false)
    expect(productTypeCompatible('Single Family Residence', 'Stock Cooperative')).toBe(false)
  })

  it('keeps like for like', () => {
    expect(productTypeCompatible('Single Family Residence', 'Single Family Residence')).toBe(true)
    expect(productTypeCompatible('Townhouse', 'Townhouse')).toBe(true)
    expect(productTypeCompatible('Condominium', 'Condominium')).toBe(true)
  })

  it('does not treat a townhouse and a condo as the same product', () => {
    expect(productTypeCompatible('Townhouse', 'Condominium')).toBe(false)
  })

  it('fails CLOSED when either side is unknown — PropertyType A is not a type', () => {
    expect(productTypeCompatible(null, 'Townhouse')).toBe(false)
    expect(productTypeCompatible('Single Family Residence', null)).toBe(false)
  })

  it('still drops townhomes from a band when the subject type was not stored', () => {
    expect(keepSameProductType(null, 'Townhouse')).toBe(false)
    expect(keepSameProductType(null, 'Single Family Residence')).toBe(true)
  })
})

describe('compPoolPropertySubType — comps SQL by the subject, not mixed A', () => {
  it('pins detached subjects to D1 SFR even when the MLS wording varies', () => {
    expect(compPoolPropertySubType('Single Family Residence')).toBe(DETACHED_PROPERTY_SUB_TYPE)
    expect(compPoolPropertySubType('Detached')).toBe('Single Family Residence')
    expect(compPoolPropertySubType('Single Family Residence')).not.toBeNull()
  })

  it('does not SQL-force SFR for a townhouse, condo, or manufactured subject', () => {
    expect(compPoolPropertySubType('Townhouse')).toBe('Townhouse')
    expect(compPoolPropertySubType('Condominium')).toBe('Condominium')
    expect(compPoolPropertySubType('Manufactured On Land')).toBe('Manufactured On Land')
    expect(compPoolPropertySubType('Townhouse')).not.toBe('Single Family Residence')
    expect(compPoolPropertySubType('Condominium')).not.toBe(DETACHED_PROPERTY_SUB_TYPE)
  })

  it('does not invent SFR when the subject type is unknown', () => {
    expect(compPoolPropertySubType(null)).toBeNull()
    expect(compPoolPropertySubType('')).toBeNull()
    expect(compPoolPropertySubType('   ')).toBeNull()
  })
})

describe('bathCountCompatible — same whole-bath count', () => {
  it('rejects a two-bath sale for a one-bath house', () => {
    expect(bathCountCompatible(1, 2)).toBe(false)
    expect(bathCountCompatible(1, 1)).toBe(true)
    expect(bathCountCompatible(2, 2)).toBe(true)
  })

  it('treats a half bath as the same whole count', () => {
    expect(bathCountCompatible(1, 1.5)).toBe(true)
    expect(bathCountCompatible(2, 2.5)).toBe(true)
    expect(bathCountCompatible(1, 2.5)).toBe(false)
  })

  it('fails closed when the sale has no bath count and the subject does', () => {
    expect(bathCountCompatible(1, null)).toBe(false)
    expect(bathCountCompatible(null, 2)).toBe(true)
  })
})

describe('productClass — every MLS sub type reaches a class (2026-08-26)', () => {
  // 12 of 21 registry sub types used to return null, and null fails closed in
  // productTypeCompatible — so a lot, a duplex or a manufactured-in-park
  // subject drew ZERO comps and could not be valued. 1,652 closed sales over
  // 12 months, ~15% of inventory.
  it.each([
    ['Single Family Residence', 'detached'],
    ['Townhouse', 'attached'],
    ['Condominium', 'attached'],
    ['Tenancy in Common', 'attached'],
    ['Manufactured On Land', 'manufactured'],
    ['Residential Leased Land', 'leased-land'],
    ['On Leased Land', 'leased-land'],
    ['Stock Cooperative', 'coop'],
    ['In Park', 'in-park'],
    ['Residential Lots', 'lots'],
    ['Recreational', 'recreational'],
    ['Agriculture', 'agriculture'],
    ['Rangeland', 'rangeland'],
    ['Duplex', 'multi-2-4'],
    ['Triplex', 'multi-2-4'],
    ['Quadruplex', 'multi-2-4'],
    ['Multi Family', 'multi-2-4'],
    ['Commercial', 'commercial'],
    ['Industrial', 'commercial'],
    ['Investment', 'commercial'],
    ['Timeshare', 'timeshare'],
  ])('%s -> %s', (subType, expected) => {
    expect(productClass(subType)).toBe(expected)
  })

  it('still returns null for an unmapped value, so it still fails closed', () => {
    // Load-bearing. PropertyType='A' once mixed 14% attached/manufactured into
    // a detached pool — that is how Santorini townhomes appeared beside an SFR.
    // A new MLS value earns a class deliberately, never by falling open.
    expect(productClass('Some New MLS Value')).toBeNull()
    expect(productClass(null)).toBeNull()
    expect(productTypeCompatible('Some New MLS Value', 'Single Family Residence')).toBe(false)
  })

  it('keeps "In Park" apart from "Manufactured On Land"', () => {
    // A home in a park sits on ground the buyer does not own. That is the
    // leased-land problem, not the manufactured-on-land one, and the two do not
    // price from each other.
    expect(productTypeCompatible('In Park', 'Manufactured On Land')).toBe(false)
    expect(productTypeCompatible('In Park', 'In Park')).toBe(true)
  })

  it('does not let "Rangeland" trip the leased-land guard', () => {
    expect(productClass('Rangeland')).toBe('rangeland')
  })

  it('comps 2-4 unit against each other, not against a house', () => {
    expect(productTypeCompatible('Duplex', 'Triplex')).toBe(true)
    expect(productTypeCompatible('Duplex', 'Quadruplex')).toBe(true)
    expect(productTypeCompatible('Duplex', 'Single Family Residence')).toBe(false)
  })

  it('keeps each land type in its own market', () => {
    // Matt 2026-08-26: land comps each type separately. A building lot and a
    // rangeland parcel are not one market.
    expect(productTypeCompatible('Residential Lots', 'Residential Lots')).toBe(true)
    expect(productTypeCompatible('Residential Lots', 'Agriculture')).toBe(false)
    expect(productTypeCompatible('Agriculture', 'Rangeland')).toBe(false)
    expect(productTypeCompatible('Recreational', 'Residential Lots')).toBe(false)
  })

  it('leaves the comps SQL open for 2-4 unit so sizes can mix', () => {
    // Pinning the subject's own value would hide every other unit count from
    // the pool — a duplex subject would never see a triplex sale. JS does the
    // class match instead.
    expect(compPoolPropertySubType('Duplex')).toBeNull()
    // Land still pins, because each type is its own market.
    expect(compPoolPropertySubType('Residential Lots')).toBe('Residential Lots')
    expect(compPoolPropertySubType('Single Family Residence')).toBe(DETACHED_PROPERTY_SUB_TYPE)
  })

  it('still drops attached product for an unknown subject on soft surfaces', () => {
    expect(keepSameProductType(null, 'Townhouse')).toBe(false)
    expect(keepSameProductType(null, 'Single Family Residence')).toBe(true)
  })
})
