import { describe, expect, it } from 'vitest'
import {
  PLACE_TYPE_PAGE_SLUGS,
  PLACE_TYPE_SEARCH_PRESET,
  placeTypeCoverPhotos,
  placeTypeKeyFromPageSlug,
  placeTypeLandingPath,
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
    expect(cards[0]?.href).toBe('/cities/redmond/types/single-family')
    expect(cards[0]?.photoUrl).toBe('https://cdn.example/sfr.jpg')
    expect(cards.find((c) => c.key === 'land')?.href).toBe('/cities/redmond/types/lots-and-land')
    expect(cards.find((c) => c.key === 'condo')?.href).toBe('/cities/redmond/types/condos')
    expect(cards.find((c) => c.key === 'condo')?.photoUrl).toBe('https://cdn.example/condo.jpg')
  })

  it('opens the community type page when browsePath is the community node', () => {
    const cards = publishPlaceTypeCards({
      browsePath: '/communities/sunriver',
      placeName: 'Sunriver',
      sfrCount: 40,
      sfrMedian: 800000,
      sfrMos: null,
      segments: [condo],
    })
    expect(cards[0]?.href).toBe('/communities/sunriver/types/single-family')
    expect(cards.find((c) => c.key === 'condo')?.href).toBe('/communities/sunriver/types/condos')
  })
})

describe('placeTypeSearchHref', () => {
  it('uses the condos / townhomes / multi-family / lots city type pages', () => {
    expect(placeTypeSearchHref('/homes-for-sale/bend', 'condo', { propertySubTypes: 'Condominium' })).toBe(
      '/cities/bend/types/condos',
    )
    expect(placeTypeSearchHref('/homes-for-sale/bend', 'townhome', { propertySubTypes: 'Townhouse' })).toBe(
      '/cities/bend/types/townhomes',
    )
    expect(placeTypeSearchHref('/homes-for-sale/redmond', 'multifamily_2_4', { propertyType: 'multi-family' })).toBe(
      '/cities/redmond/types/multi-family',
    )
    expect(placeTypeSearchHref('/homes-for-sale/redmond', 'land', { propertyType: 'Land' })).toBe(
      '/cities/redmond/types/lots-and-land',
    )
    expect(placeTypeSearchHref('/cities/bend', 'condo', { propertySubTypes: 'Condominium' })).toBe(
      '/cities/bend/types/condos',
    )
  })

  it('every type key resolves a landing path; unknown keys keep a defined query', () => {
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'farm', { propertyType: 'farm' }),
    ).toBe('/cities/redmond/types/farms')
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'manufactured_park', {
        propertySubTypes: 'In Park',
      }),
    ).toBe('/cities/redmond/types/manufactured-in-park')
    expect(
      placeTypeSearchHref('/homes-for-sale/redmond', 'not-a-key', { propertyType: 'farm' }),
    ).toBe('/homes-for-sale/redmond?propertyType=farm')
  })

  it('keeps a neighborhood search preset until that grain has a type page', () => {
    expect(
      placeTypeSearchHref('/homes-for-sale/bend/awbrey-butte', 'condo', { propertySubTypes: 'Condominium' }),
    ).toBe('/homes-for-sale/bend/awbrey-butte/condos')
  })
})

describe('placeTypeLandingPath', () => {
  it('rewrites city search and place nodes under /types/', () => {
    expect(placeTypeLandingPath('/homes-for-sale/redmond', 'condos')).toBe('/cities/redmond/types/condos')
    expect(placeTypeLandingPath('/cities/redmond', 'condos')).toBe('/cities/redmond/types/condos')
    expect(placeTypeLandingPath('/communities/tetherow', 'single-family')).toBe(
      '/communities/tetherow/types/single-family',
    )
    expect(placeTypeLandingPath('/homes-for-sale/bend/tetherow', 'condos')).toBeNull()
  })
})

describe('placeTypeKeyFromPageSlug', () => {
  it('maps preset slugs and rejects unknown types', () => {
    expect(placeTypeKeyFromPageSlug('condos')).toBe('condo')
    expect(placeTypeKeyFromPageSlug('single-family')).toBe('sfr')
    expect(placeTypeKeyFromPageSlug('lots-and-land')).toBe('land')
    expect(placeTypeKeyFromPageSlug('not-a-type')).toBeNull()
  })

  it('keeps the page slug list in lockstep with the preset map', () => {
    expect([...PLACE_TYPE_PAGE_SLUGS].sort()).toEqual(Object.values(PLACE_TYPE_SEARCH_PRESET).sort())
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
