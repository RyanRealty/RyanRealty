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

/**
 * The opening camera of the bare /homes-for-sale split view: all of Central
 * Oregon (Matt 2026-09-23). A camera, not a filter. The regional list and pins
 * are the service-area population (lib/search/search-opening.ts), so a home just
 * outside this box still counts and still pins; the box only decides where the
 * map opens.
 *
 * DERIVED, not typed from memory. It is the union of the recorded `boundaries`
 * polygons of every place the site serves, read 2026-09-23 through the
 * boundary_geojson RPC that getBoundaryGeoJSON (lib/data) wraps, and cross-read
 * with one audit query on the same rows (the same 11 city rows came back):
 *
 *   city (TIGER/Line): bend, redmond, sisters, sunriver, la-pine, madras,
 *     prineville, culver, terrebonne, powell-butte (SITE_CITY_SLUGS) + tumalo
 *   neighborhood (resort registry, data/resort-communities.json): tetherow,
 *     broken-top, eagle-crest, pronghorn, caldera-springs, sunriver, awbrey-glen,
 *     northwest-crossing, crosswater, black-butte-ranch, brasada-ranch,
 *     widgi-creek, vandevert-ranch, three-rivers
 *
 * 25 polygons. Union: west -121.6758 (Black Butte Ranch), south 43.6597
 * (La Pine), east -120.8019 (Prineville), north 44.6828 (Madras). The registry
 * places with no polygon row (Crooked River Ranch, Mt Bachelor Village, Inn of
 * the 7th Mountain, River's Edge, Mountain High; Camp Sherman) sit inside it by
 * their registry centers.
 *
 * PADDING 0.10 degrees on every side. The recorded polygons are city limits,
 * and the MLS files rural homes under the nearest city (rural Prineville,
 * La Pine, Madras). Measured the same day through searchListingsAllCount
 * against the 3,282 active service-area homes: the bare union frames 3,036
 * (92.5%), +0.05 frames 3,160 (96.3%), +0.10 frames 3,220 (98.1%, 2
 * out-of-area homes inside), +0.15 frames 3,251 (99.1%, 5), +0.20 frames 3,254
 * (99.1%, 23). The padding only decides the framing, because the population is
 * not cut to the box, so the modest 0.10 opens tight on the towns and still
 * holds 98% of the homes; the far rural edges (Mitchell, Paulina, Post, east
 * Prineville) stay in the count and the list, the camera just opens a little
 * inside them.
 */
export const CENTRAL_OREGON_BOUNDS = {
  west: -121.7758,
  south: 43.5597,
  east: -120.7019,
  north: 44.7828,
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
