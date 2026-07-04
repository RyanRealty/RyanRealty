'use client'
// brand-voice:exempt — pure UI wrapper, no user-facing prose

// @react-google-maps/api's <GoogleMap> fails to instantiate the map when it is
// server-rendered and then hydrated under React StrictMode (the container mounts
// but the map never paints). Every working Google Maps surface in this app
// (VenueMap, NeighborhoodMap) avoids that by loading its client component with
// next/dynamic ssr:false — a single clean client-only mount. KbListingMap is
// imported by ~11 server pages as `.client`, so this file stays the import
// target and simply defers the real component to a dynamic ssr:false wrapper.
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { KbListingMapImpl } from './KbListingMapImpl'

export type { KbMapFeature, KbMapGeo } from './KbListingMapImpl'

const KbListingMapDynamic = dynamic(() => import('./KbListingMapImpl').then((m) => m.KbListingMapImpl), {
  ssr: false,
  loading: () => (
    <section className="section neigh" id="map">
      <div className="wrap">
        <div className="neigh-map">
          <div id="kbMap" aria-hidden>
            <div style={{ width: '100%', height: '100%' }} className="animate-pulse bg-card" />
          </div>
        </div>
      </div>
    </section>
  ),
})

export function KbListingMap(props: ComponentProps<typeof KbListingMapImpl>) {
  return <KbListingMapDynamic {...props} />
}
