/**
 * The recorded outline of a plat FAMILY and the sales inside it (Matt
 * 2026-09-23: phases "go into the same main neighborhood page").
 *
 * THE OUTLINE. public.subdivision_footprint already unions recorded plats in
 * PostGIS (migration 20260909190000): exact slug first, then the slug's
 * phase prefix, then the member plats the caller names. A family head that the
 * county recorded as a plat of its own (Tetherow Crossing) answers on the first
 * path with ONE polygon, and the family's other seven phases would be missing
 * from its map. So the family asks under a slug no recorded plat can carry
 * ('~' is outside the [a-z0-9-] slug alphabet): the exact and prefix paths
 * find nothing, and the RPC unions exactly the member plats named here, with
 * its own 0.15-degree coherence guard. Geometry never leaves PostGIS unioned
 * by the app.
 *
 * THE SALES. A family's phases overlap wherever the county replatted lots
 * (Ridge At Eagle Crest 11 and Ridge At Eagle Crest 11 Replat Lots 21-28 both
 * contain those lots), and subdivision_plat_closed_mv attributes a sale to
 * EVERY plat whose polygon contains it. Summing the phases' counts would count
 * those sales twice (§0). The family count is therefore read the honest way:
 * every closed sale in listing_tile_mv whose coordinates fall inside the
 * family outline, each listing counted once. Same population rules as the
 * plat MV (closed = status contains "closed", internet-display filter inherited
 * from listing_tile_mv), one level coarser.
 *
 * Read cost, measured 2026-09-23 on Ridge at Eagle Crest (60 phases): the RPC
 * 337 ms; the closed rows inside the outline's bounding box 3,285 rows in
 * 825 ms from listing_tile_mv_src through the (lat, lng) btree (3,865 ms
 * through the security_barrier view, which blocks index pushdown; the status
 * filter below keeps Coming Soon out exactly as the view would). Cached 6h.
 */

import { unstable_cache } from 'next/cache'
import { createServiceClient, supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { parseFootprintRow, type PlatFootprint } from '@/lib/data/subdivisions/getSubdivisionFootprint'

/** The sentinel prefix: '~' can never appear in a recorded plat slug. */
const FAMILY_SENTINEL = '~family:'

function memberKey(memberSlugs: readonly string[]): string[] {
  return [...new Set(memberSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean))].sort()
}

async function fetchPlatFamilyFootprint(
  familySlug: string,
  memberSlugs: readonly string[],
): Promise<PlatFootprint | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('subdivision_footprint', {
    p_slug: `${FAMILY_SENTINEL}${familySlug}`,
    p_member_slugs: [...memberSlugs],
  })
  if (error) {
    throw new Error(`subdivision_footprint (family ${familySlug}) failed: ${error.message}`)
  }
  const rows = (data ?? []) as Parameters<typeof parseFootprintRow>[1][]
  const parsed = parseFootprintRow(familySlug, rows[0])
  // The RPC reports this path as 'members'. For a family it is its phases.
  return parsed ? { ...parsed, source: 'phases' } : null
}

/**
 * The union of a family's recorded phases, or null when PostGIS refused it
 * (members more than 0.15 degrees apart) or none of the slugs is on record.
 */
export function getPlatFamilyFootprint(input: {
  familySlug: string
  memberSlugs: readonly string[]
}): Promise<PlatFootprint | null> {
  const slug = input.familySlug.trim().toLowerCase()
  const members = memberKey(input.memberSlugs)
  if (!slug || members.length === 0) return Promise.resolve(null)
  return unstable_cache(
    () => fetchPlatFamilyFootprint(slug, members),
    ['plat-family-footprint-v1', slug, members.join('|')],
    { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.community(slug), 'boundaries'] },
  )()
}

// ---------------------------------------------------------------------------
// Closed sales inside the outline.
// ---------------------------------------------------------------------------

