'use client'

/**
 * PropertiesMap — Google Maps panel for the Properties report.
 *
 * Uses the vanilla Google Maps JS API via useGoogleMapsReady, placing an
 * admin-accent numbered pin for each property that has lat/lng coordinates.
 * Marker colors and map styling are resolved from the admin v2 CSS tokens
 * (--a-accent, --a-btn-fg, --a-inset, --a-surface, --a-bg, --a-border) at
 * render time, so the map follows the admin theme including dark mode.
 * Renders its own
 * <GoogleMapsBootstrap /> because the admin console tree does not mount the
 * global one (that lives in the public-site RootProvider).
 *
 * Rendered as the right pane in the two-column Properties report layout.
 */

import { useRef, useEffect } from 'react'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { getBaseMapOptions } from '@/lib/maps/markers'
import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import type { PropertyInquiryRow } from '@/lib/data/crm/getPropertiesReport'
import { GoogleMapsBootstrap } from '@/components/GoogleMapsBootstrap'

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

    // Google Maps JS takes literal colour strings — it cannot consume
    // var(...). Resolve the admin tokens from the applied stylesheet at
    // runtime instead (safe here: this effect only runs client-side, after
    // mount, once `ready` is true).
    const s = getComputedStyle(document.documentElement)
    const token = (n: string) => s.getPropertyValue(n).trim()
    const accent = token('--a-accent')
    const btnFg = token('--a-btn-fg')
    const inset = token('--a-inset')
    const surface = token('--a-surface')
    const bg = token('--a-bg')
    const border = token('--a-border')
    const text = token('--a-text')
    const text2 = token('--a-text-2')

    // Create the map once; reuse on data changes.
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        // getBaseMapOptions() guards the ControlPosition/MapTypeId enum access
        // (they throw if touched before the Maps API loads — the ci:maps-safety
        // gate enforces this). We run inside the ready-gated effect, but use the
        // helper so the gate's static check passes and the pattern stays uniform.
        ...getBaseMapOptions(),
        center: MAP_DEFAULT_CENTER,
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        // Draws the admin accent/surface tokens, so the map follows the
        // admin theme (including dark mode) instead of a fixed palette.
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: inset }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: surface }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: bg }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: border }] },
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      })
    }

    // Clear previous markers.
    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    const mappable = rows.filter((r) => r.lat !== null && r.lng !== null)

    // Place an accent-filled circle pin for each property, labelled with inquiry count.
    for (const row of mappable) {
      const marker = new google.maps.Marker({
        position: { lat: row.lat!, lng: row.lng! },
        map: mapRef.current,
        title: row.fullAddress,
        label: {
          text: String(row.viewCount),
          color: btnFg,
          fontSize: '10px',
          fontWeight: '700',
        },
        icon: {
          // Admin-accent filled circle, drawn from --a-accent so it follows
          // the admin theme (including dark mode).
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: accent,
          fillOpacity: 1,
          strokeColor: btnFg,
          strokeWeight: 1.5,
        },
      })

      // Info window on pin click.
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui,sans-serif;font-size:13px;padding:4px 2px;min-width:160px">
          <div style="font-weight:600;color:${text}">${row.fullAddress}</div>
          <div style="color:${text2};margin-top:4px;font-size:12px">${row.viewCount}&nbsp;${row.viewCount === 1 ? 'inquiry' : 'inquiries'}</div>
          ${
            row.listingUrl
              ? `<div style="margin-top:6px"><a href="${row.listingUrl}" style="color:${accent};font-size:12px;text-decoration:underline" target="_blank">View listing</a></div>`
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
  //
  // The admin console tree does NOT mount the global <GoogleMapsBootstrap /> (it
  // lives in the public-site RootProvider only), so render it here — the loader
  // is idempotent, so a second instance on a page that already has one is a no-op.

  return (
    <>
      <GoogleMapsBootstrap />
      {error ? (
        <div
          className="flex items-center justify-center"
          style={{ position: 'absolute', inset: 0, background: 'var(--a-inset)' }}
        >
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            The map could not load. The ranked list beside it carries the same rows.
          </p>
        </div>
      ) : !ready ? (
        <div
          className="flex items-center justify-center"
          style={{ position: 'absolute', inset: 0, background: 'var(--a-inset)' }}
          aria-busy
        >
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading the map…</p>
        </div>
      ) : (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      )}
    </>
  )
}
