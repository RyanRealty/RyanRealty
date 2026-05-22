'use client'

import React, { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { useRouter } from 'next/navigation'
import { MAP_DEFAULT_CENTER, getListingMarkerIcon } from '@/lib/map-constants'
import { Button } from "@/components/ui/button"
import { listingDetailPath } from '@/lib/slug'

type ListingForMap = {
  ListingKey: string
  ListNumber?: string | null
  ListPrice?: number | null
  Latitude: number
  Longitude: number
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
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
  // useGoogleMapsReady reads from the GoogleMapsBootstrap loader
  // injected by app/layout.tsx. apiKey is kept here only so the
  // "missing key" branch still shows a useful placeholder.
  const { ready: isLoaded, error: loadError } = useGoogleMapsReady({
    libraries: ['places'],
  })

  const valid = listings.filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(l.Latitude) && Number.isFinite(l.Longitude))
  const filtered = bbox ? valid.filter((l) => inBbox(l.Latitude!, l.Longitude!, bbox)) : valid
  const center = valid[0]
    ? { lat: valid[0].Latitude!, lng: valid[0].Longitude! }
    : MAP_DEFAULT_CENTER
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
      <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center bg-muted text-muted-foreground">
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center bg-muted text-muted-foreground">
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
                icon={getListingMarkerIcon()}
                onClick={() => setOpenMarkerKey(openMarkerKey === key ? null : key)}
              />
              {openMarkerKey === key && (
                <InfoWindow
                  position={{ lat: house.Latitude!, lng: house.Longitude! }}
                  onCloseClick={() => setOpenMarkerKey(null)}
                >
                  <div className="p-1 text-foreground">
                    <div className="font-semibold">${price.toLocaleString()}</div>
                    {linkKey && (
                      <Button
                        type="button"
                        className="mt-1 text-sm text-primary hover:underline"
                        onClick={() => router.push(listingDetailPath(
                          linkKey,
                          { streetNumber: house.StreetNumber, streetName: house.StreetName, city: house.City, state: house.State, postalCode: house.PostalCode },
                          undefined,
                          { mlsNumber: house.ListNumber ?? null }
                        ))}
                      >
                        View listing →
                      </Button>
                    )}
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          )
        })}
      </GoogleMap>
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <Button
          type="button"
          onClick={searchThisArea}
          className="rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-md hover:bg-muted"
        >
          Search this area
        </Button>
        {bbox && (
          <>
            <Button
              type="button"
              onClick={showAll}
              className="rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-md hover:bg-muted"
            >
              Show all
            </Button>
            <p className="rounded-lg bg-card/95 px-3 py-2 text-sm text-muted-foreground shadow">
              {filtered.length} listing{filtered.length !== 1 ? 's' : ''} in view
            </p>
          </>
        )}
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center sm:left-auto sm:right-4 sm:justify-end">
        <Link
          href="/listings"
          className="rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-md hover:bg-muted"
        >
          List view
        </Link>
      </div>
    </div>
  )
}
