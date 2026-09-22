/**
 * Live city inventory for the market-report-detail fold.
 * Price, address, beds/baths/sqft — never a photo-only card.
 */

import type { ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingTileHref } from '@/lib/slug'

/** Same cap as getCityListings on this route — show every fetched priced row. */
export const CITY_HOMES_CAP = 8

export function cityHomesRows(tiles: readonly ListingTile[]): V3ListingRowData[] {
  const rows: V3ListingRowData[] = []
  for (const tile of tiles) {
    const address =
      publishStreetLine({
        streetNumber: tile.streetNumber,
        streetDirPrefix: tile.streetDirPrefix,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        streetDirSuffix: tile.streetDirSuffix,
      }) ?? null
    if (!address) continue
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue
    const cityLine = [tile.city ? `${tile.city}, OR` : null, tile.postalCode]
      .filter(Boolean)
      .join(' ')
    rows.push({
      listingKey: tile.listingKey,
      href: listingTileHref(tile),
      photoUrl: tile.photoUrl,
      price: tile.listPrice,
      addressLine: address,
      cityLine: cityLine || 'Oregon',
      beds: tile.beds,
      baths: tile.baths,
      sqft: tile.sqft,
      pricePerSqft: tile.pricePerSqft,
      propertyType: tile.propertyType,
      propertySubType: tile.propertySubType,
      subdivisionName: tile.subdivisionName,
      city: tile.city,
      listNumber: tile.listNumber,
      tourUrl: tile.tourUrl,
      hasTour: tile.hasVirtualTour ?? Boolean(tile.tourUrl),
    })
    if (rows.length >= CITY_HOMES_CAP) break
  }
  return rows
}
