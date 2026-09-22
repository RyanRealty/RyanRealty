import { describe, expect, it } from 'vitest'
import { childListingKeys, childStockDetails, subdivisionRailEntries, summarizeChildStock } from './place-child-stock'
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
