'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useRouter } from 'next/navigation'
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM_REGION,
  MAP_DEFAULT_ZOOM_CITY,
  PRIMARY_CITY_PINS,
  getListingMarkerIcon,
  getCityPinIcon,
  MAP_LABEL_CITY,
} from '@/lib/map-constants'
import { Button } from "@/components/ui/button"

const BEND_CENTER = { ...MAP_DEFAULT_CENTER, zoom: MAP_DEFAULT_ZOOM_CITY } as const

export type MapCenter = { latitude: number; longitude: number; zoom?: number }

export type CityPin = { name: string; lat: number; lng: number }

export type ListingMapListing = {
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
  PhotoURL?: string | null
}

type ListingMapProps = {
  listings: ListingMapListing[]
  centerOnBend?: boolean
  initialCenter?: MapCenter | null
  className?: string
  fitBounds?: boolean
  /** When set, show pins for these cities (e.g. primary Central Oregon cities). Used when no city filter so map loads with city context. */
  cityPins?: CityPin[] | null
  /** Called when the user pans/zooms; receives listings whose markers fall within the current map bounds. */
  onBoundsChanged?: (listingsInView: ListingMapListing[]) => void
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
  cityPins,
  onBoundsChanged,
}: ListingMapProps) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const onBoundsChangedRef = useRef(onBoundsChanged)
  onBoundsChangedRef.current = onBoundsChanged

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

  const bounds = useMemo(() => getBounds(validListings), [validListings])
  const pins = cityPins && cityPins.length > 0 ? cityPins : null
  const boundsFromPins = useMemo(() => {
    if (!pins || pins.length === 0) return null
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    for (const p of pins) {
      minLat = Math.min(minLat, p.lat)
      minLng = Math.min(minLng, p.lng)
      maxLat = Math.max(maxLat, p.lat)
      maxLng = Math.max(maxLng, p.lng)
    }
    return minLat === Infinity ? null : ({ minLng, minLat, maxLng, maxLat } as const)
  }, [pins])

  const center = useMemo(() => {
    if (centerOnBend) return MAP_DEFAULT_CENTER
    if (initialCenter && Number.isFinite(initialCenter.latitude) && Number.isFinite(initialCenter.longitude)) {
      return { lat: initialCenter.latitude, lng: initialCenter.longitude }
    }
    if (validListings.length === 0 && boundsFromPins) {
      return {
        lat: (boundsFromPins.minLat + boundsFromPins.maxLat) / 2,
        lng: (boundsFromPins.minLng + boundsFromPins.maxLng) / 2,
      }
    }
    if (validListings.length === 0) return MAP_DEFAULT_CENTER
    if (validListings.length === 1) {
      return { lat: Number(validListings[0].Latitude), lng: Number(validListings[0].Longitude) }
    }
    if (bounds) {
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      }
    }
    return MAP_DEFAULT_CENTER
  }, [validListings, centerOnBend, initialCenter, bounds, boundsFromPins])

  const zoom = useMemo(() => {
    if (centerOnBend && pins && pins.length > 0) return MAP_DEFAULT_ZOOM_REGION
    if (centerOnBend) return MAP_DEFAULT_ZOOM_CITY
    if (initialCenter?.zoom != null) return initialCenter.zoom
    if (validListings.length === 0 && pins && pins.length > 0) return MAP_DEFAULT_ZOOM_REGION
    if (validListings.length === 0) return initialCenter?.zoom ?? 11
    if (validListings.length === 1) return 14
    return 11
  }, [validListings.length, centerOnBend, initialCenter, pins?.length])

  const reportBounds = useCallback(
    (map: google.maps.Map) => {
      const cb = onBoundsChangedRef.current
      if (!cb || validListings.length === 0) return
      const b = map.getBounds()
      if (!b) return
      const inView = validListings.filter((l) => {
        const lat = Number(l.Latitude)
        const lng = Number(l.Longitude)
        return Number.isFinite(lat) && Number.isFinite(lng) && b.contains({ lat, lng })
      })
      cb(inView)
    },
    [validListings]
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      if (validListings.length > 0) {
        if (!centerOnBend && fitBounds && bounds) {
          const b = new google.maps.LatLngBounds(
            { lat: bounds.minLat, lng: bounds.minLng },
            { lat: bounds.maxLat, lng: bounds.maxLng }
          )
          map.fitBounds(b, { top: 48, right: 48, bottom: 48, left: 48 })
        }
        reportBounds(map)
        map.addListener('idle', () => reportBounds(map))
      } else if (pins && pins.length > 0 && (centerOnBend || boundsFromPins)) {
        const b = new google.maps.LatLngBounds(
          { lat: boundsFromPins!.minLat, lng: boundsFromPins!.minLng },
          { lat: boundsFromPins!.maxLat, lng: boundsFromPins!.maxLng }
        )
        map.fitBounds(b, { top: 48, right: 48, bottom: 48, left: 48 })
      }
    },
    [centerOnBend, fitBounds, bounds, validListings, reportBounds, pins, boundsFromPins]
  )

  useEffect(() => {
    const map = mapRef.current
    if (map && onBoundsChangedRef.current) reportBounds(map)
  }, [reportBounds])

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
        {pins?.map((pin) => (
          <Marker
            key={`city-${pin.name}`}
            position={{ lat: pin.lat, lng: pin.lng }}
            title={pin.name}
            label={{
              text: pin.name,
              ...MAP_LABEL_CITY,
            }}
            icon={getCityPinIcon()}
            zIndex={1}
          />
        ))}
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
                icon={getListingMarkerIcon({ hover: hoveredId === id })}
                onClick={() => setHoveredId(hoveredId === id ? null : id)}
                zIndex={2}
              />
              {hoveredId === id && (
                <InfoWindow
                  position={{ lat, lng }}
                  onCloseClick={() => setHoveredId(null)}
                >
                  <div className="min-w-[180px] p-1 text-foreground">
                    {((l.StreetNumber ?? l.StreetName ?? l.City) != null && (
                      <div className="text-sm text-muted-foreground">
                        {[l.StreetNumber, l.StreetName].filter(Boolean).join(' ')}
                        {([l.StreetNumber, l.StreetName].filter(Boolean).length > 0 && (l.City ?? l.State ?? l.PostalCode)) ? ', ' : ''}
                        {[l.City, l.State, l.PostalCode].filter(Boolean).join(' ')}
                      </div>
                    )) || null}
                    <div className="mt-0.5 font-semibold">${price.toLocaleString()}</div>
                    {(l.BedroomsTotal != null || l.BathroomsTotal != null) && (
                      <div className="text-xs text-muted-foreground">
                        {[l.BedroomsTotal != null ? `${l.BedroomsTotal} bed` : null, l.BathroomsTotal != null ? `${l.BathroomsTotal} bath` : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <Button
                      type="button"
                      className="mt-1.5 block text-sm font-medium text-primary hover:underline"
                      onClick={() => router.push(`/listing/${id}`)}
                    >
                      View listing →
                    </Button>
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
