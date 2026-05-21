'use client'

/**
 * Interactive map of Bend resort + master-planned communities.
 *
 * Uses Google Maps JavaScript API (via @react-google-maps/api) — the same
 * platform every other map on the site renders against. Polygons come from
 * the boundaries table; each polygon is clickable and routes to /lp/<slug>/.
 *
 * API key: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (shared site-wide). If the key
 * is missing the map falls back to a static informational tile.
 */
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useJsApiLoader,
  GoogleMap,
  Polygon,
  OverlayView,
} from '@react-google-maps/api'

export type CommunityPolygon = {
  slug: string
  name: string
  /** Pre-rendered GeoJSON Feature (Polygon or MultiPolygon). */
  geometry: GeoJSON.Geometry
  /** Centroid for label placement. */
  centroid: { lng: number; lat: number }
  /** Visual tier — 'city' = official City of Bend neighborhood (navy),
   *  'community' = outside-city master-planned community (blue). Optional;
   *  defaults to 'city'. */
  tier?: 'city' | 'community' | 'community-overlay'
}

export interface BendInteractiveMapProps {
  /** Polygons to render. */
  communities: CommunityPolygon[]
  /** Map center (Bend downtown default). */
  initialCenter?: { lng: number; lat: number }
  /** Initial zoom. */
  initialZoom?: number
}

const NAVY = '#102742'
const CREAM = '#faf8f4'

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

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

export function BendInteractiveMap({
  communities,
  initialCenter = { lng: -121.32, lat: 44.052 },
  initialZoom = 11.4,
}: BendInteractiveMapProps) {
  const router = useRouter()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  const prepared = useMemo(
    () =>
      communities.map((c) => ({
        slug: c.slug,
        name: c.name,
        centroid: c.centroid,
        paths: geojsonToPaths(c.geometry),
        tier: c.tier ?? 'city',
      })),
    [communities],
  )

  const onPolygonClick = useCallback(
    (slug: string) => {
      router.push(`/lp/${slug}/`)
    },
    [router],
  )

  if (!apiKey) {
    return (
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'rgba(16,39,66,0.06)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: 'rgba(16,39,66,0.62)',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        Interactive map unavailable. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable.
      </div>
    )
  }
  if (loadError) {
    return (
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'rgba(16,39,66,0.06)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(16,39,66,0.62)',
          fontSize: 14,
        }}
      >
        Map failed to load.
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'rgba(16,39,66,0.06)',
          borderRadius: 14,
        }}
        aria-hidden
      />
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16,39,66,0.04), 0 8px 24px rgba(16,39,66,0.1)',
        aspectRatio: '4 / 5',
        minHeight: 560,
      }}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: initialCenter.lat, lng: initialCenter.lng }}
        zoom={initialZoom}
        options={{
          styles: MAP_STYLES,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          backgroundColor: CREAM,
        }}
      >
        {prepared.map((c) => {
          const isHover = hoveredSlug === c.slug
          // Two visual tiers: official City of Bend neighborhoods render navy
          // (the base mesh); resort / master-planned communities outside the
          // city render in a distinct blue so the hierarchy reads clearly.
          const isCommunity = c.tier === 'community'
          const tierColor = isCommunity ? '#1565c0' : NAVY
          return (
            <Polygon
              key={c.slug}
              paths={c.paths}
              options={{
                fillColor: tierColor,
                fillOpacity: isHover ? 0.36 : 0.20,
                strokeColor: tierColor,
                strokeOpacity: 1,
                strokeWeight: isHover ? 3 : isCommunity ? 2 : 1.5,
                clickable: true,
                zIndex: isHover ? 3 : isCommunity ? 2 : 1,
              }}
              onMouseOver={() => setHoveredSlug(c.slug)}
              onMouseOut={() => setHoveredSlug(null)}
              onClick={() => onPolygonClick(c.slug)}
            />
          )
        })}

        {prepared.map((c) => (
          <OverlayView
            key={`label-${c.slug}`}
            position={{ lat: c.centroid.lat, lng: c.centroid.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
          >
            <div
              onMouseOver={() => setHoveredSlug(c.slug)}
              onMouseOut={() => setHoveredSlug(null)}
              onClick={() => onPolygonClick(c.slug)}
              style={{
                fontFamily: 'Geist, system-ui, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.02,
                color: NAVY,
                background: 'rgba(250,248,244,0.92)',
                padding: '3px 8px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                pointerEvents: 'auto',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(16,39,66,0.12)',
                userSelect: 'none',
                transition: 'transform 0.15s, box-shadow 0.15s',
                transform: hoveredSlug === c.slug ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {c.name}
            </div>
          </OverlayView>
        ))}
      </GoogleMap>

      {hoveredSlug && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: NAVY,
            color: CREAM,
            padding: '10px 18px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.02,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(16,39,66,0.2)',
            zIndex: 10,
          }}
        >
          {prepared.find((c) => c.slug === hoveredSlug)?.name}
          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>
            Click to explore
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          background: 'rgba(255,255,255,0.95)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 11,
          color: 'rgba(16,39,66,0.62)',
          fontWeight: 500,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        Click a community to explore →
      </div>
    </div>
  )
}

export default BendInteractiveMap
