import { describe, expect, it } from 'vitest'
import { rollupPlatFamilyInventory } from './getPlatFamilyInventory'

describe('rollupPlatFamilyInventory', () => {
  it('counts each single-family listing once across overlapping phases', () => {
    const out = rollupPlatFamilyInventory(
      [
        { listing_key: 'a', geo_slug: 'x-11', property_type: 'A', property_sub_type: 'Single Family Residence', list_price: 600000 },
        // The same home inside the replat of the same lots.
        { listing_key: 'a', geo_slug: 'x-11-replat', property_type: 'A', property_sub_type: 'Single Family Residence', list_price: 600000 },
        { listing_key: 'b', geo_slug: 'x-12', property_type: 'A', property_sub_type: 'Single Family Residence', list_price: 800000 },
        { listing_key: 'c', geo_slug: 'x-12', property_type: 'A', property_sub_type: 'Townhouse', list_price: 400000 },
        { listing_key: 'd', geo_slug: 'x-12', property_type: 'D', property_sub_type: 'Residential Lots', list_price: 150000 },
        { listing_key: 'e', geo_slug: 'x-13', property_type: 'A', property_sub_type: 'Single Family Residence', list_price: null },
      ],
      '2026-09-23T00:00:00.000Z',
    )
    expect(out.activeCount).toBe(3)
    expect(out.listingKeys).toEqual(['a', 'b', 'e'])
    // The median of the PRICED single-family listings: 600,000 and 800,000.
    expect(out.medianListPrice).toBe(700000)
    expect(out.allTypeCount).toBe(5)
    expect(out.readAt).toBe('2026-09-23T00:00:00.000Z')
  })

  it('is empty, not zero-priced, when nothing is listed', () => {
    const out = rollupPlatFamilyInventory([], '2026-09-23T00:00:00.000Z')
    expect(out).toMatchObject({ activeCount: 0, medianListPrice: null, listingKeys: [] })
  })
})
