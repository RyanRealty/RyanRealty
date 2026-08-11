/**
 * Pure lifestyle-near helpers for listing + place pages (Exploration System).
 * Registry math only — no Supabase.
 */

import { findParksNear } from '@/data/co-parks'
import { CO_TRAILS } from '@/data/co-trails'
import { GOLF_COURSES } from '@/data/golf/courses'

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

export type LifestyleNearItem = {
  kind: 'park' | 'trail' | 'golf'
  name: string
  href: string
  distanceMiles: number
  meta?: string
}

export function findTrailsNear(
  lat: number,
  lng: number,
  radiusMiles = 8,
  limit = 4,
): LifestyleNearItem[] {
  return CO_TRAILS.filter((t) => typeof t.lat === 'number' && typeof t.lng === 'number')
    .map((t) => ({
      kind: 'trail' as const,
      name: t.name,
      href: `/central-oregon/trails/${t.slug}`,
      distanceMiles: haversineMiles(lat, lng, t.lat as number, t.lng as number),
      meta: t.use === 'mtb' ? 'Mountain bike' : t.use === 'both' ? 'Hike + bike' : 'Hike',
    }))
    .filter((t) => t.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit)
}

export function findGolfNear(
  lat: number,
  lng: number,
  radiusMiles = 12,
  limit = 4,
): LifestyleNearItem[] {
  return GOLF_COURSES.map((c) => ({
    kind: 'golf' as const,
    name: c.shortName || c.name,
    href: `/central-oregon/golf/${c.slug}`,
    distanceMiles: haversineMiles(lat, lng, c.lat, c.lng),
    meta: `${c.holes} holes · ${c.city}`,
  }))
    .filter((c) => c.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit)
}

export function lifestyleNearLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LifestyleNearItem[] {
  if (typeof lat !== 'number' || typeof lng !== 'number') return []
  const parks = findParksNear(lat, lng, 4, 4).map((p) => ({
    kind: 'park' as const,
    name: p.name,
    href: `/parks/${p.slug}`,
    distanceMiles: p.distanceMiles,
    meta: 'Park',
  }))
  const trails = findTrailsNear(lat, lng, 10, 3)
  const golf = findGolfNear(lat, lng, 15, 3)
  // Interleave kinds so we don't get six parks only — take top by distance overall.
  return [...parks, ...trails, ...golf]
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 8)
}
