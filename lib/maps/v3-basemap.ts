/**
 * lib/maps/v3-basemap.ts — the ONE cartography every public Google map wears.
 *
 * WHY THIS FILE EXISTS. The 2026-09-08 taste table scored /search 32 and
 * /zip/97702 33, and both evaluators named the object TASTE.md bans by example
 * for a data surface: "Not a Google default map." They were right, and the
 * cause was not that nobody had written a style — it was that the style could
 * not be guaranteed. `getSearchMapOptions()` passed `mapId` whenever
 * NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID was set, and Google IGNORES a raster `styles`
 * array next to a `mapId`: the look then lives in a Cloud Console style that
 * has to be attached to the Map ID by hand (docs/MAPS_CLOUD_STYLE.md, step 4).
 * That attachment is not in this repository, cannot be asserted from the
 * client, and on 2026-09-08 was plainly not in force — the shots show Google's
 * terrain greens, tans, road casings and shield icons.
 *
 * So the Map ID path is gone from the public maps. The cartography is a style
 * array that ships in this file, applies on every render, and can be READ by a
 * test. That is the whole trade: we give up vector tiles and
 * AdvancedMarkerElement (the price pills fall back to the OverlayView path that
 * already existed for the no-Map-ID case) and we get a basemap that is ours
 * every time, on every environment, with no console step in the loop.
 *
 * NO MAPBOX. Matt, 2026-06-13 (memory feedback-no-mapbox): one mapping vendor.
 * This is a Google style array on the Google instance, not a second stack.
 *
 * WHAT IT LOOKS LIKE. V3Atlas is the object to copy (TASTE.md: "cream field,
 * navy marks"), so the ladder here is Atlas's own, from
 * reference_atlas_basemap_tiger: primary road navy 34%, secondary 22%, local
 * 10%, water body 12%, town outline 55%, labels navy 70% on a cream halo.
 * Google's style JSON takes opaque colors only, so each rung is the navy
 * composited onto cream at that alpha — computed here from the two brand
 * constants rather than typed as literals, which is why this file holds no hex
 * of its own and why moving --v3-navy moves the entire basemap.
 */
/**
 * The two brand colors as CHANNELS, not hex strings.
 *
 * This module deliberately imports nothing from lib/maps/markers.ts: markers.ts
 * consumes this file's options, and an import in the other direction is a cycle
 * whose loser is whichever module a route happens to enter first (the ladder
 * would be computed against a constant still in its temporal dead zone). Two
 * numeric triples cost nothing and they are pinned to markers.ts's MAP_NAVY /
 * MAP_CREAM by an equality assertion in v3-basemap.test.ts, so a drift is a
 * failing test rather than a quietly different map.
 */
const NAVY_RGB: readonly [number, number, number] = [16, 39, 66]
const CREAM_RGB: readonly [number, number, number] = [250, 248, 244]

/**
 * Navy at `alpha` over cream, as an opaque hex — the rung of the Atlas ladder
 * Google will actually accept. `navyOnCream(1)` is the navy itself.
 */
