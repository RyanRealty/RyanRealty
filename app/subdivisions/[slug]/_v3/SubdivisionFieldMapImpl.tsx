'use client'
// brand-voice:exempt — map chrome only. The one sentence a visitor can read here
// reports a failure and sells nothing.

/**
 * The plat node's Field map. One element filling the frame V3Field reserves,
 * drawing the plat outline and the active single-family listings the list beside
 * it renders.
 *
 * THE BINDING IS THE POINT. `useV3FieldBinding()` is the same state the list
 * owns, so pointing at a row enlarges its pin and pointing at a pin lights its
 * row. PUBLIC_UI.md section 5 allows a motion only when it encodes a state
 * change the visitor caused, and this is that.
 *
 * WHAT IT DRAWS, and nothing else:
 *  - the recorded plat polygon, only when the page passed one. The page decides
 *    whether a boundary exists (getGeoBoundaryMapData); this file draws what it
 *    is handed and invents no geometry.
 *  - one pin per listing that carries coordinates, at the coordinate the feed
 *    reported. A listing without coordinates is listed, never placed.
 *
 * The pin set is deliberately WIDER than the list: the page plots every active
 * single-family listing with coordinates and lists the first 24 of them, which
 * is exactly what the KB dual-pane did. A pin with no row simply never lights
 * one, which is why `pins` carries its own href.
 *
 * NO FORMATTING HAPPENS HERE. `priceLabel` is the identical preformatted string
 * the row shows, so a pin and its row can never round differently.
 *
 * `google.maps.*` is touched only inside callbacks and through the guarded
 * helpers in lib/maps and lib/map-constants, which check the API is present
 * first — the render-time access that once crashed every geo page (ci:maps-safety).
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

/** Zoom used when there is one pin, or nothing at all to fit to. */
const SINGLE_POINT_ZOOM = 15

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

export type SubdivisionFieldPin = {
  /** The V3Field item id when this pin has a row. Shared, which is what binds them. */
  id: string
  /** Where a tap on the pin goes: the same href the row carries. */
  href: string
  /** The already-formatted price, identical to the row's. */
  priceLabel: string
  /** The address the pin stands for, for the marker's accessible title. */
  title: string
  lat: number
  lng: number
}

export function SubdivisionFieldMapImpl({
  pins,
  boundary,
  placeName,
}: {
  pins: readonly SubdivisionFieldPin[]
  /** The recorded plat outline, or undefined when none exists. */
  boundary?: unknown
  /** Names the map for assistive technology. */
  placeName: string
}) {
  const router = useRouter()
  const { ready, error } = useGoogleMapsReady()
  const { activeId, setActiveId } = useV3FieldBinding()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [fitted, setFitted] = useState(false)

  const rings = useMemo(() => toRings(boundary), [boundary])

  // Fit to the plat outline first when there is one — the outline is the subject
  // of this page, and fitting to pins alone would crop a plat whose listings all
  // sit in one corner of it. Falls back to the pins, then to the region centre.
  const fit = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return
      const bounds = new google.maps.LatLngBounds()
      let count = 0
      for (const ring of rings) {
        for (const point of ring) {
          bounds.extend(point)
          count += 1
        }
      }
      if (count === 0) {
        for (const pin of pins) {
          bounds.extend({ lat: pin.lat, lng: pin.lng })
          count += 1
        }
      }
      if (count === 0) {
        map.setCenter(MAP_DEFAULT_CENTER)
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
    [pins, rings],
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      fit(map)
      setFitted(true)
    },
    [fit],
  )

  // Refit when the drawn set changes, never on hover: a refit under the
  // visitor's finger is motion nobody asked for.
  useEffect(() => {
    if (!fitted || !mapRef.current) return
    fit(mapRef.current)
  }, [fit, fitted])

  if (error) {
    return (
      <div style={FILL} role="status">
        The map did not load. The homes are listed beside it.
      </div>
    )
  }
  if (!ready) return <div style={FILL} aria-hidden="true" />

  return (
    <div style={FILL} aria-label={`Map of ${placeName}`} role="application">
      <GoogleMap
        mapContainerStyle={FILL}
        center={MAP_DEFAULT_CENTER}
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
              fillOpacity: 0.1,
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
