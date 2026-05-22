'use client'

/**
 * useGoogleMapsReady — replacement for `useJsApiLoader` from
 * `@react-google-maps/api`. The original hook is broken against
 * Google's current chunked-script format (see
 * components/GoogleMapsBootstrap.tsx for the full diagnosis).
 *
 * Contract:
 *   - `components/GoogleMapsBootstrap` must be mounted higher in the
 *     tree (we put it in app/layout.tsx). It injects the official
 *     Google snippet that exposes `google.maps.importLibrary(name)`.
 *   - This hook awaits `importLibrary('maps')` plus any extra
 *     libraries (places, geometry, …) and flips `ready` to true.
 *
 * Usage:
 *   const { ready, error } = useGoogleMapsReady({ libraries: ['places'] })
 *   if (!ready) return <Placeholder />
 *   return <GoogleMap ... />
 *
 * Compatible with `@react-google-maps/api`'s `<GoogleMap>` /
 * `<Polygon>` / `<OverlayView>` etc. — those components read
 * `window.google.maps.*` directly once they mount, and our import
 * calls populate everything they need.
 */

import { useEffect, useState } from 'react'

export type SupportedLibrary =
  | 'places'
  | 'geometry'
  | 'drawing'
  | 'visualization'
  | 'marker'

export interface UseGoogleMapsReadyOptions {
  /** Extra libraries to import alongside the core 'maps' module. */
  libraries?: SupportedLibrary[]
}

export interface UseGoogleMapsReadyResult {
  /** True once `window.google.maps.Map` is callable. */
  ready: boolean
  /** Set when the underlying script genuinely fails to load. */
  error: Error | null
}

// Max time to wait for the bootstrap snippet to install importLibrary.
// If it's missing after this window the page never mounted
// GoogleMapsBootstrap (caller error) and we surface a real error.
const BOOTSTRAP_WAIT_MS = 12000

export function useGoogleMapsReady(
  opts: UseGoogleMapsReadyOptions = {},
): UseGoogleMapsReadyResult {
  // Normalise libs into a stable string key so the effect dependency
  // doesn't churn on every render. The caller usually passes an
  // inline `['places']` literal — without this stringify, the
  // useEffect would re-run on every parent re-render.
  const libsKey = (opts.libraries ?? []).slice().sort().join(',')

  const [ready, setReady] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return typeof window.google?.maps?.Map === 'function'
  })
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (ready) return

    let cancelled = false

    const run = async () => {
      try {
        // 1. Wait for GoogleMapsBootstrap to install `importLibrary`.
        const startedAt = Date.now()
        while (typeof window.google?.maps?.importLibrary !== 'function') {
          if (cancelled) return
          if (Date.now() - startedAt > BOOTSTRAP_WAIT_MS) {
            throw new Error(
              '[useGoogleMapsReady] google.maps.importLibrary never appeared. ' +
                'Did you mount <GoogleMapsBootstrap /> in the root layout?',
            )
          }
          await new Promise((r) => setTimeout(r, 50))
        }

        // 2. Import core 'maps' + any caller-requested libs in parallel.
        const wanted = ['maps', ...(libsKey ? libsKey.split(',') : [])]
        await Promise.all(
          wanted.map((name) =>
            window.google!.maps!.importLibrary!(name),
          ),
        )

        if (cancelled) return
        setReady(true)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error(String(e)))
      }
    }

    void run()

    return () => {
      cancelled = true
    }
    // libsKey is the stable string form; ready is included so the
    // effect short-circuits cleanly after the first success.
  }, [libsKey, ready])

  return { ready, error }
}

export default useGoogleMapsReady
