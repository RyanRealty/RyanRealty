import { describe, expect, it } from 'vitest'
import { listingMetaDescription, type ListingMetaDescriptionInput } from './listing-meta-description'

// Founding case, deploy of 4aec949a6 (2026-10-14): `npm run deploy:verify` failed
// its live SEO baseline because sibling listings published the SAME meta
// description. The rows below are the production rows (listings, read
// 2026-10-14): same plat, same price, same remarks, different lot number.
const GALVESTON_REMARKS =
  'This lot is located in phase II & approved for capping fill septic system. You can now call Longhorn Ridge your home! 5+ acre home sites, wide open spaces and beautiful views. A thoughtfully planned gated community w/miles of winding paved spacious roads meandering through it and plenty of adjacent BLM/State land for walking/bicycling/jogging/etc.'

const FEDERAL_REMARKS =
  'Great opportunity to locate across from Costco. This is one of 3 small parcels/lots, .45 acre each. These are the only small lots currently existing across from Costco. They are all zoned M-1 with City Services stubbed to each lot.'

function galveston(lot: string, listNumber: string): ListingMetaDescriptionInput {
  return {
    price: 114_500,
    streetNumber: lot,
    streetDirPrefix: 'SE',
    streetName: 'Galveston',
    streetSuffix: 'Loop',
    subdivisionName: 'Longhorn Ridge',
    city: 'Prineville',
    listNumber,
    lotSizeAcres: 5,
    lotSizeSqft: 217_800,
    publicRemarks: GALVESTON_REMARKS,
  }
}

function federal(streetNumber: string, listNumber: string): ListingMetaDescriptionInput {
  return {
    price: 250_000,
    streetNumber,
    streetName: 'Federal',
    streetSuffix: 'Way',
    subdivisionName: 'N/A',
    city: 'Central Point',
    listNumber,
    lotSizeAcres: 0.45,
    lotSizeSqft: 19_602,
    publicRemarks: FEDERAL_REMARKS,
  }
}

describe('listingMetaDescription: sibling listings that share their remarks', () => {
  it('gives sibling lots in one plat, at one price, different descriptions', () => {
    const lot84 = listingMetaDescription(galveston('Lot 84', '201505641'))
    const lot85 = listingMetaDescription(galveston('Lot 85', '201505643'))
    const lot86 = listingMetaDescription(galveston('Lot 86', '201505646'))
    const lot64 = listingMetaDescription(galveston('Lot 64', '201505662'))
    expect(new Set([lot84, lot85, lot86, lot64]).size).toBe(4)
    expect(lot84).toContain('Lot 84 SE Galveston Loop')
    expect(lot85).toContain('Lot 85 SE Galveston Loop')
  })

  it('gives three parcels in one building address range different descriptions', () => {
    const set = new Set(
      [
        federal('430', '102976952'),
        federal('440', '102976950'),
        federal('450', '102976958'),
      ].map(listingMetaDescription),
    )
    expect(set.size).toBe(3)
  })

  it('differs by address alone: same price, plat, lot and remarks', () => {
    const a = listingMetaDescription({ ...galveston('Lot 84', '1'), lotSizeAcres: null, lotSizeSqft: null })
    const b = listingMetaDescription({ ...galveston('Lot 85', '2'), lotSizeAcres: null, lotSizeSqft: null })
    expect(a).not.toBe(b)
  })

  it('differs by price alone when the address is the only other shared fact', () => {
    const base = { ...galveston('Lot 84', '1') }
    expect(listingMetaDescription({ ...base, price: 114_500 })).not.toBe(
      listingMetaDescription({ ...base, price: 119_900 }),
    )
  })

  it('keeps the part that differs ahead of the cut: the unique facts come before the remarks', () => {
    const d = listingMetaDescription(galveston('Lot 84', '201505641'))
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d.startsWith('$114,500 · 5-acre lot · Lot 84 SE Galveston Loop, Longhorn Ridge, Prineville. ')).toBe(true)
    // The shared remarks are what gets cut.
    expect(d.endsWith('…')).toBe(true)
  })
})

