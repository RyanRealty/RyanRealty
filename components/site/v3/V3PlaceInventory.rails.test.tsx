/**
 * Subdivision pages show one carousel per property type (Matt 2026-09-23:
 * "carousels of all available property types ... we haven't been doing
 * commercial and multi family").
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { railCardFromListingRow } from '@/app/_v3/home-rail-items'
import { V3PlaceInventory } from './V3PlaceInventory'

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 579_995,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Porter',
    streetSuffix: 'Ln',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Porter James',
    subdivisionSlug: 'porter-james',
    lat: 44.05,
    lng: -121.25,
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/800x600/true/a-o.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 2026,
    garageSpaces: 2,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-porter-ln',
    ...over,
  } as ListingTile
}

const TILES = [
  tile({ listingKey: 'sfr-1' }),
  tile({ listingKey: 'duplex-1', streetNumber: '14', propertyType: 'C', propertySubType: 'Duplex' }),
  tile({
    listingKey: 'office-1',
    streetNumber: '16',
    propertyType: 'F',
    propertySubType: null,
    beds: null,
    baths: null,
    photoUrl: null,
    status: 'Active Under Contract',
  }),
]

describe('railCardFromListingRow', () => {
  it('keeps a listing with no photo instead of dropping it', () => {
    const sections = placeStockSectionsFromTiles(TILES)
    const office = sections.find((s) => s.key === 'commercial')!.rows[0]!
    const card = railCardFromListingRow(office)
    expect(card.photoUrls).toEqual([])
    expect(card.statusLabel).toBe('Pending')
    expect(card.href).toBe(office.href)
    expect(card.addressLine).toBe(office.addressLine)
  })
})

describe('V3PlaceInventory layout="rails"', () => {
  const html = renderToStaticMarkup(
    <V3PlaceInventory
      id="homes"
      layout="rails"
      placeName="Porter James"
      sections={placeStockSectionsFromTiles(TILES)}
      source="regional MLS through Oregon Data Share"
    />,
  )

  it('renders one carousel per live type, commercial and multi-family included', () => {
    expect(html).toContain('id="homes"')
    expect(html).toContain('id="homes-sfr"')
    expect(html).toContain('id="homes-multifamily"')
    expect(html).toContain('id="homes-commercial"')
    expect(html).toContain('Commercial property')
    expect(html).toContain('Multifamily homes')
    expect(html).not.toContain('Other property')
  })

  it('puts every listing in the served HTML as a link, one card each', () => {
    const sections = placeStockSectionsFromTiles(TILES)
    for (const row of sections.flatMap((s) => s.rows)) {
      expect(html).toContain(`href="${row.href}"`)
    }
    expect(html.match(/home-rail__card/g)?.length).toBe(TILES.length)
  })

  it('says how many are for sale under each heading, and keeps the source line', () => {
    expect(html.match(/home-rail__count">1 for sale</g)?.length).toBe(3)
    expect(html).toContain('Oregon Data Share')
  })

  it('says "Price not published" for an unpriced listing, never a seller offer', () => {
    const unpriced = renderToStaticMarkup(
      <V3PlaceInventory
        layout="rails"
        placeName="Porter James"
        sections={placeStockSectionsFromTiles([tile({ listingKey: 'no-ask', listPrice: null })])}
        source="regional MLS through Oregon Data Share"
      />,
    )
    expect(unpriced).toContain('Price not published')
    expect(unpriced).not.toContain('Price on request')
  })

  it('does not print a see-all link when the carousel already holds every listing', () => {
    expect(html).not.toContain('See all')
  })

  it('leaves the ledger layout as the default for other place pages', () => {
    const rows = renderToStaticMarkup(
      <V3PlaceInventory
        placeName="Porter James"
        sections={placeStockSectionsFromTiles(TILES)}
        source="regional MLS through Oregon Data Share"
      />,
    )
    expect(rows).not.toContain('home-rail')
    expect(rows).toContain('v3-place-stock__rows')
  })
})
