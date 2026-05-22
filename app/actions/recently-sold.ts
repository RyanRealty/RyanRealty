'use server'

import { getCityListings, getCommunityListings, getListingTiles } from '@/lib/data'

export type RecentlySoldListing = {
  listingKey: string
  listNumber: string | null
  mlsSource?: string | null
  listPrice: number | null
  closePrice: number | null
  closeDate: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  photoUrl: string | null
}

export async function getRecentlySold(options: {
  city?: string | null
  subdivision?: string | null
  limit?: number
}): Promise<RecentlySoldListing[]> {
  const limit = Math.min(24, Math.max(1, options.limit ?? 9))
  const city = options.city?.trim() ?? ''
  const subdivision = options.subdivision?.trim() ?? ''

  // DAL: read closed tiles from listing_tile_mv via the canonical
  // getCommunityListings / getCityListings, sorted by close_date DESC.
  // The new 'close-newest' sort key was added to the DAL filter schema
  // so recently-sold paths can drain from the legacy direct-listings path.
  const filter = { status: 'closed' as const, sort: 'close-newest' as const, limit }
  const tiles =
    subdivision
      ? await getCommunityListings(subdivision, filter)
      : city
        ? await getCityListings(city, filter)
        : await getListingTiles(filter)

  return tiles
    .map((t) => ({
      listingKey: t.listingKey,
      listNumber: t.listNumber,
      mlsSource: null,
      listPrice: t.listPrice,
      closePrice: t.closePrice,
      closeDate: t.closeDate,
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
      streetNumber: t.streetNumber,
      streetName: t.streetName,
      city: t.city,
      state: null,
      postalCode: t.postalCode,
      photoUrl: t.photoUrl,
    }))
    .filter((row) => row.listingKey.length > 0)
}
