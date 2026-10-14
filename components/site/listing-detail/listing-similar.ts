/**
 * Similar homes on a listing page: the same relatedHomes ranking, mapped onto
 * V3ListingRow, capped as a rail. Not a poster grid.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import type { V3ListingRowData } from '@/components/site/v3'
import { pointInRings, type Ring } from '@/lib/geo/project-svg'
import { listingTileHref } from '@/lib/slug'
import { listingMlsStreetLine, publishCardAddress } from '@/lib/listing/publish-street-line'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'

export const SIMILAR_RAIL_CAP = 6

export function listingTileToRow(tile: ListingTile): V3ListingRowData {
  const street = listingMlsStreetLine(tile)
  const cityLine = [tile.city, tile.subdivisionName && tile.subdivisionName !== 'N/A' ? tile.subdivisionName : null]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(' · ')
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl,
    price: tile.listPrice,
    addressLine: street || publishCardAddress(tile) || 'Address available on request',
    cityLine: cityLine || 'Central Oregon',
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    pricePerSqft: tile.pricePerSqft,
    propertyType: tile.propertyType,
    propertySubType: tile.propertySubType,
    subdivisionName: tile.subdivisionName,
    city: tile.city,
    listNumber: tile.listNumber,
    tourUrl: tile.tourUrl,
    hasTour: tile.hasVirtualTour === true || !!tile.tourUrl,
  }
}

export function listingSimilarRail(tiles: readonly ListingTile[], cap = SIMILAR_RAIL_CAP): V3ListingRowData[] {
  return tiles.slice(0, cap).map(listingTileToRow)
}

const ACTIVE = new Set<string>(PUBLIC_ACTIVE_STATUSES)

/** Nearby homes a reader can still buy. Closed comparables are not an onward path. */
export function listingSimilarActive(tiles: readonly ListingTile[]): ListingTile[] {
  return tiles.filter((tile) => ACTIVE.has(tile.status))
}

export type ListingMapPin = { lat: number; lng: number }

/** Homes farther than this are another town, not this subdivision. */
export const HERO_MAP_NEARBY_MILES = 0.75

/**
 * A subdivision outline wider than this is the wrong polygon (a city or a
 * neighborhood). The hero map does not frame it.
 */
export const HERO_MAP_FRAME_MAX_MILES = 4

export type ListingHeroMapFrame = {
  lat: number
  lng: number
  rings?: readonly Ring[]
}

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Keep a subdivision outline only when it is actually subdivision-sized. */
export function listingHeroSubdivisionRings(rings: readonly Ring[] | null | undefined): Ring[] {
  if (!rings || rings.length === 0) return []
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(maxLat)) return []
  const span = milesBetween(minLat, minLng, maxLat, maxLng)
  if (span <= 0 || span > HERO_MAP_FRAME_MAX_MILES) return []
  return [...rings]
}

/** Active nearby homes that can take a pin. A missing coordinate is not a pin. */
export function listingHeroMapPins(
  tiles: readonly ListingTile[],
  frame?: ListingHeroMapFrame,
): ListingMapPin[] {
  const rings =
    frame && frame.rings && frame.rings.length > 0 ? listingHeroSubdivisionRings(frame.rings) : []
  const pins: ListingMapPin[] = []
  const seen = new Set<string>()
  for (const tile of listingSimilarActive(tiles)) {
    if (tile.lat == null || tile.lng == null) continue
    if (!Number.isFinite(tile.lat) || !Number.isFinite(tile.lng)) continue
    if (rings.length > 0) {
      if (!pointInRings(tile.lng, tile.lat, rings)) continue
    } else if (frame && Number.isFinite(frame.lat) && Number.isFinite(frame.lng)) {
      if (milesBetween(frame.lat, frame.lng, tile.lat, tile.lng) > HERO_MAP_NEARBY_MILES) continue
    }
    const key = `${tile.lat.toFixed(5)},${tile.lng.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    pins.push({ lat: tile.lat, lng: tile.lng })
  }
  return pins
}

function haystack(tile: ListingTile): string[] {
  // ListingTile carries the neighborhood as boundaryNeighborhood only — the
  // neighborhoodName field lives on a different type in the same module.
  return [tile.subdivisionName, tile.boundarySubdivision, tile.boundaryNeighborhood]
    .filter((s): s is string => !!s && s.trim().length > 0 && s !== 'N/A')
    .map((s) => s.trim().toLowerCase())
}

/** Keep tiles that sit in the named place. Do not pad with another city. */
export function listingSimilarInPlace(
  tiles: readonly ListingTile[],
  placeNames: readonly string[],
): ListingTile[] {
  const needles = placeNames
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n.length >= 4 && n !== 'bend' && n !== 'redmond' && n !== 'sisters')
  if (needles.length === 0) return [...tiles]
  return tiles.filter((tile) => {
    const hay = haystack(tile)
    return needles.some((n) => hay.some((h) => h === n || h.includes(n) || n.includes(h)))
  })
}

export function listingSimilarDedupe(tiles: readonly ListingTile[]): ListingTile[] {
  const seen = new Set<string>()
  const out: ListingTile[] = []
  for (const tile of tiles) {
    const street = listingMlsStreetLine(tile).trim().toLowerCase()
    const key = street.length > 0 ? `st:${street}` : tile.listingKey
    if (seen.has(key) || seen.has(tile.listingKey)) continue
    seen.add(key)
    seen.add(tile.listingKey)
    out.push(tile)
  }
  return out
}
