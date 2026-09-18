/**
 * Place-homes Atlas amenity layers (SITE-128 craft #2).
 *
 * Parks and trails on V3Atlas come from geometry we already hold:
 *   - park polygons: public.boundaries via boundary_geojson (geo_type=park)
 *   - trail lines: public.trail_lines via trail_line_geojson
 *   - membership: registry city / communitySlug, registry centroid /
 *     trailhead inside the place ring, or official park/trail geom that
 *     touches that recorded ring (community + subdivision grain)
 *
 * Registry lat/lng is membership only. It is never buffered, circled, or
 * turned into a corridor. Missing official geometry is omitted — never
 * invented, never crowd-sourced street-map geometry.
 *
 * Do not twin lib/site/place-recreation.ts (facts / ledger depth).
 */

import { CO_PARKS, type CoPark } from '@/data/co-parks'
import { CO_TRAILS, type CoTrail } from '@/data/co-trails'
import {
  bboxOfRings,
  lineStringParts,
  outerRings,
  padBbox,
  pointInRings,
  type LonLat,
  type Ring,
} from '@/lib/geo/project-svg'

export type PlaceAmenityGrain = 'city' | 'neighborhood' | 'community' | 'subdivision'

export type PlaceAmenityPark = {
  id: string
  slug: string
  name: string
  href: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  source: string
}

export type PlaceAmenityTrail = {
  id: string
  slug: string
  name: string
  href: string
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString
  source: string
}

export type PlaceAmenityOmitReason =
  | 'no-polygon-flag'
  | 'geom-missing'
  | 'outside-place'
  | 'city-mismatch'
  | 'no-place-ring'
  | 'no-anchor'
  | 'cap'

export type PlaceAmenityOmit = {
  kind: 'park' | 'trail'
  slug: string
  name: string
  reason: PlaceAmenityOmitReason
}

export type PlaceAmenityLayers = {
  parks: PlaceAmenityPark[]
  trails: PlaceAmenityTrail[]
  omitted: PlaceAmenityOmit[]
}

export const EMPTY_PLACE_AMENITY_LAYERS: PlaceAmenityLayers = {
  parks: [],
  trails: [],
  omitted: [],
}

export const CITY_PARK_CAP = 24
export const CITY_TRAIL_CAP = 16
export const LOCAL_PARK_CAP = 12
export const LOCAL_TRAIL_CAP = 10
/** Candidate fetch window around a local ring — not a draw set. */
export const LOCAL_AMENITY_BBOX_PAD = 0.5
export const LOCAL_AMENITY_MIN_PAD_DEG = 0.015

export const PLACE_AMENITY_LAYER_TRACE =
  'Park outlines from recorded park boundaries in public.boundaries (geo_type=park). Trail lines from public.trail_lines (USFS / BPRD / BLM / OPRD). Missing official geometry is omitted.'

function norm(value: string): string {
  return value.trim().toLowerCase()
}

export function cityNameMatches(placeCity: string, rowCity: string): boolean {
  const a = norm(placeCity)
  const b = norm(rowCity)
  return a.length > 0 && a === b
}

export function isParkPolygon(value: unknown): value is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (!value || typeof value !== 'object') return false
  const rec = value as { type?: string; coordinates?: unknown }
  return (rec.type === 'Polygon' || rec.type === 'MultiPolygon') && Array.isArray(rec.coordinates)
}

export function isTrailLine(value: unknown): value is GeoJSON.LineString | GeoJSON.MultiLineString {
  if (!value || typeof value !== 'object') return false
  const rec = value as { type?: string; coordinates?: unknown }
  return (rec.type === 'LineString' || rec.type === 'MultiLineString') && Array.isArray(rec.coordinates)
}

export function parkBoundarySource(park: Pick<CoPark, 'agency'>): string {
  return `${park.agency} park boundary, recorded in public.boundaries (geo_type=park)`
}

export function trailLineSource(trail: Pick<CoTrail, 'landManager'>): string {
  return `${trail.landManager} trail line, recorded in public.trail_lines`
}

export function amenityInsidePlace(
  lon: number,
  lat: number,
  placeGeometry: GeoJSON.Geometry | null | undefined,
): boolean {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !placeGeometry) return false
  return pointInRings(lon, lat, outerRings(placeGeometry))
}

export function localAmenityCandidateBbox(
  placeGeometry: GeoJSON.Geometry | null | undefined,
): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  if (!placeGeometry) return null
  const box = bboxOfRings(outerRings(placeGeometry))
  if (!box) return null
  const padded = padBbox(box, LOCAL_AMENITY_BBOX_PAD)
  return {
    minLon: Math.min(padded.minLon, box.minLon - LOCAL_AMENITY_MIN_PAD_DEG),
    maxLon: Math.max(padded.maxLon, box.maxLon + LOCAL_AMENITY_MIN_PAD_DEG),
    minLat: Math.min(padded.minLat, box.minLat - LOCAL_AMENITY_MIN_PAD_DEG),
    maxLat: Math.max(padded.maxLat, box.maxLat + LOCAL_AMENITY_MIN_PAD_DEG),
  }
}

