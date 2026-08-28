'use client'
// brand-voice:exempt — map chrome only; the two strings a visitor can read here
// state a failure or a wait, and sell nothing.

/**
 * Lifestyle place Field map. One element, filling the frame V3Field gives it,
 * drawing exactly the homes the list beside it renders, plus an optional
 * boundary the caller already decided is trustworthy.
 *
 * Polygons fill. LineStrings (trail route linework) stroke only. A place pin
 * marks the venue, trailhead, or clubhouse so it is not mistaken for a listing.
 *
 * NO FORMATTING HAPPENS HERE. The price on a pin label is the same preformatted
 * string the row shows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, Polygon, Polyline } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY } from '@/lib/maps/markers'
import {
  MAP_DEFAULT_CENTER,
  MAP_LABEL_LISTING,
  getListingMarkerIcon,
} from '@/lib/map-constants'
import { useV3FieldBinding } from '@/components/site/v3'

const FILL = { width: '100%', height: '100%' } as const
const SINGLE_POINT_ZOOM = 14

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
  const router = useRouter()
  const { ready, error } = useGoogleMapsReady()
  const { activeId, setActiveId } = useV3FieldBinding()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [fitted, setFitted] = useState(false)

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
      const bounds = new google.maps.LatLngBounds()
      let count = 0
      for (const pin of pins) {
        bounds.extend({ lat: pin.lat, lng: pin.lng })
        count += 1
      }
      if (placePin) {
        bounds.extend({ lat: placePin.lat, lng: placePin.lng })
        count += 1
      }
      if (count === 0) {
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
      }
      if (count === 0) {
        map.setCenter(fallbackCenter)
        map.setZoom(SINGLE_POINT_ZOOM)
        return
      }
      if (count === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(SINGLE_POINT_ZOOM)
        return
      }
      map.fitBounds(bounds, 48)
      // Frame floor (Matt 2026-08-27): a region-wide pin set in a small box
      // fit out to half of Oregon — Salem to Roseburg on a phone — with every
      // pin in one unreadable clump. Central Oregon at 390px is legible from
      // zoom 9; never present wider than the service area.
      google.maps.event.addListenerOnce(map, 'idle', () => {
        const z = map.getZoom()
        if (z != null && z < 9) {
          map.setZoom(9)
          map.setCenter(bounds.getCenter())
        }
      })
    },
    [pins, placePin, polygons, polylines, fallbackCenter],
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      fit(map)
      setFitted(true)
    },
    [fit],
  )

  useEffect(() => {
    if (!fitted || !mapRef.current) return
    fit(mapRef.current)
  }, [fit, fitted])

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
        center={fallbackCenter}
        zoom={SINGLE_POINT_ZOOM}
        options={getExploreMapOptions({ preferMapId: false })}
        onLoad={onLoad}
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
          <Marker
            key={pin.id}
            position={{ lat: pin.lat, lng: pin.lng }}
            title={`${pin.title} · ${pin.priceLabel}`}
            label={{ text: pin.priceLabel, ...MAP_LABEL_LISTING }}
            icon={getListingMarkerIcon({ hover: activeId === pin.id })}
            zIndex={activeId === pin.id ? 100 : 1}
            onMouseOver={() => setActiveId(pin.id)}
            onMouseOut={() => setActiveId(null)}
            onClick={() => router.push(pin.href)}
          />
        ))}
      </GoogleMap>
    </div>
  )
}
