'use client'

/**
 * ListingLot3D — photorealistic Google 3D tiles around the listing pin.
 *
 * Uses experimental `google.maps.importLibrary('maps3d')` Map3DElement so the
 * buyer can orbit the lot when coverage exists. This is Google's city mesh
 * (same family as Earth), not a custom interior 3D model of the house.
 *
 * Fail-open: if maps3d is unavailable, errors, or paints a black void (no
 * photoreal coverage for that lat/lng), hide the section and leave the 2D
 * ListingLocationMap as the primary map surface.
 *
 * CRITICAL: the Map3D host div must NEVER have React-managed children.
 * We attach the web component via replaceChildren(); if React also owns
 * children in that node, hydration throws NotFoundError removeChild and the
 * whole listing page falls into error.tsx.
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
    let loadTimer: number | undefined

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
          range: 350,
          tilt: 55,
          heading: 20,
          mode: lib.MapMode?.HYBRID ?? 'HYBRID',
        })
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.display = 'block'
        el.setAttribute('gesture-handling', 'greedy')

        // Preview API: error / no-coverage → hide the black box.
        const onErr = () => {
          if (!cancelled) setStatus('unavailable')
        }
        try {
          el.addEventListener?.('gmp-error', onErr)
          el.addEventListener?.('error', onErr)
        } catch {
          /* ignore */
        }

        host.replaceChildren(el)
        if (cancelled) return
        setStatus('ready')

        // Photoreal tiles are not everywhere. If the canvas stays effectively
        // empty (no coverage), fail open so buyers only see the working 2D map.
        loadTimer = window.setTimeout(() => {
          if (cancelled) return
          try {
            // When tiles never load, the custom element often reports no
            // shadow content or remains pure black. Prefer hide over void.
            const shadowKids = el.shadowRoot?.childElementCount ?? 0
            if (shadowKids === 0 && !el.querySelector?.('canvas')) {
              setStatus('unavailable')
            }
          } catch {
            /* keep ready if we cannot inspect */
          }
        }, 5000)
      } catch {
        if (!cancelled) setStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
      if (loadTimer) window.clearTimeout(loadTimer)
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
          <div ref={hostRef} className="absolute inset-0" />
        </div>
      </div>
    </section>
  )
}
