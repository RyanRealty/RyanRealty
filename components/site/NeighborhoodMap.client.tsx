'use client'
// brand-voice:exempt — pure UI component, no user-facing prose

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GoogleMap,
  OverlayViewF,
  OVERLAY_MOUSE_TARGET,
  Polygon,
  InfoWindowF,
} from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { cn } from '@/lib/utils'

/**
 * NeighborhoodMap.client — Google Maps implementation for the boundary-map block.
 *
 * Features:
 *   - fitBounds on load: zooms + pans to the polygon bounding box automatically.
 *   - Brand polygon: navy fill 0.08 opacity, navy stroke weight 2 (Design System v2).
 *   - Price-pill markers: Zillow-style navy pill per listing, "$795K" label.
 *     Rendered via OverlayViewF (no Maps cloud MapId required).
 *   - InfoWindow: clicking a pill opens a tiny preview with price + listing link.
 *
 * Data accuracy (CLAUDE.md GIS rule): polygons MUST come from the `boundaries`
 * table via getGeoBoundaryMapData. This component NEVER approximates.
 *
 * Gate G31 enforces that the parent page imports getGeoBoundaryMapData.
 */

const NAVY = '#102742'

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

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
  /** Optional click target. */
  href?: string
  /** Price for the pill label. */
  price?: number | null
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

/** Format a price as a compact pill label. */
function formatPriceLabel(price: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    return '$' + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'
  }
  return '$' + Math.round(price / 1_000) + 'K'
}

// ─── PricePill overlay ────────────────────────────────────────────────────────

type PillProps = {
  pin: MapListingPin
  isSelected: boolean
  onSelect: (pin: MapListingPin | null) => void
}

function PricePill({ pin, isSelected, onSelect }: PillProps) {
  const label = pin.price ? formatPriceLabel(pin.price) : null
  if (!label) return null

  return (
    <OverlayViewF
      position={{ lat: pin.lat, lng: pin.lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect(isSelected ? null : pin)
        }}
        className={cn(
          'flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none shadow-sm transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isSelected
            ? 'scale-110 border-white bg-white text-primary'
            : 'border-white bg-primary text-white',
        )}
        style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        aria-label={'Listing at ' + label}
      >
        {label}
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
  const router = useRouter()
  const { ready, error } = useGoogleMapsReady()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [selectedPin, setSelectedPin] = useState<MapListingPin | null>(null)

  const containerStyle = useMemo(
    () => ({ width: '100%', height: height + 'px' }),
    [height],
  )

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      styles: MAP_STYLES,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'cooperative',
    }),
    [],
  )

  // fitBounds on load — zoom/pan to the polygon bounding box
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      const bounds = computeBounds(polygons)
      if (bounds) {
        map.fitBounds(bounds, 32) // 32px padding
      }
    },
    [polygons],
  )

  const onPolygonClick = useCallback(
    (href: string | undefined) => {
      if (href) router.push(href)
    },
    [router],
  )

  const handleMapClick = useCallback(() => setSelectedPin(null), [])

  // Cap at 150 pins for performance
  const validPins = useMemo(
    () =>
      (listings ?? [])
        .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
        .slice(0, 150),
    [listings],
  )

  if (error || !ready) {
    return (
      <div
        aria-hidden
        style={{ height: height + 'px' }}
        className="animate-pulse rounded-xl border border-border bg-card"
      />
    )
  }

  const hasPriceOnSelected = selectedPin !== null && selectedPin.price !== null && selectedPin.price !== undefined

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
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
                strokeColor: NAVY,
                strokeOpacity: 0.85,
                strokeWeight: 2,
                fillColor: NAVY,
                fillOpacity: 0.08,
                clickable: !!p.href,
              }}
              onClick={() => onPolygonClick(p.href)}
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

        {hasPriceOnSelected && (
          <InfoWindowF
            position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
            onCloseClick={() => setSelectedPin(null)}
            options={{ pixelOffset: new google.maps.Size(0, -20) }}
          >
            <div className="min-w-[120px] text-sm">
              <p
                className="font-semibold text-primary"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPriceLabel(selectedPin.price as number)}
              </p>
              {selectedPin.href ? (
                <a
                  href={selectedPin.href}
                  className="mt-1 block text-xs text-muted-foreground underline hover:text-primary"
                >
                  View listing
                </a>
              ) : null}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  )
}
