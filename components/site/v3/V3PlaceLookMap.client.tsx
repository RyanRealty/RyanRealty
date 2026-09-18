'use client'

/**
 * Google island for V3PlaceLook. One place ring. Price pills, no count
 * cluster. Camera fits the recorded ring (not a 240-pin union).
 * Child cells stay off this fold (SITE-128 #2).
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { ListingForMap } from '@/components/SearchMapClustered'

const SearchMapClustered = dynamic(() => import('@/components/SearchMapClustered'), {
  ssr: false,
  loading: () => <div className="v3-place-look__map-pending" aria-hidden="true" />,
})

export type V3PlaceLookMapProps = {
  listings: ListingForMap[]
  boundaryGeojson?: unknown
  placeQuery?: string | null
}

export function V3PlaceLookMap({ listings, boundaryGeojson, placeQuery }: V3PlaceLookMapProps) {
  const mapProps: ComponentProps<typeof SearchMapClustered> = {
    listings,
    hideBoundaryToggle: true,
    boundaryStrokeWeight: 5,
    disableClustering: true,
    fitSubjectRing: true,
    className: 'v3-place-look__map-canvas',
  }
  if (boundaryGeojson != null) mapProps.boundaryGeojson = boundaryGeojson
  if (placeQuery) mapProps.placeQuery = placeQuery
  return <SearchMapClustered {...mapProps} />
}
