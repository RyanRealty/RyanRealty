'use client'

/**
 * Pin + optional neighborhood/subdivision outline for the contact home card.
 * Colors come from admin tokens at runtime so this file stays hex-free.
 */

import { useEffect, useMemo, useState } from 'react'
import { GoogleMap, Marker, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { geojsonToPaths } from '@/lib/maps/geojson-paths'

type Props = {
  lat: number
  lng: number
  boundary: { type: string; coordinates: unknown } | null
  fallbackMapUrl: string | null
  mapsLink: string
  placeLabel: string | null
}

function tokenColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function OwnedHomeMapClient({ lat, lng, boundary, fallbackMapUrl, mapsLink, placeLabel }: Props) {
  const { ready, error } = useGoogleMapsReady()
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [accent, setAccent] = useState('royalblue')

  useEffect(() => {
    setAccent(tokenColor('--a-accent', 'royalblue'))
  }, [])

  const center = useMemo(() => ({ lat, lng }), [lat, lng])
  const paths = useMemo(() => geojsonToPaths(boundary), [boundary])
  const containerStyle = useMemo(() => ({ width: '100%', height: '180px' }), [])

  useEffect(() => {
    if (!map || paths.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(center)
    for (const ring of paths) {
      for (const point of ring) bounds.extend(point)
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, 24)
  }, [map, paths, center])

  const fallback = fallbackMapUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fallbackMapUrl} alt="" className="w-full object-cover" style={{ height: 180 }} />
  ) : (
    <div
      className="flex w-full items-center justify-center"
      style={{
        height: 180,
        background: 'var(--a-inset)',
        color: 'var(--a-text-2)',
        fontSize: 'var(--a-text-xs)',
      }}
    >
      Map unavailable
    </div>
  )

  if (error || !ready) {
    return (
      <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="mt-2 block overflow-hidden rounded-lg">
        {fallback}
      </a>
    )
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg" style={{ border: '1px solid var(--a-border)' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        options={{
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          cameraControl: false,
          zoomControl: false,
          gestureHandling: 'cooperative',
        }}
        onLoad={setMap}
      >
        {paths.length > 0 ? (
          <Polygon
            paths={paths}
            options={{
              strokeColor: accent,
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: accent,
              fillOpacity: 0.12,
            }}
          />
        ) : null}
        <Marker position={center} />
      </GoogleMap>
      {placeLabel ? (
        <p
          className="px-2 py-1"
          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', background: 'var(--a-inset)' }}
        >
          {placeLabel}
        </p>
      ) : null}
    </div>
  )
}
