'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { GoogleMap, InfoWindow, Polygon } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { useRouter } from 'next/navigation'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

import { MAP_DEFAULT_CENTER, getListingMarkerIcon, MAP_LABEL_LISTING, MAP_COLOR_LISTING_PIN } from '@/lib/map-constants'
import { listingDetailPath } from '@/lib/slug'
import type { MapPolygonPoint } from '@/lib/map-polygon'
import { Button } from "@/components/ui/button"

type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] | number[][] }
type GeoJSONMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }

function geojsonToPaths(geo: unknown): { lat: number; lng: number }[][] {
  const g = geo as GeoJSONPolygon | GeoJSONMultiPolygon | null
  if (!g || typeof g !== 'object') return []
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const first = g.coordinates[0]
    if (Array.isArray(first) && first.length > 0) {
      const ring = Array.isArray(first[0]) ? (first as number[][]) : (g.coordinates as number[][])
      return [ring.map((c) => ({ lng: c[0], lat: c[1] }))]
    }
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    return g.coordinates.flatMap((poly) => {
      const ring = poly[0]
      return [ring.map((c) => ({ lng: c[0], lat: c[1] }))]
    })
  }
  return []
}

export type ListingForMap = {
  Latitude: number | null
  Longitude: number | null
  ListingKey?: string | null
  ListNumber?: string | number | null
  ListPrice?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  /** Hero photo for the marker popup card. */
  PhotoURL?: string | null
  /** Living area for the marker popup card. */
  TotalLivingAreaSqFt?: number | null
  /** When true, marker label shows "video" instead of "showcase". */
  hasVideo?: boolean
}

function getBounds(listings: ListingForMap[]) {
  const valid = listings.filter(
    (l) =>
      l.Latitude != null &&
      l.Longitude != null &&
      Number.isFinite(Number(l.Latitude)) &&
      Number.isFinite(Number(l.Longitude))
  )
  if (valid.length === 0) return null
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  for (const l of valid) {
    const lat = Number(l.Latitude)
    const lng = Number(l.Longitude)
    minLat = Math.min(minLat, lat)
    minLng = Math.min(minLng, lng)
    maxLat = Math.max(maxLat, lat)
    maxLng = Math.max(maxLng, lng)
  }
  return { minLng, minLat, maxLng, maxLat } as const
}

function priceLabel(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2)}M`
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}k`
  return `$${price}`
}

export type MapBounds = { west: number; south: number; east: number; north: number }

type Props = {
  listings: ListingForMap[]
  savedListingKeys?: string[]
  likedListingKeys?: string[]
  className?: string
  onMarkerClick?: (listingKey: string) => void
  /** When set, fit map to this place (e.g. "Bend Oregon", "Tetherow Bend") via Google Places for boundary/context. */
  placeQuery?: string | null
  /** When no listings, use this center (e.g. Bend). Defaults to MAP_DEFAULT_CENTER. */
  initialCenter?: { lat: number; lng: number } | null
  /** When no listings, use this zoom. Defaults to 11. */
  initialZoom?: number
  /** Called when map is ready or viewport bounds change (debounced). Use for bounds-driven listing fetch. */
  onBoundsChanged?: (bounds: MapBounds) => void
  /** Optional GeoJSON boundary (Polygon/MultiPolygon) to draw for city/neighborhood/community. */
  boundaryGeojson?: unknown
  /** Called when user draws a polygon on the map. Returns the polygon path for filtering. */
  onPolygonDrawn?: (polygon: MapPolygonPoint[] | null) => void
  /** Initial polygon to render (e.g. from URL saved search). */
  initialPolygon?: MapPolygonPoint[] | null
  /** List↔map hover sync: the listing key currently hovered in the list (highlights its marker). */
  hoveredKey?: string | null
  /** List↔map hover sync: fired when the user hovers/unhovers a marker (null on mouseout). */
  onMarkerHover?: (listingKey: string | null) => void
}

