/**
 * getCommercialLeaseListings — every publicly active commercial lease in the
 * Central Oregon service area, with the unit of its rent.
 *
 * THE SET. listing_tile_mv rows with MLS PropertyType 'G' ("Commercial Lease"
 * in the feed's own label), status Active or Active Under Contract (Coming Soon
 * is never public), MLS City inside the service-area allowlist
 * (lib/data/listings/service-area.ts). Counted 2026-09-23: 36 rows, Bend 13,
 * Redmond 12, Prineville 4, Madras 3, Sisters 3, Powell Butte 1; statewide the
 * feed carries 239 on-market 'G' rows, so the city allowlist is what keeps
 * Medford off a Central Oregon page. Capped at COMMERCIAL_LEASE_CAP, which is
 * above the statewide count, so the cap never trims a Central Oregon lease.
 *
 * THE UNIT. The rent's unit is not in the tile MV; getLeaseRateOptions reads it
 * from `listings.details` for exactly these keys. A lease the unit read misses
 * still lists, and its card reads "Lease rate not published".
 *
 * Tile fields come from getListingTiles (the one tile projection every card
 * reads), so the page's cards and a place page's lease section are the same
 * row.
 */
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { getLeaseRateOptions, type LeaseRateOptionsByKey } from '@/lib/data/listings/getLeaseRateOptions'
import type { ListingTile } from '@/lib/data/types/listing'

/** Above the whole feed's on-market lease count (239 on 2026-09-23). */
export const COMMERCIAL_LEASE_CAP = 500

export type CommercialLeaseListings = {
  /** The active Central Oregon leases, newest first. */
  tiles: ListingTile[]
  /** ListingKey → the feed's "Lease Rate Options" value, or null. */
  rateOptions: LeaseRateOptionsByKey
}

export async function getCommercialLeaseListings(): Promise<CommercialLeaseListings> {
  const tiles = await getListingTiles({
    propertyType: 'G',
    status: 'active',
    scope: 'service-area',
    sort: 'newest',
    limit: COMMERCIAL_LEASE_CAP,
  })
  if (tiles.length === 0) return { tiles, rateOptions: {} }
  const rateOptions = await getLeaseRateOptions(tiles.map((tile) => tile.listingKey))
  return { tiles, rateOptions }
}
