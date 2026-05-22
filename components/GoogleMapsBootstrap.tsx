'use client'

/**
 * GoogleMapsBootstrap — official Google Maps JS API loader, inlined.
 *
 * Background (2026-05-22 regression): Google rolled out a chunked
 * async script format that's triggered when the request URL uses
 * the magic callback name `google.maps.__ib__` (the one
 * `@googlemaps/js-api-loader` hard-codes). With the new format,
 * `google.maps.Map` is never populated synchronously — you have to
 * call `await google.maps.importLibrary('maps')` to actually load
 * the Map class. `@react-google-maps/api` (and its underlying
 * `@googlemaps/js-api-loader` v1) doesn't do that and reports
 * `loadError` on every Maps page.
 *
 * This component injects Google's OFFICIAL bootstrap snippet from
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api
 * which exposes `google.maps.importLibrary(...)` and handles the
 * chunked loading correctly. Mount once in app/layout.tsx — every
 * downstream map component then calls `await google.maps.importLibrary('maps')`
 * via `lib/use-google-maps-ready.ts`.
 *
 * Idempotent: sets `window.__gmaps_bootstrap_injected__` so re-mounts
 * are no-ops. Safe to render multiple times in dev with strict mode.
 */

import { useEffect } from 'react'

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary?: (name: string) => Promise<unknown>
        Map?: unknown
      }
    }
    __gmaps_bootstrap_injected__?: boolean
  }
}

export function GoogleMapsBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__gmaps_bootstrap_injected__) return
    if (typeof window.google?.maps?.importLibrary === 'function') return // some other loader beat us to it

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      // Surface a single console line in dev — page-level fallbacks
      // already render their own "key missing" placeholder.
      // eslint-disable-next-line no-console
      console.warn('[GoogleMapsBootstrap] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing')
      return
    }

    window.__gmaps_bootstrap_injected__ = true

    // Official Google snippet, lightly TypeScripted. Adapted from:
    // https://developers.google.com/maps/documentation/javascript/load-maps-js-api
    // We pass `key` and `v`; everything else (libraries, language, region)
    // is set per-import by callers via `importLibrary(name)`.
    type BootstrapConfig = { key: string; v?: string }
    const config: BootstrapConfig = { key: apiKey, v: 'weekly' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(function (g: BootstrapConfig) {
      let h: Promise<void> | undefined
      let a: HTMLScriptElement
      const p = 'The Google Maps JavaScript API'
      const c = 'google'
      const l = 'importLibrary'
      const q = '__ib__'
      const m = document
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let b: any = window
      b = b[c] || (b[c] = {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = b.maps || (b.maps = {})
      const r = new Set<string>()
      const e = new URLSearchParams()
      const u = () =>
        h ||
        (h = new Promise<void>((f, n) => {
          a = m.createElement('script')
          e.set('libraries', Array.from(r).join(','))
          for (const k of Object.keys(g)) {
            const snake = k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase())
            e.set(snake, String(g[k as keyof BootstrapConfig]))
          }
          e.set('callback', c + '.maps.' + q)
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e.toString()
          d[q] = f
          a.onerror = () => {
            h = undefined
            n(new Error(p + ' could not load.'))
          }
          a.nonce = m.querySelector('script[nonce]')?.getAttribute('nonce') || ''
          m.head.append(a)
        }))
      if (d[l]) {
        // eslint-disable-next-line no-console
        console.warn(p + ' only loads once. Ignoring:', g)
      } else {
        d[l] = (f: string, ...n: unknown[]) =>
          r.add(f) && u().then(() => d[l](f, ...n))
      }
    })(config)
  }, [])

  return null
}

export default GoogleMapsBootstrap
