/**
 * Place-homes Atlas amenity layers (SITE-128 craft #2).
 *
 * Parks and trails on V3Atlas come from geometry we already hold:
 *   - park polygons: public.boundaries via boundary_geojson (geo_type=park)
 *   - trail lines: public.trail_lines via trail_line_geojson
 *   - membership: registry city / communitySlug, or a registry centroid /
 *     trailhead inside the place's recorded ring
 *
 * Registry lat/lng is membership only. It is never buffered, circled, or
 * turned into a corridor. Missing official geometry is omitted — never
 * invented, never crowd-sourced street-map geometry.
 *
 * Do not twin lib/site/place-recreation.ts (facts / ledger depth).
 */

import { CO_PARKS, type CoPark } from '@/data/co-parks'
import { CO_TRAILS, type CoTrail } from '@/data/co-trails'
import { outerRings, pointInRings } from '@/lib/geo/project-svg'

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
  return selectParkCandidates(input).filter((park) => {
    if (!park.hasPolygon) return false
    if (local && !amenityInsidePlace(park.lng, park.lat, placeGeometry)) return false
    return true
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
  return selectTrailCandidates(input).filter((trail) => {
    const communityHit = Boolean(communitySlug && trail.communitySlug?.trim() === communitySlug)
    if (local && !communityHit) {
      if (!placeGeometry) return false
      if (typeof trail.lng !== 'number' || typeof trail.lat !== 'number') return false
      if (!amenityInsidePlace(trail.lng, trail.lat, placeGeometry)) return false
    }
    return true
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
    if (local && !amenityInsidePlace(park.lng, park.lat, placeGeometry)) {
      omitted.push(omit('park', park.slug, park.name, 'outside-place'))
      continue
    }
    const geometry = input.parkGeom.get(park.slug)
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
    if (local && !communityHit) {
      if (!placeGeometry) {
        omitted.push(omit('trail', trail.slug, trail.name, 'no-place-ring'))
        continue
      }
      if (!hasAnchor) {
        omitted.push(omit('trail', trail.slug, trail.name, 'no-anchor'))
        continue
      }
      if (!amenityInsidePlace(trail.lng as number, trail.lat as number, placeGeometry)) {
        omitted.push(omit('trail', trail.slug, trail.name, 'outside-place'))
        continue
      }
    }
    const geometry = input.trailGeom.get(trail.slug)
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

