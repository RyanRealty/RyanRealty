'use client'

import Link from 'next/link'
import React, { useMemo, useCallback, useState } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM_CITY, getListingMarkerIcon, MAP_LABEL_LISTING, MAP_COLOR_ACCENT, MAP_STROKE_WHITE, MAP_STROKE_WEIGHT } from '@/lib/map-constants'

type ListingPoint = {
  latitude: number
  longitude: number
  listingKey: string
  listPrice?: number | null
}

/** Subject listing can include photo URL for thumbnail-on-pin (per map spec). */
type SubjectListingPoint = ListingPoint & { photoUrl?: string | null }

function priceLabel(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2)}M`
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}k`
  return `$${price}`
}

const SUBJECT_THUMB_SIZE = 48

type Props = {
  subjectListing: SubjectListingPoint | null
  otherListings: ListingPoint[]
}

function getCenterAndZoom(listings: ListingPoint[]): { center: { lat: number; lng: number }; zoom: number } {
  if (listings.length === 0) return { center: MAP_DEFAULT_CENTER, zoom: MAP_DEFAULT_ZOOM_CITY }
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
    libraries: ['places'],
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
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        Loading map…
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border shadow-sm" style={{ width: '100%' }}>
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
              icon={
                (subjectListing as SubjectListingPoint).photoUrl
                  ? {
                      url: (subjectListing as SubjectListingPoint).photoUrl!,
                      scaledSize: new google.maps.Size(SUBJECT_THUMB_SIZE, SUBJECT_THUMB_SIZE),
                      anchor: new google.maps.Point(SUBJECT_THUMB_SIZE / 2, SUBJECT_THUMB_SIZE / 2),
                    }
                  : {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: MAP_COLOR_ACCENT,
                      fillOpacity: 1,
                      strokeColor: MAP_STROKE_WHITE,
                      strokeWeight: MAP_STROKE_WEIGHT,
                    }
              }
              onClick={() => { setInfoSubject(true); setInfoOtherKey(null) }}
            />
            {infoSubject && (
              <InfoWindow
                position={{ lat: subjectListing!.latitude, lng: subjectListing!.longitude }}
                onCloseClick={() => setInfoSubject(false)}
              >
                <div className="min-w-0 max-w-[200px] p-1 text-foreground">
                  {(subjectListing as SubjectListingPoint).photoUrl && (
                    <div className="mb-1.5 flex justify-center overflow-hidden rounded border border-border bg-muted" style={{ width: 72, height: 54 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Map popup thumbnail: listing photo URL from API; small fixed size */}
                      <img
                        src={(subjectListing as SubjectListingPoint).photoUrl!}
                        alt="This listing — map thumbnail"
                        className="h-full w-full object-contain"
                        width={72}
                        height={54}
                      />
                    </div>
                  )}
                  <div className="font-bold text-foreground">This listing</div>
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
              title={priceLabel(Number(listing.listPrice ?? 0))}
              label={{ text: priceLabel(Number(listing.listPrice ?? 0)), ...MAP_LABEL_LISTING }}
              icon={getListingMarkerIcon()}
              onClick={() => { setInfoOtherKey(listing.listingKey); setInfoSubject(false) }}
            />
            {infoOtherKey === listing.listingKey && (
              <InfoWindow
                position={{ lat: listing.latitude, lng: listing.longitude }}
                onCloseClick={() => setInfoOtherKey(null)}
              >
                <div className="p-1 text-foreground">
                  <div className="text-sm font-semibold">${(Number(listing.listPrice ?? 0) / 1000).toFixed(0)}k</div>
                  <Link
                    href={`/listing/${listing.listingKey}`}
                    className="text-sm text-primary hover:underline"
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
