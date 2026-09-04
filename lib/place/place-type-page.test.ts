import { describe, expect, it } from 'vitest'
import type { AtlasDot } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import {
  atlasViewForType,
  placeTypeFaceStats,
  placeTypeHeadline,
  placeTypeListingRows,
  placeTypeMetadataCopy,
  placeTypeSchemas,
  resolvePlaceTypePage,
} from './place-type-page'

function tile(overrides: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'k1',
    listNumber: '220000001',
    status: 'Active',
    listPrice: 425000,
    closePrice: null,
    closeDate: null,
    beds: 2,
    baths: 2,
    sqft: 1100,
    streetNumber: '12',
    streetName: 'River',
    streetSuffix: 'Rd',
    city: 'Sunriver',
    citySlug: 'sunriver',
    postalCode: '97707',
    subdivisionName: 'Sunriver',
    subdivisionSlug: 'sunriver',
    lat: 43.87,
    lng: -121.44,
    photoUrl: 'https://cdn.example/condo.jpg',
    propertyType: 'A',
    propertySubType: 'Condominium',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 386,
    lotSizeAcres: null,
    yearBuilt: 1998,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 12,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...overrides,
  }
}

describe('resolvePlaceTypePage', () => {
  it('resolves preset slugs and rejects unknown types', () => {
    expect(resolvePlaceTypePage('condos')?.key).toBe('condo')
    expect(resolvePlaceTypePage('condos')?.h1Type).toBe('Condos')
    expect(resolvePlaceTypePage('single-family')?.listingFilter.propertySubType).toBe(
      'Single Family Residence',
    )
    expect(resolvePlaceTypePage('lots-and-land')?.listingFilter.propertyType).toBe('D')
    expect(resolvePlaceTypePage('not-a-type')).toBeNull()
  })
})

describe('placeTypeHeadline', () => {
  it('is Type in Place', () => {
    const spec = resolvePlaceTypePage('condos')!
    expect(placeTypeHeadline(spec, 'Sunriver')).toBe('Condos in Sunriver')
  })
})

describe('placeTypeFaceStats', () => {
  it('prints leftover count and median and omits a miss', () => {
    const spec = resolvePlaceTypePage('condos')!
    const stats = placeTypeFaceStats({ spec, count: 12, median: 312000, mos: null })
    expect(stats.find((s) => s.id === 'active')?.value).toBe('12')
    expect(stats.find((s) => s.id === 'active')?.label).toBe('condos for sale')
    expect(stats.find((s) => s.id === 'medianList')?.value).toContain('312,000')
    expect(stats.find((s) => s.id === 'monthsOfSupply')).toBeUndefined()
    expect(placeTypeFaceStats({ spec, count: null, median: null, mos: null })).toEqual([])
  })
})

describe('placeTypeListingRows', () => {
  it('keeps photographed priced streets and drops the rest', () => {
    const rows = placeTypeListingRows([
      tile(),
      tile({ listingKey: 'k2', photoUrl: null }),
      tile({ listingKey: 'k3', listPrice: null, photoUrl: 'https://cdn.example/x.jpg' }),
      tile({
        listingKey: 'k4',
        streetName: null,
        streetNumber: null,
        streetSuffix: null,
        photoUrl: 'https://cdn.example/y.jpg',
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.listingKey).toBe('k1')
    expect(rows[0]?.photoUrl).toBe('https://cdn.example/condo.jpg')
  })
})

describe('atlasViewForType', () => {
  const dots: AtlasDot[] = [
    { k: 'c1', lat: 44, lng: -121, p: 1, t: 'condo', s: 'active', age: 1 },
    { k: 'h1', lat: 44, lng: -121, p: 1, t: 'house', s: 'active', age: 1 },
  ]
  const atlas = {
    dots,
    types: [
      { key: 'house', label: 'House' },
      { key: 'condo', label: 'Condo' },
    ],
    events: [],
    source: 'trace',
    stamp: 'Sep 4, 2026',
    counts: { forSale: 2, pending: 0, sold: 0, cities: 1 },
    tiles: [],
    complete: true,
  }

  it('filters 1:1 types and keeps the parent dots when the type is mixed', () => {
    expect(atlasViewForType(atlas, 'condo').dots.map((d) => d.k)).toEqual(['c1'])
    expect(atlasViewForType(atlas, null).dots).toHaveLength(2)
  })
})

describe('placeTypeMetadataCopy', () => {
  it('names the type and omits a count when leftover missed', () => {
    const spec = resolvePlaceTypePage('condos')!
    expect(placeTypeMetadataCopy({ spec, placeName: 'Redmond', count: 12 }).title).toBe(
      'Condos in Redmond, Oregon',
    )
    expect(placeTypeMetadataCopy({ spec, placeName: 'Redmond', count: null }).description).not.toMatch(
      /^\d/,
    )
  })
})

describe('placeTypeSchemas', () => {
  it('is City then type, with ItemList only when listings exist', () => {
    const spec = resolvePlaceTypePage('condos')!
    const empty = placeTypeSchemas({
      spec,
      placeName: 'Redmond',
      placeHref: '/cities/redmond',
      pagePath: '/cities/redmond/types/condos',
      description: 'Condos for sale in Redmond, Oregon.',
      listings: [],
    })
    expect(empty.some((s) => s.type === 'itemList')).toBe(false)
    const withList = placeTypeSchemas({
      spec,
      placeName: 'Redmond',
      placeHref: '/cities/redmond',
      pagePath: '/cities/redmond/types/condos',
      description: 'Condos for sale in Redmond, Oregon.',
      listings: [{ addressLine: '12 River Rd', href: '/listing/k1' }],
    })
    const crumbs = withList.find((s) => s.type === 'breadcrumb')
    expect(crumbs && crumbs.type === 'breadcrumb' ? crumbs.items.map((i) => i.name) : []).toEqual([
      'Redmond',
      'Condos',
    ])
    expect(withList.some((s) => s.type === 'itemList')).toBe(true)
  })
})
