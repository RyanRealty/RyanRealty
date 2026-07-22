import { displaySubdivision } from '@/lib/slug'

/**
 * Geo-scope handling for the split (map) search view.
 *
 * A search URL can pin the query to a place — city, subdivision, or zip. That
 * pin is honest only while the map still shows that place. The moment the user
 * moves the map (pan, zoom, re-center) or draws an area, the viewport query
 * must become pure bounding-box: keeping an invisible `city=Bend` filter while
 * the map sits over Redmond returns zero rows with a misleading empty state
 * (W4.2 audit finding, 2026-07-21).
 *
 * Until the first user move, the scope is VISIBLE as a chip on the map with a
 * clear-on-tap affordance — no silent filters either way.
 */

/** The filter keys that pin a search to a place. */
export const GEO_SCOPE_KEYS = ['city', 'subdivision', 'postalCode'] as const

export type GeoScopeKey = (typeof GEO_SCOPE_KEYS)[number]

type GeoScoped = Partial<Record<GeoScopeKey, unknown>>

/**
 * Return a copy of `filters` with every geo-scope key removed so the viewport
 * query is pure bounding-box. Non-geo filters (price, beds, amenities,
 * keywords, status, sort, …) are untouched.
 */
export function stripGeoScope<T extends GeoScoped>(filters: T): T {
  return {
    ...filters,
    city: undefined,
    subdivision: undefined,
    postalCode: undefined,
  }
}

/**
 * Human label for the active geo scope, or null when the search has none.
 * Subdivision reads through displaySubdivision so MLS "no subdivision"
 * sentinels (N/A, None, ***) never render as a place name.
 */
export function geoScopeLabel(filters: {
  city?: string | null
  subdivision?: string | null
  postalCode?: string | null
}): string | null {
  const subdivision = filters.subdivision?.trim()
    ? displaySubdivision(filters.subdivision)
    : null
  const parts = [subdivision, filters.city?.trim() || null, filters.postalCode?.trim() || null].filter(
    (p): p is string => Boolean(p)
  )
  if (parts.length === 0) return null
  return parts.join(' · ')
}
