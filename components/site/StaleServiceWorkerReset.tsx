'use client'

import { useEffect } from 'react'

/**
 * StaleServiceWorkerReset — evicts a leftover service worker from a previous
 * site on this domain.
 *
 * Ryan Realty cut over to this Next.js app on an apex domain that previously
 * served a different stack (the old AgentFire/WordPress site). That stack may
 * have registered a fetch-intercepting service worker. A returning visitor's
 * browser keeps that old SW installed, so it serves a stale cached shell and
 * the user sees a broken or frozen page while every fresh visitor (and our
 * headless checks) gets the real site. This is the classic "works for everyone
 * but the owner" cutover trap.
 *
 * This component unregisters ANY service worker registered on the origin and
 * deletes its caches. If a SW was actively controlling the current page (so the
 * HTML in front of the user may be the stale cached copy), it reloads ONCE to
 * pull the fresh network copy. After unregistering, `controller` is null on the
 * next load, so it never loops.
 *
 * The app itself registers no caching service worker, so for the 99% of
 * visitors with no SW this is a no-op that returns on the first line.
 */
export default function StaleServiceWorkerReset() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const evict = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        if (regs.length === 0) return // clean browser — nothing to do

        await Promise.all(regs.map((r) => r.unregister().catch(() => {})))

        if (typeof caches !== 'undefined') {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})))
        }

        // A SW was controlling this page → the visible HTML may be the stale
        // cached shell. Reload once for the fresh copy. After unregister,
        // controller is null next load, so this fires at most once.
        if (navigator.serviceWorker.controller) {
          window.location.reload()
        }
      } catch {
        /* never block the page on cleanup */
      }
    }

    void evict()
  }, [])

  return null
}
