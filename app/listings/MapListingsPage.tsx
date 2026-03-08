'use client'

import React, { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'

type ListingForMap = {
  ListingKey: string
  ListNumber?: string | null
  ListPrice?: number | null
  Latitude: number
  Longitude: number
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
}

type Bbox = { west: number; south: number; east: number; north: number }

function inBbox(lat: number, lng: number, b: Bbox): boolean {
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north
}

export default function MapListingsPage({ listings }: { listings: ListingForMap[] }) {
  const router = useRouter()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [openMarkerKey, setOpenMarkerKey] = useState<string | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })

  const valid = listings.filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(l.Latitude) && Number.isFinite(l.Longitude))
  const filtered = bbox ? valid.filter((l) => inBbox(l.Latitude!, l.Longitude!, bbox)) : valid
  const center = valid[0]
    ? { lat: valid[0].Latitude!, lng: valid[0].Longitude! }
    : { lat: 44.0582, lng: -121.3153 }
  const zoom = valid.length <= 1 ? 12 : 9

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  const searchThisArea = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    if (!b) return
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    setBbox({
      west: sw.lng(),
      south: sw.lat(),
      east: ne.lng(),
      north: ne.lat(),
    })
  }, [])

  const showAll = useCallback(() => setBbox(null), [])

  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center bg-zinc-100 text-zinc-600">
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center bg-zinc-100 text-zinc-500">
        Loading map…
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-120px)] w-full">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {filtered.map((house) => {
          const linkKey = (house.ListNumber ?? house.ListingKey ?? '').toString().trim()
          const key = linkKey || house.ListingKey
          const price = Number(house.ListPrice ?? 0)
          return (
            <React.Fragment key={key}>
              <Marker
                position={{ lat: house.Latitude!, lng: house.Longitude! }}
                title={`$${price.toLocaleString()}`}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '#0d9488',
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                }}
                onClick={() => setOpenMarkerKey(openMarkerKey === key ? null : key)}
              />
              {openMarkerKey === key && (
                <InfoWindow
                  position={{ lat: house.Latitude!, lng: house.Longitude! }}
                  onCloseClick={() => setOpenMarkerKey(null)}
                >
                  <div className="p-1 text-zinc-900">
                    <div className="font-semibold">${price.toLocaleString()}</div>
                    {linkKey && (
                      <button
                        type="button"
                        className="mt-1 text-sm text-blue-600 hover:underline"
                        onClick={() => router.push(`/listing/${encodeURIComponent(linkKey)}`)}
                      >
                        View listing →
                      </button>
                    )}
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          )
        })}
      </GoogleMap>
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={searchThisArea}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-lg hover:bg-zinc-50"
        >
          Search this area
        </button>
        {bbox && (
          <>
            <button
              type="button"
              onClick={showAll}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 shadow-lg hover:bg-zinc-50"
            >
              Show all
            </button>
            <p className="rounded-lg bg-white/95 px-3 py-2 text-sm text-zinc-700 shadow">
              {filtered.length} listing{filtered.length !== 1 ? 's' : ''} in view
            </p>
          </>
        )}
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center sm:left-auto sm:right-4 sm:justify-end">
        <Link
          href="/listings"
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-lg hover:bg-zinc-50"
        >
          List view
        </Link>
      </div>
    </div>
  )
}
