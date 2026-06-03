/**
 * getParkDetail — resolve a park registry entry + the REAL active single-family
 * homes near it (from our own MLS listings) for the /parks/[slug] page.
 *
 * Nearby-homes resolution — a lat/lng bounding box around the park centroid:
 *
 *   SELECT ... FROM listings
 *   WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract')
 *     AND "PropertyType"   = 'A'                              -- SFR + residential
 *     AND "Latitude"  BETWEEN c.lat - LAT_PAD  AND c.lat + LAT_PAD
 *     AND "Longitude" BETWEEN c.lng - LNG_PAD  AND c.lng + LNG_PAD
 *
 * The box is roughly 1.5 miles in each direction. LAT_PAD = 0.022 deg
 * (~1.5 mi N/S) and LNG_PAD = 0.028 deg (~1.4 mi E/W at 44° N, where a degree
 * of longitude is ~50 miles). Homes are sorted price-desc; the page slices its
 * own card + pin caps. Stats (count, median list price) are computed in memory
 * over the FULL returned set so the numbers are accurate.
 *
 * No academic/park-fact data is invented here — the registry carries the
 * sourced blurb + amenities. This DAL only joins the park to live listings.
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only (Gate G8).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
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
  /** Active SFR homes near this park, from our listings. */
  count: number
  /** Median list price across those homes (rounded to nearest $1k), or null. */
  medianListPrice: number | null
}

export type ParkDetail = {
  park: CoPark
  homes: ParkHomeTile[]
  stats: ParkStats
  /** Other registry parks in the same city (excludes self). */
  nearbyParks: CoPark[]
}

/** Raw row shape returned by the listings projection (PostgREST column names). */
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

function rowToHome(row: RawRow): ParkHomeTile {
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  const cityLine = [
    [row.City, 'OR'].filter(Boolean).join(', '),
    row.PostalCode,
  ]
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
  }
}

/** Median list price over the homes, rounded to the nearest $1k. Null when empty. */
function medianListPrice(homes: ParkHomeTile[]): number | null {
  const prices = homes
    .map((h) => h.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  const raw = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  return Math.round(raw / 1000) * 1000
}

async function fetchParkHomes(park: CoPark): Promise<ParkHomeTile[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('listings')
    .select(PROJECTION)
    .in('StandardStatus', ACTIVE_STATUSES)
    .eq('PropertyType', 'A')
    .gte('Latitude', park.lat - LAT_PAD)
    .lte('Latitude', park.lat + LAT_PAD)
    .gte('Longitude', park.lng - LNG_PAD)
    .lte('Longitude', park.lng + LNG_PAD)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(MAX_HOMES)

  if (error) {
    // THROW (do not return []) so a transient error is never cached as
    // "0 homes near this park" for the full TTL. The next request retries.
    throw new Error(`[getParkDetail] supabase error: ${error.message}`)
  }

  return (data ?? []).map((r) => rowToHome(r as unknown as RawRow))
}

async function fetchParkDetail(slug: string): Promise<ParkDetail | null> {
  const park = getParkBySlug(slug)
  if (!park) return null

  const homes = await fetchParkHomes(park)

  const nearbyParks = CO_PARKS.filter((p) => p.slug !== park.slug && p.city === park.city)

  return {
    park,
    homes,
    stats: {
      count: homes.length,
      medianListPrice: medianListPrice(homes),
    },
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
    ['park-detail-v1', slug],
    {
      revalidate: CACHE_WINDOWS.listingsByGeo,
      tags: [cacheTag.listings, 'parks'],
    },
  )()
}
