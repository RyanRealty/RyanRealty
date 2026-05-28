'use client'

import { useMemo } from 'react'
import { GoogleMap, Marker, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

/**
 * ListingLocationMap.client — actual Google Maps implementation for
 * the Layer 4 ListingLocationMap block. 21:9 aspect ratio. Single
 * marker on the listing's lat/lng plus an optional subdivision /
 * neighborhood polygon overlay.
 *
 * Loaded via next/dynamic from the server-safe wrapper at
 * ListingLocationMap.tsx so the @react-google-maps/api bundle only
 * ships on the listing-detail route.
 */

const NAVY = '#102742'
const CREAM = '#faf8f4'

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

type Props = {
  lat: number
  lng: number
  boundary?: GeoJSON.Geometry | null
  zoom?: number
}

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

export default function ListingLocationMapClient({ lat, lng, boundary, zoom = 14 }: Props) {
  const { ready, error } = useGoogleMapsReady()

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), [])
  const center = useMemo(() => ({ lat, lng }), [lat, lng])

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      styles: MAP_STYLES,
      streetViewControl: true,
      mapTypeControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    }),
    [],
  )

  if (error || !ready) {
    return (
      <div
        aria-hidden
        className="h-full w-full animate-pulse rounded-[14px] border border-border bg-card"
      />
    )
  }

  const paths = boundary ? geojsonToPaths(boundary) : []

  return (
    <div className="h-full w-full overflow-hidden rounded-[14px] border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
      >
        {paths.length > 0 ? (
          <Polygon
            paths={paths}
            options={{
              strokeColor: NAVY,
              strokeOpacity: 0.85,
              strokeWeight: 1.5,
              fillColor: CREAM,
              fillOpacity: 0.15,
              clickable: false,
            }}
          />
        ) : null}
        <Marker
          position={center}
          icon={{
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: NAVY,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.6,
            anchor: new google.maps.Point(12, 22),
          }}
        />
      </GoogleMap>
    </div>
  )
}
