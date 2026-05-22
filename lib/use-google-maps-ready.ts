'use client'

/**
 * useGoogleMapsReady — drop-in replacement for `useJsApiLoader` from
 * `@react-google-maps/api` that survives Google's new chunked async
 * script loading.
 *
 * Background (2026-05-22 regression):
 *   Google rolled out a chunked-script format triggered when the
 *   request URL uses `callback=google.maps.__ib__` — the exact
 *   callback `@googlemaps/js-api-loader` (the loader behind
 *   `@react-google-maps/api`) hard-codes. The new bootstrap is only
 *   13 KB and async-fetches main.js + places.js after the fact, so
 *   `window.google.maps.Map` is NOT defined when the loader's
 *   "Failed to load Google Maps script, retrying in 2 ms" budget
 *   expires. Result: `loadError` fires on every Maps page even
 *   though the script is actively still loading.
 *
 * What this hook does:
 *   - Delegates to `useJsApiLoader` for the script-injection part,
 *     because that's still correct (we're using the same loader,
 *     same id, same libraries to keep the singleton consistent).
 *   - IGNORES `loadError` from the underlying hook unless the script
 *     truly never injected (no <script> tag in the DOM after a
 *     generous timeout). The "loadError" the hook reports is almost
 *     always a false positive caused by the retry budget expiring
 *     before main.js finishes.
 *   - Polls `window.google?.maps?.Map` after `isLoaded` (or even
 *     after a `loadError` from the underlying hook) and returns
 *     `ready: true` only once the Map class is actually available.
 *
 * Usage:
 *   const { ready, error } = useGoogleMapsReady({
 *     id: 'google-map-script',
 *     googleMapsApiKey: apiKey,
 *     libraries: ['places'],
 *   })
 *
 * Then render based on `ready` instead of `isLoaded`. `error` is
 * only set when we're confident the script truly cannot load (e.g.
 * 503 from Google after 10s of polling with no Map class).
 */

import { useEffect, useRef, useState } from 'react'
import type { LoadScriptProps } from '@react-google-maps/api'
import { useJsApiLoader } from '@react-google-maps/api'

export interface UseGoogleMapsReadyOptions {
  id?: string
  googleMapsApiKey: string
  libraries?: LoadScriptProps['libraries']
  version?: string
  language?: string
  region?: string
}

export interface UseGoogleMapsReadyResult {
  /** True once `window.google.maps.Map` is actually defined and usable. */
  ready: boolean
  /** Set only when the script truly cannot load (script tag never
   * injected after timeout). False positives from the underlying
   * loader's retry budget are filtered out. */
  error: Error | null
}

// Max time (ms) we'll wait for `google.maps.Map` to appear before
// declaring real failure. Google's main.js is ~300 KB; 15 s is
// generous even on slow mobile networks.
const MAP_CLASS_TIMEOUT_MS = 15000

// Polling cadence while waiting.
const POLL_INTERVAL_MS = 100

export function useGoogleMapsReady(
  opts: UseGoogleMapsReadyOptions,
): UseGoogleMapsReadyResult {
  // Defer to the standard loader for script injection. We pass the
  // same id/libraries/etc. so the singleton stays consistent across
  // every map-using component in the app.
  const { isLoaded, loadError } = useJsApiLoader({
    id: opts.id ?? 'google-map-script',
    googleMapsApiKey: opts.googleMapsApiKey,
    libraries: opts.libraries,
    version: opts.version,
    language: opts.language,
    region: opts.region,
  })

  const [ready, setReady] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (ready) return // Already resolved.

    // If the loader injected the script and Map is already defined,
    // we're good. Common path on second navigation (singleton).
    const hasMap = (): boolean => {
      const g = (window as unknown as { google?: { maps?: { Map?: unknown } } }).google
      return typeof g?.maps?.Map === 'function'
    }
    if (hasMap()) {
      setReady(true)
      return
    }

    // Begin polling. We start regardless of `isLoaded`/`loadError`
    // because the script tag is injected at the loader's initial
    // mount and Google's new chunked bootstrap finishes registering
    // Map only after main.js arrives (well after the loader's
    // internal retry budget has expired).
    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now()
    }

    const interval = window.setInterval(() => {
      if (hasMap()) {
        window.clearInterval(interval)
        setReady(true)
        setError(null)
        return
      }
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now())
      if (elapsed > MAP_CLASS_TIMEOUT_MS) {
        window.clearInterval(interval)
        // Only surface a real error if the script tag also never
        // made it into the DOM. Otherwise the script is still
        // loading; just give up quietly and let the caller render
        // the standard "Loading map" placeholder.
        const scriptInjected = !!document.querySelector(
          'script[src*="maps.googleapis.com/maps/api/js"]',
        )
        if (!scriptInjected) {
          setError(new Error('Google Maps script never injected'))
        } else if (loadError) {
          // Underlying loader reported error AND we timed out.
          setError(loadError)
        }
      }
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [isLoaded, loadError, ready])

  return { ready, error }
}

export default useGoogleMapsReady
