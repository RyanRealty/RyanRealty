'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleMap, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

/**
 * NeighborhoodMap.client — actual Google Maps implementation for the
 * Layer 3 NeighborhoodMap block. Loaded via next/dynamic from the
 * server-safe wrapper at components/site/NeighborhoodMap.tsx so the
 * `@react-google-maps/api` bundle does not weigh down first paint on
 * routes that do not render a map.
 *
 * Per CLAUDE.md GIS rule: polygons MUST come from authoritative sources
 * (City of Bend GIS / Deschutes County DIAL / Oregon GEO / Census
 * TIGER). Callers fetch from the `boundaries` table; this component
 * never approximates.
 *
 * Visual: navy stroke + cream fill at low opacity, no POI labels, no
 * transit overlay. Click on a polygon routes to its `href`.
 */

const NAVY = '#102742'
const CREAM = '#faf8f4'

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

export type NeighborhoodPolygon = {
  slug: string
  name: string
  /** Pre-rendered GeoJSON Feature (Polygon or MultiPolygon) from boundaries. */
  geometry: GeoJSON.Geometry
  /** Click target for the polygon. When present, clicks navigate; otherwise the polygon is informational. */
  href?: string
}

type Props = {
  polygons: ReadonlyArray<NeighborhoodPolygon>
  /** Map center. Defaults to downtown Bend. */
  center?: { lng: number; lat: number }
  /** Initial zoom. Default 11. */
  zoom?: number
  /** Map container height in px. Default 480. */
  height?: number
}

function geojsonToPaths(geo: GeoJSON.Geometry): google.maps.LatLngLiteral[][] {
  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng })),
    )
  }
  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][][]).flatMap((poly) =>
      poly.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
    )
  }
  return []
}

export default function NeighborhoodMapClient({
  polygons,
  center = { lng: -121.32, lat: 44.052 },
  zoom = 11,
  height = 480,
}: Props) {
  const router = useRouter()
  const { ready, error } = useGoogleMapsReady()

  const containerStyle = useMemo(
    () => ({ width: '100%', height: `${height}px` }),
    [height],
  )

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      styles: MAP_STYLES,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'cooperative',
    }),
    [],
  )

  const onPolygonClick = useCallback(
    (href: string | undefined) => {
      if (href) router.push(href)
    },
    [router],
  )

  if (error || !ready) {
    return (
      <div
        aria-hidden
        style={{ height: `${height}px` }}
        className="bg-card rounded-[14px] border border-border animate-pulse"
      />
    )
  }

  return (
    <div className="rounded-[14px] overflow-hidden border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
      >
        {polygons.map((p) => {
          const paths = geojsonToPaths(p.geometry)
          if (paths.length === 0) return null
          return (
            <Polygon
              key={p.slug}
              paths={paths}
              options={{
                strokeColor: NAVY,
                strokeOpacity: 0.85,
                strokeWeight: 1.5,
                fillColor: CREAM,
                fillOpacity: p.href ? 0.18 : 0.08,
                clickable: !!p.href,
              }}
              onClick={() => onPolygonClick(p.href)}
            />
          )
        })}
      </GoogleMap>
    </div>
  )
}
