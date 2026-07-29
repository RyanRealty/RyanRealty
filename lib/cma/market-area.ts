/**
 * Market-area resolution for CMA comp selection.
 *
 * The professional standard is NOT a radius. USPAP sets no proximity rule, and
 * Fannie Mae B4-1.3-08 requires comps from the subject's MARKET AREA (including
 * subdivision or project) while requiring distance to be *reported* — with a
 * direction, e.g. "1.75 miles NW" — never capped. The old 1-mile/5-mile rule was
 * retired with UAD and survives only as a soft lender overlay. The governing
 * test is buyer substitution: would a typical buyer have considered this
 * property INSTEAD of the subject?
 *
 * So the primitive here is the polygon, not the circle. `data/bend/
 * bend-neighborhood-polygons.json` holds 23 non-overlapping polygons built from
 * the City of Bend GIS neighborhood mesh — authoritative boundaries that already
 * follow the real dividing features. Distance is computed for DISCLOSURE, and
 * used only to order and to bound the last-resort tier.
 *
 * Researched and locked 2026-07-28 — see
 * docs/plans/PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md §A5.
 */

import polygonData from '@/data/bend/bend-neighborhood-polygons.json'

type Ring = number[][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Community = {
  slug: string
  route_slug: string
  name: string
  tier: string
  centroid: { lng: number; lat: number }
  geometry: Geometry
}

const COMMUNITIES = (polygonData as { communities: Community[] }).communities

/** Ray-casting point-in-ring. Coordinates are [lng, lat] (GeoJSON order). */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Outer ring contains the point and no hole excludes it. */
function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0]!)) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i]!)) return false // inside a hole
  }
  return true
}

function pointInGeometry(lng: number, lat: number, g: Geometry): boolean {
  if (g.type === 'Polygon') return pointInPolygon(lng, lat, g.coordinates)
  return g.coordinates.some((poly) => pointInPolygon(lng, lat, poly))
}

/**
 * The GIS neighborhood/community a coordinate falls in, or null when it is
 * outside every mapped polygon (rural, or a city we have no mesh for).
 * Null is a legitimate answer, not a failure — callers fall back to distance.
 */
export function resolveMarketArea(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const c of COMMUNITIES) {
    if (pointInGeometry(lng, lat, c.geometry)) return c.slug
  }
  return null
}

/** Display name for a market-area slug. */
export function marketAreaName(slug: string | null): string | null {
  if (!slug) return null
  return COMMUNITIES.find((c) => c.slug === slug)?.name ?? null
}

const EARTH_RADIUS_MILES = 3958.7613

/** Straight-line miles between two coordinates — the distance Fannie Mae requires be reported. */
export function distanceMiles(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(s)))
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** Compass direction from subject to comp, e.g. "NW" — the direction Fannie Mae requires alongside the distance. */
export function bearingLabel(
  from: { lat: number | null; lng: number | null },
  to: { lat: number | null; lng: number | null },
): string | null {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat))
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng))
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8]!
}

/** "1.75 miles NW" — the disclosure string. Null when either point lacks coordinates. */
export function proximityLabel(
  subject: { lat: number | null; lng: number | null },
  comp: { lat: number | null; lng: number | null },
): string | null {
  const d = distanceMiles(subject, comp)
  if (d == null) return null
  const dir = bearingLabel(subject, comp)
  return `${d.toFixed(2)} miles${dir ? ` ${dir}` : ''}`
}

/**
 * Lot-character comparability (Matt's hard exclusion, 2026-07-28: "different
 * zoning / lot character" is excluded at any distance).
 *
 * An acreage property and an in-town lot are different products with different
 * buyer pools, so they are never comparable however close they sit. The split is
 * drawn at 1 acre: below it is a platted in-town lot, at or above it is acreage.
 * Within acreage, the band still applies so a 1-acre subject is not compared to
 * a 40-acre ranch. A missing lot size on either side is UNKNOWN, and unknown
 * fails open (excluding on absent data would silently drop good comps).
 */
export function lotCharacterCompatible(subjectAcres: number | null, compAcres: number | null): boolean {
  if (subjectAcres == null || compAcres == null) return true
  const ACREAGE = 1
  const subjectIsAcreage = subjectAcres >= ACREAGE
  const compIsAcreage = compAcres >= ACREAGE
  if (subjectIsAcreage !== compIsAcreage) return false
  if (!subjectIsAcreage) return true
  return compAcres >= subjectAcres * 0.4 && compAcres <= subjectAcres * 2.5
}
