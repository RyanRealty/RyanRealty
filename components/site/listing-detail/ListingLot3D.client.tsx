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
    if (!ready || !hostRef.current) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = null

    ;(async () => {
      try {
        // Preview library — may throw if project lacks enablement or region.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lib = (await window.google!.maps!.importLibrary!('maps3d')) as any
        if (cancelled || !hostRef.current) return
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
        hostRef.current.replaceChildren(el)
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
      try {
        el?.remove?.()
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
        <p
          className="mt-2 max-w-prose text-sm"
          style={{ color: 'var(--navy-70)' }}
        >
          Photorealistic Google 3D tiles for this block when coverage exists. Drag to
          orbit. This is the neighborhood mesh, not an interior tour of the house.
        </p>
        <div
          ref={hostRef}
          className="mt-6 w-full overflow-hidden"
          style={{
            height: 'min(52vh, 420px)',
            border: '3px solid var(--navy)',
            borderRadius: 4,
            background: 'var(--cream)',
          }}
        >
          {status === 'loading' ? (
            <div
              className="flex h-full w-full items-center justify-content-center text-sm"
              style={{ color: 'var(--navy-70)', justifyContent: 'center', alignItems: 'center', display: 'flex' }}
            >
              Loading 3D map…
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
