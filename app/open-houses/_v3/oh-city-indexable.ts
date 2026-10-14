/**
 * Is this city's /open-houses/{city} page indexable? ONE decision, two callers.
 *
 * Callers: /open-houses/[city] generateMetadata (robots) and app/sitemap.ts
 * (which URLs to submit). A sitemap lists only indexable canonical URLs, so the
 * two must never disagree. Until 2026-10-14 they did: the page noindexed a city
 * with no open house in the window while the sitemap listed
 * /open-houses/{city} for every site city and every city with an active listing
 * (deploy:verify 9fa63fa7a: "SITEMAP URL HEALTH FAILED (2 of 400)" on
 * /open-houses/brothers and /open-houses/black-butte-ranch, both
 * "meta robots noindex, follow on a sitemap URL").
 *
 * THE RULE (SITE-27): a city page is indexable when at least one open house
 * assembles for it in the CANONICAL window, which is today through six days out,
 * Pacific, no narrowing searchParams. The count is assembleOpenHouses with the
 * page's own city filter over the same two reads the page renders:
 * getUpcomingOpenHouses (rows) and getListingTiles (the tile that carries the
 * city the filter matches). Heroes only choose a photo; they never change the
 * count.
 *
 * THE BATCH. The sitemap cannot run the page's per-city read once per city (up
 * to 24 reads inside a time-boxed build), so loadIndexableOpenHouseCitySlugs
 * does ONE region-wide read of the same two sources and then asks the same
 * decision function once per city the tiles name. It makes the same calls with
 * the same arguments the /open-houses hub makes, so in production it usually
 * reads the hub's 15-minute data-cache entries instead of the database.
 *
 * FAILURE IS NOT INDEXABLE. getUpcomingOpenHouses and getListingTiles resolve to
 * [] on a failed read, and an empty read yields no city, so a failed or timed-out
 * read leaves every /open-houses/{city} URL out of the sitemap. A sitemap lists
 * only URLs known to be indexable.
 */

import { getListingTiles, getUpcomingOpenHouses, type UpcomingOpenHouseRow } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { cityEntityKey } from '@/lib/slug'
import { addIsoDays, pacificTodayIso } from './oh-constants'
import { assembleOpenHouses } from './oh-listings'

/** The canonical window reaches this many days past today (today + 6 = seven days). */
export const OH_WINDOW_DAYS_AHEAD = 6

export type OpenHouseWindow = {
  dateFromIso: string
  dateToIso: string
  todayIso: string
}

/** Today through six days out, Pacific. What the page's metadata and default body read. */
export function canonicalOpenHouseWindow(todayIso: string = pacificTodayIso()): OpenHouseWindow {
  return {
    dateFromIso: todayIso,
    dateToIso: addIsoDays(todayIso, OH_WINDOW_DAYS_AHEAD),
    todayIso,
  }
}

export type OpenHouseCityDecision = {
  /** Open houses that assemble for the city in the rows and tiles given. */
  count: number
  /** True when the city's page is index,follow and belongs in the sitemap. */
  indexable: boolean
}

const NO_HEROES: ReadonlyMap<string, string> = new Map()

/**
 * THE decision. The page's generateMetadata and the sitemap both call this with
 * rows and tiles read for the canonical window; nothing else decides robots for
 * /open-houses/{city}.
 */
export function openHouseCityDecision(
  rows: readonly UpcomingOpenHouseRow[],
  tiles: readonly ListingTile[],
  heroes: ReadonlyMap<string, string>,
  cityName: string,
): OpenHouseCityDecision {
  const count = assembleOpenHouses(rows, tiles, heroes, { city: cityName }).length
  return { count, indexable: count > 0 }
}

/**
 * The route slug of every city whose page is indexable today, from ONE batched
 * read. Rows are the region-wide window read (service-area scope, no city
 * argument, exactly the hub's call); tiles name each row's city; each distinct
 * city name goes through openHouseCityDecision.
 */
export async function loadIndexableOpenHouseCitySlugs(
  todayIso: string = pacificTodayIso(),
): Promise<ReadonlySet<string>> {
  const rows = await getUpcomingOpenHouses(canonicalOpenHouseWindow(todayIso))
  const listingKeys = [...new Set(rows.map((row) => row.listing_key))]
  if (listingKeys.length === 0) return new Set()

  // 500 is what the hub and city pages ask for, so a region that fits shares
  // their cache entry. A region with more keys asks for all of them: a tile cut
  // by the limit would drop its city and leave a live page out of the file.
  const tiles = await getListingTiles({
    listingKeys: listingKeys.slice(0, 5000),
    status: 'all',
    limit: Math.min(5000, Math.max(500, listingKeys.length)),
  })

  const slugs = new Set<string>()
  const decided = new Set<string>()
  for (const tile of tiles) {
    const cityName = tile.city
    if (!cityName || decided.has(cityName)) continue
    decided.add(cityName)
    if (openHouseCityDecision(rows, tiles, NO_HEROES, cityName).indexable) {
      slugs.add(cityEntityKey(cityName))
    }
  }
  return slugs
}
