/**
 * Pure helpers for the subdivision explore stack.
 * Keeps app/subdivisions/[slug]/page.tsx under the file-size budget.
 * Plat live figures go through publishPlatFigures — do not fetch parent pulse here.
 */

import { listingDetailPath, slugify } from '@/lib/slug'
import resortCommunitiesData from '@/data/resort-communities.json'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import { lifestyleNearLatLng, type LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import type { KbTownItem } from '@/components/site/kb/types'

type ResortEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases: string[]
}

export function peerPlatsForResort(
  resortSlug: string | null,
  selfSlug: string,
): KbTownItem[] {
  if (!resortSlug) return []
  const entry = (resortCommunitiesData as { communities: ResortEntry[] }).communities.find(
    (c) => c.slug === resortSlug,
  )
  if (!entry) return []
  return entry.subdivision_aliases
    .filter((a) => slugify(a) !== selfSlug)
    .slice(0, 12)
    .map((a) => ({
      name: a,
      href: `/subdivisions/${slugify(a)}`,
      activeCount: -1,
      medianPrice: null,
      img: '',
    }))
}

export function mapCentroid(
  tiles: Array<{ lat?: number | null; lng?: number | null }>,
): { lat: number; lng: number } | null {
  const pinCoords = tiles.filter(
    (t): t is { lat: number; lng: number } =>
      typeof t.lat === 'number' && typeof t.lng === 'number',
  )
  if (pinCoords.length === 0) return null
  return {
    lat: pinCoords.reduce((s, t) => s + t.lat, 0) / pinCoords.length,
    lng: pinCoords.reduce((s, t) => s + t.lng, 0) / pinCoords.length,
  }
}

export function subdivisionPlaceContext(input: {
  cityName: string
  citySlug: string | null
  displayName: string
  slug: string
}): PlaceContext {
  return resolvePlaceContextFromListing({
    city: input.cityName !== 'Central Oregon' ? input.cityName : null,
    citySlug: input.citySlug,
    subdivisionName: input.displayName,
    subdivisionSlug: input.slug,
  })
}

export function lifestyleForCentroid(
  centroid: { lat: number; lng: number } | null,
): LifestyleNearItem[] {
  if (!centroid) return []
  return lifestyleNearLatLng(centroid.lat, centroid.lng)
}

/**
 * City-scale inventory is a preview. Pass this cap from the city page only.
 * Community / neighborhood / plat pages list the counted set — a silent 24-row
 * slice is what made /communities/tetherow print 35 and show 19 listing doors
 * (fleet a1851580, 2026-08-16).
 */
export const CITY_PLACE_LIST_CAP = 24

/** Dual-pane list rows from map tiles. Default is the full counted set. */
export function splitRowsFromTiles(
  mapTiles: Array<{
    listingKey: string
    listNumber?: string | null
    listPrice: number | null
    beds: number | null
    baths: number | null
    streetNumber: string | null
    streetName: string | null
    streetSuffix?: string | null
    city: string | null
    subdivisionName: string | null
    photoUrl: string | null
    lat: number | null
    lng: number | null
  }>,
  options?: { cap?: number },
) {
  const rows = [...mapTiles]
    .filter((t) => Boolean(t.listingKey))
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .map((t) => {
      const street = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
      return {
        key: t.listingKey,
        href: listingDetailPath(
          t.listingKey,
          { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city },
          { city: t.city, subdivision: t.subdivisionName },
          { mlsNumber: t.listNumber },
        ),
        title: street || 'Listing',
        subtitle: [t.beds != null ? `${t.beds} bd` : null, t.baths != null ? `${t.baths} ba` : null]
          .filter(Boolean)
          .join(' · '),
        price: t.listPrice,
        photoUrl: t.photoUrl,
        lat: t.lat,
        lng: t.lng,
      }
    })
  return options?.cap != null ? rows.slice(0, options.cap) : rows
}

