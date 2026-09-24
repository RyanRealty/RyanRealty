/**
 * railCardFromListingRow turns a place inventory row into a home rail card
 * without dropping a listing that has no photo. It fed V3PlaceInventory's
 * `layout="rails"` card carousel, deleted 2026-09-24 when every place page
 * moved to the listing dial (SITE-193); the rails' own markup tests went with
 * it, and this conversion test stays while the helper does.
 */
import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { railCardFromListingRow } from '@/app/_v3/home-rail-items'

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

