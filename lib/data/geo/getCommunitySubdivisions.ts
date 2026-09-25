/**
 * getCommunitySubdivisions — the GIS subdivision plats that make up a
 * resort/master-planned community, via the `community_subdivisions` RPC.
 *
 * Each entry carries the subdivision's authoritative county-GIS polygon (so the
 * community map can render the subdivisions "broken out" as separate cells) and
 * its active home count (from listing_boundary_xref_mv). Membership is spatial:
 * a plat smaller than the parent with more than half its area inside it. See
 * the RPC migration 20260529050000 for why (plats aren't parented to
 * communities, and MLS names don't match plat names); the current body, which
 * reaches the GiST index, is 20260925015103.
 *
 * SOURCE AND CACHING (SITE-209). The RPC returns EVERY member plat, but
 * PostgREST caps one response at the project's max-rows (1,000). Bend has
 * 1,621 plats (2026-09-25), so a single un-ranged call silently dropped the
 * 621 with the fewest homes for sale, and both the new-construction map and
 * the listing atlas (city scope) missed any plat in that cut. This reads the
 * RPC in pages of PAGE rows with supabase-js `.range()`, ordered by `geo_slug`
 * (stable: the RPC's own `active_homes desc` order comes from a materialized
 * view that refreshes between two page reads and can move a row across a
 * page boundary). Each page is its own cache entry because Next's data cache
 * refuses any entry over 2 MB ("items over 2MB can not be cached",
 * next/dist/server/lib/incremental-cache/index.js): the raw JSON measured
 * 2,724,531 bytes per 1,000 Bend rows, so a whole-list entry could never be
 * stored and every render paid the RPC. The largest 500-row page measured
 * 1,364,815 bytes. `total` comes from PostgREST's exact count of the
 * function's result set (verified live: 1,621 for Bend), so the page count is
 * known after page 0 and the rest read in parallel. The assembled list is
 * returned in the RPC's own published order (activeHomes desc, label, slug)
 * so callers that slice a top N keep seeing the same head.
 *
 * Throws on a transient RPC error (never caches an empty page) — same
 * no-poison contract as getGeoBoundaryMapData / getBoundaryGeoJSON.
 *
 * GIS rule (CLAUDE.md): polygons come from the authoritative `boundaries`
 * table. This never approximates.
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { supabaseAnon } from '@/lib/data/client'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type CommunitySubdivisionInput = {
  geoType: 'city' | 'neighborhood'
  geoSlug: string
}

export type CommunitySubdivision = {
  slug: string
  label: string
  geometry: BoundaryGeometry
  activeHomes: number
}

type RpcRow = {
  geo_slug: string
  geo_label: string
  geojson: string | null
  active_homes: number | null
}

/**
 * Rows per cache entry. Next's data cache refuses entries over 2 MB and the
 * RPC's raw JSON measured 2.7 MB per 1,000 Bend rows (2026-09-25), so 500
 * rows (largest measured page 1.36 MB) keeps every page storable with margin.
 */
const PAGE = 500

type CommunitySubdivisionPage = {
  rows: CommunitySubdivision[]
  /** PostgREST's exact count of the RPC's result set; null when it withheld one. */
  total: number | null
}

function parseGeometry(geojson: string | null): BoundaryGeometry | null {
  if (!geojson) return null
  try {
    const parsed = JSON.parse(geojson)
    if (
      parsed &&
      (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') &&
      Array.isArray(parsed.coordinates)
    ) {
      return parsed as BoundaryGeometry
    }
    return null
  } catch {
    return null
  }
}

async function fetchCommunitySubdivisionPage(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
  page: number,
): Promise<CommunitySubdivisionPage> {
  const supabase = supabaseAnon()
  if (!supabase) return { rows: [], total: 0 }

  const from = page * PAGE
  // PostgREST applies the order and the range over the function's result set,
  // and `count: 'exact'` reports that set's full size on every page.
  const { data, error, count } = await supabase
    .rpc('community_subdivisions', { p_geo_type: geoType, p_geo_slug: geoSlug }, { count: 'exact' })
    .order('geo_slug', { ascending: true })
    .range(from, from + PAGE - 1)

  if (error) {
    // THROW (do not return a page) so unstable_cache never caches a transient
    // failure — same no-poison rule as the other geo DALs.
    console.error('[getCommunitySubdivisions] RPC error:', { geoType, geoSlug, page, error })
    throw new Error(
      `community_subdivisions RPC failed for ${geoType}/${geoSlug} page ${page}: ${error.message}`,
    )
  }

  const rows = ((data ?? []) as RpcRow[])
    .map((row) => {
      const geometry = parseGeometry(row.geojson)
      if (!geometry) return null
      return {
        slug: row.geo_slug,
        label: row.geo_label,
        geometry,
        activeHomes: row.active_homes ?? 0,
      }
    })
    .filter((s): s is CommunitySubdivision => s !== null)

  return { rows, total: typeof count === 'number' ? count : null }
}

function readPage(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
  page: number,
): Promise<CommunitySubdivisionPage> {
  return unstable_cache(
    () => fetchCommunitySubdivisionPage(geoType, geoSlug, page),
    ['community-subdivisions-v2', geoType, geoSlug, 'page', String(page)],
    {
      revalidate: CACHE_WINDOWS.geoNeighborhood,
      tags: [cacheTag.neighborhood(geoSlug), 'boundaries'],
    },
  )()
}

/** The RPC's own published order: most homes for sale first, then name, then slug. */
function byPublishedOrder(a: CommunitySubdivision, b: CommunitySubdivision): number {
  return (
    b.activeHomes - a.activeHomes ||
    a.label.localeCompare(b.label, 'en') ||
    a.slug.localeCompare(b.slug, 'en')
  )
}

/**
 * Every member plat of a city or community. Page 0 tells the total; the rest
 * read in one parallel round. A plat that a materialized-view refresh moved
 * across a page boundary between reads is kept once, first occurrence wins.
 */
export async function getCommunitySubdivisions(
  input: CommunitySubdivisionInput,
): Promise<CommunitySubdivision[]> {
  const { geoType, geoSlug } = input
  const first = await readPage(geoType, geoSlug, 0)

  let pages: CommunitySubdivisionPage[]
  if (first.total != null) {
    // A dropped (unparsable) row shortens `rows` without shrinking the result
    // set, so the page count comes from the exact total, never from rows.length.
    const pageCount = Math.max(1, Math.ceil(first.total / PAGE))
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) => readPage(geoType, geoSlug, i + 1)),
    )
    pages = [first, ...rest]
  } else {
    // PostgREST withheld the count: walk pages until one comes back short.
    // (Not observed live; `count: 'exact'` returned 1,621 for Bend.)
    pages = [first]
    let last = first
    while (last.rows.length >= PAGE) {
      last = await readPage(geoType, geoSlug, pages.length)
      pages.push(last)
    }
  }

  const seen = new Set<string>()
  const out: CommunitySubdivision[] = []
  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.slug)) continue
      seen.add(row.slug)
      out.push(row)
    }
  }
  return out.sort(byPublishedOrder)
}
