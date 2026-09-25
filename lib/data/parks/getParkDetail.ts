/**
 * getParkDetail — resolve a park registry entry + the REAL on-market homes near
 * it (from our own MLS listings) for the /parks/[slug] page.
 *
 * Nearby-homes resolution — a lat/lng bounding box around the park centroid,
 * read from listing_search_mv by fetchOnMarketHomesInBox
 * (lib/data/geo/nearby-on-market-homes.ts): public active statuses
 * (PUBLIC_ACTIVE_STATUSES), PropertyType 'A', lat/lng inside the box.
 *
 * The box is roughly 1.5 miles in each direction. LAT_PAD = 0.022 deg
 * (~1.5 mi N/S) and LNG_PAD = 0.028 deg (~1.4 mi E/W at 44° N, where a degree
 * of longitude is ~50 miles). Count and median list price cover EVERY matching
 * home; `homes` is the price-desc top MAX_HOMES the page slices its cards and
 * pins from. Until 2026-09-23 the stats were computed over that 60-home display
 * slice, so the Pilot Butte page printed 60 homes and a $692,450 median where
 * the box held 114 homes with a $597,000 median (audit DATA-3/8). The median
 * publishes on at least 10 priced homes (Market Truth median floor).
 *
 * No academic/park-fact data is invented here — the registry carries the
 * sourced blurb + amenities. This DAL only joins the park to live listings.
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesInBox, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import { getParkBySlug, CO_PARKS, type CoPark } from '@/data/co-parks'

/** Half-width of the bounding box in degrees. ~1.5 mi N/S, ~1.4 mi E/W at 44° N. */
const LAT_PAD = 0.022
const LNG_PAD = 0.028

/** Safety ceiling on rows scanned/returned. */
const MAX_HOMES = 60

/** A single nearby-home tile, slimmed for the park page. */
export type ParkHomeTile = {
  listingKey: string
  href: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Single-line street address (e.g. "2732 NW Ordway Ave"). */
  addressLine: string
  /** City line (e.g. "Bend, OR 97703"). */
  cityLine: string
  lat: number | null
  lng: number | null
  photoUrl: string | null
}

export type ParkStats = {
  /** Every public on-market PropertyType 'A' home near this park (not the display slice). */
  count: number
  /** percentile_cont median list price across ALL of them, rounded to $1k; null under 10 priced homes. */
  medianListPrice: number | null
}

export type ParkDetail = {
  park: CoPark
  homes: ParkHomeTile[]
  stats: ParkStats
  /** Other registry parks in the same city (excludes self). */
  nearbyParks: CoPark[]
}

/**
 * Every public on-market PropertyType 'A' home in the box, from listing_search_mv.
 * `stats` covers the full set; `homes` is its price-desc top slice (DATA-3/8).
 */
async function fetchParkHomes(park: CoPark): Promise<{ homes: ParkHomeTile[]; stats: NearbyHomeStats }> {
  const { homes, stats } = await fetchOnMarketHomesInBox({
    label: '[getParkDetail] park homes',
    lat: park.lat,
    lng: park.lng,
    latPad: LAT_PAD,
    lngPad: LNG_PAD,
    maxTiles: MAX_HOMES,
  })
  return { homes, stats }
}

async function fetchParkDetail(slug: string): Promise<ParkDetail | null> {
  const park = getParkBySlug(slug)
  if (!park) return null

  const { homes, stats } = await fetchParkHomes(park)

  const nearbyParks = CO_PARKS.filter((p) => p.slug !== park.slug && p.city === park.city)

  return {
    park,
    homes,
    stats,
    nearbyParks,
  }
}

/**
 * Cached entry point. Returns null when the slug is not in the registry so the
 * page can render notFound(). Cached on the listings window + tag so the homes
 * refresh alongside the rest of the site's listing data.
 */
export function getParkDetail(slug: string): Promise<ParkDetail | null> {
  return unstable_cache(
    () => fetchParkDetail(slug),
    ['park-detail-v2-full-set', slug],
    {
      revalidate: CACHE_WINDOWS.listingsByGeo,
      tags: [cacheTag.listings, 'parks'],
    },
  )()
}
