'use client'

import { useMemo } from 'react'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions } from '@/lib/maps/markers'

/**
 * ListingHeroMap.client — flush Google Map that fills the listing hero band.
 * Shares explore basemap options + static fallback when JS maps fail.
 */

const NAVY = '#102742'
const CREAM = '#faf8f4'

type Props = {
  lat: number
  lng: number
  zoom?: number
}

export default function ListingHeroMapClient({ lat, lng, zoom = 15 }: Props) {
  const { ready, error } = useGoogleMapsReady()

  const containerStyle = useMemo(
    () => ({ width: '100%', height: '100%', minHeight: 200 }),
    [],
  )
  const center = useMemo(() => ({ lat, lng }), [lat, lng])

  const mapOptions = useMemo(
    () => ({
      ...getExploreMapOptions({ preferMapId: false }),
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy' as const,
      clickableIcons: false,
    }),
    [],
  )

  const staticFallback = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
    if (!key) return null
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: String(zoom),
      size: '640x360',
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
        <img src={staticFallback} alt="" className="h-full w-full object-cover" />
      )
    }
    return <div aria-hidden className="h-full w-full" style={{ background: CREAM }} />
  }

  if (!ready) {
    return <div aria-hidden className="h-full w-full animate-pulse" style={{ background: CREAM }} />
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