describe('listingMetaDescription: facts, all from the row', () => {
  it('prints the lot on land, in acres rounded to two places', () => {
    expect(listingMetaDescription(federal('430', '1'))).toContain('0.45-acre lot')
    expect(listingMetaDescription(galveston('Lot 84', '1'))).toContain('5-acre lot')
  })

  it('falls back to square feet when the row has no acres', () => {
    const d = listingMetaDescription({ ...federal('430', '1'), lotSizeAcres: null })
    expect(d).toContain('19,602 sq ft lot')
  })

  it('prints no lot when the row has no lot size, and invents none', () => {
    const d = listingMetaDescription({ ...federal('430', '1'), lotSizeAcres: null, lotSizeSqft: null })
    expect(d).not.toContain('acre lot')
    expect(d.startsWith('$250,000 · 430 Federal Way, Central Point. ')).toBe(true)
  })

  it('leaves the lot off a home: beds, baths and sq ft are the facts a buyer scans', () => {
    const d = listingMetaDescription({
      price: 825_000,
      beds: 4,
      baths: 3,
      sqft: 2_450,
      lotSizeAcres: 0.31,
      streetNumber: '61288',
      streetName: 'King Saul',
      streetSuffix: 'Avenue',
      subdivisionName: 'Tetherow',
      city: 'Bend',
      listNumber: '220100001',
      publicRemarks: 'Single level living with a sunny back patio.',
    })
    expect(d).toBe(
      '$825,000 · 4 bed, 3 bath · 2,450 sq ft · 61288 King Saul Avenue, Tetherow, Bend. Single level living with a sunny back patio.',
    )
  })

  it('drops the MLS placeholder "N/A" plat instead of printing it as a place', () => {
    const d = listingMetaDescription(federal('430', '1'))
    expect(d).not.toContain('N/A')
    expect(d).toContain('430 Federal Way, Central Point')
  })

  it('leads with the status word and the close price on a sold home', () => {
    const d = listingMetaDescription({
      statusWord: 'Sold',
      price: 1_100_000,
      beds: 3,
      baths: 3,
      sqft: 3_174,
      streetNumber: '55550',
      streetName: 'Heidi',
      streetSuffix: 'Court',
      city: 'Bend',
      listNumber: '220219603',
      publicRemarks: 'Quiet cul-de-sac.',
    })
    expect(d.startsWith('Sold $1,100,000 · 3 bed, 3 bath · 3,174 sq ft · 55550 Heidi Court, Bend')).toBe(true)
  })

  it('shows the broker remarks as written: whitespace normalised, wording untouched', () => {
    const d = listingMetaDescription({
      price: 300_000,
      beds: 2,
      streetNumber: '1',
      streetName: 'Oak',
      streetSuffix: 'Street',
      city: 'Bend',
      publicRemarks: '  Light &   airy\n\nw/ new floors!  ',
    })
    expect(d.endsWith('Light & airy w/ new floors!')).toBe(true)
  })
})

describe('listingMetaDescription: a street with no house number', () => {
  const parcel: ListingMetaDescriptionInput = {
    price: 99_000,
    streetNumber: '0',
    streetName: 'Kouns',
    streetSuffix: 'Drive',
    subdivisionName: 'Kouns Acres',
    city: 'Bend',
    lotSizeAcres: 1.35,
    publicRemarks: GALVESTON_REMARKS,
  }

  it('adds the MLS number, because the address alone cannot tell two parcels apart', () => {
    const a = listingMetaDescription({ ...parcel, listNumber: '220200001' })
    const b = listingMetaDescription({ ...parcel, listNumber: '220200002' })
    expect(a).toContain('MLS 220200001')
    expect(b).toContain('MLS 220200002')
    expect(a).not.toBe(b)
    expect(a).not.toMatch(/\b0 Kouns/)
  })

  it('never prints the MLS number when the address has a house number', () => {
    expect(listingMetaDescription(federal('430', '102976952'))).not.toContain('MLS')
    expect(listingMetaDescription(galveston('Lot 84', '201505641'))).not.toContain('MLS')
  })

  it('names the MLS number alone when the row has no street at all', () => {
    const d = listingMetaDescription({ price: 50_000, city: 'Bend', listNumber: '220200003', publicRemarks: 'Corner parcel.' })
    expect(d).toBe('$50,000 · Bend · MLS 220200003. Corner parcel.')
  })
})

describe('listingMetaDescription: length and fallbacks', () => {
  it('never exceeds 155 characters and never ends mid-word', () => {
    const longRemarks = 'Wide open views of the Cascades from every window. '.repeat(30)
    const d = listingMetaDescription({ ...galveston('Lot 84', '1'), publicRemarks: longRemarks })
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d.endsWith('…')).toBe(true)
    expect(d.slice(0, -1)).not.toMatch(/\s$/)
  })

  it('says what the page holds when the listing has no remarks', () => {
    const d = listingMetaDescription({ ...federal('430', '1'), publicRemarks: null })
    expect(d).toBe('$250,000 · 0.45-acre lot · 430 Federal Way, Central Point. Photos, map, and nearby sales.')
  })

  it('treats whitespace-only remarks as no remarks', () => {
    const d = listingMetaDescription({ ...federal('430', '1'), publicRemarks: '  \n ' })
    expect(d.endsWith('Photos, map, and nearby sales.')).toBe(true)
  })

  it('drops the remarks rather than print a two-word fragment when the facts fill the line', () => {
    const d = listingMetaDescription({
      price: 1_250_000,
      beds: 5,
      baths: 4,
      sqft: 4_200,
      streetNumber: '12345',
      streetDirPrefix: 'NW',
      streetName: 'Extraordinarily Long Cascade Vista',
      streetSuffix: 'Boulevard',
      subdivisionName: 'The Reserve at Awbrey Butte Estates',
      city: 'Bend',
      publicRemarks: 'Lovely.',
    })
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d).not.toContain('Lovely')
    expect(d.endsWith('.')).toBe(true)
  })

  it('adds no em dash of its own to public copy', () => {
    const d = listingMetaDescription({ ...federal('430', '1'), publicRemarks: null })
    expect(d).not.toContain('—')
  })
})
