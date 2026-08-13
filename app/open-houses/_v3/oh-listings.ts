import type { UpcomingOpenHouseRow } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingDetailPath } from '@/lib/slug'

export type OpenHouseListing = {
  id: string
  listingKey: string
  listNumber: string | null
  eventDate: string
  startTime: string | null
  endTime: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  subdivisionName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  unparsedAddress: string | null
  photoUrl: string | null
  lat: number | null
  lng: number | null
  href: string
}

export type OpenHouseJoinFilters = {
  community?: string[]
  city?: string
  minPrice?: number
  maxPrice?: number
  beds?: number
  baths?: number
}

/**
 * Join OpenHouses jsonb rows to listing tiles. Same shape the retired
 * getOpenHousesWithListings action assembled: hero photo first, tile photo
 * fallback, then drop rows that fail the caller's filters.
 */
export function assembleOpenHouses(
  rows: readonly UpcomingOpenHouseRow[],
  tiles: readonly ListingTile[],
  heroes: ReadonlyMap<string, string>,
  filters: OpenHouseJoinFilters = {},
): OpenHouseListing[] {
  const byKey = new Map(tiles.map((tile) => [tile.listingKey, tile]))
  const out: OpenHouseListing[] = []

  for (const row of rows) {
    const tile = byKey.get(row.listing_key)
    const city = tile?.city ?? null
    const subdivision = tile?.subdivisionName ?? null
    if (filters.community?.length && subdivision && !filters.community.includes(subdivision)) {
      continue
    }
    if (filters.city && city !== filters.city) continue
    const listPrice = tile?.listPrice ?? null
    if (filters.minPrice != null && (listPrice == null || listPrice < filters.minPrice)) continue
    if (filters.maxPrice != null && (listPrice == null || listPrice > filters.maxPrice)) continue
    const beds = tile?.beds ?? null
    if (filters.beds != null && (beds == null || beds < filters.beds)) continue
    const baths = tile?.baths ?? null
    if (filters.baths != null && (baths == null || baths < filters.baths)) continue

    const streetNumber = tile?.streetNumber ?? null
    const streetName = tile?.streetName ?? null
    const address = [streetNumber, streetName].filter(Boolean).join(' ')
    const listingKey = row.listing_key
    const listNumber = tile?.listNumber ?? null

    out.push({
      id: row.id,
      listingKey,
      listNumber,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      listPrice,
      beds,
      baths,
      sqft: tile?.sqft ?? null,
      subdivisionName: subdivision,
      city,
      state: null,
      postalCode: tile?.postalCode ?? null,
      streetNumber,
      streetName,
      streetSuffix: tile?.streetSuffix ?? null,
      unparsedAddress: address || null,
      photoUrl: heroes.get(listingKey) ?? tile?.photoUrl ?? null,
      lat: tile?.lat ?? null,
      lng: tile?.lng ?? null,
      href: listingDetailPath(
        listingKey,
        {
          streetNumber,
          streetName,
          city,
          state: null,
          postalCode: tile?.postalCode ?? null,
        },
        { city, subdivision },
        { mlsNumber: listNumber },
      ),
    })
  }

  return out
}

export function medianPositive(values: readonly (number | null | undefined)[]): number | null {
  const nums = values.filter((n): n is number => n != null && Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (nums.length === 0) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
}
