/**
 * Trails and parks depth for place + listing surfaces.
 *
 * Distance, difficulty, overview, features, parking, and practical facts come
 * from the verified registries only. A missing field is omitted — never guessed
 * (CLAUDE.md §0). Nearby math reuses lib/explore/lifestyle-near.
 */

import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import { CO_PARKS, type CoPark, type ParkType } from '@/data/co-parks'
import {
  CO_TRAILS,
  TRAIL_DIFFICULTY_LABEL,
  TRAIL_USE_LABEL,
  type CoTrail,
} from '@/data/co-trails'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'

const PARK_TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

const CITY_CAP = 8
const FEATURE_CAP = 3

export const PLACE_PARKS_TRACE =
  'Named parks from the Central Oregon parks registry, each with a page of its own. Features, parking, and hours print only when the official park page states them.'

export const PLACE_TRAILS_TRACE =
  'Named trails from the Central Oregon trails registry, each with a page of its own. Distance and difficulty print only when the land manager publishes them.'

export const PLACE_NEAR_RECREATION_TRACE =
  'Straight-line distance from this place to the curated Central Oregon parks and trails registry. Trail miles, difficulty, park features, and parking print only when the official source states them.'

function firstSentence(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^.+?[.!?](?:\s|$)/)
  const sentence = (match ? match[0] : trimmed).trim()
  return sentence || null
}

function joinDepth(parts: Array<string | null | undefined>): string | null {
  const kept = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part))
  return kept.length > 0 ? kept.join(' · ') : null
}

export function trailDistanceLabel(trail: CoTrail): string | null {
  if (typeof trail.lengthMiles !== 'number') return null
  const unit = trail.lengthMiles === 1 ? 'mile' : 'miles'
  const note = trail.distanceNote?.trim()
  return note ? `${trail.lengthMiles} ${unit} ${note}` : `${trail.lengthMiles} ${unit}`
}

export function trailDifficultyLabel(trail: CoTrail): string | null {
  return trail.difficulty ? TRAIL_DIFFICULTY_LABEL[trail.difficulty] : null
}

export function trailOverview(trail: CoTrail): string | null {
  return firstSentence(trail.blurb)
}

export function trailDepthLine(trail: CoTrail): string | null {
  return joinDepth([trailDistanceLabel(trail), trailDifficultyLabel(trail), trailOverview(trail)])
}

export function parkFeaturesLine(park: CoPark, limit = FEATURE_CAP): string | null {
  const items = park.amenities.map((item) => item.trim()).filter(Boolean)
  if (items.length === 0) return null
  return items.slice(0, limit).join(', ')
}

export function parkParkingLabel(park: CoPark): string | null {
  if (park.parking?.trim()) return park.parking.trim()
  const fromAmenity = park.amenities.find((item) => /parking/i.test(item))
  return fromAmenity?.trim() || null
}

export function parkPracticalLine(park: CoPark): string | null {
  const acres =
    typeof park.acres === 'number' ? `${park.acres.toLocaleString('en-US')} acres` : null
  return joinDepth([acres, park.hours?.trim(), park.address?.trim()])
}

export function parkDepthLine(park: CoPark): string | null {
  return joinDepth([parkFeaturesLine(park), parkParkingLabel(park), parkPracticalLine(park)])
}

export function parksInCity(cityName: string): CoPark[] {
  const needle = cityName.trim().toLowerCase()
  if (!needle) return []
  return CO_PARKS.filter((park) => park.city.trim().toLowerCase() === needle).sort((a, b) => {
    const acres = (b.acres ?? 0) - (a.acres ?? 0)
    if (acres !== 0) return acres
    return a.name.localeCompare(b.name)
  })
}

