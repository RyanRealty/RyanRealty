'use client'

import dynamic from 'next/dynamic'
import type { VenuePin } from './VenueMap.client'

/**
 * VenueMap — server-safe wrapper that lazy-loads the point-map client
 * (Google Maps JS ships only on routes that render it). Renders a venue marker
 * plus nearby-home price pills. Use for events, landmarks, and any place with a
 * coordinate but no authoritative boundary polygon. See NeighborhoodMap for the
 * polygon case.
 */

export type { VenuePin } from './VenueMap.client'

const VenueMapClient = dynamic(() => import('./VenueMap.client'), {
  ssr: false,
  loading: () => (
    <div aria-hidden className="bg-card rounded-[14px] border border-border h-[460px] animate-pulse" />
  ),
})

type Props = {
  venue: { lat: number; lng: number; name: string }
  listings?: ReadonlyArray<VenuePin>
  zoom?: number
  height?: number
  /** Authoritative route linework (GeoJSON LineString | MultiLineString) — trails only. */
  line?: GeoJSON.LineString | GeoJSON.MultiLineString | null
}

export function VenueMap({ venue, listings, zoom, height, line }: Props) {
  return <VenueMapClient venue={venue} listings={listings} zoom={zoom} height={height} line={line} />
}
