'use client'

import { useEffect } from 'react'

/**
 * Manages the Ryan Realty service worker lifecycle:
 *
 * 1. Evicts any stale SW left by the pre-cutover AgentFire/WordPress site on
 *    this domain. Those SWs can serve a frozen cached shell to returning
 *    visitors, making the site look broken for users who visited before the
 *    Next.js migration.
 *
 * 2. Registers /sw.js — the Ryan Realty offline service worker that caches
 *    MapLibre map tiles so maps stay functional when a user is offline or has a
 *    poor connection (most useful when the PWA is installed to home screen on
 *    iPhone/Android).
 *
 * Any SW whose script URL is NOT /sw.js (at the current origin) is treated as
 * stale and unregistered. /sw.js is compiled from app/sw.ts by Serwist during
 * `next build --webpack`. In dev / Turbopack mode the file won't exist;
 * registration fails silently, which is expected.
 */
export default function StaleServiceWorkerReset() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const manage = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()

        // Split into ours (/sw.js) and stale (everything else)
        const ourSwSuffix = `${window.location.origin}/sw.js`
        const stale = regs.filter((r) => {
          const url = r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? ''
          return url !== ourSwSuffix
        })
        const hasOurs = regs.length > stale.length

        // Unregister stale SWs and delete their caches
        if (stale.length > 0) {
          await Promise.all(stale.map((r) => r.unregister().catch(() => {})))

          if (typeof caches !== 'undefined') {
            const keys = await caches.keys()
            // Our named caches start with these prefixes — leave them intact
            const ourPrefixes = ['map-tiles-ofm-v1', 'map-hillshade-v1', 'serwist-']
            const staleKeys = keys.filter((k) => !ourPrefixes.some((p) => k.startsWith(p)))
            await Promise.all(staleKeys.map((k) => caches.delete(k).catch(() => {})))
          }

          // If a stale SW was controlling this page the user may be seeing the
          // old cached shell. Reload once for the live copy; the next load will
          // have no stale SW so this never loops.
          const ctrl = navigator.serviceWorker.controller
          if (ctrl && ctrl.scriptURL !== ourSwSuffix) {
            window.location.reload()
            return
          }
        }

        // Register our SW if not already installed
        if (!hasOurs) {
          navigator.serviceWorker.register('/sw.js').catch(() => {
            // Expected in dev (Turbopack) where /sw.js is not built — safe to ignore
          })
        }
      } catch {
        /* never block the page on SW management errors */
      }
    }

    void manage()
  }, [])

  return null
}
