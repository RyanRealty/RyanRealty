import { describe, expect, it } from 'vitest'
import {
  placeTypeCoverPhotos,
  placeTypeSearchHref,
  publishPlaceTypeCards,
} from './publish-place-type-cards'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'

const land: PublicSegmentRow = {
  segment: 'land',
  activeCount: 40,
  pendingCount: null,
  closedCount: null,
  medianList: 250000,
  monthsOfSupply: null,
  verdict: null,
  sampleN: 40,
  daysToContract: null,
  saleToOriginal: null,
  yoyMedian: null,
  priceCutShare: null,
}

const condo: PublicSegmentRow = {
  ...land,
  segment: 'condo',
  activeCount: 2,
  medianList: 312000,
}

describe('publishPlaceTypeCards', () => {
  it('leads with single-family then extra types, and opens the SEO search for that type', () => {
    const cards = publishPlaceTypeCards({
      browsePath: '/homes-for-sale/redmond',
      placeName: 'Redmond',
      sfrCount: 255,
      sfrMedian: 598900,
      sfrMos: 4.6,
      segments: [land, condo],
      covers: { sfr: 'https://cdn.example/sfr.jpg', condo: 'https://cdn.example/condo.jpg' },
    })
    expect(cards[0]?.key).toBe('sfr')
    expect(cards[0]?.active).toBe(false)
    // Place+type landing path (2026-09-01): a crawlable page, not a query search.
    expect(cards[0]?.href).toBe('/homes-for-sale/redmond/single-family')
    expect(cards[0]?.photoUrl).toBe('https://cdn.example/sfr.jpg')
    expect(cards.find((c) => c.key === 'land')?.href).toBe('/homes-for-sale/redmond/lots-and-land')
    expect(cards.find((c) => c.key === 'condo')?.href).toBe('/homes-for-sale/redmond/condos')
    expect(cards.find((c) => c.key === 'condo')?.photoUrl).toBe('https://cdn.example/condo.jpg')
  })
})

describe('placeTypeSearchHref', () => {
  it('uses the condos / townhomes / multi-family / lots presets', () => {
    expect(placeTypeSearchHref('/homes-for-sale/bend', 'condo', { propertySubTypes: 'Condominium' })).toBe(
      '/homes-for-sale/bend/condos',
    )
    expect(placeTypeSearchHref('/homes-for-sale/bend', 'townhome', { propertySubTypes: 'Townhouse' })).toBe(
      '/homes-for-sale/bend/townhomes',
    )
    expect(placeTypeSearchHref('/homes-for-sale/redmond', 'multifamily_2_4', { propertyType: 'multi-family' })).toBe(
      '/homes-for-sale/redmond/multi-family',
    )
    expect(placeTypeSearchHref('/homes-for-sale/redmond', 'land', { propertyType: 'Land' })).toBe(
      '/homes-for-sale/redmond/lots-and-land',
    )
  })

  it('every type key resolves a landing path; unknown keys keep a defined query', () => {
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'farm', { propertyType: 'farm' }),
    ).toBe('/homes-for-sale/redmond/farms')
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'manufactured_park', {
        propertySubTypes: 'In Park',
      }),
    ).toBe('/homes-for-sale/redmond/manufactured-in-park')
    // The query fallback survives for a key outside the preset map.
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'not-a-key', { propertyType: 'farm' }),
    ).toBe('/homes-for-sale/redmond?propertyType=farm')
  })
})

describe('placeTypeCoverPhotos', () => {
  it('picks the first Active listing photo per leftover type from tile fields', () => {
    const covers = placeTypeCoverPhotos([
      { photoUrl: 'https://cdn.example/sfr.jpg', propertySubType: 'Single Family Residence', propertyType: 'A' },
      { PhotoURL: 'https://cdn.example/condo.jpg', PropertySubType: 'Condominium', PropertyType: 'A' },
      { photoUrl: 'https://cdn.example/lot.jpg', propertyType: 'D' },
      { photoUrl: null, propertySubType: 'Condominium', propertyType: 'A' },
    ])
    expect(covers.sfr).toBe('https://cdn.example/sfr.jpg')
    expect(covers.condo).toBe('https://cdn.example/condo.jpg')
    expect(covers.land).toBe('https://cdn.example/lot.jpg')
  })
})
