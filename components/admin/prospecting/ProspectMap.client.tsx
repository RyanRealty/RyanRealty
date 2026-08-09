'use client'

/**
 * ProspectMap — single-point Google Map for the prospecting detail panel.
 * Follows the vanilla Google Maps JS API pattern already used by
 * app/admin/(protected)/crm/reporting/properties/PropertiesMap.tsx (this repo
 * standardizes on Google Maps, never Mapbox — see CLAUDE.md). Client-only and
 * ready-gated so it never touches `google.maps.*` before the loader script
 * (mounted via <GoogleMapsBootstrap /> here, same as PropertiesMap — the
 * admin console tree does not mount the global one) resolves.
 *
 * 11F: on the LOCKED admin v2 language. The marker was a hardcoded public-brand
 * navy/cream pair; it now resolves --a-accent / --a-btn-fg from the applied
 * stylesheet inside the ready-gated effect, exactly as PropertiesMap does, so
 * the pin follows the admin theme including dark mode. Google Maps JS takes
 * literal colour strings — it cannot consume var(...).
 *
 * Also fixed here: both containers carry min-width:0. A map box is a flex/grid
 * ITEM whose default min-width:auto refuses to shrink below its content, which
 * is how this panel pushed the page sideways at 375px (same class of defect the
 * .av2-pane comment records).
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

    // Google Maps JS takes literal colour strings, so the admin tokens are
    // resolved from the applied stylesheet at runtime (safe here: this effect
    // only runs client-side, after mount, once `ready` is true).
    const s = getComputedStyle(document.documentElement)
    const accent = s.getPropertyValue('--a-accent').trim()
    const btnFg = s.getPropertyValue('--a-btn-fg').trim()

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
        // Admin-accent filled circle, drawn from --a-accent so it follows the
        // admin theme (including dark mode) — same treatment as PropertiesMap.
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: accent,
        fillOpacity: 1,
        strokeColor: btnFg,
        strokeWeight: 1.5,
      },
    })
  }, [ready, hasPoint, lat, lng, address])

  if (!hasPoint) {
    return (
      <div
        className={cn('flex h-full min-h-40 items-center justify-center rounded-lg', className)}
        style={{ minWidth: 0, background: 'var(--a-inset)' }}
      >
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No map location</p>
      </div>
    )
  }

  return (
    <div className={cn('relative h-full min-h-40 overflow-hidden rounded-lg', className)} style={{ minWidth: 0 }}>
      <GoogleMapsBootstrap />
      {error ? (
        <div className="flex h-full items-center justify-center" style={{ background: 'var(--a-inset)' }}>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Map unavailable</p>
        </div>
      ) : !ready ? (
        <div className="flex h-full items-center justify-center" style={{ background: 'var(--a-inset)' }}>
          <div
            className="h-5 w-5 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--a-accent)', borderTopColor: 'transparent' }}
            aria-hidden
          />
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  )
}
