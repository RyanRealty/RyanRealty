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

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getVenueBySlug, CO_VENUES, type CoVenue } from '@/data/co-venues'
import { CO_EVENTS, type CoEvent } from '@/data/co-events'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
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

function rowToHome(row: RawRow): VenueHomeTile {
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

function medianListPrice(homes: VenueHomeTile[]): number | null {
  const prices = homes
    .map((h) => h.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  const raw = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  return Math.round(raw / 1000) * 1000
}

async function fetchVenueHomes(venue: CoVenue): Promise<VenueHomeTile[]> {
  if (typeof venue.lat !== 'number' || typeof venue.lng !== 'number') return []
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listings')
    .select(PROJECTION)
    .in('StandardStatus', ACTIVE_STATUSES)
    .eq('PropertyType', 'A')
    .gte('Latitude', venue.lat - LAT_PAD)
    .lte('Latitude', venue.lat + LAT_PAD)
    .gte('Longitude', venue.lng - LNG_PAD)
    .lte('Longitude', venue.lng + LNG_PAD)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(MAX_HOMES)

  if (error) {
    throw new Error(`[getVenueDetail] supabase error: ${error.message}`)
  }
  return (data ?? []).map((r) => rowToHome(r as unknown as RawRow))
}

async function fetchVenueDetail(slug: string): Promise<VenueDetail | null> {
  const venue = getVenueBySlug(slug)
  if (!venue) return null

  const homes = await fetchVenueHomes(venue)
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

  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: venue.geoSlug }).catch(() => null)
  const cityMarket: AreaMarket | null = pulse
    ? {
        city: venue.city,
        medianListPrice: pulse.medianListPrice,
        activeCount: pulse.activeCount,
        monthsOfSupply: pulse.monthsOfSupply,
        medianDaysToPending: pulse.medianDaysToPending,
      }
    : null

  return {
    venue,
    homes,
    stats: { count: homes.length, medianListPrice: medianListPrice(homes) },
    relatedVenues,
    eventsHere,
    cityMarket,
  }
}

export function getVenueDetail(slug: string): Promise<VenueDetail | null> {
  return unstable_cache(() => fetchVenueDetail(slug), ['venue-detail-v1', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'venues'],
  })()
}
