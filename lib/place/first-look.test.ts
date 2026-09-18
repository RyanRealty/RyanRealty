import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  listingsFromAtlasDots,
  photoCardsFromOpening,
  placeLookPhotoCards,
} from '@/lib/place/first-look'
import type { PlaceOpeningListingBucket } from '@/lib/data/listings/getPlaceOpeningListings'

function houseBucket(n: number): PlaceOpeningListingBucket {
  return {
    key: 'houses',
    label: 'Houses',
    noun: { one: 'house', many: 'houses' },
    newCount30d: n,
    source: 'listing_tile_mv',
    listings: Array.from({ length: n }, (_, i) => ({
      href: `/homes-for-sale/listing/22000${i}`,
      photoSrc: `https://example.test/house-${i}.jpg`,
      title: `${100 + i} NW Test Ave`,
      price: `$${(700 + i)}K`,
      beds: 3,
      baths: 2,
      sqft: 1800 + i,
    })),
  }
}

describe('place first-look cards', () => {
  it('takes house photographs first and stops at six', () => {
    const cards = photoCardsFromOpening([houseBucket(8)])
    expect(cards).toHaveLength(6)
    expect(cards[0]?.photoSrc).toContain('house-0')
    expect(cards.every((card) => card.photoSrc.length > 0)).toBe(true)
  })

  it('falls back to map listings when opening buckets have no photos', () => {
    const cards = placeLookPhotoCards({
      buckets: [],
      listings: [
        {
          ListingKey: 'abc',
          ListPrice: 735000,
          Latitude: 44.05,
          Longitude: -121.3,
          PhotoURL: 'https://example.test/pin.jpg',
          StreetNumber: '12',
          StreetName: 'Oregon',
          StreetSuffix: 'Ave',
          City: 'Bend',
        },
      ],
    })
    expect(cards).toHaveLength(1)
    expect(cards[0]?.photoSrc).toContain('pin.jpg')
    expect(cards[0]?.price).toBe('$735K')
  })
})

describe('place first-look map island', () => {
  it('clusters pins on one ring and does not paint child overlays', () => {
    const map = readFileSync(resolve('components/site/v3/V3PlaceLookMap.client.tsx'), 'utf8')
    expect(map).toMatch(/hideBoundaryToggle:\s*true/)
    expect(map).toMatch(/SearchMapClustered/)
    expect(map).not.toMatch(/overlayBoundaries/)
  })
})

describe('place first-look pins', () => {
  it('keeps active house dots and drops sold marks', () => {
    const listings = listingsFromAtlasDots([
      {
        k: 'live',
        lat: 44.05,
        lng: -121.3,
        p: 735000,
        s: 'active',
        photo: 'https://example.test/live.jpg',
        street: '12 Oregon Ave, Bend',
      },
      {
        k: 'sold',
        lat: 44.06,
        lng: -121.31,
        p: 800000,
        s: 'sold',
        photo: 'https://example.test/sold.jpg',
      },
    ])
    expect(listings).toHaveLength(1)
    expect(listings[0]?.ListingKey).toBe('live')
    expect(listings[0]?.ListPrice).toBe(735000)
  })
})