export type PlatFamilyClosedSales = {
  /** Distinct closed listings inside the family outline, every property type. */
  closedCount: number
  /** The same listings by calendar year of the close. */
  closedByYear: Readonly<Record<number, number>>
  /** How many recorded phases the outline joins. */
  phases: number
  /** When the rows were read, ISO. */
  readAt: string
}

type ClosedRow = {
  listing_key?: string | null
  lat?: number | string | null
  lng?: number | string | null
  close_date?: string | null
}

/** Even-odd ring test over every ring of a polygon, so a hole is outside. */
function inPolygonRings(lng: number, lat: number, rings: readonly (readonly number[][])[]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i]![0]!
      const yi = ring[i]![1]!
      const xj = ring[j]![0]!
      const yj = ring[j]![1]!
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}

/** True when the point is inside the geometry (any polygon of a MultiPolygon, holes excluded). */
export function pointInGeometry(lng: number, lat: number, geometry: BoundaryGeometry): boolean {
  if (geometry.type === 'Polygon') return inPolygonRings(lng, lat, geometry.coordinates)
  return geometry.coordinates.some((polygon) => inPolygonRings(lng, lat, polygon))
}

/** Pure count over rows already read, so the test can pin the dedup and the hole rule. */
export function countClosedInside(
  rows: readonly ClosedRow[],
  geometry: BoundaryGeometry,
  maxYear: number = new Date().getUTCFullYear(),
): { closedCount: number; closedByYear: Record<number, number> } {
  const seen = new Set<string>()
  const byYear: Record<number, number> = {}
  for (const row of rows) {
    const key = (row.listing_key ?? '').trim()
    if (!key || seen.has(key)) continue
    const lat = Number(row.lat)
    const lng = Number(row.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (!pointInGeometry(lng, lat, geometry)) continue
    seen.add(key)
    const year = row.close_date ? new Date(row.close_date).getUTCFullYear() : NaN
    if (Number.isInteger(year) && year >= 1900 && year <= maxYear) byYear[year] = (byYear[year] ?? 0) + 1
  }
  return { closedCount: seen.size, closedByYear: byYear }
}

function bboxOf(geometry: BoundaryGeometry): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      minLng = Math.min(minLng, node[0])
      maxLng = Math.max(maxLng, node[0])
      minLat = Math.min(minLat, node[1])
      maxLat = Math.max(maxLat, node[1])
      return
    }
    for (const child of node) visit(child)
  }
  visit(geometry.coordinates)
  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null
}

async function fetchPlatFamilyClosedSales(
  familySlug: string,
  memberSlugs: readonly string[],
): Promise<PlatFamilyClosedSales | null> {
  const footprint = await getPlatFamilyFootprint({ familySlug, memberSlugs })
  if (!footprint) return null
  const box = bboxOf(footprint.geometry)
  if (!box) return null
  const readAt = new Date().toISOString()
  const supabase = createServiceClient()
  const { rows, error } = await fetchPagedRows<ClosedRow>((from, to) =>
    supabase
      .from('listing_tile_mv_src')
      .select('listing_key,lat,lng,close_date')
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng)
      .ilike('standard_status', '%closed%')
      // listing_key is the MV's unique key: a total order, so no page skips or
      // repeats a row (G48 / ci:row-cap).
      .order('listing_key', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`getPlatFamilyClosedSales(${familySlug}): ${error.message}`)
  const counted = countClosedInside(rows, footprint.geometry)
  return { ...counted, phases: footprint.partSlugs.length, readAt }
}

/**
 * Lifetime closed sales inside a family's outline, each sale once. Null when
 * the family has no drawable outline or the read failed: §0, the page then
 * prints no family figure rather than a sum it cannot stand behind.
 */
export const getPlatFamilyClosedSales = makeResilientCached(
  (familySlug: string, memberSlugs: readonly string[]) =>
    fetchPlatFamilyClosedSales(familySlug.trim().toLowerCase(), memberKey(memberSlugs)),
  ['plat-family-closed-sales-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'boundaries'] },
  null as PlatFamilyClosedSales | null,
)
