'use client'
// brand-voice:exempt — map chrome only; the two strings a visitor can read here
// state a failure or a wait, and sell nothing.

/**
 * Lifestyle place Field map. Google is the geographic frame. Pins are the
 * Field language already locked in V3Field.css (`.v3-field__pin` / label).
 * Fit the place polygon when the caller passed one — do not invent a marker
 * set, and do not leave an ocean of basemap around the boundary.
 *
 * NO FORMATTING HAPPENS HERE. The price on a pin label is the same
 * preformatted string the row shows. Price shows only on the active pin.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, OverlayView, Polygon, Polyline } from '@react-google-maps/api'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY } from '@/lib/maps/markers'
import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import { useV3FieldBinding } from '@/components/site/v3'

const FILL = { width: '100%', height: '100%' } as const
const SINGLE_POINT_ZOOM = 14
/** Same 10% inset the Field plot uses. */
const FRAME_INSET_PCT = 10
/** fitBounds on a 0×0 tile zooms to the world (an ocean of basemap). */
const MIN_FIT_PX = 64

type Ring = google.maps.LatLngLiteral[]

function toPolygons(geometry: unknown): Ring[] {
  const g = geometry as { type?: string; coordinates?: unknown } | null
  if (!g || typeof g !== 'object') return []
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
}

function toPolylines(geometry: unknown): Ring[] {
  const g = geometry as { type?: string; coordinates?: unknown } | null
  if (!g || typeof g !== 'object') return []
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return [
      (g.coordinates as number[][]).map(([lng, lat]) => ({
        lat: Number(lat),
        lng: Number(lng),
      })),
    ]
  }
  if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][]).map((line) =>
      line.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })),
    )
  }
  return []
}

export type PlaceFieldMapPin = {
  id: string
  href: string
  priceLabel: string
  title: string
  lat: number
  lng: number
  /** Same 0–4 mark the Field row carries. Omitting it keeps the pin full navy. */
  cat?: 0 | 1 | 2 | 3 | 4
}

export function PlaceFieldMapImpl({
  pins,
  boundary,
  placeName,
  centerLonLat,
  placePin,
  posterSrc,
}: {
  pins: readonly PlaceFieldMapPin[]
  boundary?: unknown
  placeName: string
  centerLonLat?: readonly [number, number]
  /** Venue, trailhead, or clubhouse. Not a listing. */
  placePin?: { lat: number; lng: number; title: string }
  /** Live listing photograph shown while the map script loads. */
  posterSrc?: string
}) {
  const { ready, error } = useGoogleMapsReady()
  const { activeId, setActiveId } = useV3FieldBinding()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const polygons = useMemo(() => toPolygons(boundary), [boundary])
  const polylines = useMemo(() => toPolylines(boundary), [boundary])

  const fallbackCenter = useMemo(() => {
    if (centerLonLat) return { lat: centerLonLat[1], lng: centerLonLat[0] }
    if (placePin) return { lat: placePin.lat, lng: placePin.lng }
    return MAP_DEFAULT_CENTER
  }, [centerLonLat, placePin])

  const fit = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return
      const el = map.getDiv()
      if (el.clientWidth < MIN_FIT_PX || el.clientHeight < MIN_FIT_PX) return false
      const bounds = new google.maps.LatLngBounds()
      let count = 0
      for (const ring of polygons) {
        for (const point of ring) {
          bounds.extend(point)
          count += 1
        }
      }
      for (const line of polylines) {
        for (const point of line) {
          bounds.extend(point)
          count += 1
        }
      }
      if (count === 0) {
        for (const pin of pins) {
          bounds.extend({ lat: pin.lat, lng: pin.lng })
          count += 1
        }
        if (placePin) {
          bounds.extend({ lat: placePin.lat, lng: placePin.lng })
          count += 1
        }
      }
      if (count === 0) {
        map.setCenter(fallbackCenter)
        map.setZoom(SINGLE_POINT_ZOOM)
        return true
      }
      if (count === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(SINGLE_POINT_ZOOM)
        return true
      }
      const padX = Math.max(12, Math.round(el.clientWidth * (FRAME_INSET_PCT / 100)))
      const padY = Math.max(12, Math.round(el.clientHeight * (FRAME_INSET_PCT / 100)))
      map.fitBounds(bounds, { top: padY, bottom: padY, left: padX, right: padX })
      return true
    },
    [pins, placePin, polygons, polylines, fallbackCenter],
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
    const ro = new ResizeObserver(() => {
      fit(map)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, mapReady])

  if (error) {
    return (
      <div style={FILL} role="status">
        The {placeName} map did not load. The homes are listed beside it.
      </div>
    )
  }
  if (!ready) {
    if (posterSrc) {
      return (
        <img
          className="v3-field__map-poster"
          src={posterSrc}
          alt=""
          width={800}
          height={600}
        />
      )
    }
    return <div className="v3-field__map-pending" aria-hidden="true" />
  }

  return (
    <div style={FILL} role="group" aria-label={`Map of homes for sale near ${placeName}`}>
      <GoogleMap
        mapContainerStyle={FILL}
        options={{
          ...getExploreMapOptions({ preferMapId: false }),
          center: fallbackCenter,
        }}
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
              fillOpacity: 0.12,
              strokeColor: MAP_NAVY,
              strokeWeight: 2,
              clickable: false,
            }}
          />
        ))}
        {polylines.map((path, i) => (
          <Polyline
            key={`line-${i}`}
            path={path}
            options={{
              strokeColor: MAP_NAVY,
              strokeWeight: 3,
              clickable: false,
            }}
          />
        ))}
        {placePin ? (
          <Marker
            position={{ lat: placePin.lat, lng: placePin.lng }}
            title={placePin.title}
            zIndex={50}
          />
        ) : null}
        {pins.map((pin) => (
          <OverlayView
            key={pin.id}
            position={{ lat: pin.lat, lng: pin.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <Link
              href={pin.href}
              className={cn(
                'v3-field__pin',
                pin.cat != null && `v3-field__pin--cat-${pin.cat}`,
                activeId === pin.id && 'is-active',
              )}
              style={{ left: 0, top: 0 }}
              tabIndex={-1}
              aria-hidden="true"
              onMouseEnter={() => setActiveId(pin.id)}
              onClick={(event) => {
                event.stopPropagation()
                setActiveId(pin.id)
              }}
            >
              <span className="v3-field__pin-label">{pin.priceLabel}</span>
            </Link>
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  )
}