function pointInBox(
  lon: number,
  lat: number,
  box: NonNullable<ReturnType<typeof localAmenityCandidateBbox>>,
): boolean {
  return lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat
}

function segmentsCross(a: LonLat, b: LonLat, c: LonLat, d: LonLat): boolean {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
  if (den === 0) return false
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function ringTouchesRing(a: Ring, b: Ring): boolean {
  for (const [lon, lat] of a) {
    if (pointInRings(lon, lat, [b])) return true
  }
  for (const [lon, lat] of b) {
    if (pointInRings(lon, lat, [a])) return true
  }
  for (let i = 0; i < a.length; i += 1) {
    const a0 = a[i]!
    const a1 = a[(i + 1) % a.length]!
    for (let j = 0; j < b.length; j += 1) {
      const b0 = b[j]!
      const b1 = b[(j + 1) % b.length]!
      if (segmentsCross(a0, a1, b0, b1)) return true
    }
  }
  return false
}

/** Official amenity geom vs the recorded place ring. Registry lat/lng is not drawn. */
export function amenityGeomTouchesPlace(
  amenity:
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon
    | GeoJSON.LineString
    | GeoJSON.MultiLineString,
  placeGeometry: GeoJSON.Geometry | null | undefined,
): boolean {
  if (!placeGeometry) return false
  const place = outerRings(placeGeometry)
  if (place.length === 0) return false
  if (amenity.type === 'LineString' || amenity.type === 'MultiLineString') {
    for (const part of lineStringParts(amenity)) {
      for (const [lon, lat] of part) {
        if (amenityInsidePlace(lon, lat, placeGeometry)) return true
      }
      for (const ring of place) {
        for (let i = 0; i < part.length - 1; i += 1) {
          const a0 = part[i]!
          const a1 = part[i + 1]!
          for (let j = 0; j < ring.length; j += 1) {
            const b0 = ring[j]!
            const b1 = ring[(j + 1) % ring.length]!
            if (segmentsCross(a0, a1, b0, b1)) return true
          }
        }
      }
    }
    return false
  }
  const amenityRings = outerRings(amenity)
  for (const amenityRing of amenityRings) {
    for (const placeRing of place) {
      if (ringTouchesRing(amenityRing, placeRing)) return true
    }
  }
  return false
}

export function selectParkCandidates(input: {
  grain: PlaceAmenityGrain
  cityName: string
}): CoPark[] {
  const city = input.cityName.trim()
  if (!city) return []
  return CO_PARKS.filter((park) => cityNameMatches(city, park.city)).sort((a, b) => {
    const acres = (b.acres ?? 0) - (a.acres ?? 0)
    if (acres !== 0) return acres
    return a.name.localeCompare(b.name)
  })
}

export function selectTrailCandidates(input: {
  grain: PlaceAmenityGrain
  cityName: string
  citySlug?: string
  communitySlug?: string
}): CoTrail[] {
  const city = input.cityName.trim()
  const citySlug = input.citySlug?.trim()
  const communitySlug = input.communitySlug?.trim()
  return CO_TRAILS.filter((trail) => {
    if (communitySlug && trail.communitySlug?.trim() === communitySlug) return true
    if (city && cityNameMatches(city, trail.city)) return true
    if (citySlug && trail.geoSlug.trim() === citySlug) return true
    return false
  }).sort((a, b) => a.name.localeCompare(b.name))
}

/** Parks whose official polygon is worth fetching (membership + hasPolygon). */
export function parksNeedingGeom(input: {
  grain: PlaceAmenityGrain
  cityName: string
  placeGeometry?: GeoJSON.Geometry | null
}): CoPark[] {
  const local = input.grain !== 'city'
  const placeGeometry = input.placeGeometry ?? null
  if (local && !placeGeometry) return []
  const candidateBox = local ? localAmenityCandidateBbox(placeGeometry) : null
  return selectParkCandidates(input).filter((park) => {
    if (!park.hasPolygon) return false
    if (!local) return true
    if (amenityInsidePlace(park.lng, park.lat, placeGeometry)) return true
    return Boolean(candidateBox && pointInBox(park.lng, park.lat, candidateBox))
  })
}

/** Trails whose official line is worth fetching (membership / communitySlug). */
export function trailsNeedingGeom(input: {
  grain: PlaceAmenityGrain
  cityName: string
  citySlug?: string
  communitySlug?: string
  placeGeometry?: GeoJSON.Geometry | null
}): CoTrail[] {
  const local = input.grain !== 'city'
  const communitySlug = input.communitySlug?.trim()
  const placeGeometry = input.placeGeometry ?? null
  const candidateBox = local ? localAmenityCandidateBbox(placeGeometry) : null
  return selectTrailCandidates(input).filter((trail) => {
    const communityHit = Boolean(communitySlug && trail.communitySlug?.trim() === communitySlug)
    if (communityHit) return true
    if (!local) return true
    if (!placeGeometry) return false
    if (typeof trail.lng !== 'number' || typeof trail.lat !== 'number') return false
    if (amenityInsidePlace(trail.lng, trail.lat, placeGeometry)) return true
    return Boolean(candidateBox && pointInBox(trail.lng, trail.lat, candidateBox))
  })
}

function omit(
  kind: PlaceAmenityOmit['kind'],
  slug: string,
  name: string,
  reason: PlaceAmenityOmitReason,
): PlaceAmenityOmit {
  return { kind, slug, name, reason }
}

export function assembleAmenityLayers(input: {
  grain: PlaceAmenityGrain
  cityName: string
  citySlug?: string
  communitySlug?: string
  placeGeometry?: GeoJSON.Geometry | null
  parkGeom: ReadonlyMap<string, GeoJSON.Polygon | GeoJSON.MultiPolygon | null>
  trailGeom: ReadonlyMap<string, GeoJSON.LineString | GeoJSON.MultiLineString | null>
}): PlaceAmenityLayers {
  const parks: PlaceAmenityPark[] = []
  const trails: PlaceAmenityTrail[] = []
  const omitted: PlaceAmenityOmit[] = []
  const local = input.grain !== 'city'
  const parkCap = local ? LOCAL_PARK_CAP : CITY_PARK_CAP
  const trailCap = local ? LOCAL_TRAIL_CAP : CITY_TRAIL_CAP
  const placeGeometry = input.placeGeometry ?? null
  const communitySlug = input.communitySlug?.trim()
  const candidateBox = local ? localAmenityCandidateBbox(placeGeometry) : null

  if (local && !placeGeometry && !(input.grain === 'community' && communitySlug)) {
    for (const park of selectParkCandidates(input)) {
      omitted.push(omit('park', park.slug, park.name, 'no-place-ring'))
    }
    for (const trail of selectTrailCandidates(input)) {
      const communityHit = Boolean(communitySlug && trail.communitySlug?.trim() === communitySlug)
      omitted.push(omit('trail', trail.slug, trail.name, communityHit ? 'geom-missing' : 'no-place-ring'))
    }
    return { parks, trails, omitted }
  }

  for (const park of selectParkCandidates(input)) {
    if (!park.hasPolygon) {
      omitted.push(omit('park', park.slug, park.name, 'no-polygon-flag'))
      continue
    }
    const geometry = input.parkGeom.get(park.slug)
    const inRing = amenityInsidePlace(park.lng, park.lat, placeGeometry)
    const nearRing = Boolean(candidateBox && pointInBox(park.lng, park.lat, candidateBox))
    const touches = isParkPolygon(geometry) && amenityGeomTouchesPlace(geometry, placeGeometry)
    if (local && !inRing && !touches) {
      if (nearRing && !isParkPolygon(geometry)) {
        omitted.push(omit('park', park.slug, park.name, 'geom-missing'))
        continue
      }
      omitted.push(omit('park', park.slug, park.name, 'outside-place'))
      continue
    }
    if (!isParkPolygon(geometry)) {
      omitted.push(omit('park', park.slug, park.name, 'geom-missing'))
      continue
    }
    if (parks.length >= parkCap) {
      omitted.push(omit('park', park.slug, park.name, 'cap'))
      continue
    }
    parks.push({
      id: `park:${park.slug}`,
      slug: park.slug,
      name: park.name,
      href: `/parks/${park.slug}`,
      geometry,
      source: parkBoundarySource(park),
    })
  }

  for (const trail of selectTrailCandidates(input)) {
    const communityHit = Boolean(communitySlug && trail.communitySlug?.trim() === communitySlug)
    const hasAnchor = typeof trail.lng === 'number' && typeof trail.lat === 'number'
    const geometry = input.trailGeom.get(trail.slug)
    const inRing =
      hasAnchor && amenityInsidePlace(trail.lng as number, trail.lat as number, placeGeometry)
    const nearRing =
      hasAnchor && Boolean(candidateBox && pointInBox(trail.lng as number, trail.lat as number, candidateBox))
    const touches = isTrailLine(geometry) && amenityGeomTouchesPlace(geometry, placeGeometry)
    if (local && !communityHit) {
      if (!placeGeometry) {
        omitted.push(omit('trail', trail.slug, trail.name, 'no-place-ring'))
        continue
      }
      if (!hasAnchor) {
        omitted.push(omit('trail', trail.slug, trail.name, 'no-anchor'))
        continue
      }
      if (!inRing && !touches) {
        if (nearRing && !isTrailLine(geometry)) {
          omitted.push(omit('trail', trail.slug, trail.name, 'geom-missing'))
          continue
        }
        omitted.push(omit('trail', trail.slug, trail.name, 'outside-place'))
        continue
      }
    }
    if (!isTrailLine(geometry)) {
      omitted.push(omit('trail', trail.slug, trail.name, 'geom-missing'))
      continue
    }
    if (trails.length >= trailCap) {
      omitted.push(omit('trail', trail.slug, trail.name, 'cap'))
      continue
    }
    trails.push({
      id: `trail:${trail.slug}`,
      slug: trail.slug,
      name: trail.name,
      href: `/central-oregon/trails/${trail.slug}`,
      geometry,
      source: trailLineSource(trail),
    })
  }

  return { parks, trails, omitted }
}