export default function SearchMapClustered({
  listings,
  savedListingKeys = [],
  likedListingKeys = [],
  className = '',
  onMarkerClick,
  placeQuery,
  initialCenter = null,
  initialZoom = 11,
  onBoundsChanged,
  boundaryGeojson,
  onPolygonDrawn,
  initialPolygon,
  hoveredKey = null,
  onMarkerHover,
}: Props) {
  const router = useRouter()
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const markersByKeyRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const placeViewportRef = useRef<google.maps.LatLngBounds | null>(null)
  const [placeViewport, setPlaceViewport] = useState<google.maps.LatLngBounds | null>(null)
  const [showBoundary, setShowBoundary] = useState(true)
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<MapPolygonPoint[]>([])
  const [activePolygon, setActivePolygon] = useState<MapPolygonPoint[] | null>(initialPolygon ?? null)
  const [openInfo, setOpenInfo] = useState<{
    listingKey: string
    position: { lat: number; lng: number }
    listing: ListingForMap & { Latitude: number; Longitude: number }
  } | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { ready: isLoaded, error: loadError } = useGoogleMapsReady({
    libraries: ['places'],
  })

  const validListings = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.Latitude != null &&
          l.Longitude != null &&
          Number.isFinite(Number(l.Latitude)) &&
          Number.isFinite(Number(l.Longitude))
      ) as (ListingForMap & { Latitude: number; Longitude: number })[],
    [listings]
  )

  const bounds = useMemo(() => getBounds(validListings), [validListings])

  const defaultCenter = initialCenter ?? MAP_DEFAULT_CENTER
  const defaultZoom = initialZoom ?? 11
  const center = useMemo(() => {
    if (validListings.length === 0) return defaultCenter
    if (validListings.length === 1)
      return { lat: validListings[0].Latitude, lng: validListings[0].Longitude }
    if (bounds)
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      }
    return defaultCenter
  }, [validListings, bounds, defaultCenter])

  const zoom = useMemo(() => {
    if (validListings.length === 0) return defaultZoom
    if (validListings.length === 1) return 14
    return 11
  }, [validListings.length, defaultZoom])

  const savedSet = useMemo(
    () => new Set([...savedListingKeys, ...likedListingKeys]),
    [savedListingKeys, likedListingKeys]
  )

  const boundaryPaths = useMemo(() => geojsonToPaths(boundaryGeojson), [boundaryGeojson])

  useEffect(() => {
    setActivePolygon(initialPolygon && initialPolygon.length >= 3 ? initialPolygon : null)
  }, [initialPolygon])

  const reportBounds = useCallback(() => {
    const map = mapRef.current
    if (!map || !onBoundsChanged) return
    const b = map.getBounds()
    if (!b) return
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    onBoundsChanged({
      west: sw.lng(),
      south: sw.lat(),
      east: ne.lng(),
      north: ne.lat(),
    })
  }, [onBoundsChanged])

  const recenterMap = useCallback(() => {
    const map = mapRef.current
    const viewport = placeViewportRef.current
    if (!map || !viewport) return
    setShowBoundary(true)
    map.fitBounds(viewport, { top: 48, right: 48, bottom: 48, left: 48 })
    if (onBoundsChanged) setTimeout(reportBounds, 300)
  }, [onBoundsChanged, reportBounds])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      const padding = { top: 48, right: 48, bottom: 48, left: 48 }
      if (placeQuery?.trim() && window.google?.maps?.places) {
        const service = new window.google.maps.places.PlacesService(map)
        service.findPlaceFromQuery(
          { query: placeQuery.trim(), fields: ['geometry'] },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.viewport) {
              const viewport = results[0].geometry!.viewport!
              placeViewportRef.current = viewport
              setPlaceViewport(viewport)
              map.fitBounds(viewport, padding)
              const zoom = map.getZoom()
              if (typeof zoom === 'number' && zoom < 12) map.setZoom(12)
            } else if (validListings.length > 0 && bounds) {
              const b = new google.maps.LatLngBounds(
                { lat: bounds.minLat, lng: bounds.minLng },
                { lat: bounds.maxLat, lng: bounds.maxLng }
              )
              map.fitBounds(b, padding)
            }
            if (onBoundsChanged) setTimeout(reportBounds, 300)
          }
        )
        } else if (validListings.length > 0 && bounds) {
        const b = new google.maps.LatLngBounds(
          { lat: bounds.minLat, lng: bounds.minLng },
          { lat: bounds.maxLat, lng: bounds.maxLng }
        )
        map.fitBounds(b, padding)
        const zoom = map.getZoom()
        if (typeof zoom === 'number' && zoom < 12) map.setZoom(12)
        if (onBoundsChanged) setTimeout(reportBounds, 300)
      } else if (onBoundsChanged) {
        reportBounds()
      }
    },
    [validListings.length, bounds, placeQuery, onBoundsChanged, reportBounds]
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !onBoundsChanged) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    const onIdle = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(reportBounds, 200)
    }
    let listener: google.maps.MapsEventListener | null = null
    try {
      listener = map.addListener('idle', onIdle)
    } catch {
      return
    }
    return () => {
      if (timeout) clearTimeout(timeout)
      try {
        listener?.remove?.()
      } catch {
        // ignore if map/DOM already gone
      }
    }
  }, [isLoaded, onBoundsChanged, reportBounds])

  // Create markers and clusterer when map and listings are ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google || validListings.length === 0) return

    // Clear previous clusterer and markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current = null
    }
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    markersByKeyRef.current = new Map()

    const newMarkers: google.maps.Marker[] = validListings.map((l, i) => {
      const listingKey = (l.ListNumber ?? l.ListingKey ?? `point-${i}`).toString()
      const price = Number(l.ListPrice ?? 0)
      const label = priceLabel(price)
      const isSaved = savedSet.has(listingKey)
      const hasVideo = Boolean(l.hasVideo)
      const markerLabel = [label, hasVideo ? 'video' : null, isSaved ? '♥' : null].filter(Boolean).join(' · ')

      const marker = new google.maps.Marker({
        position: { lat: l.Latitude, lng: l.Longitude },
        map,
        label: { text: markerLabel, ...MAP_LABEL_LISTING },
        icon: getListingMarkerIcon(),
      })

      marker.addListener('click', () => {
        setOpenInfo((prev) =>
          prev?.listingKey === listingKey
            ? null
            : {
                listingKey,
                position: { lat: l.Latitude, lng: l.Longitude },
                listing: l,
              }
        )
        onMarkerClick?.(listingKey)
      })

      if (onMarkerHover) {
        marker.addListener('mouseover', () => onMarkerHover(listingKey))
        marker.addListener('mouseout', () => onMarkerHover(null))
      }

      markersByKeyRef.current.set(listingKey, marker)
      return marker
    })

    markersRef.current = newMarkers
    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      renderer: {
        render: (cluster, _stats, map) => {
          const count = cluster.count
          const position = cluster.position
          return new google.maps.Marker({
            position,
            map,
            label: { text: String(count), color: 'white', fontSize: '12px', fontWeight: 'bold' },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: MAP_COLOR_LISTING_PIN,
              fillOpacity: 0.9,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          })
        },
      },
    })

    return () => {
      try {
        newMarkers.forEach((m) => {
          try {
            m.setMap(null)
          } catch {
            // ignore if marker DOM is already gone
          }
        })
        if (clustererRef.current) {
          try {
            clustererRef.current.clearMarkers()
          } catch {
            // ignore parentNode etc. if map container was already unmounted
          }
          clustererRef.current = null
        }
      } catch {
        // guard against "Cannot read properties of null (reading 'parentNode')" on unmount
      }
    }
  }, [isLoaded, validListings, savedSet, onMarkerClick, onMarkerHover])

  // List↔map hover sync: enlarge the marker matching the list card under the cursor.
  useEffect(() => {
    const byKey = markersByKeyRef.current
    if (byKey.size === 0) return
    for (const [key, marker] of byKey) {
      const isHover = key === hoveredKey
      try {
        marker.setIcon(getListingMarkerIcon({ hover: isHover }))
        marker.setZIndex(isHover ? Number(google.maps.Marker.MAX_ZINDEX) : undefined)
      } catch {
        // marker DOM may be gone mid-pan; ignore
      }
    }
  }, [hoveredKey, validListings])

  if (loadError) {
    return (
      <div
        className={className}
        style={{
          height: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--muted)',
          color: 'var(--muted-foreground)',
        }}
      >
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className={className}
        style={{
          height: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--muted)',
          color: 'var(--muted-foreground)',
        }}
      >
        Loading map…
      </div>
    )
  }

  const openListing = openInfo?.listing
  const openKey = openInfo?.listingKey

  const hasBoundary = boundaryPaths.length > 0
  const showBoundaryControls = boundaryPaths.length > 0 || (placeQuery != null && placeQuery !== '')

  return (
    <div className={`relative ${className}`.trim()} style={{ height: '100%', minHeight: 360 }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: 360, cursor: drawingMode ? 'crosshair' : '' }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onClick={(e) => {
          if (drawingMode && e.latLng) {
            const point = { lat: e.latLng.lat(), lng: e.latLng.lng() }
            setDrawingPoints((prev) => [...prev, point])
          }
        }}
        options={{
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          draggable: !drawingMode,
          clickableIcons: !drawingMode,
        }}
      >
        {/* Drawing preview polygon */}
        {drawingMode && drawingPoints.length >= 2 && (
          <Polygon
            paths={drawingPoints}
            options={{
              fillColor: 'var(--accent)',
              fillOpacity: 0.15,
              strokeColor: 'var(--primary)',
              strokeWeight: 2,
              strokeOpacity: 0.8,
            }}
          />
        )}
        {/* Completed drawn polygon */}
        {!drawingMode && activePolygon && activePolygon.length >= 3 && (
          <Polygon
            paths={activePolygon}
            options={{
              fillColor: 'var(--accent)',
              fillOpacity: 0.2,
              strokeColor: 'var(--primary)',
              strokeWeight: 2,
            }}
          />
        )}
        {showBoundary && boundaryPaths.flat().length > 0 &&
          boundaryPaths.map((path, i) => (
            <Polygon
              key={`geo-${i}`}
              paths={path}
              options={{
                fillColor: 'var(--primary)',
                fillOpacity: 0.12,
                strokeColor: 'var(--primary)',
                strokeWeight: 2,
              }}
            />
          ))}
        {openInfo && openListing && openKey && (
          <InfoWindow
            position={openInfo.position}
            onCloseClick={() => setOpenInfo(null)}
          >
            <div className="map-infowindow-card p-1 text-foreground">
              {openListing.PhotoURL ? (
                <div className="mb-1.5 overflow-hidden rounded-md" style={{ aspectRatio: '4 / 3' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={openListing.PhotoURL}
                    alt={[openListing.StreetNumber, openListing.StreetName].filter(Boolean).join(' ') || 'Listing photo'}
                    width={240}
                    height={180}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ) : null}
              {((openListing.StreetNumber ?? openListing.StreetName ?? openListing.City) != null && (
                <div className="text-sm text-muted-foreground">
                  {[openListing.StreetNumber, openListing.StreetName].filter(Boolean).join(' ')}
                  {[openListing.StreetNumber, openListing.StreetName].filter(Boolean).length > 0 &&
                  (openListing.City ?? openListing.State ?? openListing.PostalCode)
                    ? ', '
                    : ''}
                  {[openListing.City, openListing.State, openListing.PostalCode].filter(Boolean).join(' ')}
                </div>
              )) || null}
              <div className="mt-0.5 font-semibold">
                ${Number(openListing.ListPrice ?? 0).toLocaleString()}
                {savedSet.has(openKey) && <span className="ml-1 text-destructive" aria-hidden>♥</span>}
              </div>
              {(openListing.BedroomsTotal != null || openListing.BathroomsTotal != null || openListing.TotalLivingAreaSqFt != null) && (
                <div className="text-xs text-muted-foreground">
                  {[
                    openListing.BedroomsTotal != null ? `${openListing.BedroomsTotal} bed` : null,
                    openListing.BathroomsTotal != null ? `${openListing.BathroomsTotal} bath` : null,
                    openListing.TotalLivingAreaSqFt != null ? `${Number(openListing.TotalLivingAreaSqFt).toLocaleString()} sqft` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
              <Button
                type="button"
                className="mt-1.5 block text-sm font-medium text-primary hover:underline"
                onClick={() => router.push(listingDetailPath(
                  openKey,
                  { streetNumber: openListing.StreetNumber, streetName: openListing.StreetName, city: openListing.City, state: openListing.State, postalCode: openListing.PostalCode },
                  undefined,
                  { mlsNumber: openListing.ListNumber != null ? String(openListing.ListNumber) : null }
                ))}
              >
                View listing →
              </Button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      {/* Draw-on-map controls */}
      {onPolygonDrawn && (
        <div className="absolute left-3 top-3 z-[100] flex gap-2" aria-label="Draw controls">
          {!drawingMode && (!activePolygon || activePolygon.length < 3) && (
            <Button
              type="button"
              onClick={() => {
                setDrawingMode(true)
                setDrawingPoints([])
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary shadow-md hover:bg-muted"
            >
              Draw area
            </Button>
          )}
          {drawingMode && (
            <>
              <Button
                type="button"
                onClick={() => {
                  // Finalize the polygon
                  if (drawingPoints.length >= 3) {
                    const path = [...drawingPoints]
                    setActivePolygon(path)
                    onPolygonDrawn?.(path)
                  }
                  setDrawingMode(false)
                }}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md hover:bg-primary/90"
                disabled={drawingPoints.length < 3}
              >
                Apply area ({drawingPoints.length})
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDrawingMode(false)
                  setDrawingPoints([])
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-md hover:bg-muted"
              >
                Cancel
              </Button>
            </>
          )}
          {!drawingMode && activePolygon && activePolygon.length >= 3 && (
            <Button
              type="button"
              onClick={() => {
                setActivePolygon(null)
                setDrawingPoints([])
                onPolygonDrawn?.(null)
              }}
              className="rounded-lg border border-destructive bg-card px-3 py-2 text-sm font-medium text-destructive shadow-md hover:bg-destructive/10"
            >
              Clear area
            </Button>
          )}
        </div>
      )}

      {showBoundaryControls && (
        <div className="absolute right-3 top-14 z-[100] flex flex-col gap-2 rounded-lg border border-border bg-card p-1.5 shadow-md" aria-label="Map controls">
          {showBoundary && hasBoundary && (
            <Button
              type="button"
              onClick={() => setShowBoundary(false)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-primary shadow-sm hover:bg-muted"
            >
              Remove boundary
            </Button>
          )}
          {placeViewport && (
            <Button
              type="button"
              onClick={recenterMap}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              Re-center
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
