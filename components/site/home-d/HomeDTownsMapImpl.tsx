'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { GoogleMap, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getExploreMapOptions, MAP_NAVY } from '@/lib/maps/markers'
import type { HomeDPolygonFeature } from './types'

const FRAME = { west: -121.95, south: 43.55, east: -120.95, north: 44.55 }

function geojsonToPaths(geo: GeoJSON.Geometry): google.maps.LatLngLiteral[][] {
  if (geo.type === 'Polygon') {
    return (geo.coordinates as number[][][]).map((r) => r.map(([lng, lat]) => ({ lat, lng })))
  }
  if (geo.type === 'MultiPolygon') {
    return (geo.coordinates as number[][][][]).flatMap((p) => p.map((r) => r.map(([lng, lat]) => ({ lat, lng }))))
  }
  return []
}

function inFrame(pt: google.maps.LatLngLiteral) {
  return pt.lng >= FRAME.west && pt.lng <= FRAME.east && pt.lat >= FRAME.south && pt.lat <= FRAME.north
}

function ringCentroid(ring: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral | null {
  const pts = ring.filter(inFrame)
  if (pts.length === 0) return null
  const sum = pts.reduce(
    (acc, pt) => ({ lat: acc.lat + pt.lat, lng: acc.lng + pt.lng }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / pts.length, lng: sum.lng / pts.length }
}

export function HomeDTownsMapImpl({
  polygons,
  activeSlug,
  onActiveSlug,
}: {
  polygons: HomeDPolygonFeature[]
  activeSlug: string | null
  onActiveSlug: (slug: string | null) => void
}) {
  const { ready } = useGoogleMapsReady()
  const mapRef = useRef<google.maps.Map | null>(null)
  const labelRef = useRef<google.maps.Marker | null>(null)

  const rings = useMemo(
    () =>
      polygons.map((p) => ({
        ...p,
        paths: geojsonToPaths(p.geometry),
      })),
    [polygons],
  )

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      ...getExploreMapOptions({ preferMapId: false }),
      scrollwheel: false,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    }),
    [],
  )

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), [])
  const initialView = useMemo(() => ({ center: { lat: 44.1, lng: -121.28 }, zoom: 9 }), [])

  const frameMap = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    let framed = false
    for (const row of rings) {
      for (const path of row.paths) {
        for (const pt of path) {
          if (!inFrame(pt)) continue
          bounds.extend(pt)
          framed = true
        }
      }
    }
    if (framed) map.fitBounds(bounds, 48)
  }, [rings])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      frameMap(map)
    },
    [frameMap],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    labelRef.current?.setMap(null)
    const row = rings.find((r) => r.slug === activeSlug)
    const center = row ? ringCentroid(row.paths[0] ?? []) : null
    if (!row || !center) {
      labelRef.current = null
      return
    }
    const marker = new google.maps.Marker({
      map,
      position: center,
      clickable: false,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
        fillOpacity: 0,
        strokeOpacity: 0,
      },
      label: {
        text: row.name,
        color: MAP_NAVY,
        fontSize: '12px',
        fontWeight: '700',
      },
      title: row.name,
      zIndex: 5,
    })
    labelRef.current = marker
    return () => {
      marker.setMap(null)
    }
  }, [activeSlug, ready, rings])

  if (!ready) {
    return <div className="home-d-towns-map-el animate-pulse bg-card" aria-hidden />
  }

  return (
    <GoogleMap
      mapContainerClassName="home-d-towns-map-el"
      mapContainerStyle={containerStyle}
      center={initialView.center}
      zoom={initialView.zoom}
      options={mapOptions}
      onLoad={onLoad}
    >
      {rings.map((row) => {
        const active = activeSlug === row.slug
        return (
          <Polygon
            key={row.slug}
            paths={row.paths}
            options={{
              strokeColor: MAP_NAVY,
              strokeOpacity: active ? 0.95 : 0.5,
              strokeWeight: active ? 2.25 : 1.25,
              fillColor: MAP_NAVY,
              fillOpacity: active ? 0.32 : 0.07,
              clickable: true,
              zIndex: active ? 3 : 1,
            }}
            onClick={() => onActiveSlug(row.slug)}
            onMouseOver={() => onActiveSlug(row.slug)}
          />
        )
      })}
    </GoogleMap>
  )
}
