'use client'

import { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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
  const mapRef = useRef<MapRef>(null)
  const [bbox, setBbox] = useState<Bbox | null>(null)

  const valid = listings.filter((l) => l.Latitude != null && l.Longitude != null && Number.isFinite(l.Latitude) && Number.isFinite(l.Longitude))
  const filtered = bbox ? valid.filter((l) => inBbox(l.Latitude!, l.Longitude!, bbox)) : valid
  const initialViewState = {
    latitude: valid[0]?.Latitude ?? 44.0582,
    longitude: valid[0]?.Longitude ?? -121.3153,
    zoom: valid.length <= 1 ? 12 : 9,
  }

  const searchThisArea = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const bounds = map.getBounds()
    if (!bounds) return
    setBbox({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    })
  }, [])

  const showAll = useCallback(() => setBbox(null), [])

  return (
    <div className="relative h-[calc(100vh-120px)] w-full">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      >
        <NavigationControl position="top-right" />
        {filtered.map((house) => (
          <Marker
            key={house.ListNumber ?? house.ListingKey}
            latitude={house.Latitude!}
            longitude={house.Longitude!}
            anchor="bottom"
          >
            <Link
              href={`/listing/${house.ListingKey}`}
              className="rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-zinc-900 shadow-md transition hover:bg-zinc-100"
            >
              ${Number(house.ListPrice ?? 0).toLocaleString()}
            </Link>
          </Marker>
        ))}
      </Map>
      <div className="absolute left-4 top-4 flex flex-col gap-2">
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
      <div className="absolute bottom-4 left-4 right-4 flex justify-center sm:left-auto sm:right-4 sm:justify-end">
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
