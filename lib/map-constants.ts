/**
 * Shared map configuration: primary city pins, marker icons, and label styles.
 * Use everywhere (search map, listing map, community map, etc.) so icons and labels look the same.
 */

/** Brand navy for primary UI; listing map markers use teal for visibility and to avoid red. */
export const MAP_COLOR_LISTING = '#102742'

/** Color for listing pins on map (teal accent — small markers, not red). */
export const MAP_COLOR_LISTING_PIN = '#0d9488'

/** Accent/teal for "this" or highlighted marker when needed. */
export const MAP_COLOR_ACCENT = '#0d9488'

/** City pin color (distinct from listing dots so primary cities are recognizable). */
export const MAP_COLOR_CITY_PIN = '#0d9488'

export const MAP_STROKE_WHITE = '#ffffff'
export const MAP_STROKE_WEIGHT = 2

/** Primary Central Oregon cities with coordinates for map pins. Order matches PRIMARY_CITIES. */
export type CityPin = { name: string; slug: string; lat: number; lng: number }

export const PRIMARY_CITY_PINS: CityPin[] = [
  { name: 'Bend', slug: 'bend', lat: 44.0582, lng: -121.3153 },
  { name: 'Redmond', slug: 'redmond', lat: 44.2726, lng: -121.1739 },
  { name: 'La Pine', slug: 'la-pine', lat: 43.6704, lng: -121.5036 },
  { name: 'Sisters', slug: 'sisters', lat: 44.2912, lng: -121.5492 },
  { name: 'Sunriver', slug: 'sunriver', lat: 43.884, lng: -121.4386 },
  { name: 'Tumalo', slug: 'tumalo', lat: 44.1498, lng: -121.3309 },
  { name: 'Crooked River Ranch', slug: 'crooked-river-ranch', lat: 44.41, lng: -121.0 },
  { name: 'Prineville', slug: 'prineville', lat: 44.299, lng: -120.8345 },
  { name: 'Madras', slug: 'madras', lat: 44.6335, lng: -121.1295 },
]

/** Default map center when showing all primary cities (Central Oregon). */
export const MAP_DEFAULT_CENTER = { lat: 44.0582, lng: -121.3153 } as const
export const MAP_DEFAULT_ZOOM_REGION = 9
export const MAP_DEFAULT_ZOOM_CITY = 10

/** Approximate viewport bounds for Bend, OR (for initial home-page map load). */
export const BEND_DEFAULT_BOUNDS = {
  west: -121.42,
  south: 43.92,
  east: -121.15,
  north: 44.25,
} as const

/** Icon spec for listing marker (small circle, teal, white stroke). Same on every map. Call when google.maps is loaded. */
export function getListingMarkerIcon(opts?: { scale?: number; hover?: boolean }): {
  path: number
  scale: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
} {
  const scale = opts?.hover ? 6 : opts?.scale ?? 4
  return {
    path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
    scale,
    fillColor: MAP_COLOR_LISTING_PIN,
    fillOpacity: 1,
    strokeColor: MAP_STROKE_WHITE,
    strokeWeight: MAP_STROKE_WEIGHT,
  }
}

/** Icon spec for city pin (circle, teal, white stroke). Same on every map. Call when google.maps is loaded. */
export function getCityPinIcon(opts?: { scale?: number }): {
  path: number
  scale: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
} {
  return {
    path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
    scale: opts?.scale ?? 10,
    fillColor: MAP_COLOR_CITY_PIN,
    fillOpacity: 1,
    strokeColor: MAP_STROKE_WHITE,
    strokeWeight: MAP_STROKE_WEIGHT,
  }
}

/** Label style for listing markers (price). Small so many markers fit. Same on every map. */
export const MAP_LABEL_LISTING = {
  color: 'white',
  fontSize: '9px',
  fontWeight: 'bold',
} as const

/** Label style for city pins (city name). Same on every map. */
export const MAP_LABEL_CITY = {
  color: 'white',
  fontSize: '11px',
  fontWeight: 'bold',
} as const
