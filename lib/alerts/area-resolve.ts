/**
 * area-resolve — pure helpers turning saved named areas (public.search_areas
 * rows, migration 20260730020000) into the {include, exclude} shape set the
 * search path consumes (searchListingsAll `shapes` / the
 * search_listing_keys_in_shapes RPC).
 *
 * PURE on purpose: no supabase, no server-only — the alert engine calls this
 * with rows it already fetched (lib/data getAreasByIds), and tests exercise
 * the set algebra directly.
 *
 * Contract recap:
 *   - An area's `shapes` column is an ARRAY of drawn shapes, each
 *     {type:'polygon',coords:[[lng,lat],...]} | {type:'circle',center,radius_m},
 *     optionally carrying `exclude: true`.
 *   - Area membership = union(non-exclude shapes) minus union(exclude shapes).
 *   - Multiple areas on one search/alert are ADDITIVE geography: includes
 *     union across areas, excludes union across areas — identical to drawing
 *     all their shapes on one map (the RPC's set algebra).
 *
 * ── Engine integration (do NOT wire here — the engine owns its loop) ────────
 * Saved-search filters may carry `areaIds: string[]` (whitelisted in
 * lib/search-filters.ts). Before matching, the engine should:
 *
 *   const areaIds = getAreaIdsFromFilters(alert.filters)
 *   if (areaIds.length) {
 *     const areas = await getAreasByIds(areaIds)          // @/lib/data
 *     const shapes = resolveAreasToShapeSet(areas)
 *     // pass `shapes` into the searchListingsAll filter alongside the rest
 *   }
 *
 * A null return means NO valid geography was resolved (deleted areas, bad
 * rows). The engine must treat that as "this alert matches nothing" — never
 * silently widen to the whole feed (same guard class as hasNarrowingFilter).
 */

import type { MapShape, MapShapeSet } from '@/lib/map-polygon'
import { AreaShapeSchema, type AreaShape } from '@/lib/data/areas/validation'

/** Max area ids honored on one search/alert (mirrors the 50-shape RPC cap). */
export const MAX_AREA_IDS = 10

/** filters.areaIds, cleaned: strings, deduped, capped. */
export function getAreaIdsFromFilters(filters: Record<string, unknown> | null | undefined): string[] {
  const raw = filters?.areaIds
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const id = v.trim()
    if (id && !out.includes(id)) out.push(id)
    if (out.length >= MAX_AREA_IDS) break
  }
  return out
}

function stripExclude(shape: AreaShape): MapShape {
  if (shape.type === 'polygon') return { type: 'polygon', coords: shape.coords }
  return { type: 'circle', center: shape.center, radius_m: shape.radius_m }
}

/**
 * One area's stored shapes array → a shape set. Malformed entries are dropped
 * (rows predating a contract change must not kill an entire alert run); an
 * array with no valid include shape resolves to null.
 */
export function areaShapesToShapeSet(shapes: unknown): MapShapeSet | null {
  if (!Array.isArray(shapes)) return null
  const include: MapShape[] = []
  const exclude: MapShape[] = []
  for (const raw of shapes) {
    const parsed = AreaShapeSchema.safeParse(raw)
    if (!parsed.success) continue
    const shape = parsed.data
    if (shape.exclude === true) exclude.push(stripExclude(shape))
    else include.push(stripExclude(shape))
  }
  if (include.length === 0) return null
  return exclude.length > 0 ? { include, exclude } : { include }
}

/**
 * Merge many areas into ONE shape set (includes union, excludes union).
 * Areas that resolve to null contribute nothing. Null when nothing resolves.
 */
export function resolveAreasToShapeSet(
  areas: Array<{ shapes: unknown }> | null | undefined,
): MapShapeSet | null {
  if (!areas || areas.length === 0) return null
  const include: MapShape[] = []
  const exclude: MapShape[] = []
  for (const area of areas) {
    const set = areaShapesToShapeSet(area.shapes)
    if (!set) continue
    include.push(...set.include)
    if (set.exclude) exclude.push(...set.exclude)
  }
  if (include.length === 0) return null
  return exclude.length > 0 ? { include, exclude } : { include }
}
