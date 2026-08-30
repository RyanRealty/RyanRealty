import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ListingTile } from '@/lib/data'
import {
  boundsFromListingPins,
  hasRealPlatPolygon,
  toSplitListing,
} from './subdivision-split'

const PAGE = resolve('app/subdivisions/[slug]/page.tsx')

const square = {
  type: 'Polygon',
  coordinates: [[
    [-121.4, 44.0],
    [-121.3, 44.0],
    [-121.3, 44.1],
    [-121.4, 44.1],
    [-121.4, 44.0],
  ]],
}

function tile(over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'key-1',
    listNumber: '22000001',
    status: 'Active',
    listPrice: 909_950,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Ridge',
    streetSuffix: 'Ln',
    city: 'Redmond',
    citySlug: 'redmond',
    postalCode: '97756',
    subdivisionName: 'Ridge At Eagle Crest',
    subdivisionSlug: 'ridge-at-eagle-crest',
    lat: 44.26,
    lng: -121.26,
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

describe('toSplitListing', () => {
  it('projects the plat inventory tile onto the Split row, including type', () => {
    const row = toSplitListing(tile())
    expect(row.ListingKey).toBe('key-1')
    expect(row.ListPrice).toBe(909_950)
    expect(row.Latitude).toBe(44.26)
    expect(row.Longitude).toBe(-121.26)
    expect(row.PropertyType).toBe('A')
    expect(row.PropertySubType).toBe('Single Family Residence')
    expect(row.PhotoURL).toBe('https://cdn.example/a.jpg')
  })
})

describe('boundsFromListingPins', () => {
  it('returns a padded bbox from pins, not a membership ring', () => {
    const bounds = boundsFromListingPins([
      { lat: 44.26, lng: -121.26 },
      { lat: 44.27, lng: -121.25 },
    ])
    expect(bounds).not.toBeNull()
    expect(bounds!.west).toBeLessThan(-121.26)
    expect(bounds!.east).toBeGreaterThan(-121.25)
    expect(bounds!.south).toBeLessThan(44.26)
    expect(bounds!.north).toBeGreaterThan(44.27)
  })

  it('returns null when no pin has coordinates — does not invent a hull', () => {
    expect(boundsFromListingPins([])).toBeNull()
    expect(boundsFromListingPins([{ lat: null, lng: null }])).toBeNull()
  })
})

describe('hasRealPlatPolygon', () => {
  it('accepts a usable polygon and refuses empty or point geometry', () => {
    expect(hasRealPlatPolygon(square)).toBe(true)
    expect(hasRealPlatPolygon(null)).toBe(false)
    expect(hasRealPlatPolygon({ type: 'Point', coordinates: [-121, 44] })).toBe(false)
  })
})

describe('subdivision page first screen', () => {
  const page = readFileSync(PAGE, 'utf8')
  const code = page.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

  it('opens on Split + plat inventory face, not a Stage/Field cage', () => {
    expect(page).toMatch(/from ['"]@\/components\/search\/PlaceSplitView['"]/)
    expect(page).toMatch(/from ['"]@\/components\/place\/PlaceFaceStrip['"]/)
    expect(page).toMatch(/from ['"]@\/lib\/market\/publish-place-face['"]/)
    expect(code).toMatch(/publishPlaceFace\(\{/)
    expect(code).toMatch(/grain:\s*['"]subdivision['"]/)
    expect(code).toMatch(/hud:\s*null/)
    expect(code).not.toMatch(/<V3Field\b/)
    expect(code).not.toMatch(/<V3Stage\b/)
    expect(code).toMatch(/const headline = `\$\{displayName\} homes for sale`/)
    expect(code).not.toMatch(/heading=\{v3Text\(`Homes for sale in \$\{displayName\}`\)\}/)
  })

  it('faces inventory count + median through publishPlatFigures, never a leftover parent', () => {
    expect(code).toMatch(/publishPlatFigures\(/)
    expect(code).toMatch(/platFigures\.medianListPrice/)
    expect(code).toMatch(/platFigures\.medianDaysToPending/)
    expect(code).toMatch(/platFigures\.soldCount30d/)
    expect(code).toMatch(/inventory\?\.activeCount/)
    expect(code).not.toMatch(/\bactive:\s*15\b/)
    expect(code).not.toMatch(/leftoverHudKpis\(/)
    expect(code).not.toMatch(/cityPulse/)
    expect(code).not.toMatch(/communityPulse/)
    expect(code).not.toMatch(/fetchSubdivMarketExtras/)
    expect(code).toMatch(/seedRing=\{seedRing\}/)
    expect(code).toMatch(/hasRealPlatPolygon\(/)
  })
})
