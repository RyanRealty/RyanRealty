import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ListingTile } from '@/lib/data/types/listing'
import {
  neighborhoodAboutItems,
  neighborhoodHeadline,
  neighborhoodSplitListings,
} from './neighborhood-sections'

const PAGE = resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx')

function tile(over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'key-1',
    listNumber: '22000001',
    status: 'Active',
    listPrice: 1_385_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 2100,
    streetNumber: '10',
    streetName: 'Promontory',
    streetSuffix: 'Dr',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97703',
    subdivisionName: 'Awbrey Butte',
    subdivisionSlug: 'awbrey-butte',
    lat: 44.08,
    lng: -121.34,
    photoUrl: 'https://cdn.example/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: null,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...over,
  }
}

describe('neighborhoodHeadline', () => {
  it('is the neighborhood name then homes for sale', () => {
    expect(neighborhoodHeadline('Awbrey Butte')).toBe('Awbrey Butte homes for sale')
  })
})

describe('neighborhoodSplitListings', () => {
  it('projects polygon inventory tiles onto Split rows', () => {
    const row = neighborhoodSplitListings([tile()])[0]
    expect(row?.ListingKey).toBe('key-1')
    expect(row?.ListPrice).toBe(1_385_000)
    expect(row?.PropertyType).toBe('A')
    expect(row?.PropertySubType).toBe('Single Family Residence')
    expect(row?.City).toBe('Bend')
  })
})

describe('neighborhoodAboutItems', () => {
  it('prints one paragraph and no City term', () => {
    const items = neighborhoodAboutItems({
      curatedProse: ['Elevation first. The butte is high.', 'A second paragraph stays off.'],
      description: 'Fallback.',
      cityName: 'Bend',
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({ kind: 'prose', body: 'Elevation first. The butte is high.' })
  })
})

describe('neighborhood page first screen', () => {
  const page = readFileSync(PAGE, 'utf8')
  const code = page.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

  it('opens on Split + polygon-inventory face, not a Stage/Field cage', () => {
    expect(page).toMatch(/from ['"]@\/components\/search\/PlaceSplitView['"]/)
    expect(page).toMatch(/from ['"]@\/components\/place\/PlaceFaceStrip['"]/)
    expect(page).toMatch(/from ['"]@\/lib\/market\/publish-place-face['"]/)
    expect(code).toMatch(/publishPlaceFace\(\{/)
    expect(code).toMatch(/grain:\s*['"]neighborhood['"]/)
    expect(code).toMatch(/getNeighborhoodPublicInventory\(boundaryNeighborhoodSlug\)/)
    expect(code).toMatch(/neighborhood=\{neighborhood\.name\}/)
    expect(code).toMatch(/city=\{cityName\}/)
    expect(code).toMatch(/boundaryGeojson=\{boundaryMapData\.polygon\}/)
    expect(code).toMatch(/cityStagePoster\(indexCities\[citySlug\]/)
    expect(code).toMatch(/cityLibraryHero\(citySlug\)/)
    expect(code).not.toMatch(/<V3Field\b/)
    expect(code).not.toMatch(/<V3Stage\b/)
    expect(code).toMatch(/neighborhoodHeadline\(\s*neighborhood\.name\s*\)/)
  })

  it('does not write ?shapes= and does not print leftover MOS on the face', () => {
    expect(code).not.toMatch(/params\.set\(\s*['"]shapes['"]/)
    expect(code).not.toMatch(/<PlaceFaceStrip[^>]*monthsOfSupply/)
    expect(code).toMatch(/leftoverHudKpis/)
    expect(code).toMatch(/buildMarketFaq/)
    expect(code).toMatch(/cityFallback/)
    expect(code).not.toMatch(/\bplat\b|\bnest\b|\bsibling\b|\bCDP\b|\bFeeders\b/)
  })
})
