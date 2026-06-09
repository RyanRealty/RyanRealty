'use client'
// brand-voice:exempt — pure UI component, no user-facing prose

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  GoogleMap,
  OverlayViewF,
  OVERLAY_MOUSE_TARGET,
  Polygon,
  InfoWindowF,
} from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import {
  formatPriceLabel,
  buildInfoWindowHTML,
  getBaseMapOptions,
  MAP_BOUNDARY_STYLES,
  MAP_NAVY,
} from '@/lib/maps/markers'
import { isInsideAnyRing } from '@/lib/map-polygon'
import { cn } from '@/lib/utils'

/**
 * NeighborhoodMap.client — Google Maps implementation for the boundary-map block.
 *
 * Features:
 *   - fitBounds on load: zooms + pans to the polygon bounding box automatically.
 *   - Brand polygon: navy fill 0.08 opacity, navy stroke weight 2 (Design System v2).
 *   - Price-pill markers: navy pill per listing, "$795K" label, matching all other
 *     map surfaces site-wide. Rendered via OverlayViewF (no Maps cloud MapId required).
 *   - InfoWindow: clicking a pill opens a shared preview card (photo, price, address,
 *     beds/baths, link) from lib/maps/markers.ts, identical to search and listing maps.
 *
 * Data accuracy (CLAUDE.md GIS rule): polygons MUST come from the `boundaries`
 * table via getGeoBoundaryMapData. This component NEVER approximates.
 *
 * Gate G31 enforces that the parent page imports getGeoBoundaryMapData.
 */

export type NeighborhoodPolygon = {
  slug: string
  name: string
  /** Pre-rendered GeoJSON Feature (Polygon or MultiPolygon) from boundaries. */
  geometry: GeoJSON.Geometry
  /** Click target for the polygon. When present, clicks navigate; otherwise informational. */
  href?: string
}

/** A single listing pin to render on the map. */
export type MapListingPin = {
  lat: number
  lng: number
  /** Optional click target (full URL or path). */
  href?: string
  /** Price for the pill label. */
  price?: number | null
  // Extended listing data for the shared InfoWindow card.
  photoURL?: string | null
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  bedroomsTotal?: number | null
  bathroomsTotal?: number | null
  sqft?: number | null
}

type Props = {
  polygons: ReadonlyArray<NeighborhoodPolygon>
  listings?: ReadonlyArray<MapListingPin>
  center?: { lng: number; lat: number }
  zoom?: number
  height?: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function geojsonToPaths(geo: GeoJSON.Geometry): google.maps.LatLngLiteral[][] {
  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng })),
    )
  }
  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][][]).flatMap((poly) =>
      poly.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
    )
  }
  return []
}

/** Compute the bounding box of all polygon coordinates. */
function computeBounds(
  polygons: ReadonlyArray<NeighborhoodPolygon>,
): google.maps.LatLngBoundsLiteral | null {
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  let hasPoints = false

  for (const poly of polygons) {
    const paths = geojsonToPaths(poly.geometry)
    for (const ring of paths) {
      for (const pt of ring) {
        hasPoints = true
        if (pt.lat < minLat) minLat = pt.lat
        if (pt.lat > maxLat) maxLat = pt.lat
        if (pt.lng < minLng) minLng = pt.lng
        if (pt.lng > maxLng) maxLng = pt.lng
      }
    }
  }

  if (!hasPoints) return null
  return { south: minLat, north: maxLat, west: minLng, east: maxLng }
}

// ─── PricePill overlay ────────────────────────────────────────────────────────

type PillProps = {
  pin: MapListingPin
  isSelected: boolean
  onSelect: (pin: MapListingPin | null) => void
}

/**
 * Navy price-pill overlay matching the SVG price-pill markers on the search map.
 * Uses CSS classes because OverlayViewF renders inside the React tree (Tailwind applies).
 * Color classes reference design tokens (bg-primary, text-white) which resolve to
 * the same navy/white as the SVG markers built in lib/maps/markers.ts.
 */
