/**
 * Similar homes on a listing page: the same relatedHomes ranking, mapped onto
 * V3ListingRow, capped as a rail. Not a poster grid.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import type { V3ListingRowData } from '@/components/site/v3'
import { listingTileHref } from '@/lib/slug'
import { listingMlsStreetLine, publishCardAddress } from '@/lib/listing/publish-street-line'

export const SIMILAR_RAIL_CAP = 6

export function listingTileToRow(tile: ListingTile): V3ListingRowData {
  const street = listingMlsStreetLine(tile)
  const cityLine = [tile.city, tile.subdivisionName && tile.subdivisionName !== 'N/A' ? tile.subdivisionName : null]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(' · ')
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl,
    price: tile.listPrice,
    addressLine: street || publishCardAddress(tile) || 'Address available on request',
    cityLine: cityLine || 'Central Oregon',
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
    hasTour: tile.hasVirtualTour === true || !!tile.tourUrl,
  }
}

export function listingSimilarRail(tiles: readonly ListingTile[], cap = SIMILAR_RAIL_CAP): V3ListingRowData[] {
  return tiles.slice(0, cap).map(listingTileToRow)
}
