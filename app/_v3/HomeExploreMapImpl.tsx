'use client'
// brand-voice:exempt — map chrome only; failure/wait copy states status.

/**
 * Lightweight Central Oregon Google Map for the homepage.
 * Pins are active listings with list-price labels — no Atlas chrome.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, OverlayView, Polygon } from '@react-google-maps/api'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY } from '@/lib/maps/markers'
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM_REGION } from '@/lib/map-constants'
export type HomeExploreMapPin = {
  id: string
  href: string
  priceLabel: string
  title: string
  lat: number
  lng: number
}

import './home-explore-map.css'

const FILL = { width: '100%', height: '100%' } as const
const MIN_FIT_PX = 64
const FRAME_INSET_PCT = 8

export function HomeExploreMapImpl({
  pins,
  boundary,
}: {
  pins: readonly HomeExploreMapPin[]
  boundary?: unknown
}) {
  const { ready, error } = useGoogleMapsReady()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const polygons = useMemo(() => {
    const g = boundary as { type?: string; coordinates?: unknown } | null
    if (!g || typeof g !== 'object') return [] as google.maps.LatLngLiteral[][]
    if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
      return (g.coordinates as number[][][]).map((ring) =>
        ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })),
      )
    }
    if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      return (g.coordinates as number[][][][]).flatMap((poly) =>
        poly.map((ring) => ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))),
      )
    }
    return []
  }, [boundary])

  const fit = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return
      const el = map.getDiv()
      if (el.clientWidth < MIN_FIT_PX || el.clientHeight < MIN_FIT_PX) return
      const bounds = new google.maps.LatLngBounds()
      let count = 0
      for (const ring of polygons) {
        for (const point of ring) {
          bounds.extend(point)
          count += 1
        }
      }
      if (count === 0) {
        for (const pin of pins) {
          if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue
          bounds.extend({ lat: pin.lat, lng: pin.lng })
          count += 1
        }
      }
      if (count === 0) {
        map.setCenter(MAP_DEFAULT_CENTER)
        map.setZoom(MAP_DEFAULT_ZOOM_REGION)
        return
      }
      if (count === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(12)
        return
      }
      const padX = Math.max(12, Math.round(el.clientWidth * (FRAME_INSET_PCT / 100)))
      const padY = Math.max(12, Math.round(el.clientHeight * (FRAME_INSET_PCT / 100)))
      map.fitBounds(bounds, { top: padY, bottom: padY, left: padX, right: padX })
    },
    [pins, polygons],
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      setMapReady(true)
      fit(map)
    },
    [fit],
  )

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    fit(map)
    const el = map.getDiv()
    const ro = new ResizeObserver(() => fit(map))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, mapReady])

  const mapOptions = useMemo(() => {
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    return {
      ...getExploreMapOptions({ preferMapId: false }),
      center: MAP_DEFAULT_CENTER,
      zoom: MAP_DEFAULT_ZOOM_REGION,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: !coarse,
      cameraControl: false,
      mapTypeControl: false,
      gestureHandling: 'cooperative' as const,
    }
  }, [])

  if (error) {
    return (
      <div className="home-explore-map__status" role="status">
        The map did not load. Browse homes in the list above, or open the full map search.
      </div>
    )
  }
  if (!ready) {
    return <div className="home-explore-map__pending" aria-hidden="true" />
  }

  return (
    <div style={FILL} role="group" aria-label="Map of homes for sale in Central Oregon">
      <GoogleMap
        mapContainerStyle={FILL}
        options={mapOptions}
        onLoad={onLoad}
        onClick={() => setActiveId(null)}
        onUnmount={() => {
          mapRef.current = null
        }}
      >
        {polygons.map((ring, i) => (
          <Polygon
            key={`poly-${i}`}
            paths={ring}
            options={{
              fillColor: MAP_NAVY,
              fillOpacity: 0.08,
              strokeColor: MAP_NAVY,
              strokeWeight: 1.5,
              clickable: false,
            }}
          />
        ))}
        {pins.map((pin) => (
          <OverlayView
            key={pin.id}
            position={{ lat: pin.lat, lng: pin.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <Link
              href={pin.href}
              className={cn('home-explore-map__pin', activeId === pin.id && 'is-active')}
              style={{ left: 0, top: 0 }}
              title={`${pin.title} — ${pin.priceLabel}`}
              aria-label={`${pin.title}, ${pin.priceLabel}, for sale`}
              onMouseEnter={() => setActiveId(pin.id)}
              onClick={(event) => {
                event.stopPropagation()
                setActiveId(pin.id)
              }}
            >
              <span className="home-explore-map__pin-dot" aria-hidden="true" />
              <span className="home-explore-map__pin-label">{pin.priceLabel}</span>
            </Link>
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  )
}
