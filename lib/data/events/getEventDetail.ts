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
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getEventBySlug, CO_EVENTS, type CoEvent } from '@/data/co-events'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
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
  /** Active SFR homes near the venue, from our listings. */
  count: number
  /** Median list price across those homes (rounded to nearest $1k), or null. */
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

type RawRow = {
  ListingKey: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  PostalCode: string | null
  Latitude: number | null
  Longitude: number | null
  PhotoURL: string | null
}

const PROJECTION = [
  'ListingKey, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt',
  'StreetNumber, StreetName, City, PostalCode, Latitude, Longitude, PhotoURL',
].join(', ')

const ACTIVE_STATUSES = ['Active', 'Coming Soon', 'Active Under Contract']

function rowToHome(row: RawRow): EventHomeTile {
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  const cityLine = [[row.City, 'OR'].filter(Boolean).join(', '), row.PostalCode]
    .filter(Boolean)
    .join(' ')
    .trim()
  return {
    listingKey: row.ListingKey ?? '',
    href: `/listing/${row.ListingKey ?? ''}`,
    price: row.ListPrice,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt,
    addressLine: street || 'Address available on request',
    cityLine: cityLine || 'Central Oregon',
    lat: row.Latitude,
    lng: row.Longitude,
    photoUrl: row.PhotoURL,
    video: null,
    hasTour: false,
  }
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

/** Median list price over the homes, rounded to the nearest $1k. Null when empty. */
function medianListPrice(homes: EventHomeTile[]): number | null {
  const prices = homes
    .map((h) => h.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  const raw = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  return Math.round(raw / 1000) * 1000
}

async function fetchEventHomes(event: CoEvent): Promise<EventHomeTile[]> {
  if (typeof event.lat !== 'number' || typeof event.lng !== 'number') return []
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listings')
    .select(PROJECTION)
    .in('StandardStatus', ACTIVE_STATUSES)
    .eq('PropertyType', 'A')
    .gte('Latitude', event.lat - LAT_PAD)
    .lte('Latitude', event.lat + LAT_PAD)
    .gte('Longitude', event.lng - LNG_PAD)
    .lte('Longitude', event.lng + LNG_PAD)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(MAX_HOMES)

  if (error) {
    // THROW (do not return []) so a transient error is never cached as
    // "0 homes near this venue" for the full TTL. The next request retries.
    throw new Error(`[getEventDetail] supabase error: ${error.message}`)
  }

  return (data ?? []).map((r) => rowToHome(r as unknown as RawRow))
}

async function fetchEventDetail(slug: string): Promise<EventDetail | null> {
  const event = getEventBySlug(slug)
  if (!event) return null

  const homes = await fetchEventHomes(event)
  await attachTileVideos(homes)
  const relatedEvents = CO_EVENTS.filter((e) => e.slug !== event.slug && e.city === event.city)

  // Live city market snapshot (the moat). Resilient: a miss/timeout degrades to
  // null and the page simply omits the band — it never fails the event page.
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: event.geoSlug }).catch(() => null)
  const cityMarket: AreaMarket | null = pulse
    ? {
        city: event.city,
        medianListPrice: pulse.medianListPrice,
        activeCount: pulse.activeCount,
        monthsOfSupply: pulse.monthsOfSupply,
        medianDaysToPending: pulse.medianDaysToPending,
      }
    : null

  return {
    event,
    homes,
    stats: { count: homes.length, medianListPrice: medianListPrice(homes) },
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
  return unstable_cache(() => fetchEventDetail(slug), ['event-detail-v1', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'events'],
  })()
}
