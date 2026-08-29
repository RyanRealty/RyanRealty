/**
 * Split listings + camera for the plat node.
 *
 * Inventory SoR is getPlatPublicInventory. MapSearchView speaks ListingTileRow,
 * so one mapper owns the projection. Camera is a recorded ring or a pin bbox.
 * Do not convex-hull pins into a fake plat polygon.
 */

import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import type { ListingTile } from '@/lib/data'
import { publishPlaceSplitSeed } from '@/lib/search/publish-place-split-seed'

/** ~0.5 mile so a single pin still has a viewport. Not a membership ring. */
const PIN_PAD_DEG = 0.008

export function toSplitListing(tile: ListingTile): ListingTileRow {
  return {
    ListingKey: tile.listingKey,
    ListNumber: tile.listNumber,
    ListPrice: tile.listPrice,
    BedroomsTotal: tile.beds,
    BathroomsTotal: tile.baths,
    StreetNumber: tile.streetNumber,
    StreetName: tile.streetName,
    StreetSuffix: tile.streetSuffix ?? null,
    City: tile.city,
    State: null,
    PostalCode: tile.postalCode,
    SubdivisionName: tile.subdivisionName,
    TotalLivingAreaSqFt: tile.sqft,
    PhotoURL: tile.photoUrl,
    Latitude: tile.lat,
    Longitude: tile.lng,
    ModificationTimestamp: tile.modifiedAt,
    PropertyType: tile.propertyType,
    PropertySubType: tile.propertySubType,
    StandardStatus: tile.status,
    OnMarketDate: tile.onMarketDate,
    ClosePrice: tile.closePrice,
    CloseDate: tile.closeDate,
  }
}

export function boundsFromListingPins(
  tiles: ReadonlyArray<{ lat?: number | null; lng?: number | null }>,
): MapBounds | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let n = 0
  for (const tile of tiles) {
    const lat = tile.lat
    const lng = tile.lng
    if (lat == null || lng == null) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    n += 1
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  if (n === 0) return null
  const padLng = Math.max((east - west) * 0.15, PIN_PAD_DEG)
  const padLat = Math.max((north - south) * 0.15, PIN_PAD_DEG)
  return {
    west: west - padLng,
    south: south - padLat,
    east: east + padLng,
    north: north + padLat,
  }
}

/** True only when the stored geometry can seed a Split ring. Miss is not a hull. */
export function hasRealPlatPolygon(
  geom: { type?: string; coordinates?: unknown } | null | undefined,
): boolean {
  return publishPlaceSplitSeed(geom) != null
}
