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

function haystack(tile: ListingTile): string[] {
  return [tile.subdivisionName, tile.boundarySubdivision, tile.neighborhoodName, tile.boundaryNeighborhood]
    .filter((s): s is string => !!s && s.trim().length > 0 && s !== 'N/A')
    .map((s) => s.trim().toLowerCase())
}

/** Keep tiles that sit in the named place. Do not pad with another city. */
export function listingSimilarInPlace(
  tiles: readonly ListingTile[],
  placeNames: readonly string[],
): ListingTile[] {
  const needles = placeNames
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n.length >= 4 && n !== 'bend' && n !== 'redmond' && n !== 'sisters')
  if (needles.length === 0) return [...tiles]
  return tiles.filter((tile) => {
    const hay = haystack(tile)
    return needles.some((n) => hay.some((h) => h === n || h.includes(n) || n.includes(h)))
  })
}

export function listingSimilarDedupe(tiles: readonly ListingTile[]): ListingTile[] {
  const seen = new Set<string>()
  const out: ListingTile[] = []
  for (const tile of tiles) {
    const street = listingMlsStreetLine(tile).trim().toLowerCase()
    const key = street.length > 0 ? `st:${street}` : tile.listingKey
    if (seen.has(key) || seen.has(tile.listingKey)) continue
    seen.add(key)
    seen.add(tile.listingKey)
    out.push(tile)
  }
  return out
}
