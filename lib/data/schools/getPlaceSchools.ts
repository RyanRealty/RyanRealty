/**
 * getPlaceSchools — attendance-area schools that cover one place polygon.
 *
 * Source: public.get_place_schools. That RPC intersects boundaries
 * geo_type='school' (Deschutes County GIS attendance) with the place polygon
 * and keeps a school only when it covers at least 5% of the place. The share
 * is the cut and the sort key. It is not a published figure.
 *
 * Names and levels come from data/co-schools.ts. A boundary slug with no
 * registry page is omitted, so the list never links to a missing school.
 * Crook, Jefferson, Culver, and Gilchrist attendance is unpublished: a genuine
 * empty result stays empty. An RPC error throws so the resilient cache does
 * not store that empty.
 *
 * Not getSubdivisionSchools. That claim is one MLS modal per level for an
 * exact city + SubdivisionName.
 */

import { findSchoolByName, getSchoolBySlug, type SchoolLevel } from '@/data/co-schools'
import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/** A boundary kiss below this fraction of the place is not listed. */
export const PLACE_SCHOOL_MIN_SHARE = 0.05

export type PlaceSchool = {
  slug: string
  /** Registry name. Display this, not a rewritten spelling. */
  name: string
  level: SchoolLevel
  /** Fraction of the place polygon. For ordering. Do not print. */
  share: number
}

export type PlaceSchoolRpcRow = {
  geo_slug?: string | null
  geo_label?: string | null
  share?: number | string | null
}

const LEVEL_RANK: Record<SchoolLevel, number> = {
  elementary: 0,
  middle: 1,
  high: 2,
}

/**
 * Registry schools covering the place, elementary then middle then high,
 * and a larger share first inside one level. Unknown slugs and kisses
 * under the floor are dropped.
 */
export function placeSchoolsFromRows(rows: readonly PlaceSchoolRpcRow[]): PlaceSchool[] {
  const bySlug = new Map<string, PlaceSchool>()
  for (const row of rows) {
    const share = Number(row.share)
    if (!Number.isFinite(share) || share < PLACE_SCHOOL_MIN_SHARE) continue
    const slug = (row.geo_slug ?? '').trim()
    const label = (row.geo_label ?? '').trim()
    const school = (slug ? getSchoolBySlug(slug) : undefined) ?? findSchoolByName(label)
    if (!school) continue
    const prev = bySlug.get(school.slug)
    if (prev && prev.share >= share) continue
    bySlug.set(school.slug, {
      slug: school.slug,
      name: school.name,
      level: school.level,
      share,
    })
  }
  return [...bySlug.values()].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.share - a.share || a.name.localeCompare(b.name),
  )
}

async function fetchPlaceSchools(geoType: string, geoSlug: string): Promise<PlaceSchool[]> {
  const type = geoType.trim()
  const slug = geoSlug.trim()
  if (!type || !slug) return []

  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('get_place_schools', {
    p_geo_type: type,
    p_geo_slug: slug,
  })
  if (error) {
    throw new Error(`get_place_schools RPC failed for "${type}/${slug}": ${error.message}`)
  }
  return placeSchoolsFromRows((Array.isArray(data) ? data : []) as PlaceSchoolRpcRow[])
}

/** Cached 6h. Attendance polygons move when the county redraws them. */
export const getPlaceSchools = makeResilientCached(
  fetchPlaceSchools,
  ['place-schools-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  [],
)
