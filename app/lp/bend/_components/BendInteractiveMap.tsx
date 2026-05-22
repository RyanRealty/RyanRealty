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
  GoogleMap,
  Polygon,
  OverlayView,
} from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

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
  // useGoogleMapsReady uses Google's official bootstrap loader
  // (injected once at the root layout by <GoogleMapsBootstrap />).
  // The bootstrap exposes `google.maps.importLibrary(name)`; the
  // hook awaits 'maps' + any extras and flips ready when ready.
  // See lib/use-google-maps-ready.ts.
  const { ready: isLoaded, error: loadError } = useGoogleMapsReady({
    libraries: ['places'],
  })

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'neighborhoods' | 'communities'>('all')

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

  // Filter polygons based on the active view toggle. 'city' tier = official
  // Bend neighborhoods; 'community' / 'community-overlay' = resort + master-
  // planned communities outside city limits.
  const visiblePolygons = useMemo(() => {
    if (viewMode === 'all') return prepared
    if (viewMode === 'neighborhoods') return prepared.filter((c) => c.tier === 'city')
    return prepared.filter((c) => c.tier === 'community' || c.tier === 'community-overlay')
  }, [prepared, viewMode])

  const neighborhoodCount = useMemo(
    () => prepared.filter((c) => c.tier === 'city').length,
    [prepared],
  )
  const communityCount = useMemo(
    () =>
      prepared.filter((c) => c.tier === 'community' || c.tier === 'community-overlay').length,
    [prepared],
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
        {visiblePolygons.map((c) => {
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

        {visiblePolygons.map((c) => (
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

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 999,
          padding: 4,
          boxShadow: '0 1px 2px rgba(16,39,66,0.06), 0 6px 18px rgba(16,39,66,0.14)',
          zIndex: 6,
          fontFamily: 'Geist, system-ui, sans-serif',
        }}
        role="tablist"
        aria-label="Map view"
      >
        {(
          [
            { id: 'all' as const, label: 'All', count: prepared.length },
            { id: 'neighborhoods' as const, label: 'Neighborhoods', count: neighborhoodCount },
            { id: 'communities' as const, label: 'Communities', count: communityCount },
          ]
        ).map((opt) => {
          const active = viewMode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setViewMode(opt.id)}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: 0.02,
                color: active ? CREAM : NAVY,
                background: active ? NAVY : 'transparent',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {opt.label}
              <span
                style={{
                  marginLeft: 6,
                  fontVariantNumeric: 'tabular-nums',
                  opacity: active ? 0.78 : 0.55,
                  fontWeight: 500,
                }}
              >
                {opt.count}
              </span>
            </button>
          )
        })}
      </div>

      {hoveredSlug && (
        <div
          style={{
            position: 'absolute',
            top: 72,
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
