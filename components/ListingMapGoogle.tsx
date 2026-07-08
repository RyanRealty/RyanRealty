'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM_REGION,
  MAP_DEFAULT_ZOOM_CITY,
  getCityPinIcon,
  MAP_LABEL_CITY,
} from '@/lib/map-constants'
import { listingDetailPath } from '@/lib/slug'
import {
  buildPricePillIcon,
  formatPriceLabel,
  buildInfoWindowHTML,
  getBaseMapOptions,
} from '@/lib/maps/markers'

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
  StreetSuffix?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  PhotoURL?: string | null
  TotalLivingAreaSqFt?: number | null
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
  const [openId, setOpenId] = useState<string | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const onBoundsChangedRef = useRef(onBoundsChanged)
  onBoundsChangedRef.current = onBoundsChanged

  const { ready: isLoaded, error: loadError } = useGoogleMapsReady({
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
        style={{ ...defaultMapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
      >
        Map failed to load. Check your Google Maps API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className={className}
        style={{ ...defaultMapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
      >
        Loading map...
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
        options={getBaseMapOptions()}
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
          const id = (l.ListNumber ?? l.ListingKey ?? `point-${i}`).toString()
          const lat = Number(l.Latitude)
          const lng = Number(l.Longitude)
          const price = Number(l.ListPrice ?? 0)
          const label = formatPriceLabel(price)
          return (
            <React.Fragment key={id}>
              <Marker
                position={{ lat, lng }}
                title={label}
                icon={buildPricePillIcon(label, { hover: openId === id })}
                onClick={() => setOpenId(openId === id ? null : id)}
                zIndex={2}
              />
              {openId === id && (
                <InfoWindow
                  position={{ lat, lng }}
                  onCloseClick={() => setOpenId(null)}
                  options={{ maxWidth: 260 }}
                >
                  {/* Inline styles required: Google InfoWindow renders in an isolated
                      DOM context. All styles come from buildInfoWindowHTML in lib/maps/markers.ts. */}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: buildInfoWindowHTML({
                        price: l.ListPrice ?? null,
                        photoURL: l.PhotoURL ?? null,
                        streetNumber: l.StreetNumber ?? null,
                        streetName: l.StreetName ?? null,
                        streetSuffix: l.StreetSuffix ?? null,
                        city: l.City ?? null,
                        state: l.State ?? null,
                        postalCode: l.PostalCode ?? null,
                        bedroomsTotal: l.BedroomsTotal ?? null,
                        bathroomsTotal: l.BathroomsTotal ?? null,
                        sqft: l.TotalLivingAreaSqFt ?? null,
                        href: listingDetailPath(
                          id,
                          {
                            streetNumber: l.StreetNumber,
                            streetName: l.StreetName,
                            city: l.City,
                            state: l.State,
                            postalCode: l.PostalCode,
                          },
                          undefined,
                          { mlsNumber: l.ListNumber != null ? String(l.ListNumber) : null }
                        ),
                      }),
                    }}
                  />
                </InfoWindow>
              )}
            </React.Fragment>
          )
        })}
      </GoogleMap>
    </div>
  )
}
