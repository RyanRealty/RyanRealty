/**
 * Pure lifestyle-near helpers for listing + place pages (Exploration System).
 * Registry math only — no Supabase.
 */

import { findParksNear, type ParkType } from '@/data/co-parks'
import { CO_TRAILS } from '@/data/co-trails'
import { GOLF_COURSES } from '@/data/golf/courses'
import { CO_EVENTS } from '@/data/co-events'

const PARK_META: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
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

export type LifestyleNearItem = {
  kind: 'park' | 'trail' | 'golf' | 'event'
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

export function findEventsNear(
  lat: number,
  lng: number,
  radiusMiles = 20,
  limit = 3,
): LifestyleNearItem[] {
  return CO_EVENTS.filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number')
    .map((e) => ({
      kind: 'event' as const,
      name: e.name,
      href: `/central-oregon/events/${e.slug}`,
      distanceMiles: haversineMiles(lat, lng, e.lat as number, e.lng as number),
      meta: e.category?.replace(/-/g, ' ') ?? 'Event',
    }))
    .filter((e) => e.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit)
}

export type LifestyleNearGroups = {
  parks: LifestyleNearItem[]
  trails: LifestyleNearItem[]
  golf: LifestyleNearItem[]
  events: LifestyleNearItem[]
}

const EMPTY_NEAR: LifestyleNearGroups = {
  parks: [],
  trails: [],
  golf: [],
  events: [],
}

function parkItems(lat: number, lng: number, radiusMiles = 4, limit = 6): LifestyleNearItem[] {
  return findParksNear(lat, lng, radiusMiles, limit).map((p) => ({
    kind: 'park' as const,
    name: p.name,
    href: `/parks/${p.slug}`,
    distanceMiles: p.distanceMiles,
    meta: PARK_META[p.type],
  }))
}

/** Parks, trails, golf, and events as separate nearby groups. */
export function lifestyleNearByKind(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LifestyleNearGroups {
  if (typeof lat !== 'number' || typeof lng !== 'number') return EMPTY_NEAR
  return {
    parks: parkItems(lat, lng, 4, 6),
    trails: findTrailsNear(lat, lng, 10, 4),
    golf: findGolfNear(lat, lng, 15, 3),
    events: findEventsNear(lat, lng, 25, 4),
  }
}

export function lifestyleNearLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LifestyleNearItem[] {
  const groups = lifestyleNearByKind(lat, lng)
  // Interleave kinds so a mixed rail does not show six parks only.
  return [...groups.parks, ...groups.trails, ...groups.golf, ...groups.events]
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 9)
}
