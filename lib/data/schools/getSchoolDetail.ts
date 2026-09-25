/**
 * getSchoolDetail — resolve a school registry entry + the REAL active homes
 * that feed it (from our own MLS listings) for the /schools/[slug] page.
 *
 * Home-feeding resolution (names verified 2026-06-03 against the live
 * `listings` table — see data/co-schools.ts header), read from
 * listing_search_mv by fetchOnMarketHomesForSchool
 * (lib/data/geo/nearby-on-market-homes.ts), which carries the same MLS
 * school-name columns:
 *
 *   standard_status IN (the public active statuses)
 *     AND property_type = 'A'
 *     AND <levelColumn> ILIKE '<MLS-exact name>'   -- case-insensitive
 *     AND city IN (<the school's district cities>)  -- exact display-case
 *
 * <levelColumn> is elementary_school / middle_school / high_school depending
 * on the registry entry's level. The district-cities clause keeps a same-named
 * school in another county from leaking homes into this page (the MLS school
 * fields span the whole state, e.g. "Three Rivers Elem" or duplicate names).
 *
 * Stats (count, medianListPrice) cover the FULL feeding set, paged, with no
 * row ceiling; the median publishes on at least 10 priced homes (Market Truth
 * median floor, audit DATA-8). The page slices its own card + pin caps from the
 * returned, price-desc array (top MAX_HOMES).
 *
 * Academic stats are NOT fetched or invented here — they live as optional
 * nullable fields on the registry entry and get enriched later (CLAUDE.md §0).
 *
 * Lives entirely behind the DAL boundary (Gate G1). Pages import from
 * @/lib/data only.
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchOnMarketHomesForSchool, type NearbyHomeStats } from '@/lib/data/geo/nearby-on-market-homes'
import {
  getSchoolBySlug,
  citiesForSchool,
  CO_SCHOOLS,
  type CoSchool,
  type SchoolLevel,
} from '@/data/co-schools'

/**
 * Display ceiling on returned tiles. Real feeding-home counts top out around
 * ~360 (Summit High). count + median are computed over the FULL feeding set
 * (not this slice), so a school above the ceiling still prints its real count.
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
  /** Every public on-market PropertyType 'A' home that feed this school (not the display slice). */
  count: number
  /** percentile_cont median list price across ALL of them, rounded to $1k; null under 10 priced homes. */
  medianListPrice: number | null
}

export type SchoolDetail = {
  school: CoSchool
  homes: SchoolHomeTile[]
  stats: SchoolStats
  /** Other schools in the same district at the same level (excludes self). */
  nearby: CoSchool[]
}

/** Maps a registry level to the listings column that carries that level's school name. */
const LEVEL_COLUMN: Record<SchoolLevel, 'elementary_school' | 'middle_school' | 'high_school'> = {
  elementary: 'elementary_school',
  middle: 'middle_school',
  high: 'high_school',
}

async function fetchSchoolHomes(
  school: CoSchool,
): Promise<{ homes: SchoolHomeTile[]; stats: NearbyHomeStats }> {
  // Retries then THROWS inside the shared reader, so a transient error is never
  // cached as "0 homes feed this school"; the page wraps the call in .catch().
  return fetchOnMarketHomesForSchool({
    label: `getSchoolDetail(${school.slug})`,
    column: LEVEL_COLUMN[school.level],
    name: school.name,
    cities: citiesForSchool(school),
    maxTiles: MAX_HOMES,
  })
}

async function fetchSchoolDetail(slug: string): Promise<SchoolDetail | null> {
  const school = getSchoolBySlug(slug)
  if (!school) return null

  const { homes, stats } = await fetchSchoolHomes(school)

  const nearby = CO_SCHOOLS.filter(
    (s) =>
      s.slug !== school.slug &&
      s.districtSlug === school.districtSlug &&
      s.level === school.level,
  )

  return {
    school,
    homes,
    stats,
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
    ['school-detail-v2-full-set', slug],
    {
      revalidate: CACHE_WINDOWS.listingsByGeo,
      tags: [cacheTag.listings, 'schools'],
    },
  )()
}
