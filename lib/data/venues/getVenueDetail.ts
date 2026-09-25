/**
 * getVenueDetail — resolve a venue registry entry + the REAL active
 * single-family homes near it (from our own MLS listings) for the
 * /central-oregon/venues/[slug] page.
 *
 * Same lat/lng bounding box the parks + events pages use (~1.5 mi around the
 * venue). The venue's facts come from the static registry (CLAUDE.md §0); this
 * DAL only joins the venue to live listings so every venue page carries the
 * live-data moat (docs/CONTENT_ENGINE_SPEC.md §3).
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesInBox, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import { getVenueBySlug, CO_VENUES, type CoVenue } from '@/data/co-venues'
import { CO_EVENTS, type CoEvent } from '@/data/co-events'
import { leftoverCityAreaMarket } from '@/lib/data/market-truth/leftover-area-market'
import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import type { AreaMarket } from '@/lib/area-market'

/** A silent, chrome-less MLS background loop that autoplays in a featured tile. */
export type TileVideo = { url: string; embedType: 'iframe' | 'video-tag' } | null

const LAT_PAD = 0.022
const LNG_PAD = 0.028
const MAX_HOMES = 60

export type VenueHomeTile = {
  listingKey: string
  href: string
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressLine: string
  cityLine: string
  lat: number | null
  lng: number | null
  photoUrl: string | null
  /** MLS background video that autoplays in the featured tile on scroll-into-view. */
  video: TileVideo
  /** Has media that can't autoplay chrome-less (Matterport/Aryeo) → "Tour" badge. */
  hasTour: boolean
}

export type VenueStats = {
  count: number
  medianListPrice: number | null
}

export type VenueDetail = {
  venue: CoVenue
  homes: VenueHomeTile[]
  stats: VenueStats
  /** Other registry venues in the same city (excludes self). */
  relatedVenues: CoVenue[]
  /** Our own event pages that take place at this venue — confirmed-dated first. */
  eventsHere: CoEvent[]
  /** Live city market snapshot (the real-estate moat). Null when unavailable. */
  cityMarket: AreaMarket | null
}

/**
 * Attach each home's MLS background video to the top tiles and sort video-first,
 * so the featured grid autoplays on scroll-into-view exactly like every other
 * listing grid on the site (parity with lib/kb/resolve-featured-items).
 */
async function attachTileVideos(homes: VenueHomeTile[]): Promise<void> {
  const candidates = homes.filter((h) => h.photoUrl && h.listingKey).slice(0, 12)
  await Promise.all(
    candidates.map((h) =>
      getListingVideos(h.listingKey)
        .then((vids) => {
          for (const v of vids) {
            const bg = toTileBackgroundVideo(v)
            if (bg) {
              h.video = bg
              return
            }
          }
          h.hasTour = vids.length > 0
        })
        .catch(() => {}),
    ),
  )
  homes.sort((a, b) => (a.video ? 0 : a.hasTour ? 1 : 2) - (b.video ? 0 : b.hasTour ? 1 : 2))
}

/**
 * Every public on-market PropertyType 'A' home in the box, from listing_search_mv.
 * `stats` covers the full set; `homes` is its price-desc top slice (DATA-3/8).
 */
async function fetchVenueHomes(venue: CoVenue): Promise<{ homes: VenueHomeTile[]; stats: NearbyHomeStats }> {
  if (typeof venue.lat !== 'number' || typeof venue.lng !== 'number') {
    return { homes: [], stats: { count: 0, medianListPrice: null } }
  }
  const { homes, stats } = await fetchOnMarketHomesInBox({
    label: '[getVenueDetail] venue homes',
    lat: venue.lat,
    lng: venue.lng,
    latPad: LAT_PAD,
    lngPad: LNG_PAD,
    maxTiles: MAX_HOMES,
  })
  return {
    homes: homes.map((h) => ({ ...h, video: null, hasTour: false })),
    stats,
  }
}

async function fetchVenueDetail(slug: string): Promise<VenueDetail | null> {
  const venue = getVenueBySlug(slug)
  if (!venue) return null

  const { homes, stats } = await fetchVenueHomes(venue)
  await attachTileVideos(homes)
  const relatedVenues = CO_VENUES.filter((v) => v.slug !== venue.slug && v.city === venue.city)

  // Our own event pages held at this venue (match on the venue name appearing in
  // the event's venue string). Confirmed-dated events first (by date), then
  // recurrence-only anchors by name — so the venue page links our pages, not the
  // venue's external calendar.
  const needle = venue.name.toLowerCase()
  const eventsHere = CO_EVENTS.filter((e) => e.venue.toLowerCase().includes(needle)).sort(
    (a, b) =>
      (a.nextConfirmedDate ?? '9999').localeCompare(b.nextConfirmedDate ?? '9999') ||
      a.name.localeCompare(b.name),
  )

  const cityMarket: AreaMarket | null = await leftoverCityAreaMarket({
    cityName: venue.city,
    geoSlug: venue.geoSlug,
  }).catch(() => null)

  return {
    venue,
    homes,
    stats,
    relatedVenues,
    eventsHere,
    cityMarket,
  }
}

export function getVenueDetail(slug: string): Promise<VenueDetail | null> {
  return unstable_cache(() => fetchVenueDetail(slug), ['venue-detail-v3-full-set', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'venues'],
  })()
}
