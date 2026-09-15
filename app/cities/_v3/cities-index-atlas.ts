/**
 * Verified city outlines for the /cities Atlas. Unknown geometry is omitted —
 * a missing boundary is not a point we invent (CLAUDE.md §0).
 */

import type { AtlasRegion } from '@/components/site/v3'

const GEOMETRY_TYPES = new Set([
  'Polygon',
  'MultiPolygon',
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'GeometryCollection',
])

export function asCityGeometry(value: unknown): GeoJSON.Geometry | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { type?: unknown; geometry?: unknown; features?: unknown }
  if (typeof record.type === 'string' && GEOMETRY_TYPES.has(record.type)) {
    return value as GeoJSON.Geometry
  }
  if (record.type === 'Feature') return asCityGeometry(record.geometry)
  if (record.type === 'FeatureCollection' && Array.isArray(record.features)) {
    return asCityGeometry(record.features[0])
  }
  return null
}

export function cityAtlasRegions(
  rows: ReadonlyArray<{ slug: string; name: string; geometry: unknown }>,
): AtlasRegion[] {
  const out: AtlasRegion[] = []
  for (const row of rows) {
    const geometry = asCityGeometry(row.geometry)
    if (!geometry) continue
    out.push({
      id: `city:${row.slug}`,
      kind: 'town',
      kindLabel: 'City',
      name: row.name,
      href: `/cities/${row.slug}`,
      geometry,
    })
  }
  return out
}
