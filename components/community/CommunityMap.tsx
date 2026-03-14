'use client'

import { useMemo, useState, useCallback } from 'react'
import { useJsApiLoader, GoogleMap, Marker, Polygon, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import type { ListingRow } from '@/app/actions/communities'
import {
  MAP_DEFAULT_CENTER,
  MAP_COLOR_LISTING,
  getListingMarkerIcon,
  getCityPinIcon,
  MAP_LABEL_LISTING,
  MAP_LABEL_CITY,
} from '@/lib/map-constants'
import { Button } from "@/components/ui/button"

type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: number[][][] | number[][]
}
type GeoJSONMultiPolygon = {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

type Props = {
  boundaryGeojson: unknown
  listings: ListingRow[]
  communityName: string
  /** Optional query to find and show this place on the map (e.g. "Pronghorn Resort Bend Oregon"). Uses Google Places. */
  placeSearchQuery?: string | null
}

const DEFAULT_ZOOM = 12

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function getBounds(listings: { Latitude: number | null; Longitude: number | null }[]) {
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
  return { minLng, minLat, maxLng, maxLat }
}

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

export default function CommunityMap({
  boundaryGeojson,
  listings,
  communityName,
  placeSearchQuery,
}: Props) {
  const router = useRouter()
  const [infoListing, setInfoListing] = useState<ListingRow | null>(null)
  const [placePosition, setPlacePosition] = useState<{ lat: number; lng: number } | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
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
      ),
    [listings]
  )

  const paths = useMemo(() => geojsonToPaths(boundaryGeojson), [boundaryGeojson])
  const bounds = useMemo(() => getBounds(validListings), [validListings])

  const center = useMemo(() => {
    if (placePosition) return placePosition
    if (validListings.length === 0) return MAP_DEFAULT_CENTER
    if (bounds) {
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      }
    }
    return { lat: Number(validListings[0].Latitude), lng: Number(validListings[0].Longitude) }
  }, [validListings, bounds, placePosition])

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      if (!placeSearchQuery?.trim() || !window.google?.maps?.places) return
      const service = new window.google.maps.places.PlacesService(map)
      service.textSearch({ query: placeSearchQuery.trim() }, (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.[0]) return
        const place = results[0]
        if (place.geometry?.location) {
          setPlacePosition({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
          if (place.geometry.viewport) map.fitBounds(place.geometry.viewport, 40)
        }
      })
    },
    [placeSearchQuery]
  )

  if (loadError) return <div className="h-[400px] rounded-lg bg-muted flex items-center justify-center text-muted-foreground">Map failed to load.</div>
  if (!isLoaded) return <div className="h-[400px] rounded-lg bg-muted animate-pulse" />

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-map-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="community-map-heading" className="text-2xl font-bold tracking-tight text-primary">
          {communityName} Map
        </h2>
        <div className="mt-4 h-[400px] w-full overflow-hidden rounded-lg">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={DEFAULT_ZOOM}
            options={{ mapTypeControl: true, streetViewControl: false }}
            onLoad={onMapLoad}
          >
            {placePosition && (
              <Marker
                position={placePosition}
                title={communityName}
                label={{ text: communityName.slice(0, 15), ...MAP_LABEL_CITY }}
                icon={getCityPinIcon()}
                zIndex={100}
              />
            )}
            {paths.flat().length > 0 &&
              paths.map((path, i) => (
                <Polygon
                  key={i}
                  paths={path}
                  options={{
                    fillColor: 'var(--primary)',
                    fillOpacity: 0.2,
                    strokeColor: 'var(--primary)',
                    strokeWeight: 2,
                  }}
                />
              ))}
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
                  label={{
                    text: formatPrice(listing.ListPrice) ? formatPrice(listing.ListPrice).replace(/\$|,/g, '').slice(0, 6) : '',
                    ...MAP_LABEL_LISTING,
                  }}
                  icon={getListingMarkerIcon()}
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
                  <p className="font-semibold text-primary">
                    {[infoListing.StreetNumber, infoListing.StreetName].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(infoListing.ListPrice)} · {infoListing.BedroomsTotal} bed · {infoListing.BathroomsTotal} bath
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      const k = infoListing.ListingKey ?? infoListing.ListNumber
                      if (k) router.push(`/listing/${k}`)
                    }}
                    className="mt-2 text-sm font-semibold text-accent-foreground hover:underline"
                  >
                    View listing
                  </Button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </section>
  )
}
