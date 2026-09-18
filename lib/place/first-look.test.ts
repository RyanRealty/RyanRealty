import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CITY_LOOK_PIN_CAP,
  capLookListings,
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
  it('paints price pins on one ring and does not paint child overlays', () => {
    const map = readFileSync(resolve('components/site/v3/V3PlaceLookMap.client.tsx'), 'utf8')
    expect(map).toMatch(/hideBoundaryToggle:\s*true/)
    expect(map).toMatch(/boundaryStrokeWeight:\s*8/)
    expect(map).toMatch(/disableClustering:\s*true/)
    expect(map).toMatch(/fitSubjectRing:\s*true/)
    expect(map).toMatch(/SearchMapClustered/)
    expect(map).not.toMatch(/overlayBoundaries/)
  })

  it('lets the BEM canvas fill the 10.5rem phone island (no 360px minHeight)', () => {
    const clustered = readFileSync(resolve('components/SearchMapClustered.tsx'), 'utf8')
    expect(clustered).toMatch(/const fillIsland = \/v3-place-look\/\.test\(className\)/)
    expect(clustered).not.toMatch(/\\bv3-place-look\\b/)
    expect(/v3-place-look/.test('v3-place-look__map-canvas')).toBe(true)
    expect(/\bv3-place-look\b/.test('v3-place-look__map-canvas')).toBe(false)
    expect(clustered).toMatch(/fitSubjectRing && hasRing/)
    expect(clustered).toMatch(/v3SubjectRingPadding/)
  })

  it('paints a cream halo + navy ink above the basemap and under pills', () => {
    const clustered = readFileSync(resolve('components/SearchMapClustered.tsx'), 'utf8')
    expect(clustered).toMatch(/subjectRingHaloWeight/)
    expect(clustered).toMatch(/strokeColor: MAP_CREAM/)
    expect(clustered).toMatch(/dataset\.subjectRing = 'true'/)
    expect(clustered).toMatch(/SUBJECT_RING_Z_UNDER_PILLS/)
    expect(clustered).toMatch(/SUBJECT_RING_CHIP_Z/)
    expect(clustered).toMatch(/dataset\.subjectRingLabel/)
    expect(clustered).toMatch(/subjectRingLabel\(placeQuery\)/)
    expect(clustered).toMatch(/overlayLayer/)
    expect(clustered).toMatch(/subjectRingKeepFittedZoom/)
    expect(clustered).not.toMatch(/map\.setZoom\(9\)/)
  })
})

describe('place first-look pin cap', () => {
  it('spread-samples a city-sized pile down to the fold cap', () => {
    const listings = Array.from({ length: 800 }, (_, i) => ({
      ListingKey: `k${i}`,
      ListPrice: 400000 + i,
      Latitude: 44 + i / 10000,
      Longitude: -121 - i / 10000,
    }))
    const capped = capLookListings(listings)
    expect(CITY_LOOK_PIN_CAP).toBe(36)
    expect(capped).toHaveLength(CITY_LOOK_PIN_CAP)
    expect(capped[0]?.ListingKey).toBe('k0')
    expect(capped.at(-1)?.ListingKey).not.toBe('k0')
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
