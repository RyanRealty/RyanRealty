/**
 * getResortBoundaryGeoJSON — the TRUE footprint of a resort community, built as
 * the union of its authoritative Deschutes County GIS subdivision plats.
 *
 * Why this exists: a handful of resort `neighborhood` boundaries in the
 * `boundaries` table are oversized "spatial discovery" hulls (a convex blob
 * drawn around MLS listing pins), so the community map drew a boundary many
 * times too large and the plat-membership spilled into neighboring subdivisions.
 * Matt flagged Northwest Crossing (4,857-acre hull vs a real ~342-acre
 * footprint) and Eagle Crest.
 *
 * The fix is read-only: the `resort_plat_union_geojson(pattern)` Postgres
 * function (migration 20260601, SELECT-only) unions the county-GIS `subdivision`
 * plats whose label contains the resort name. No boundary data is mutated.
 *
 * Only the resorts whose stored boundary is a bad hull AND whose county plats
 * give a verified-good union are mapped here. Excluded on purpose:
 *   - tetherow: its stored boundary is already the correct county union (699ac);
 *     a broad "tetherow" match would wrongly pull in Tetherow Crossing (Redmond).
 *   - sunriver: its plats are labeled differently, so the union is incomplete.
 *   - brasada-ranch, three-rivers, widgi-creek: no county plats in the table.
 * Those keep their existing boundary.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/** Resort slug -> the label pattern that selects its county-GIS plats. */
const RESORT_PLAT_PATTERNS: Record<string, string> = {
  'northwest-crossing': 'northwest crossing',
  'eagle-crest': 'eagle crest',
  'broken-top': 'broken top',
  'pronghorn': 'pronghorn',
  'caldera-springs': 'caldera springs',
  'crosswater': 'crosswater',
  'awbrey-glen': 'awbrey glen',
  'vandevert-ranch': 'vandevert',
  'black-butte-ranch': 'black butte',
}

async function fetchResortBoundary(
  slug: string,
  pattern: string,
): Promise<BoundaryGeometry | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('resort_plat_union_geojson', {
    p_name_pattern: pattern,
  })

  if (error) {
    // THROW (do not return null) on a transient RPC error so unstable_cache
    // never caches the failure — same no-poison contract as getBoundaryGeoJSON.
    console.error('[getResortBoundaryGeoJSON] RPC error:', { slug, error })
    throw new Error(`resort_plat_union_geojson failed for ${slug}: ${error.message}`)
  }
  if (!data) return null

  try {
    const parsed = JSON.parse(data as string)
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

/**
 * Returns the authoritative county-GIS plat union for a mapped resort, or null
 * for any community not in the map (caller keeps the existing boundary).
 */
export function getResortBoundaryGeoJSON(
  slug: string,
): Promise<BoundaryGeometry | null> {
  const pattern = RESORT_PLAT_PATTERNS[slug]
  if (!pattern) return Promise.resolve(null)

  return unstable_cache(
    () => fetchResortBoundary(slug, pattern),
    ['resort-boundary-union-v1', slug],
    {
      revalidate: CACHE_WINDOWS.geoNeighborhood,
      tags: [cacheTag.neighborhood(slug), 'boundaries'],
    },
  )()
}
