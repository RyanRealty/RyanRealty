import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import { communityFieldItems } from './community-opening'

function tile(listingKey: string, price: number): ListingTile {
  return {
    listingKey,
    listNumber: listingKey,
    listPrice: price,
    streetNumber: '1',
    streetName: 'Fairway',
    streetSuffix: 'Dr',
    city: 'Bend',
    photoUrl: null,
    lat: 44.03,
    lng: -121.36,
    beds: 3,
    baths: 2,
    sqft: 2000,
    subdivisionName: 'Tetherow',
  } as ListingTile
}

describe('master-plan Field see-all', () => {
  it('lists the counted set, not a 24-home slice', () => {
    const tiles = Array.from({ length: 36 }, (_, i) => tile(`k${i}`, 1_000_000 + i))
    const items = communityFieldItems(tiles)
    expect(items).toHaveLength(36)
  })

  it('tags each row with a type chip key', () => {
    const items = communityFieldItems([
      { ...tile('house-1', 900_000), propertySubType: 'Single Family Residence' },
      { ...tile('lot-1', 200_000), propertySubType: 'Residential Lots' },
    ])
    expect(items.map((item) => item.typeLabel)).toEqual(['House', 'Land'])
    expect(items.every((item) => item.cat === 0 || item.cat === 1)).toBe(true)
  })
})
