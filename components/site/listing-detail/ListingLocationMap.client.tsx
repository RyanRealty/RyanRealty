'use client'

import { useMemo, useState } from 'react'
import { GoogleMap, Marker, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions } from '@/lib/maps/markers'
import MapListingPopup, { type MapListingPopupData } from '@/components/search/MapListingPopup'

/**
 * ListingLocationMap.client — Google Maps for listing detail location block.
 * Fixed min height so tiles always paint (height:100% alone can init at 0px).
 * Editorial basemap via getExploreMapOptions; Map ID when configured.
 */

const NAVY = '#102742'
const CREAM = '#faf8f4'

type Props = {
  lat: number
  lng: number
  boundary?: GeoJSON.Geometry | null
  zoom?: number
  popup?: MapListingPopupData | null
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

export default function ListingLocationMapClient({ lat, lng, boundary, zoom = 15, popup }: Props) {
  const { ready, error } = useGoogleMapsReady()
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [popupOpen, setPopupOpen] = useState(true)

  // Intrinsic height: clamp from viewport so GoogleMaps never inits at 0px.
  const containerStyle = useMemo(
    () => ({ width: '100%', height: 'min(52vh, 420px)', minHeight: 280 }),
    [],
  )
  const center = useMemo(() => ({ lat, lng }), [lat, lng])

  // preferMapId false: single-pin listing map must always show tiles even if
  // Cloud Map ID is misconfigured; editorial MAP_SEARCH_STYLES still apply.
  const mapOptions = useMemo(
    () => ({
      ...getExploreMapOptions({ preferMapId: false }),
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative' as const,
    }),
    [],
  )

  // Static map fallback when JS maps fail (key, network, bootstrap).
  const staticFallback = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
    if (!key) return null
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: String(zoom),
      size: '800x420',
      scale: '2',
      maptype: 'roadmap',
      markers: `color:0x102742|${lat},${lng}`,
      key,
    })
    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  }, [lat, lng, zoom])

  if (error) {
    if (staticFallback) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticFallback}
          alt="Map of this home"
          className="h-full w-full object-cover"
          style={{ minHeight: 280, border: '3px solid var(--navy)' }}
        />
      )
    }
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm"
        style={{ minHeight: 280, color: 'var(--navy-70)', background: CREAM, border: '3px solid var(--navy)' }}
      >
        Map unavailable right now.
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        aria-hidden
        className="h-full w-full animate-pulse"
        style={{ minHeight: 280, background: CREAM, border: '3px solid var(--navy)' }}
      />
    )
  }

  const paths = boundary ? geojsonToPaths(boundary) : []

  return (
    <div className="h-full w-full overflow-hidden" style={{ minHeight: 280, border: '3px solid var(--navy)' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={setMap}
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
          onClick={() => setPopupOpen(true)}
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
        {map && popup && popupOpen ? (
          <MapListingPopup
            map={map}
            position={center}
            listing={popup}
            onClose={() => setPopupOpen(false)}
          />
        ) : null}
      </GoogleMap>
    </div>
  )
}
