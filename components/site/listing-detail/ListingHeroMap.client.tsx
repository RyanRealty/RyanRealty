'use client'

import { useMemo } from 'react'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

/**
 * ListingHeroMap.client — flush Google Map that fills the listing hero band.
 * Same Maps stack as ListingLocationMap.client (bootstrap + useGoogleMapsReady).
 * Hex literals are required for Google Maps marker/style APIs.
 */

const NAVY = '#102742'

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

type Props = {
  lat: number
  lng: number
  zoom?: number
}

export default function ListingHeroMapClient({ lat, lng, zoom = 15 }: Props) {
  const { ready, error } = useGoogleMapsReady()

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), [])
  const center = useMemo(() => ({ lat, lng }), [lat, lng])

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      styles: MAP_STYLES,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
      disableDefaultUI: false,
      clickableIcons: false,
    }),
    [],
  )

  if (error || !ready) {
    return (
      <div
        aria-hidden
        className="h-full w-full animate-pulse bg-muted"
      />
    )
  }

  return (
    <div className="h-full w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
      >
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
