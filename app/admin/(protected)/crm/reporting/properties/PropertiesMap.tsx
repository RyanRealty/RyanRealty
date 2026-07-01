'use client'

/**
 * PropertiesMap — Google Maps panel for the Properties report.
 *
 * Uses the vanilla Google Maps JS API (loaded by <GoogleMapsBootstrap> in the
 * root layout) via useGoogleMapsReady, placing a navy numbered pin for each
 * property that has lat/lng coordinates.
 *
 * Rendered as the right pane in the two-column Properties report layout.
 */

import { useRef, useEffect } from 'react'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import type { PropertyInquiryRow } from '@/lib/data/crm/getPropertiesReport'

// Declare the google global so TypeScript resolves it (provided by @types/google.maps).
declare const google: typeof globalThis.google

interface Props {
  rows: PropertyInquiryRow[]
}

export function PropertiesMap({ rows }: Props) {
  const { ready, error } = useGoogleMapsReady()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    if (!ready || !containerRef.current) return

    // Create the map once; reuse on data changes.
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: MAP_DEFAULT_CENTER,
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        // Subtle navy/cream-friendly style (vector fallback-safe)
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d2d3' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      })
    }

    // Clear previous markers.
    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    const mappable = rows.filter((r) => r.lat !== null && r.lng !== null)

    // Place a navy circle pin for each property, labelled with inquiry count.
    for (const row of mappable) {
      const marker = new google.maps.Marker({
        position: { lat: row.lat!, lng: row.lng! },
        map: mapRef.current,
        title: row.fullAddress,
        label: {
          text: String(row.viewCount),
          color: '#faf8f4',
          fontSize: '10px',
          fontWeight: '700',
        },
        icon: {
          // Navy filled circle — matches brand navy #102742
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#102742',
          fillOpacity: 1,
          strokeColor: '#faf8f4',
          strokeWeight: 1.5,
        },
      })

      // Info window on pin click.
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui,sans-serif;font-size:13px;padding:4px 2px;min-width:160px">
          <div style="font-weight:600;color:#102742">${row.fullAddress}</div>
          <div style="color:#666;margin-top:4px;font-size:12px">${row.viewCount}&nbsp;${row.viewCount === 1 ? 'inquiry' : 'inquiries'}</div>
          ${
            row.listingUrl
              ? `<div style="margin-top:6px"><a href="${row.listingUrl}" style="color:#102742;font-size:12px;text-decoration:underline" target="_blank">View listing</a></div>`
              : ''
          }
        </div>`,
      })

      marker.addListener('click', () => {
        infoWindow.open(mapRef.current, marker)
      })

      markersRef.current.push(marker)
    }

    // Fit viewport to show all pins; fall back to Bend default if none.
    if (mappable.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds()
      for (const row of mappable) {
        bounds.extend({ lat: row.lat!, lng: row.lng! })
      }
      // Pad the bounds so pins don't sit on the edge.
      mapRef.current.fitBounds(bounds, 80)
    }
  }, [ready, rows])

  // ── Render states ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-r-lg bg-muted/30">
        <p className="text-sm text-muted-foreground">Map unavailable</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center rounded-r-lg bg-muted/30">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full rounded-r-lg" />
}
