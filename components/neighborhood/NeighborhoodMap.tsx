'use client'

import { useMemo, useState } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import type { CityListingRow } from '@/app/actions/cities'

type Props = {
  listings: CityListingRow[]
  neighborhoodName: string
}

const BEND_CENTER = { lat: 44.0582, lng: -121.3153 }
const DEFAULT_ZOOM = 13

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function NeighborhoodMap({ listings, neighborhoodName }: Props) {
  const router = useRouter()
  const [infoListing, setInfoListing] = useState<CityListingRow | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-neighborhood',
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

  const center = useMemo(() => {
    if (validListings.length === 0) return BEND_CENTER
    const lat = validListings.reduce((a, l) => a + Number(l.Latitude), 0) / validListings.length
    const lng = validListings.reduce((a, l) => a + Number(l.Longitude), 0) / validListings.length
    return { lat, lng }
  }, [validListings])

  if (loadError) {
    return (
      <div className="h-[360px] rounded-xl bg-[var(--gray-bg)] flex items-center justify-center text-[var(--text-secondary)]">
        Map failed to load.
      </div>
    )
  }
  if (!isLoaded) {
    return <div className="h-[360px] rounded-xl bg-[var(--gray-bg)] animate-pulse" />
  }

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-map-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="neighborhood-map-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          {neighborhoodName} Map
        </h2>
        <div className="mt-4 h-[360px] w-full overflow-hidden rounded-xl">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={DEFAULT_ZOOM}
            options={{ mapTypeControl: true, streetViewControl: false }}
          >
            {validListings.map((listing) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? ''
              const lat = Number(listing.Latitude)
              const lng = Number(listing.Longitude)
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
              return (
                <Marker
                  key={String(key)}
                  position={{ lat, lng }}
                  onClick={() => setInfoListing(listing)}
                  {...(formatPrice(listing.ListPrice)
                    ? {
                        label: {
                          text: formatPrice(listing.ListPrice).replace(/\$|,/g, '').slice(0, 8),
                          fontSize: '11px',
                          fontWeight: 'bold',
                        },
                      }
                    : {})}
                />
              )
            })}
            {infoListing && (
              <InfoWindow
                position={{
                  lat: Number(infoListing.Latitude),
                  lng: Number(infoListing.Longitude),
                }}
                onCloseClick={() => setInfoListing(null)}
              >
                <div className="min-w-[180px] p-1">
                  <p className="font-semibold text-[var(--brand-navy)]">
                    {[infoListing.StreetNumber, infoListing.StreetName].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {formatPrice(infoListing.ListPrice)} · {infoListing.BedroomsTotal} bed · {infoListing.BathroomsTotal} bath
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const k = infoListing.ListingKey ?? infoListing.ListNumber
                      if (k) router.push(`/listing/${k}`)
                    }}
                    className="mt-2 text-sm font-semibold text-[var(--accent)] hover:underline"
                  >
                    View listing
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </section>
  )
}
