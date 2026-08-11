'use client'

/**
 * ListingLot3D — photorealistic Google 3D tiles around the listing pin.
 *
 * Uses experimental `google.maps.importLibrary('maps3d')` Map3DElement so the
 * buyer can orbit the lot when coverage exists. This is Google's city mesh
 * (same family as Earth), not a custom interior 3D model of the house.
 *
 * Fail-open: if maps3d is unavailable or tiles fail, render nothing and leave
 * the 2D ListingLocationMap as the primary map surface.
 *
 * CRITICAL: the Map3D host div must NEVER have React-managed children.
 * We attach the web component via replaceChildren(); if React also owns
 * children in that node, hydration throws NotFoundError removeChild and the
 * whole listing page falls into error.tsx ("This page didn't load").
 *
 * Setup: docs/MAPS_CLOUD_STYLE.md
 */

import { useEffect, useRef, useState } from 'react'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

type Props = {
  lat: number
  lng: number
  /** Optional address for aria. */
  label?: string | null
}

export default function ListingLot3D({ lat, lng, label }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { ready } = useGoogleMapsReady()
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    const host = hostRef.current
    if (!ready || !host) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = null

    ;(async () => {
      try {
        // Preview library — may throw if project lacks enablement or region.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib = (await window.google!.maps!.importLibrary!('maps3d')) as any
        if (cancelled || !host.isConnected) return
        const Map3DElement = lib.Map3DElement
        if (!Map3DElement) {
          setStatus('unavailable')
          return
        }
        el = new Map3DElement({
          center: { lat, lng, altitude: 80 },
          // range = camera distance in meters — close enough to read the lot
          range: 350,
          tilt: 55,
          heading: 20,
          mode: lib.MapMode?.HYBRID ?? 'HYBRID',
        })
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.display = 'block'
        el.setAttribute('gesture-handling', 'greedy')
        // Imperative only — host has no React children (see file header).
        host.replaceChildren(el)
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
      try {
        el?.remove?.()
        host.replaceChildren()
      } catch {
        /* ignore */
      }
    }
  }, [ready, lat, lng])

  if (status === 'unavailable') return null

  return (
    <section
      className="section"
      aria-label={label ? `3D map near ${label}` : '3D neighborhood map'}
    >
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">Around the home</span>
          <h2 className="sec-title display">See the lot in 3D</h2>
        </div>
        <p className="mt-2 max-w-prose text-sm text-[color:var(--navy-70)]">
          Photorealistic Google 3D tiles for this block when coverage exists. Drag to
          orbit. This is the neighborhood mesh, not an interior tour of the house.
        </p>
        {/* relative shell: loading overlay is a SIBLING of the host, never a child */}
        <div
          className="relative mt-6 w-full overflow-hidden rounded-sm border-[3px] border-[color:var(--navy)] bg-[color:var(--cream)]"
          style={{ height: 'min(52vh, 420px)' }}
        >
          {status === 'loading' ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-sm text-[color:var(--navy-70)]"
              aria-live="polite"
            >
              Loading 3D map…
            </div>
          ) : null}
          {/* Empty host for Map3DElement — do not put React children here */}
          <div ref={hostRef} className="absolute inset-0" />
        </div>
      </div>
    </section>
  )
}
