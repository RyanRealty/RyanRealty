/**
 * getTrailDetail — resolve a trail registry entry + the REAL active single-family
 * homes near the trailhead (from our own MLS listings) + the live city market
 * band, for the /central-oregon/trails/[slug] page. Mirrors getGolfDetail (same
 * ~1.5-mile bounding box, video-attached tiles, market snapshot). Trail facts
 * come from the static registry (CLAUDE.md §0).
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getTrailBySlug, CO_TRAILS, type CoTrail } from '@/data/co-trails'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getListingVideos } from '@/lib/data/videos/getListingVideos'
import { toTileBackgroundVideo } from '@/lib/video-embed'
import type { AreaMarket } from '@/lib/area-market'

const LAT_PAD = 0.022
const LNG_PAD = 0.028
const MAX_HOMES = 60

export type TileVideo = { url: string; embedType: 'iframe' | 'video-tag' } | null

export type TrailHomeTile = {
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
  video: TileVideo
  hasTour: boolean
}

export type TrailStats = { count: number; medianListPrice: number | null }

export type TrailDetail = {
  trail: CoTrail
  homes: TrailHomeTile[]
  stats: TrailStats
  relatedTrails: CoTrail[]
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

function rowToHome(row: RawRow): TrailHomeTile {
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

function medianListPrice(homes: TrailHomeTile[]): number | null {
  const prices = homes
    .map((h) => h.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  const raw = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  return Math.round(raw / 1000) * 1000
}

async function attachTileVideos(homes: TrailHomeTile[]): Promise<void> {
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

async function fetchTrailHomes(trail: CoTrail): Promise<TrailHomeTile[]> {
  if (typeof trail.lat !== 'number' || typeof trail.lng !== 'number') return []
  const supabase = supabaseAnon()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('listings')
    .select(PROJECTION)
    .in('StandardStatus', ACTIVE_STATUSES)
    .eq('PropertyType', 'A')
    .gte('Latitude', trail.lat - LAT_PAD)
    .lte('Latitude', trail.lat + LAT_PAD)
    .gte('Longitude', trail.lng - LNG_PAD)
    .lte('Longitude', trail.lng + LNG_PAD)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(MAX_HOMES)
  if (error) throw new Error(`[getTrailDetail] supabase error: ${error.message}`)
  return (data ?? []).map((r) => rowToHome(r as unknown as RawRow))
}

async function fetchTrailDetail(slug: string): Promise<TrailDetail | null> {
  const trail = getTrailBySlug(slug)
  if (!trail) return null

  const homes = await fetchTrailHomes(trail)
  await attachTileVideos(homes)
  const relatedTrails = CO_TRAILS.filter((t) => t.slug !== trail.slug && t.city === trail.city)

  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: trail.geoSlug }).catch(() => null)
  const cityMarket: AreaMarket | null = pulse
    ? {
        city: trail.city,
        medianListPrice: pulse.medianListPrice,
        activeCount: pulse.activeCount,
        monthsOfSupply: pulse.monthsOfSupply,
        medianDaysToPending: pulse.medianDaysToPending,
      }
    : null

  return {
    trail,
    homes,
    stats: { count: homes.length, medianListPrice: medianListPrice(homes) },
    relatedTrails,
    cityMarket,
  }
}

export function getTrailDetail(slug: string): Promise<TrailDetail | null> {
  return unstable_cache(() => fetchTrailDetail(slug), ['trail-detail-v1', slug], {
    revalidate: CACHE_WINDOWS.listingsByGeo,
    tags: [cacheTag.listings, 'trails'],
  })()
}
