'use client'

/**
 * Interactive map of Bend resort + master-planned communities.
 *
 * Renders the polygons from the boundaries table on a Mapbox GL base map.
 * Each polygon is clickable — clicking takes the visitor to /lp/<slug>/.
 * Hovering shows the community name + a brief teaser.
 *
 * The polygons are loaded server-side and handed in as props. Mapbox token
 * is read from NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN. If the token is missing the
 * map falls back to a static informational tile.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl, { type Map as MapboxMap, type GeoJSONSource } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export type CommunityPolygon = {
  slug: string
  name: string
  /** Pre-rendered GeoJSON Feature (Polygon or MultiPolygon). */
  geometry: GeoJSON.Geometry
  /** Centroid for label placement. */
  centroid: { lng: number; lat: number }
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
const NAVY_FILL = 'rgba(16, 39, 66, 0.18)'
const NAVY_HOVER = 'rgba(16, 39, 66, 0.34)'

export function BendInteractiveMap({
  communities,
  initialCenter = { lng: -121.31, lat: 44.05 },
  initialZoom = 10.6,
}: BendInteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const router = useRouter()
  const [hover, setHover] = useState<{ name: string; slug: string } | null>(null)
  const [missingToken, setMissingToken] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!token) {
      setMissingToken(true)
      return
    }
    if (!containerRef.current) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: { compact: true },
    })

    mapRef.current = map

    map.on('load', () => {
      // Single FeatureCollection across all communities — Mapbox handles
      // hit-testing per feature for hover + click.
      const featureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: communities.map((c) => ({
          type: 'Feature',
          properties: { slug: c.slug, name: c.name },
          geometry: c.geometry,
        })),
      }

      map.addSource('communities', {
        type: 'geojson',
        data: featureCollection,
        promoteId: 'slug',
      })

      // Fill layer — dark navy at 18% opacity, brightens on hover.
      map.addLayer({
        id: 'community-fill',
        type: 'fill',
        source: 'communities',
        paint: {
          'fill-color': NAVY,
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.34,
            0.18,
          ],
        },
      })

      // Outline — solid navy, slightly thicker on hover.
      map.addLayer({
        id: 'community-line',
        type: 'line',
        source: 'communities',
        paint: {
          'line-color': NAVY,
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            3,
            1.5,
          ],
        },
      })

      // Centroid label — community name, only visible at zoom >= 10.
      map.addLayer({
        id: 'community-label',
        type: 'symbol',
        source: 'communities',
        layout: {
          'symbol-placement': 'point',
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-letter-spacing': 0.02,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': NAVY,
          'text-halo-color': '#faf8f4',
          'text-halo-width': 2,
        },
      })

      // Hover behavior + cursor.
      let hoveredId: string | null = null

      map.on('mousemove', 'community-fill', (e) => {
        if (!e.features || e.features.length === 0) return
        map.getCanvas().style.cursor = 'pointer'

        const feat = e.features[0]
        const newId = String(feat.id)
        if (hoveredId !== newId) {
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
          }
          hoveredId = newId
          map.setFeatureState({ source: 'communities', id: newId }, { hover: true })
          setHover({
            name: String(feat.properties?.name ?? ''),
            slug: String(feat.properties?.slug ?? ''),
          })
        }
      })

      map.on('mouseleave', 'community-fill', () => {
        map.getCanvas().style.cursor = ''
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
          hoveredId = null
        }
        setHover(null)
      })

      // Click — navigate to community page.
      map.on('click', 'community-fill', (e) => {
        if (!e.features || e.features.length === 0) return
        const slug = e.features[0].properties?.slug
        if (typeof slug === 'string' && slug) {
          router.push(`/lp/${slug}/`)
        }
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [communities, initialCenter.lat, initialCenter.lng, initialZoom, router])

  if (missingToken) {
    return (
      <div
        style={{
          aspectRatio: '16 / 10',
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
        Interactive map unavailable. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,39,66,0.04), 0 8px 24px rgba(16,39,66,0.1)' }}>
      <div ref={containerRef} style={{ width: '100%', aspectRatio: '16 / 10', minHeight: 420 }} />
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: NAVY,
            color: '#faf8f4',
            padding: '10px 18px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.02,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(16,39,66,0.2)',
          }}
        >
          {hover.name}
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
        }}
      >
        Click a community to explore →
      </div>
    </div>
  )
}

export default BendInteractiveMap
