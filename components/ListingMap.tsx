'use client'

import { useRef, useMemo, useCallback } from 'react'
import Map, { Source, Layer, NavigationControl } from 'react-map-gl'
import type { MapRef } from 'react-map-gl'
import type { FeatureCollection, Point } from 'geojson'
import 'mapbox-gl/dist/mapbox-gl.css'

const BEND_CENTER = { latitude: 44.0582, longitude: -121.3153, zoom: 10 }

export type MapCenter = { latitude: number; longitude: number; zoom?: number }

type ListingMapProps = {
  listings: any[]
  /** When true, always use Bend as initial view (e.g. homepage). */
  centerOnBend?: boolean
  /** When provided (e.g. city/subdivision page), map opens centered here so the area and listings are visible. */
  initialCenter?: MapCenter | null
}

export default function ListingMap({ listings, centerOnBend, initialCenter }: ListingMapProps) {
  const mapRef = useRef<MapRef>(null)
  const validListings = listings.filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude)))

  const geojson: FeatureCollection<Point> = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: validListings.map((l, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(l.Longitude), Number(l.Latitude)] },
        properties: { id: l.ListingKey ?? l.ListNumber ?? i, price: Number(l.ListPrice) ?? 0 },
      })),
    }),
    [validListings]
  )

  const initialViewState = useMemo(() => {
    if (centerOnBend) return BEND_CENTER
    if (initialCenter && Number.isFinite(initialCenter.latitude) && Number.isFinite(initialCenter.longitude)) {
      return {
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
        zoom: initialCenter.zoom ?? 11,
      }
    }
    if (validListings.length === 0) return BEND_CENTER
    if (validListings.length === 1) {
      return {
        latitude: Number(validListings[0].Latitude),
        longitude: Number(validListings[0].Longitude),
        zoom: 14,
      }
    }
    return { ...BEND_CENTER, zoom: 10 }
  }, [validListings, centerOnBend, initialCenter])

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.on('click', 'clusters', (e) => {
      const feature = e.features?.[0]
      if (!feature?.properties?.cluster_id) return
      const clusterId = feature.properties.cluster_id
      const source = map.getSource('listings') as { getClusterExpansionZoom?: (id: number, cb: (err: Error | null, zoom?: number) => void) => void }
      if (!source?.getClusterExpansionZoom) return
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        const coords = (feature.geometry as Point).coordinates
        map.easeTo({ center: [coords[0], coords[1]], zoom })
      })
    })
  }, [])

  if (validListings.length === 0) {
    const emptyView = initialCenter && Number.isFinite(initialCenter.latitude) && Number.isFinite(initialCenter.longitude)
      ? { latitude: initialCenter.latitude, longitude: initialCenter.longitude, zoom: initialCenter.zoom ?? 11 }
      : BEND_CENTER
    return (
      <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
        <Map
          ref={mapRef}
          initialViewState={emptyView}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        >
          <NavigationControl position="top-right" />
        </Map>
      </div>
    )
  }

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        onLoad={onLoad}
      >
        <NavigationControl position="top-right" />
        <Source
          id="listings"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': ['step', ['get', 'point_count'], '#0d9488', 10, '#0f766e', 30, '#115e59'],
              'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 30, 36],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 13,
            }}
            paint={{ 'text-color': '#fff' }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': '#0d9488',
              'circle-radius': 8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            }}
          />
        </Source>
      </Map>
    </div>
  )
}
