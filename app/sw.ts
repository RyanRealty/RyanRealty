/**
 * reachability: entry-point — Serwist swSrc. Compiled to public/sw.js by a
 * manual `next build --webpack` pass (Turbopack, the live next.config.ts
 * build, skips webpack plugins and never wires withSerwistInit — see the PWA
 * comment there), so nothing in the app/lib/components graph imports this
 * file; the build tool reads it by the swSrc path. public/sw.js is the
 * checked-in, served artifact (verified 200 in production) and is what
 * scripts/check-web-push-durable.mjs inspects, not this source.
 */
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()
