'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'

const BEND_CENTER = { lat: 44.0582, lng: -121.3153, zoom: 10 }

export type MapCenter = { latitude: number; longitude: number; zoom?: number }

type ListingMapListing = {
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
}

type ListingMapProps = {
  listings: ListingMapListing[]
  centerOnBend?: boolean
  initialCenter?: MapCenter | null
  className?: string
  fitBounds?: boolean
}

const defaultMapStyle = { height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden' as const }

function getBounds(listings: { Latitude: number | null; Longitude: number | null }[]) {
  if (listings.length === 0) return null
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const l of listings) {
    const lat = Number(l.Latitude)
    const lng = Number(l.Longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    minLat = Math.min(minLat, lat)
    minLng = Math.min(minLng, lng)
    maxLat = Math.max(maxLat, lat)
    maxLng = Math.max(maxLng, lng)
  }
  if (minLat === Infinity) return null
  return { minLng, minLat, maxLng, maxLat } as const
}

export default function ListingMapGoogle({
  listings,
  centerOnBend,
  initialCenter,
  className,
  fitBounds = true,
}: ListingMapProps) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })

  const validListings = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.Latitude != null &&
          l.Longitude != null &&
          Number.isFinite(Number(l.Latitude)) &&
          Number.isFinite(Number(l.Longitude))
      ),
    [listings]
  )

  const bounds = useMemo(() => getBounds(validListings), [validListings])

  const center = useMemo(() => {
    if (centerOnBend) return BEND_CENTER
    if (initialCenter && Number.isFinite(initialCenter.latitude) && Number.isFinite(initialCenter.longitude)) {
      return { lat: initialCenter.latitude, lng: initialCenter.longitude }
    }
    if (validListings.length === 0) return BEND_CENTER
    if (validListings.length === 1) {
      return { lat: Number(validListings[0].Latitude), lng: Number(validListings[0].Longitude) }
    }
    if (bounds) {
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      }
    }
    return BEND_CENTER
  }, [validListings, centerOnBend, initialCenter, bounds])

  const zoom = useMemo(() => {
    if (centerOnBend) return 10
    if (initialCenter?.zoom != null) return initialCenter.zoom
    if (validListings.length === 0) return initialCenter?.zoom ?? 11
    if (validListings.length === 1) return 14
    return 11
  }, [validListings.length, centerOnBend, initialCenter])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (centerOnBend || !fitBounds || !bounds || validListings.length === 0) return
      const b = new google.maps.LatLngBounds(
        { lat: bounds.minLat, lng: bounds.minLng },
        { lat: bounds.maxLat, lng: bounds.maxLng }
      )
      map.fitBounds(b, { top: 48, right: 48, bottom: 48, left: 48 })
    },
    [centerOnBend, fitBounds, bounds, validListings.length]
  )

  if (loadError) {
    return (
      <div
        className={className}
        style={{ ...defaultMapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', color: '#71717a' }}
      >
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className={className}
        style={{ ...defaultMapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', color: '#71717a' }}
      >
        Loading map…
      </div>
    )
  }

  return (
    <div className={className} style={className ? undefined : defaultMapStyle}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', minHeight: '360px' }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        options={{
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {validListings.map((l, i) => {
          const id = (l.ListingKey ?? l.ListNumber ?? `point-${i}`).toString()
          const lat = Number(l.Latitude)
          const lng = Number(l.Longitude)
          const price = Number(l.ListPrice ?? 0)
          const priceLabel = price >= 1000 ? `${(price / 1000).toFixed(0)}k` : `$${price}`
          return (
            <React.Fragment key={id}>
              <Marker
                position={{ lat, lng }}
                title={priceLabel}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: hoveredId === id ? 12 : 8,
                  fillColor: '#0d9488',
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                }}
                onClick={() => setHoveredId(hoveredId === id ? null : id)}
              />
              {hoveredId === id && (
                <InfoWindow
                  position={{ lat, lng }}
                  onCloseClick={() => setHoveredId(null)}
                >
                  <div className="min-w-[180px] p-1 text-zinc-900">
                    {((l.StreetNumber ?? l.StreetName ?? l.City) != null && (
                      <div className="text-sm text-zinc-600">
                        {[l.StreetNumber, l.StreetName].filter(Boolean).join(' ')}
                        {([l.StreetNumber, l.StreetName].filter(Boolean).length > 0 && (l.City ?? l.State ?? l.PostalCode)) ? ', ' : ''}
                        {[l.City, l.State, l.PostalCode].filter(Boolean).join(' ')}
                      </div>
                    )) || null}
                    <div className="mt-0.5 font-semibold">${price.toLocaleString()}</div>
                    {(l.BedroomsTotal != null || l.BathroomsTotal != null) && (
                      <div className="text-xs text-zinc-500">
                        {[l.BedroomsTotal != null ? `${l.BedroomsTotal} bed` : null, l.BathroomsTotal != null ? `${l.BathroomsTotal} bath` : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <button
                      type="button"
                      className="mt-1.5 block text-sm font-medium text-blue-600 hover:underline"
                      onClick={() => router.push(`/listing/${id}`)}
                    >
                      View listing →
                    </button>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          )
        })}
      </GoogleMap>
    </div>
  )
}