function PricePill({ pin, isSelected, onSelect }: PillProps) {
  const label = pin.price ? formatPriceLabel(pin.price) : null
  if (!label) return null

  return (
    <OverlayViewF
      position={{ lat: pin.lat, lng: pin.lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h })}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect(isSelected ? null : pin)
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full border-2 border-white px-2.5 py-1 text-xs font-semibold leading-none shadow-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isSelected
            ? 'scale-110 border-white bg-white text-primary'
            : 'bg-primary text-white',
        )}
        style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        aria-label={'Listing at ' + label}
      >
        {label}
        {/* Caret pointing down, matching the SVG price-pill anchor style */}
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-[7px] left-1/2 -translate-x-1/2 border-4 border-transparent border-t-4',
            isSelected ? 'border-t-white' : 'border-t-primary',
          )}
          style={{ borderTopWidth: 7, borderLeftWidth: 5, borderRightWidth: 5 }}
        />
      </button>
    </OverlayViewF>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function NeighborhoodMapClient({
  polygons,
  listings,
  center = { lng: -121.32, lat: 44.052 },
  zoom = 11,
  height = 480,
}: Props) {
  const { ready, error } = useGoogleMapsReady()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [selectedPin, setSelectedPin] = useState<MapListingPin | null>(null)

  // Compute the initial center+zoom ONCE (lazy useState initializer -> stable
  // references for the component's life). Why this matters: the parent passes a
  // fresh `polygons` array each render and `center` defaults to a new object
  // literal, so a center computed inline would change identity every render.
  // @react-google-maps/api treats `center`/`zoom` as controlled props and
  // re-applies them on any identity change — which would clobber the fitBounds
  // call in onLoad and leave the map zoomed out (the polygon never frames).
  // Stable refs here mean the library applies them only on first paint; the
  // onLoad fitBounds then owns the final frame and survives every re-render.
  const [initialView] = useState(() => {
    const b = computeBounds(polygons)
    const c = b
      ? { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 }
      : center
    return { center: c, zoom }
  })

  const containerStyle = useMemo(
    () => ({ width: '100%', height: height + 'px' }),
    [height],
  )

  // Boundary map context: suppress POI labels, hide type control and fullscreen
  // so the polygon is the focus. Gesture handling is cooperative (page stays
  // scrollable). Zoom and street view match all other map surfaces.
  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      ...getBaseMapOptions(),
      styles: MAP_BOUNDARY_STYLES,
      mapTypeControl: false,
      fullscreenControl: false,
    }),
    [],
  )

  // fitBounds on load — frame the POLYGON, not the listing pins.
  // Using 48px padding on all sides gives the polygon a comfortable margin
  // inside the map viewport. Pins live spatially inside the polygon so they
  // are always visible after the polygon is framed.
  // We store the bounds and call fitBounds once the map has a size; calling
  // it a second time via a zero-timeout flush handles cases where the map
  // container size resolves slightly late (dynamic import / SSR hydration).
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      const bounds = computeBounds(polygons)
      if (bounds) {
        const padding = { top: 48, right: 48, bottom: 48, left: 48 }
        map.fitBounds(bounds, padding)
        // Flush a second fit on the next tick so the bounds apply after the
        // map container has fully painted its dimensions. Without this, a
        // small community polygon can render off-centre on first load.
        setTimeout(() => {
          if (mapRef.current) mapRef.current.fitBounds(bounds, padding)
        }, 0)
      }
    },
    [polygons],
  )

  const handleMapClick = useCallback(() => setSelectedPin(null), [])

  // Boundary rings (outer + any holes), flattened across every polygon.
  const boundaryRings = useMemo(
    () => polygons.flatMap((p) => geojsonToPaths(p.geometry)),
    [polygons],
  )

  // Clip pins to the rendered boundary so homes never show OUTSIDE the polygon
  // (Matt: "the homes listed are well outside the polygon"). The
  // listings_in_boundary RPC already spatial-filters, but this guarantees the
  // pins match the EXACT polygon drawn here — any RPC/geometry drift is corrected
  // client-side against the same paths. No polygon -> show all. Cap 150 for perf.
  const validPins = useMemo(() => {
    const coords = (listings ?? []).filter(
      (l) => typeof l.lat === 'number' && typeof l.lng === 'number',
    )
    return coords
      .filter((l) => isInsideAnyRing({ lat: l.lat, lng: l.lng }, boundaryRings))
      .slice(0, 150)
  }, [listings, boundaryRings])

  if (error || !ready) {
    return (
      <div
        aria-hidden
        style={{ height: height + 'px' }}
        className="animate-pulse rounded-xl border border-border bg-card"
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        // Stable initial center/zoom (computed once). fitBounds() in onLoad
        // frames the polygon exactly and — because these props no longer change
        // identity on re-render — is not clobbered afterward.
        center={initialView.center}
        zoom={initialView.zoom}
        options={mapOptions}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
      >
        {polygons.map((p) => {
          const paths = geojsonToPaths(p.geometry)
          if (paths.length === 0) return null
          return (
            <Polygon
              key={p.slug}
              paths={paths}
              options={{
                strokeColor: MAP_NAVY,
                strokeOpacity: 0.95,
                strokeWeight: 3,
                fillColor: MAP_NAVY,
                fillOpacity: 0.1,
                clickable: !!p.href,
                zIndex: 1,
              }}
              onClick={() => {
                if (p.href) window.location.href = p.href
              }}
            />
          )
        })}

        {validPins.map((pin, i) => (
          <PricePill
            key={pin.lat + '-' + pin.lng + '-' + i}
            pin={pin}
            isSelected={selectedPin === pin}
            onSelect={setSelectedPin}
          />
        ))}

        {selectedPin !== null && selectedPin.price != null && (
          <InfoWindowF
            position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
            onCloseClick={() => setSelectedPin(null)}
            options={{ pixelOffset: new google.maps.Size(0, -24), maxWidth: 260 }}
          >
            {/* Inline styles required: Google InfoWindow renders in an isolated
                DOM context. All styles come from buildInfoWindowHTML in lib/maps/markers.ts. */}
            <div
              dangerouslySetInnerHTML={{
                __html: buildInfoWindowHTML({
                  price: selectedPin.price,
                  photoURL: selectedPin.photoURL ?? null,
                  streetNumber: selectedPin.streetNumber ?? null,
                  streetName: selectedPin.streetName ?? null,
                  city: selectedPin.city ?? null,
                  state: selectedPin.state ?? null,
                  postalCode: selectedPin.postalCode ?? null,
                  bedroomsTotal: selectedPin.bedroomsTotal ?? null,
                  bathroomsTotal: selectedPin.bathroomsTotal ?? null,
                  sqft: selectedPin.sqft ?? null,
                  href: selectedPin.href ?? '#',
                }),
              }}
            />
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  )
}