export function navyOnCream(alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  const mix = NAVY_RGB.map((n, i) =>
    Math.round(CREAM_RGB[i] + (n - CREAM_RGB[i]) * a)
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${mix.join('')}`
}

/**
 * The Atlas ladder, named so a reader (and a test) can say which rung a feature
 * sits on instead of matching a hex.
 */
export const V3_BASEMAP_INK = {
  field: navyOnCream(0),
  park: navyOnCream(0.06),
  roadLocal: navyOnCream(0.1),
  water: navyOnCream(0.12),
  roadArterial: navyOnCream(0.22),
  roadHighway: navyOnCream(0.34),
  labelQuiet: navyOnCream(0.45),
  boundary: navyOnCream(0.55),
  label: navyOnCream(0.7),
} as const

/** Every value the basemap is allowed to paint. The accept test samples against this set. */
export const V3_BASEMAP_PALETTE: readonly string[] = Object.values(V3_BASEMAP_INK)

/**
 * The navy-on-cream basemap. Read top to bottom: everything starts cream, then
 * each feature is given its rung.
 *
 * The three lines that do the most work are the ones that turn things OFF —
 * `labels.icon` (Google's colored highway shields and POI glyphs), `poi`, and
 * `transit`. Those icons are the loudest "this is Google Maps" signal on the
 * canvas and no amount of recoloring survives them.
 */
export const V3_BASEMAP_STYLE: google.maps.MapTypeStyle[] = [
  // The field.
  { elementType: 'geometry', stylers: [{ color: V3_BASEMAP_INK.field }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: V3_BASEMAP_INK.field }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: V3_BASEMAP_INK.field }] },

  // Type: navy on a cream halo, one weight, no colored glyphs anywhere.
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: V3_BASEMAP_INK.label }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: V3_BASEMAP_INK.field }, { weight: 3 }] },

  // Boundaries: the town outline is the strongest line on the field, as in Atlas.
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: V3_BASEMAP_INK.boundary }, { weight: 0.8 }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: V3_BASEMAP_INK.labelQuiet }] },

  // Points of interest: off. A park keeps a faint wash so open ground still reads.
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: V3_BASEMAP_INK.park }] },

  // Roads: fill only, no casing. Three weights, the Atlas ladder.
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: V3_BASEMAP_INK.roadLocal }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: V3_BASEMAP_INK.labelQuiet }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: V3_BASEMAP_INK.roadLocal }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: V3_BASEMAP_INK.roadArterial }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: V3_BASEMAP_INK.roadHighway }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.fill', stylers: [{ color: V3_BASEMAP_INK.roadHighway }] },

  // Transit is somebody else's subject.
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Water: a wash, not a blue. The Deschutes reads as a shape, not a highlight.
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: V3_BASEMAP_INK.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: V3_BASEMAP_INK.labelQuiet }] },
]

/**
 * Every control Google draws for itself, named and switched off. The Google
 * wordmark and the terms links are NOT in this list and never will be: those
 * stay by the Maps terms of service, and hiding them is a licence problem, not
 * a design decision. Everything else — the +/− stack, the Map/Satellite
 * dropdown, Street View, fullscreen, the camera and scale widgets, Google's own
 * keyboard shortcut layer, and the clickable POI hit layer — is ours to own,
 * and on search MapChrome draws the two a person actually needs.
 */
export const V3_MAP_CHROME_OFF = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  rotateControl: false,
  scaleControl: false,
  cameraControl: false,
  keyboardShortcuts: false,
  clickableIcons: false,
} as const

/** Zoom band shared by every public map. 7 is the region, 18 is the lot. */
export const V3_MAP_MIN_ZOOM = 7
export const V3_MAP_MAX_ZOOM = 18

/**
 * The base options for any public Google map. Note what is absent: `mapId`.
 * See the file header — a Map ID silently discards `styles`, and a style we
 * cannot read is a style we cannot promise.
 */
export function getV3MapOptions(overrides?: google.maps.MapOptions): google.maps.MapOptions {
  return {
    ...V3_MAP_CHROME_OFF,
    backgroundColor: V3_BASEMAP_INK.field,
    minZoom: V3_MAP_MIN_ZOOM,
    maxZoom: V3_MAP_MAX_ZOOM,
    styles: V3_BASEMAP_STYLE,
    ...overrides,
  }
}

/* -------------------------------------------------------------------------- */
/* Frame geometry — clustering and the padded fit                              */
/* -------------------------------------------------------------------------- */

/**
 * The widest a price pill gets. "$1.2M" at 12px/700 with 10px of padding and a
 * 1.5px border measures ~58px; the close-zoom photo stamp is 56px. 64 is the
 * number both the cluster radius and the fit padding are derived from, so
 * changing the pill changes the frame in one place.
 */
export const V3_MARK_WIDTH_PX = 64

/**
 * Cluster radius in screen pixels. A pair of marks whose anchors are closer
 * than one mark's width collapses into a badge — which is the whole point of
 * the badge, and the reason the SW Bend stack in the 2026-09-08 shots is gone.
 *
 * Two marks each W wide stop overlapping once their centres are W apart, so the
 * radius is a full mark plus a hair.
 */
export const V3_CLUSTER_RADIUS_PX = V3_MARK_WIDTH_PX + 8

/**
 * Supercluster's tile extent, and it is NOT a detail.
 *
 * Supercluster measures `radius` in units of `extent`, and its default extent
 * is 512 while a Google Maps tile is 256 — so a radius of 60 was merging points
 * only 30 screen pixels apart, which is why price pills 60px wide still stacked
 * after the radius looked generous. Pinning the extent to the tile size makes
 * `radius` mean what it says: screen pixels.
 */
export const V3_CLUSTER_EXTENT = 256

/**
 * Clustering never stops. The old value was 14, which is why every zoom past
 * that painted raw overlapping pills. Supercluster spreads points apart on its
 * own as the zoom climbs, so at street level almost nothing is still merged —
 * but the two homes that share a driveway stay one badge instead of two pills
 * on top of each other.
 */
export const V3_CLUSTER_MAX_ZOOM = V3_MAP_MAX_ZOOM

/**
 * Padding for the opening fitBounds, in pixels, scaled to the frame.
 *
 * The accept test for SITE-44 is that no mark sits within its own width of the
 * edge. A mark is anchored at its centre, so the padding has to clear half the
 * mark PLUS a full mark: 1.5 x V3_MARK_WIDTH_PX = 96. The clamp keeps a phone
 * frame from spending its whole width on margin while still clearing the bar.
 */
export function v3FitPadding(el: { clientWidth: number; clientHeight: number } | null): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const floor = Math.round(V3_MARK_WIDTH_PX * 1.5)
  const w = el?.clientWidth ?? 0
  const h = el?.clientHeight ?? 0
  const side = Math.max(floor, Math.min(128, Math.round(w * 0.24)))
  const vertical = Math.max(floor, Math.min(128, Math.round(h * 0.2)))
  return { top: vertical, right: side, bottom: vertical, left: side }
}
