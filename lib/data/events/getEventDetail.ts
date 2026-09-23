/**
 * getEventDetail — resolve an event registry entry + the REAL active
 * single-family homes near its venue (from our own MLS listings) for the
 * /central-oregon/events/[slug] page.
 *
 * Nearby-homes resolution is the same lat/lng bounding box the parks pages use
 * (~1.5 mi around the venue centroid). The event's facts (dates, blurb) come
 * from the static registry (CLAUDE.md §0 — verified + cited); this DAL only
 * joins the venue to live listings so every event page carries the live-data
 * moat (docs/CONTENT_ENGINE_SPEC.md §3). Events without a venue coordinate
 * simply return no homes and the page degrades gracefully.
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from 'next/cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesInBox, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import { getEventBySlug, CO_EVENTS, type CoEvent } from '@/data/co-events'
import { leftoverCityAreaMarket } from '@/lib/data/market-truth/leftover-area-market'
import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import type { AreaMarket } from '@/lib/area-market'

/** A silent, chrome-less MLS background loop that autoplays in a featured tile. */
export type TileVideo = { url: string; embedType: 'iframe' | 'video-tag' } | null

/** Half-width of the bounding box in degrees. ~1.5 mi N/S, ~1.4 mi E/W at 44° N. */
const LAT_PAD = 0.022
const LNG_PAD = 0.028

/** Safety ceiling on rows scanned/returned. */
const MAX_HOMES = 60

/** A single nearby-home tile, slimmed for the event page. */
export type EventHomeTile = {
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

export type EventStats = {
  /** Every public on-market PropertyType 'A' home near the venue (not the display slice). */
  count: number
  /** percentile_cont median list price across ALL of them, rounded to $1k; null under 10 priced homes. */
  medianListPrice: number | null
}

export type EventDetail = {
  event: CoEvent
  homes: EventHomeTile[]
  stats: EventStats
  /** Other registry events in the same city (excludes self). */
  relatedEvents: CoEvent[]
  /** Live city market snapshot (the real-estate moat). Null when unavailable. */
  cityMarket: AreaMarket | null
}

/**
 * Attach each home's MLS background video to the top tiles and sort video-first,
 * so the featured grid autoplays on scroll-into-view exactly like every other
 * listing grid on the site (parity with lib/kb/resolve-featured-items). Only the
 * first 12 tiles with a photo are probed (one video lookup each), failure-safe.
 */
async function attachTileVideos(homes: EventHomeTile[]): Promise<void> {
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
async function fetchEventHomes(event: CoEvent): Promise<{ homes: EventHomeTile[]; stats: NearbyHomeStats }> {
  if (typeof event.lat !== 'number' || typeof event.lng !== 'number') {
    return { homes: [], stats: { count: 0, medianListPrice: null } }
  }
  const { homes, stats } = await fetchOnMarketHomesInBox({
    label: '[getEventDetail] event homes',
    lat: event.lat,
    lng: event.lng,
    latPad: LAT_PAD,
    lngPad: LNG_PAD,
    maxTiles: MAX_HOMES,
  })
  return {
    homes: homes.map((h) => ({ ...h, video: null, hasTour: false })),
    stats,
  }
}

async function fetchEventDetail(slug: string): Promise<EventDetail | null> {
  const event = getEventBySlug(slug)
  if (!event) return null

  const { homes, stats } = await fetchEventHomes(event)
  await attachTileVideos(homes)
  const relatedEvents = CO_EVENTS.filter((e) => e.slug !== event.slug && e.city === event.city)

  // Leftover city market band. Miss omits. Pulse does not fill.
  const cityMarket: AreaMarket | null = await leftoverCityAreaMarket({
    cityName: event.city,
    geoSlug: event.geoSlug,
  }).catch(() => null)

  return {
    event,
    homes,
    stats,
    relatedEvents,
    cityMarket,
  }
}

/**
 * Cached entry point. Returns null when the slug is not in the registry so the
 * page can render notFound(). Cached on the listings window + tag so the homes
 * refresh alongside the rest of the site's listing data.
 */
export function getEventDetail(slug: string): Promise<EventDetail | null> {
  return unstable_cache(() => fetchEventDetail(slug), ['event-detail-v3-full-set', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'events'],
  })()
}
