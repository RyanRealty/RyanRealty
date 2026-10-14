import { getUpcomingOpenHouses, type UpcomingOpenHouseRow } from '@/lib/data/open-houses/getUpcomingOpenHouses'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import type { ListingTile } from '@/lib/data/types/listing'
import { citySlugForScope } from '@/lib/central-oregon'
import { addIsoDays, pacificTodayIso } from './oh-constants'
import { assembleOpenHouses } from './oh-listings'

/**
 * The city slugs with at least one open house, counted the way
 * app/open-houses/[city]/page.tsx counts a city: the soonest open house per
 * listing, joined to its listing tile and attributed to the tile's city.
 */
export function citySlugsWithOpenHouses(
  rows: readonly UpcomingOpenHouseRow[],
  tiles: readonly ListingTile[],
): Set<string> {
  const slugs = new Set<string>()
  for (const listing of assembleOpenHouses(rows, tiles, new Map())) {
    if (listing.city) slugs.add(citySlugForScope(listing.city))
  }
  return slugs
}

/**
 * The /open-houses/<city> pages that render index,follow now, as city slugs.
 * A city page is noindex when its calendar is empty in the canonical window,
 * today through six days out, Pacific (SITE-27, the page's generateMetadata),
 * so the sitemap submits only these. One read for the whole service area, not
 * one per city.
 */
export async function openHouseCitySlugsWithEvents(todayIso: string = pacificTodayIso()): Promise<Set<string>> {
  const rows = await getUpcomingOpenHouses({ dateFromIso: todayIso, dateToIso: addIsoDays(todayIso, 6), todayIso })
  const listingKeys = [...new Set(rows.map((r) => r.listing_key))].slice(0, 5000)
  if (listingKeys.length === 0) return new Set()
  const tiles = await getListingTiles({ listingKeys, status: 'all', limit: listingKeys.length })
  return citySlugsWithOpenHouses(rows, tiles)
}
