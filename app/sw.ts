import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, CacheFirst, ExpirationPlugin } from 'serwist'

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
  runtimeCaching: [
    // OpenFreeMap vector tiles + glyph fonts — the MapLibre basemap used across
    // the site (KbListingMap, SearchMap). CacheFirst: tiles are versioned by the
    // tile server; serve from cache to keep maps functional when offline.
    // 600 entries covers Central Oregon at zoom 7–14 with room for fonts.
    {
      matcher: /^https:\/\/tiles\.openfreemap\.org\//,
      handler: new CacheFirst({
        cacheName: 'map-tiles-ofm-v1',
        plugins: [
          new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    // Terrarium hillshade DEM — elevation layer for the terrain hillshade.
    // Elevation data is essentially static; 90-day TTL is conservative.
    {
      matcher: /^https:\/\/elevation-tiles-prod\.s3\.amazonaws\.com\//,
      handler: new CacheFirst({
        cacheName: 'map-hillshade-v1',
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 }),
        ],
      }),
    },
    ...defaultCache,
  ],
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
