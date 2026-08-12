'use client'
// brand-voice:exempt — map chrome only; the two strings a visitor can read here
// state a failure or a wait, and sell nothing.

/**
 * The community node's Field map. One element, filling the frame V3Field gives
 * it, drawing exactly the homes the list beside it renders.
 *
 * THE BINDING IS THE POINT. `useV3FieldBinding()` is the same state the list
 * uses, so pointing at a row enlarges its pin and pointing at a pin lights its
 * row. PUBLIC_UI.md section 5 allows a motion only when it encodes a state change
 * the visitor caused; this is that, and it is the only motion here.
 *
 * WHAT IT DRAWS, and nothing else:
 *  - one pin per item that carries coordinates, at the coordinate the feed
 *    reported. Items without coordinates are not placed, not guessed.
 *  - the community outline, ONLY when the caller passed one. The caller decides
 *    whether a boundary is trustworthy (the oversized-hull rule in the page);
 *    this file draws what it is handed.
 *
 * NO FORMATTING HAPPENS HERE. The price on a pin label is the same preformatted
 * string the row shows, so the pin and the row cannot round differently.
 *
 * `google.maps.*` is touched only through the guarded helpers in lib/maps and
 * lib/map-constants, which check the API is present first — the render-time
 * access that once crashed every geo page at once (ci:maps-safety).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, Polygon } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY } from '@/lib/maps/markers'
import {
  MAP_DEFAULT_CENTER,
  MAP_LABEL_LISTING,
  getListingMarkerIcon,
} from '@/lib/map-constants'
import { useV3FieldBinding } from '@/components/site/v3'

/** Fills the box V3Field reserved. `.v3-field__map > :only-child` sizes it. */
const FILL = { width: '100%', height: '100%' } as const

/** Zoom used when there is one pin, or none and only a registry center. */
const SINGLE_POINT_ZOOM = 14

type Ring = google.maps.LatLngLiteral[]

/** GeoJSON Polygon / MultiPolygon to the ring list Google's Polygon takes. */
function toRings(geometry: unknown): Ring[] {
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

export type CommunityFieldMapPin = {
  /** The V3Field item id. Shared with the row, which is what binds them. */
  id: string
  /** Where a tap on the pin goes: the same href as the row. */
  href: string
  /** The already-formatted price, identical to the row's. */
  priceLabel: string
  /** The address the pin stands for, for the marker's accessible title. */
  title: string
  lat: number
  lng: number
}

export function CommunityFieldMapImpl({
  pins,
  boundary,
  placeName,
  centerLonLat,
}: {
  pins: readonly CommunityFieldMapPin[]
  /** The outline to draw, or null when the caller does not trust one. */
  boundary?: unknown
  /** Names the map for assistive technology. */
  placeName: string
  /** Registry centre, used when there is nothing to fit to. */
  centerLonLat?: readonly [number, number]
}) {
  const router = useRouter()
  const { ready, error } = useGoogleMapsReady()
  const { activeId, setActiveId } = useV3FieldBinding()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [fitted, setFitted] = useState(false)

  const rings = useMemo(() => toRings(boundary), [boundary])

  const fallbackCenter = useMemo(() => {
    if (centerLonLat) return { lat: centerLonLat[1], lng: centerLonLat[0] }
    return MAP_DEFAULT_CENTER
  }, [centerLonLat])

  // Fit to the pins, then to the outline when there are no pins. Runs once per
  // pin set: a refit on every hover would move the map under the visitor's
  // finger, which is motion nobody asked for.
  const fit = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return
      const bounds = new google.maps.LatLngBounds()
      let count = 0
      for (const pin of pins) {
        bounds.extend({ lat: pin.lat, lng: pin.lng })
        count += 1
      }
      if (count === 0) {
        for (const ring of rings) {
          for (const point of ring) {
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
    },
    [pins, rings, fallbackCenter],
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
  if (!ready) return <div style={FILL} aria-hidden="true" />

  return (
    // Named, because the map is an interactive region and V3Field's own label
    // covers the whole section rather than this pane. A group with a name is
    // something a screen-reader user can find and skip; an unnamed div is not.
    <div style={FILL} role="group" aria-label={`Map of homes for sale in ${placeName}`}>
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
        {rings.map((ring, i) => (
          <Polygon
            key={`ring-${i}`}
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
