'use client'

import Link from 'next/link'
import Map, { Marker, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type ListingPoint = {
  latitude: number
  longitude: number
  listingKey: string
  listPrice?: number | null
}

type Props = {
  /** The listing being viewed (shown with a distinct marker) */
  subjectListing: ListingPoint | null
  /** Other listings (e.g. same subdivision) to show on the map */
  otherListings: ListingPoint[]
}

const CENTRAL_OREGON = { latitude: 44.0582, longitude: -121.3153 }

function fitBounds(listings: ListingPoint[]) {
  if (listings.length === 0) return { ...CENTRAL_OREGON, zoom: 10 }
  const lats = listings.map((l) => l.latitude)
  const lngs = listings.map((l) => l.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const zoom = listings.length === 1 ? 14 : Math.max(10, 14 - Math.log2(listings.length))
  return { latitude: centerLat, longitude: centerLng, zoom }
}

export default function ListingDetailMap({ subjectListing, otherListings }: Props) {
  const isValidPoint = (p: ListingPoint | null | undefined): p is ListingPoint =>
    !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)

  const validSubject = isValidPoint(subjectListing)
  const validOthers = otherListings.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))

  const allPoints = [
    ...(validSubject ? [subjectListing!] : []),
    ...validOthers,
  ]
  const viewState = allPoints.length > 0 ? fitBounds(allPoints) : { ...CENTRAL_OREGON, zoom: 10 }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm" style={{ height: '400px', width: '100%' }}>
      <Map
        initialViewState={viewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      >
        <NavigationControl position="top-right" />
        {validSubject && (
          <Marker
            latitude={subjectListing!.latitude}
            longitude={subjectListing!.longitude}
            anchor="bottom"
          >
            <div className="flex flex-col items-center">
              <span className="rounded-t-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-md">
                This listing
              </span>
              <span className="rounded-b-lg bg-blue-600/95 px-3 py-1 text-xs font-semibold text-white shadow">
                ${Number(subjectListing!.listPrice ?? 0).toLocaleString()}
              </span>
              <div
                className="border-[8px] border-transparent border-t-blue-600"
                style={{ marginTop: -1 }}
                aria-hidden
              />
            </div>
          </Marker>
        )}
        {validOthers.map((listing) => (
            <Marker
              key={listing.listingKey}
              latitude={listing.latitude}
              longitude={listing.longitude}
              anchor="bottom"
            >
              <Link
                href={`/listing/${listing.listingKey}`}
                className="block rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 shadow-md transition hover:border-zinc-500 hover:shadow-lg"
              >
                ${(Number(listing.listPrice ?? 0) / 1000).toFixed(0)}k
              </Link>
            </Marker>
          ))}
      </Map>
    </div>
  )
}
