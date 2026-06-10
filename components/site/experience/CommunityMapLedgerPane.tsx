/**
 * CommunityMapLedgerPane -- Experience System, Geo archetype
 *
 * Split-scroll spine: map pinned on the right (desktop), listing ledger
 * scrolling on the left. On mobile, stacks normally (ledger above, map below).
 *
 * Wires hover state: hovering a ledger row highlights its price pill on the
 * map; hovering a map marker highlights its ledger row. Uses the
 * hoveredKey / onMarkerHover API from NeighborhoodMap.client.
 *
 * The map is sticky on desktop (position: sticky, top: 88px) while the
 * ledger scrolls. The sticky height is capped to viewport - nav height.
 *
 * Props:
 *   listings      -- ListingCardData[] for the ledger
 *   polygons      -- NeighborhoodPolygon[] for the map boundary
 *   mapListings   -- MapListingPin[] for the map price pills
 *   zoom          -- map zoom (default 14)
 *   mapHeight     -- sticky map panel height on desktop (default 620)
 *   viewAllHref   -- optional "view all" link
 *   viewAllLabel  -- optional label
 *   communityName -- used for heading labels
 *   totalCount    -- total listing count (if > shown, view-all appears)
 */
// brand-voice:exempt
'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { ListingLedger } from './ListingLedger'
import type { ListingCardData } from '@/components/site/ListingCard'
import type { NeighborhoodPolygon, MapListingPin } from '@/components/site/NeighborhoodMap.client'

const NeighborhoodMapClient = dynamic(() => import('@/components/site/NeighborhoodMap.client'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="w-full h-full min-h-[400px] rounded-xl bg-muted animate-pulse"
    />
  ),
})

type Props = {
  listings: ReadonlyArray<ListingCardData>
  polygons: ReadonlyArray<NeighborhoodPolygon>
  mapListings: ReadonlyArray<MapListingPin>
  zoom?: number
  mapHeight?: number
  viewAllHref?: string
  viewAllLabel?: string
  communityName: string
  totalCount?: number
}

export function CommunityMapLedgerPane({
  listings,
  polygons,
  mapListings,
  zoom = 14,
  mapHeight = 620,
  viewAllHref,
  viewAllLabel,
  communityName,
  totalCount,
}: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const handleRowHover = useCallback((key: string | null) => {
    setHoveredKey(key)
  }, [])

  const hasMap = polygons.length > 0 || mapListings.length > 0

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 xl:gap-12">
      {/* Left: scrollable listing ledger */}
      <div className="flex-1 min-w-0 lg:max-w-[52%]">
        <ListingLedger
          listings={listings}
          featuredFirst={listings.length >= 2}
          viewAllHref={viewAllHref ?? (totalCount && listings.length < totalCount ? viewAllHref : undefined)}
          viewAllLabel={viewAllLabel}
          hoveredKey={hoveredKey}
          onRowHover={handleRowHover}
          sectionId="listing-ledger"
        />
        {viewAllHref && totalCount && listings.length < totalCount ? (
          <div className="mt-5 flex justify-end">
            <a
              href={viewAllHref}
              className="text-sm font-semibold text-primary hover:underline underline-offset-2"
            >
              {viewAllLabel ?? `View all ${totalCount} homes`}
            </a>
          </div>
        ) : null}
      </div>

      {/* Right: sticky map panel (desktop only, stacks below on mobile) */}
      {hasMap ? (
        <div
          className="w-full lg:w-[48%] xl:w-[46%] flex-shrink-0 order-last lg:order-none"
          aria-label={`Map of ${communityName}`}
        >
          <div
            className="lg:sticky"
            style={{ top: '88px', maxHeight: 'calc(100vh - 100px)' }}
          >
            <div
              className="rounded-xl overflow-hidden border border-border shadow-sm"
              style={{ height: `${mapHeight}px`, maxHeight: 'calc(100vh - 120px)' }}
            >
              <NeighborhoodMapClient
                polygons={polygons}
                listings={mapListings}
                zoom={zoom}
                height={mapHeight}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
