import { describe, expect, it } from 'vitest'
import { childStockDetails, summarizeChildStock } from './place-child-stock'

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
