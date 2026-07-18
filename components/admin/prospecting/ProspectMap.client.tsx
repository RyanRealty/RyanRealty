'use client'

/**
 * ProspectMap — single-point Google Map for the prospecting detail panel.
 * Follows the vanilla Google Maps JS API pattern already used by
 * app/admin/(protected)/crm/reporting/properties/PropertiesMap.tsx (this repo
 * standardizes on Google Maps, never Mapbox — see CLAUDE.md). Client-only and
 * ready-gated so it never touches `google.maps.*` before the loader script
 * (mounted via <GoogleMapsBootstrap /> here, same as PropertiesMap — the
 * admin console tree does not mount the global one) resolves.
 */

import { useEffect, useRef } from 'react'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getBaseMapOptions } from '@/lib/maps/markers'
import { GoogleMapsBootstrap } from '@/components/GoogleMapsBootstrap'
import { cn } from '@/lib/utils'

// Declare the google global so TypeScript resolves it (provided by @types/google.maps).
declare const google: typeof globalThis.google

export function ProspectMap({
  lat,
  lng,
  address,
  className,
}: {
  lat: number | null
  lng: number | null
  address?: string | null
  className?: string
}) {
  const hasPoint = lat != null && lng != null
  const { ready, error } = useGoogleMapsReady()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!ready || !hasPoint || !containerRef.current) return
    const position = { lat: lat as number, lng: lng as number }

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        ...getBaseMapOptions(),
        center: position,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
    } else {
      mapRef.current.setCenter(position)
    }

    if (markerRef.current) markerRef.current.setMap(null)
    markerRef.current = new google.maps.Marker({
      position,
      map: mapRef.current,
      title: address ?? undefined,
      icon: {
        // Navy filled circle — matches brand navy #102742 (same treatment as PropertiesMap).
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#102742',
        fillOpacity: 1,
        strokeColor: '#faf8f4',
        strokeWeight: 1.5,
      },
    })
  }, [ready, hasPoint, lat, lng, address])

  if (!hasPoint) {
    return (
      <div className={cn('flex h-full min-h-40 items-center justify-center rounded-lg bg-muted/30', className)}>
        <p className="text-sm text-muted-foreground">No map location</p>
      </div>
    )
  }

  return (
    <div className={cn('relative h-full min-h-40 overflow-hidden rounded-lg', className)}>
      <GoogleMapsBootstrap />
      {error ? (
        <div className="flex h-full items-center justify-center bg-muted/30">
          <p className="text-sm text-muted-foreground">Map unavailable</p>
        </div>
      ) : !ready ? (
        <div className="flex h-full items-center justify-center bg-muted/30">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  )
}
