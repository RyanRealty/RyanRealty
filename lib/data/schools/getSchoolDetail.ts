/**
 * getSchoolDetail — resolve a school registry entry + the REAL active homes
 * that feed it (from our own MLS listings) for the /schools/[slug] page.
 *
 * Home-feeding resolution (verified 2026-06-03 against the live `listings`
 * table — see data/co-schools.ts header for the distinct-name verification):
 *
 *   SELECT ... FROM listings
 *   WHERE "StandardStatus" = 'Active'
 *     AND "PropertyType"   = 'A'                 -- SFR + residential, never land
 *     AND <levelColumn>    ILIKE '<MLS-exact name>'   -- case-insensitive
 *     AND "City" IN (<the school's district cities>)  -- exact display-case
 *
 * <levelColumn> is elementary_school / middle_school / high_school depending
 * on the registry entry's level. The district-cities clause keeps a same-named
 * school in another county from leaking homes into this page (the MLS school
 * fields span the whole state, e.g. "Three Rivers Elem" or duplicate names).
 *
 * Stats (count, medianListPrice) are computed in memory over the FULL feeding
 * set (bounded by MAX_HOMES as a safety ceiling) so the numbers are accurate.
 * The page slices its own card + pin caps from the returned, price-desc array.
 *
 * Academic stats are NOT fetched or invented here — they live as optional
 * nullable fields on the registry entry and get enriched later (CLAUDE.md §0).
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { readOrThrow } from '@/lib/data/cache/resilient'
import {
  getSchoolBySlug,
  citiesForSchool,
  CO_SCHOOLS,
  type CoSchool,
  type SchoolLevel,
} from '@/data/co-schools'

/**
 * Safety ceiling on rows scanned. Real feeding-home counts top out around ~360
 * (Summit High), so 600 covers every school with headroom while keeping the
 * query light. count + median are computed over the FULL feeding set (not a
 * display slice) so the stat band is accurate; the page slices its own card +
 * pin caps from the returned array.
 */
const MAX_HOMES = 600

/** A single feeding-home tile, slimmed for the school page. */
export type SchoolHomeTile = {
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

export type SchoolStats = {
  /** Active SFR homes that feed this school, from our listings. */
  count: number
  /** Median list price across those homes (rounded to nearest $1k), or null. */
  medianListPrice: number | null
}

export type SchoolDetail = {
  school: CoSchool
  homes: SchoolHomeTile[]
  stats: SchoolStats
  /** Other schools in the same district at the same level (excludes self). */
  nearby: CoSchool[]
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

/** Maps a registry level to the listings column that carries that level's school name. */
const LEVEL_COLUMN: Record<SchoolLevel, 'elementary_school' | 'middle_school' | 'high_school'> = {
  elementary: 'elementary_school',
  middle: 'middle_school',
  high: 'high_school',
}

/** Escape a name for an ilike pattern (no wildcards — exact case-insensitive match). */
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '')
}

function rowToHome(row: RawRow): SchoolHomeTile {
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
function medianListPrice(homes: SchoolHomeTile[]): number | null {
  const prices = homes
    .map((h) => h.price)
    .filter((p): p is number => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  const raw = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
  return Math.round(raw / 1000) * 1000
}

async function fetchSchoolHomes(school: CoSchool): Promise<SchoolHomeTile[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const cities = citiesForSchool(school)
  const column = LEVEL_COLUMN[school.level]

  // readOrThrow retries the read up to 3 times, then THROWS (does not return
  // []) so a transient error is never cached as "0 homes feed this school" for
  // the full TTL. All 55 school pages pre-render at build (dynamicParams =
  // false), so the retry matters: one 57014 statement timeout on this 590K-row
  // scan must not surface as a thrown build error. The page wraps the call in
  // .catch() as the final backstop.
  const data = await readOrThrow(`getSchoolDetail(${school.slug})`, () =>
    supabase
      .from('listings')
      .select(PROJECTION)
      .in('StandardStatus', ACTIVE_STATUSES)
      .eq('PropertyType', 'A')
      .ilike(column, escapeIlike(school.name))
      .in('City', cities)
      .order('ListPrice', { ascending: false, nullsFirst: false })
      .limit(MAX_HOMES),
  )

  return (data ?? []).map((r) => rowToHome(r as unknown as RawRow))
}

async function fetchSchoolDetail(slug: string): Promise<SchoolDetail | null> {
  const school = getSchoolBySlug(slug)
  if (!school) return null

  const homes = await fetchSchoolHomes(school)

  const nearby = CO_SCHOOLS.filter(
    (s) =>
      s.slug !== school.slug &&
      s.districtSlug === school.districtSlug &&
      s.level === school.level,
  )

  return {
    school,
    homes,
    stats: {
      count: homes.length,
      medianListPrice: medianListPrice(homes),
    },
    nearby,
  }
}

/**
 * Cached entry point. Returns null when the slug is not in the registry so the
 * page can render notFound(). Cached on the listings window + tag so the homes
 * refresh alongside the rest of the site's listing data.
 */
export function getSchoolDetail(slug: string): Promise<SchoolDetail | null> {
  return unstable_cache(
    () => fetchSchoolDetail(slug),
    ['school-detail-v1', slug],
    {
      revalidate: CACHE_WINDOWS.listingsByGeo,
      tags: [cacheTag.listings, 'schools'],
    },
  )()
}