export function trailsInCity(cityName: string): CoTrail[] {
  const needle = cityName.trim().toLowerCase()
  if (!needle) return []
  return CO_TRAILS.filter((trail) => trail.city.trim().toLowerCase() === needle).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

export function parkLedgerRows(
  parks: readonly CoPark[],
  options?: { cap?: number; omitHrefs?: ReadonlySet<string> },
): V3LedgerPlainRow[] {
  const cap = options?.cap ?? CITY_CAP
  const omit = options?.omitHrefs
  const rows: V3LedgerPlainRow[] = []
  for (const park of parks) {
    const name = park.name.trim()
    const slug = park.slug.trim()
    if (!name || !slug) continue
    const href = `/parks/${slug}`
    if (omit?.has(href)) continue
    const detail = parkDepthLine(park)
    rows.push({
      href,
      when: v3Text(PARK_TYPE_LABEL[park.type]),
      what: v3Text(name),
      detail: detail ? v3Text(detail) : undefined,
      id: `park-${slug}`,
    })
    if (rows.length >= cap) break
  }
  return rows
}

export function trailLedgerRows(
  trails: readonly CoTrail[],
  options?: { cap?: number; omitHrefs?: ReadonlySet<string> },
): V3LedgerPlainRow[] {
  const cap = options?.cap ?? CITY_CAP
  const omit = options?.omitHrefs
  const rows: V3LedgerPlainRow[] = []
  for (const trail of trails) {
    const name = trail.name.trim()
    const slug = trail.slug.trim()
    if (!name || !slug) continue
    const href = `/central-oregon/trails/${slug}`
    if (omit?.has(href)) continue
    const detail = trailDepthLine(trail)
    rows.push({
      href,
      when: v3Text(TRAIL_USE_LABEL[trail.use]),
      what: v3Text(name),
      detail: detail ? v3Text(detail) : undefined,
      id: `trail-${slug}`,
    })
    if (rows.length >= cap) break
  }
  return rows
}

export function recreationForCity(cityName: string): {
  parks: V3LedgerPlainRow[]
  trails: V3LedgerPlainRow[]
} {
  return {
    parks: parkLedgerRows(parksInCity(cityName)),
    trails: trailLedgerRows(trailsInCity(cityName)),
  }
}

export function recreationNearPoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
  options?: { omitHrefs?: ReadonlySet<string> },
): {
  parks: V3LedgerPlainRow[]
  trails: V3LedgerPlainRow[]
} {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { parks: [], trails: [] }
  }
  const nearbyParks = CO_PARKS.map((park) => ({
    park,
    miles: haversineMiles(lat, lng, park.lat, park.lng),
  }))
    .filter((row) => row.miles <= 4)
    .sort((a, b) => a.miles - b.miles)
    .map((row) => row.park)
  const nearbyTrails = CO_TRAILS.filter(
    (trail) => typeof trail.lat === 'number' && typeof trail.lng === 'number',
  )
    .map((trail) => ({
      trail,
      miles: haversineMiles(lat, lng, trail.lat as number, trail.lng as number),
    }))
    .filter((row) => row.miles <= 10)
    .sort((a, b) => a.miles - b.miles)
    .map((row) => row.trail)
  return {
    parks: parkLedgerRows(nearbyParks, { cap: 6, omitHrefs: options?.omitHrefs }),
    trails: trailLedgerRows(nearbyTrails, { cap: 4, omitHrefs: options?.omitHrefs }),
  }
}

export function trailIndexDetail(trail: CoTrail): string {
  return (
    joinDepth([trail.city, trailDistanceLabel(trail), trailDifficultyLabel(trail)]) ?? trail.city
  )
}

export function parkIndexDetail(park: CoPark): string {
  const type = PARK_TYPE_LABEL[park.type]
  const acres =
    typeof park.acres === 'number' ? `${park.acres.toLocaleString('en-US')} acres` : null
  return joinDepth([type, acres, parkParkingLabel(park), parkFeaturesLine(park, 2)]) ?? type
}

export function enrichLifestyleItem(item: LifestyleNearItem): LifestyleNearItem {
  if (item.kind === 'trail') {
    const slug = item.href.replace('/central-oregon/trails/', '').split('/')[0]
    const trail = slug ? CO_TRAILS.find((row) => row.slug === slug) : undefined
    if (!trail) return item
    return {
      ...item,
      meta: joinDepth([item.meta, trailDistanceLabel(trail), trailDifficultyLabel(trail)]) ?? item.meta,
      overview: trailOverview(trail) ?? undefined,
    }
  }
  if (item.kind === 'park') {
    const slug = item.href.replace('/parks/', '').split('/')[0]
    const park = slug ? CO_PARKS.find((row) => row.slug === slug) : undefined
    if (!park) return item
    return {
      ...item,
      meta:
        joinDepth([item.meta, parkFeaturesLine(park, 2), parkParkingLabel(park)]) ?? item.meta,
      overview: firstSentence(park.blurb) ?? undefined,
    }
  }
  return item
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.7613
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
