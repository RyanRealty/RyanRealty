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
import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import { useV3FieldBinding } from '@/components/site/v3'
import { fieldMapFit } from './field-map-fit'
import { fieldPinLabelColor, fieldTypeMarkerIcon, fieldTypesFromItems } from './field-map-pin'

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
  typeKey?: string
}

export function PlaceFieldMapImpl({
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
  const { activeId, setActiveId, items } = useV3FieldBinding()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [fitted, setFitted] = useState(false)

  const polygons = useMemo(() => toPolygons(boundary), [boundary])
  const polylines = useMemo(() => toPolylines(boundary), [boundary])
  const listingPins = useMemo(
    () =>
      items.flatMap((item) =>
        typeof item.lat === 'number' && typeof item.lng === 'number'
          ? [
              {
                id: item.id,
                href: item.href,
                priceLabel: item.priceLabel,
                title: item.title,
                lat: item.lat,
                lng: item.lng,
                typeKey: item.typeKey,
              },
            ]
          : [],
      ),
    [items],
  )
  const types = useMemo(() => fieldTypesFromItems(listingPins), [listingPins])

  const fallbackCenter = useMemo(() => {
    if (centerLonLat) return { lat: centerLonLat[1], lng: centerLonLat[0] }
    if (placePin) return { lat: placePin.lat, lng: placePin.lng }
    return MAP_DEFAULT_CENTER
  }, [centerLonLat, placePin])

  const fit = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return
      const target = fieldMapFit({
        polygons,
        pins: listingPins,
        placePin: placePin ?? null,
      })
      if (target.kind === 'empty') {
        map.setCenter(fallbackCenter)
        map.setZoom(SINGLE_POINT_ZOOM)
        return
      }
      if (target.kind === 'single') {
        map.setCenter(target.point)
        map.setZoom(SINGLE_POINT_ZOOM)
        return
      }
      const bounds = new google.maps.LatLngBounds()
      for (const point of target.points) bounds.extend(point)
      map.fitBounds(bounds, 48)
      // Pin-only fits can still open at a regional default. A place polygon
      // already named the viewport; do not pull it wider than the place.
      if (target.kind === 'pins') {
        google.maps.event.addListenerOnce(map, 'idle', () => {
          const z = map.getZoom()
          if (z != null && z < 9) {
            map.setZoom(9)
            map.setCenter(bounds.getCenter())
          }
        })
      }
    },
    [listingPins, placePin, polygons, fallbackCenter],
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
        {listingPins.map((pin) => (
          <Marker
            key={pin.id}
            position={{ lat: pin.lat, lng: pin.lng }}
            title={`${pin.title} · ${pin.priceLabel}`}
            label={
              activeId === pin.id
                ? { text: pin.priceLabel, color: fieldPinLabelColor(), fontSize: '9px', fontWeight: 'bold' }
                : undefined
            }
            icon={fieldTypeMarkerIcon({
              typeKey: pin.typeKey,
              types,
              hover: activeId === pin.id,
            })}
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
