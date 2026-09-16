/**
 * The reads behind the city index's door board figures (SITE-92 round 5).
 *
 * A door prints the count it OPENS ONTO, so each read here is the destination
 * page's own read, not a lookalike:
 *
 *  - the open-house door repeats /open-houses/[city]'s window read exactly —
 *    getCityFromSlug for the MLS city name, getUpcomingOpenHouses for today
 *    through six days out, the tile and hero joins, assembleOpenHouses with
 *    the city filter — and takes its `.length`, which is the count that page's
 *    title and body print;
 *  - the Bend luxury door asks the DAL's count for the filter
 *    /luxury-homes-bend redirects onto (/homes-for-sale/bend?minPrice=1500000).
 *
 * The page time-boxes both (withTimeoutFallback); a slow read costs the door
 * its figure, never the door. Nothing here formats — cities-door-figures.ts
 * turns a count into the board's strings.
 */
import { getCityFromSlug } from '@/app/actions/listings'
import { getHeroPhotosByListingKeys, getListingTiles, getListingTilesCount, getUpcomingOpenHouses } from '@/lib/data'
import { assembleOpenHouses } from '@/app/open-houses/_v3/oh-listings'
import { addIsoDays, pacificTodayIso } from '@/app/open-houses/_v3/oh-constants'
import { LUXURY_FLOOR_USD, OPEN_HOUSE_WINDOW_DAYS } from './cities-door-figures'

/**
 * The count /open-houses/<slug> prints for the canonical window, or null when
 * the slug names no city the MLS carries.
 */
export async function countOpenHousesThisWeek(slug: string): Promise<number | null> {
  const cityName = await getCityFromSlug(slug)
  if (!cityName) return null
  const todayIso = pacificTodayIso()
  const rows = await getUpcomingOpenHouses({
    dateFromIso: todayIso,
    dateToIso: addIsoDays(todayIso, OPEN_HOUSE_WINDOW_DAYS),
    todayIso,
    city: cityName,
  })
  const listingKeys = [...new Set(rows.map((r) => r.listing_key))]
  if (listingKeys.length === 0) return 0
  const [tiles, heroes] = await Promise.all([
    getListingTiles({ listingKeys: listingKeys.slice(0, 5000), status: 'all', limit: 500 }),
    getHeroPhotosByListingKeys(listingKeys),
  ])
  return assembleOpenHouses(rows, tiles, heroes, { city: cityName }).length
}

/**
 * One read per featured city, in parallel. A city whose read fails is absent
 * from the map — its door then prints no figure — rather than failing the
 * board; the page's budget bounds the whole set.
 */
export async function countOpenHousesByCity(slugs: readonly string[]): Promise<Map<string, number>> {
  const pairs = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const n = await countOpenHousesThisWeek(slug)
        return n == null ? null : ([slug, n] as const)
      } catch {
        return null
      }
    }),
  )
  return new Map(pairs.filter((p): p is readonly [string, number] => p != null))
}

/** Active listings of every type in Bend at or above the luxury floor — the count the luxury door opens onto. */
export function countBendLuxury(): Promise<number> {
  return getListingTilesCount({ city: 'Bend', minPrice: LUXURY_FLOOR_USD, status: 'active' })
}
