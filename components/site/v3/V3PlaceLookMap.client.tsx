'use client'

/**
 * Google island for V3PlaceLook. One place ring. Price pills cluster at
 * city zoom so a 375 first-look does not pile/clip into an unreadable
 * stack (SITE-128 rematch FAIL 5). Camera fits the recorded ring.
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
    boundaryStrokeWeight: 8,
    fitSubjectRing: true,
    className: 'v3-place-look__map-canvas',
  }
  if (boundaryGeojson != null) mapProps.boundaryGeojson = boundaryGeojson
  if (placeQuery) mapProps.placeQuery = placeQuery
  return <SearchMapClustered {...mapProps} />
}
