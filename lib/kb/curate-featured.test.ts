import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { curateFeaturedTiles } from './curate-featured'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    listPrice: 500_000,
    streetNumber: '100',
    streetName: `${partial.listingKey} St`,
    streetSuffix: null,
    city: 'Bend',
    photoUrl: 'https://cdn.example/x.jpg',
    lat: 44.05,
    lng: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: null,
    ...partial,
  } as ListingTile
}

describe('curateFeaturedTiles', () => {
  // Order is a PRODUCT decision (Matt 2026-08-27): the market leads. Leading
  // with the price-desc "luxury heroes" put an $8.75M outlier as the first
  // home every visitor saw when the region's median was ~$939K.
  it('leads with each town at its live median; the two highest asks follow, never open', () => {
    const tiles = [
      tile({ listingKey: 'trophy1', listPrice: 8_750_000 }),
      tile({ listingKey: 'trophy2', listPrice: 5_900_000 }),
      tile({ listingKey: 'bend-median', listPrice: 940_000 }),
      tile({ listingKey: 'redmond-median', listPrice: 610_000, city: 'Redmond' }),
      tile({ listingKey: 'filler', listPrice: 1_200_000 }),
    ]
    const out = curateFeaturedTiles(
      tiles,
      [
        { name: 'Bend', medianPrice: 939_000 },
        { name: 'Redmond', medianPrice: 605_000 },
      ],
      5,
    )
    expect(out[0]?.listingKey).toBe('bend-median')
    expect(out[1]?.listingKey).toBe('redmond-median')
    // Both trophies stay in the set — right after the median picks.
    expect(out.slice(2, 4).map((t) => t.listingKey).sort()).toEqual(['trophy1', 'trophy2'])
  })

  it('one development cannot fill the grid (street+subdivision dedupe)', () => {
    const tiles = [
      tile({ listingKey: 'a', streetName: 'Same St', subdivisionName: 'One Sub', listPrice: 900_000 }),
      tile({ listingKey: 'b', streetName: 'Same St', subdivisionName: 'One Sub', listPrice: 890_000 }),
      tile({ listingKey: 'c', streetName: 'Other St', listPrice: 880_000 }),
    ]
    const out = curateFeaturedTiles(tiles, [], 3)
    expect(out.map((t) => t.listingKey)).not.toContain('b')
  })
})
