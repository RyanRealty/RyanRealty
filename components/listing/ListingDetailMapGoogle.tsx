'use client'

import Link from 'next/link'
import React, { useMemo, useCallback, useState } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'

type ListingPoint = {
  latitude: number
  longitude: number
  listingKey: string
  listPrice?: number | null
}

type Props = {
  subjectListing: ListingPoint | null
  otherListings: ListingPoint[]
}

const CENTRAL_OREGON = { lat: 44.0582, lng: -121.3153 }
const DEFAULT_ZOOM = 10

function getCenterAndZoom(listings: ListingPoint[]): { center: { lat: number; lng: number }; zoom: number } {
  if (listings.length === 0) return { center: CENTRAL_OREGON, zoom: DEFAULT_ZOOM }
  const lats = listings.map((l) => l.latitude)
  const lngs = listings.map((l) => l.longitude)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  const zoom = listings.length === 1 ? 14 : Math.max(10, 14 - Math.log2(listings.length))
  return { center, zoom }
}

const mapContainerStyle = { width: '100%', height: '400px' }

export default function ListingDetailMapGoogle({ subjectListing, otherListings }: Props) {
  const router = useRouter()
  const [infoSubject, setInfoSubject] = useState(true)
  const [infoOtherKey, setInfoOtherKey] = useState<string | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })

  const isValidPoint = (p: ListingPoint | null | undefined): p is ListingPoint =>
    !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)

  const validSubject = isValidPoint(subjectListing)
  const validOthers = otherListings.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
  const allPoints = useMemo(
    () => [...(validSubject ? [subjectListing!] : []), ...validOthers],
    [validSubject, subjectListing, validOthers]
  )

  const { center, zoom } = useMemo(() => getCenterAndZoom(allPoints), [allPoints])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (allPoints.length <= 1) return
      const bounds = new google.maps.LatLngBounds()
      allPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
      map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 })
    },
    [allPoints]
  )

  if (loadError) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-600">
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-500">
        Loading map…
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm" style={{ width: '100%' }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
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
        {validSubject && (
          <>
            <Marker
              position={{ lat: subjectListing!.latitude, lng: subjectListing!.longitude }}
              title="This listing"
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: '#2563eb',
                fillOpacity: 1,
                strokeColor: '#1d4ed8',
                strokeWeight: 2,
              }}
              onClick={() => { setInfoSubject(true); setInfoOtherKey(null) }}
            />
            {infoSubject && (
              <InfoWindow
                position={{ lat: subjectListing!.latitude, lng: subjectListing!.longitude }}
                onCloseClick={() => setInfoSubject(false)}
              >
                <div className="p-1 text-zinc-900">
                  <div className="font-bold text-blue-600">This listing</div>
                  <div className="text-sm font-semibold">${Number(subjectListing!.listPrice ?? 0).toLocaleString()}</div>
                </div>
              </InfoWindow>
            )}
          </>
        )}
        {validOthers.map((listing) => (
          <React.Fragment key={listing.listingKey}>
            <Marker
              position={{ lat: listing.latitude, lng: listing.longitude }}
              title={`$${(Number(listing.listPrice ?? 0) / 1000).toFixed(0)}k`}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#0d9488',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
              onClick={() => { setInfoOtherKey(listing.listingKey); setInfoSubject(false) }}
            />
            {infoOtherKey === listing.listingKey && (
              <InfoWindow
                position={{ lat: listing.latitude, lng: listing.longitude }}
                onCloseClick={() => setInfoOtherKey(null)}
              >
                <div className="p-1 text-zinc-900">
                  <div className="text-sm font-semibold">${(Number(listing.listPrice ?? 0) / 1000).toFixed(0)}k</div>
                  <Link
                    href={`/listing/${listing.listingKey}`}
                    className="text-sm text-blue-600 hover:underline"
                    onClick={(e) => { e.stopPropagation(); router.push(`/listing/${listing.listingKey}`) }}
                  >
                    View listing →
                  </Link>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        ))}
      </GoogleMap>
    </div>
  )
}
