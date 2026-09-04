/**
 * Nested place rings as a class prop.
 *
 * Community, neighborhood, and (non-Bend) city pages all hold child GIS
 * polygons. One mapper feeds Split overlayBoundaries and Atlas child regions.
 * A grain with no children passes []. Subdivision is self: parent ring only.
 */
import { atlasRegionName } from '@/lib/atlas/place-names'
import type { CommunitySubdivision } from '@/lib/data/geo/getCommunitySubdivisions'

const RING_CAP = 80

export type PlaceChildOverlay = {
  label: string
  href?: string
  geojson: { type?: string; coordinates?: unknown }
}

export type PlaceChildRegion = {
  id: string
  kind: 'neighborhood'
  kindLabel: string
  name: string
  href: string
  geometry: CommunitySubdivision['geometry']
}

function isRingGeometry(
  value: unknown,
): value is { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } {
  if (!value || typeof value !== 'object') return false
  const rec = value as { type?: string; coordinates?: unknown }
  return (rec.type === 'Polygon' || rec.type === 'MultiPolygon') && Array.isArray(rec.coordinates)
}

/** Child GIS plats as Split overlay rings, each a door to its page. */
export function overlaysFromChildCells(
  cells: readonly CommunitySubdivision[],
  cap = RING_CAP,
): PlaceChildOverlay[] {
  const out: PlaceChildOverlay[] = []
  for (const cell of cells) {
    if (out.length >= cap) break
    if (!isRingGeometry(cell.geometry)) continue
    const label = (atlasRegionName(cell.label) ?? cell.label).trim()
    const slug = cell.slug.trim()
    if (!label || !slug) continue
    out.push({
      label,
      href: `/subdivisions/${slug}`,
      geojson: { type: cell.geometry.type, coordinates: cell.geometry.coordinates },
    })
  }
  return out
}

/** Child GIS plats as Atlas regions. Parent silhouette is the caller's job. */
export function regionsFromChildCells(
  cells: readonly CommunitySubdivision[],
  cap = RING_CAP,
): PlaceChildRegion[] {
  const out: PlaceChildRegion[] = []
  for (const cell of cells) {
    if (out.length >= cap) break
    if (!isRingGeometry(cell.geometry)) continue
    const label = (atlasRegionName(cell.label) ?? cell.label).trim()
    const slug = cell.slug.trim()
    if (!label || !slug) continue
    out.push({
      id: `subdivision:${slug}`,
      kind: 'neighborhood',
      kindLabel: 'Subdivision',
      name: label,
      href: `/subdivisions/${slug}`,
      geometry: cell.geometry,
    })
  }
  return out
}

/**
 * Atlas child silhouettes (neighborhoods on Bend, plats elsewhere, nested
 * plats on a community or neighborhood) as Split overlay rings.
 */
export function overlaysFromRegions(
  regions: readonly { name: string; href?: string; geometry: unknown }[],
  cap = RING_CAP,
): PlaceChildOverlay[] {
  const out: PlaceChildOverlay[] = []
  for (const region of regions) {
    if (out.length >= cap) break
    if (!isRingGeometry(region.geometry)) continue
    const label = region.name.trim()
    if (!label) continue
    const href = region.href?.trim()
    out.push({
      label,
      ...(href ? { href } : {}),
      geojson: { type: region.geometry.type, coordinates: region.geometry.coordinates },
    })
  }
  return out
}
