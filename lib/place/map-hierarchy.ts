/**
 * SITE-128 Tip Ready #2 — map hierarchy lock.
 *
 * Neighborhood / community maps highlight THAT place ring only. Child plats
 * stay selectable: picking one zooms so THAT recorded boundary fills the
 * frame. No recorded geom → no highlight (Tetherow/Juniper FAIL was painting
 * children as the place). Do not invent coordinates.
 *
 * Subdivision grain uses the same subject ring, readable (not faint/tiny).
 */

export const MAP_HIERARCHY_KIND = 'map-hierarchy' as const
export const MAP_HIERARCHY_LOCKED_AT = '2026-09-18'
export const SUBJECT_FRAME_PAD = 0.1
export const DEFAULT_ATLAS_FRAME_PAD = 0.6
export const SUBJECT_STROKE_PX = 2.8

export type HierarchyGrain = 'city' | 'neighborhood' | 'community' | 'subdivision'

export type RecordedRing = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: unknown
}

export type LonLatBox = {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function isPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1])
}

/** Official GIS ring only. Approximated / empty / non-poly is not a highlight. */
export function isRecordedRing(value: unknown): value is RecordedRing {
  if (!value || typeof value !== 'object') return false
  const rec = value as { type?: string; coordinates?: unknown }
  if (rec.type !== 'Polygon' && rec.type !== 'MultiPolygon') return false
  return Array.isArray(rec.coordinates) && rec.coordinates.length > 0
}

function walkPairs(coords: unknown, visit: (lon: number, lat: number) => void): void {
  if (isPair(coords)) {
    visit(coords[0], coords[1])
    return
  }
  if (!Array.isArray(coords)) return
  for (const part of coords) walkPairs(part, visit)
}

/** Bounding box of a recorded Polygon / MultiPolygon. Null if missing or invented-empty. */
export function recordedRingBounds(geojson: unknown): LonLatBox | null {
  if (!isRecordedRing(geojson)) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  let n = 0
  walkPairs(geojson.coordinates, (lon, lat) => {
    n += 1
    if (lon < minLon) minLon = lon
    if (lat < minLat) minLat = lat
    if (lon > maxLon) maxLon = lon
    if (lat > maxLat) maxLat = lat
  })
  if (n < 3 || !Number.isFinite(minLon) || !Number.isFinite(minLat)) return null
  if (minLon === maxLon || minLat === maxLat) return null
  return { minLon, minLat, maxLon, maxLat }
}

/** Google fitBounds box from recorded geom. Child zoom uses this — not listing pins. */
export function childZoomBounds(geojson: unknown): {
  south: number
  west: number
  north: number
  east: number
} | null {
  const box = recordedRingBounds(geojson)
  if (!box) return null
  return { south: box.minLat, west: box.minLon, north: box.maxLat, east: box.maxLon }
}

export function subjectAtlasRegions<T extends { kind: string }>(regions: readonly T[]): T[] {
  return regions.filter((region) => region.kind === 'town')
}

export function childAtlasRegions<T extends { kind: string }>(regions: readonly T[]): T[] {
  return regions.filter((region) => region.kind !== 'town')
}

/** Ids that may take the child-hit / selected-child paint. Homepage cities stay unmarked. */
export function hierarchyChildIdSet(childRegions: readonly { id: string }[]): Set<string> {
  return new Set(childRegions.map((region) => region.id))
}

/** The id the rail and the carousel share. Strips the atlas prefix. */
export function childSelectionId(shapeId: string): string {
  if (shapeId.startsWith('subdivision:')) return shapeId.slice('subdivision:'.length)
  if (shapeId.startsWith('neighborhood:')) return shapeId.slice('neighborhood:'.length)
  return shapeId
}

/** A rail id matches a subdivision shape or a neighborhood shape. */
export function childSelectionMatches(shapeId: string, selectedId: string): boolean {
  return (
    shapeId === selectedId ||
    shapeId === `subdivision:${selectedId}` ||
    shapeId === `neighborhood:${selectedId}`
  )
}

/**
 * Default highlight: the subject place ring only. No subject geom → nothing
 * (never fall back to twenty child plats).
 */
export function defaultHighlightOverlays<T extends { geojson: unknown }>(
  subject: unknown,
  _children: readonly T[],
): { subject: unknown | null; selected: T | null } {
  return {
    subject: isRecordedRing(subject) ? subject : null,
    selected: null,
  }
}

/**
 * SITE-128: child plats are hit-only until selected.
 * Hover is not a paint — no label, no covering card.
 */
export function childPaintLive(
  selectedId: string | null | undefined,
  childId: string | null | undefined,
): boolean {
  return Boolean(selectedId && childId && selectedId === childId)
}

/** After a child is chosen, highlight THAT recorded ring only. */
export function selectedChildHighlight<T extends { id?: string; href?: string; geojson: unknown }>(
  children: readonly T[],
  selectedId: string | null,
): T | null {
  if (!selectedId) return null
  const hit = children.find((child) => child.id === selectedId || child.href === selectedId) ?? null
  if (!hit || !isRecordedRing(hit.geojson)) return null
  return hit
}

export function atlasFramePad(subjectGrain: boolean): number {
  return subjectGrain ? SUBJECT_FRAME_PAD : DEFAULT_ATLAS_FRAME_PAD
}

export function isSubjectGrain(grain: HierarchyGrain): boolean {
  return grain === 'subdivision'
}
