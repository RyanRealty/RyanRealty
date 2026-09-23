import { describe, expect, it } from 'vitest'
import { childListingKeys, childStockDetails, railDoorHref, subdivisionRailEntries, summarizeChildStock } from './place-child-stock'
import { firstListedPhoto } from './rail-photo'

describe('summarizeChildStock', () => {
  it('counts each listing once and omits empty types', () => {
    expect(
      summarizeChildStock([
        {
          listing_key: 'a',
          geo_slug: 'park-place',
          property_type: 'A',
          property_sub_type: 'Single Family Residence',
        },
        {
          listing_key: 'a',
          geo_slug: 'park-place',
          property_type: 'A',
          property_sub_type: 'Single Family Residence',
        },
        {
          listing_key: 'b',
          geo_slug: 'park-place',
          property_type: 'D',
          property_sub_type: 'Residential Lots',
        },
      ]),
    ).toBe('1 single-family · 1 lot')
  })

  it('returns null when nothing is measured', () => {
    expect(summarizeChildStock([])).toBeNull()
  })

  it('counts a commercial sale as commercial and never a commercial lease', () => {
    expect(
      summarizeChildStock([
        { listing_key: 'f', geo_slug: 'x', property_type: 'F', property_sub_type: null },
        { listing_key: 'g', geo_slug: 'x', property_type: 'G', property_sub_type: null },
      ]),
    ).toBe('1 commercial')
    expect(
      summarizeChildStock([{ listing_key: 'g', geo_slug: 'x', property_type: 'G', property_sub_type: null }]),
    ).toBeNull()
  })

  it('drops a commercial lease (PropertyType G) rather than counting it as single-family', () => {
    // Verified live 2026-09-23: 671 Greenwood Avenue, Bend carries three
    // Active 'G' rows (list_price 1.3 / 1.4 / 1.4) under subdivision "Center
    // Addition to Bend"; placeStockSectionKey falls to 'sfr' for 'G' via
    // placeTypeKey's default, which printed them as single-family stock.
    expect(
      summarizeChildStock([
        {
          listing_key: 'lease-1',
          geo_slug: 'center-addition-to-bend',
          property_type: 'G',
          property_sub_type: null,
        },
        {
          listing_key: 'lease-2',
          geo_slug: 'center-addition-to-bend',
          property_type: 'G',
          property_sub_type: null,
        },
        {
          listing_key: 'sfr-1',
          geo_slug: 'center-addition-to-bend',
          property_type: 'A',
          property_sub_type: 'Single Family Residence',
        },
      ]),
    ).toBe('1 single-family')
  })
})

describe('childStockDetails', () => {
  it('attaches the mix to the matching plat and leaves an empty plat unlabeled', () => {
    const rows = childStockDetails(
      [
        { name: 'Park Place', href: '/subdivisions/park-place' },
        { name: 'Quiet Lot', href: '/subdivisions/quiet-lot' },
      ],
      [
        {
          listing_key: 'a',
          geo_slug: 'park-place',
          property_type: 'A',
          property_sub_type: 'Townhouse',
        },
      ],
    )
    expect(rows[0]?.detail).toBe('1 townhome or condo')
    expect(rows[1]?.detail).toBeUndefined()
  })
})

describe('subdivisionRailEntries', () => {
  it('keeps the drawn subdivision and drops a repeated slug', () => {
    const rail = subdivisionRailEntries({
      regions: [
        { name: 'North Forty', href: '/subdivisions/north-forty' },
        { name: 'Quiet Lot', href: '/subdivisions/quiet-lot' },
      ],
      extras: [{ name: 'North Forty again', href: '/subdivisions/north-forty' }],
      rows: [
        {
          listing_key: 'a',
          geo_slug: 'north-forty',
          property_type: 'A',
          property_sub_type: 'Single Family Residence',
        },
        {
          listing_key: 'b',
          geo_slug: 'north-forty',
          property_type: 'A',
          property_sub_type: 'Single Family Residence',
        },
      ],
    })
    expect(rail.map((row) => row.id)).toEqual(['north-forty', 'quiet-lot'])
    // EXP-3: every rail row carries its page, so the rail can render a real
    // anchor beside the map-select button.
    expect(rail.map((row) => row.href)).toEqual(['/subdivisions/north-forty', '/subdivisions/quiet-lot'])
    expect(rail[0]?.detail).toBe('2 single-family')
    expect(rail[1]?.detail).toBeUndefined()
    expect(childListingKeys([
      {
        listing_key: 'a',
        geo_slug: 'north-forty',
        property_type: 'A',
        property_sub_type: 'Single Family Residence',
      },
      {
        listing_key: 'a',
        geo_slug: 'north-forty',
        property_type: 'A',
        property_sub_type: 'Single Family Residence',
      },
    ])).toEqual({ 'north-forty': ['a'] })
  })
})

describe('firstListedPhoto', () => {
  it('uses the first photograph inside that subdivision', () => {
    expect(
      firstListedPhoto(
        [
          { listingKey: 'a', photoUrl: '  ' },
          { listingKey: 'b', photoUrl: 'https://cdn.example/north.jpg' },
          { listingKey: 'c', photoUrl: 'https://cdn.example/other.jpg' },
        ],
        ['a', 'b'],
      ),
    ).toBe('https://cdn.example/north.jpg')
    expect(firstListedPhoto([{ listingKey: 'c', photoUrl: 'https://cdn.example/other.jpg' }], ['a'])).toBeNull()
    expect(firstListedPhoto([{ listingKey: 'a', photoUrl: 'https://cdn.example/north.jpg' }], [])).toBeNull()
    expect(firstListedPhoto([{ listingKey: 'a', photoUrl: 'https://cdn.example/north.jpg' }], undefined)).toBeNull()
  })
})

describe('railDoorHref (EXP-3 doors never land on a redirect)', () => {
  it('opens a redirected plat slug at its destination and drops a door back to the page itself', () => {
    expect(railDoorHref('/subdivisions/park-place')).toBe('/subdivisions/park-place')
    expect(railDoorHref('/subdivisions/eagle-crest')).toBe('/communities/eagle-crest')
    expect(railDoorHref('/subdivisions/eagle-crest', '/communities/eagle-crest')).toBeUndefined()
    expect(railDoorHref('not-a-path')).toBeUndefined()
  })
})
