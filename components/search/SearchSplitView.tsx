'use client'

import { useRef, useCallback } from 'react'
import SearchResults from '@/components/search/SearchResults'
import SearchMapClustered from '@/components/SearchMapClustered'
import type { ListingTileRow } from '@/app/actions/listings'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import type { ListingForMap } from '@/components/SearchMapClustered'

export type SearchSplitViewProps = {
  /** List: initial data and filters */
  initialListings: ListingTileRow[]
  totalCount: number
  initialPage: number
  filters: SearchFiltersInitial
  hasActiveFilters: boolean
  /** Map: listings with lat/lng (same dataset as list for current page, or full set for map-only) */
  mapListings: ListingForMap[]
  savedListingKeys: string[]
  likedListingKeys: string[]
  placeQuery: string
  boundaryGeojson?: unknown
}

export default function SearchSplitView({
  initialListings,
  totalCount,
  initialPage,
  filters,
  hasActiveFilters,
  mapListings,
  savedListingKeys,
  likedListingKeys,
  placeQuery,
  boundaryGeojson,
}: SearchSplitViewProps) {
  const listContainerRef = useRef<HTMLDivElement>(null)

  const onMarkerClick = useCallback((listingKey: string) => {
    const el = listContainerRef.current?.querySelector(`[data-listing-key="${listingKey}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div
      className="flex w-full h-[calc(100vh-120px)] min-h-[400px] overflow-hidden"
      style={{ contain: 'layout' }}
    >
      {/* Left: fixed-width scrollable list (sidebar) — only this column scrolls */}
      <div className="hidden lg:flex flex-col w-[420px] min-w-[360px] max-w-[480px] shrink-0 min-h-0 border-r border-border bg-muted">
        <div
          ref={listContainerRef}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          <SearchResults
            initialListings={initialListings}
            totalCount={totalCount}
            initialPage={initialPage}
            filters={filters}
            view="split"
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>
      {/* Right: full-height map — fills remaining space */}
      <div className="flex-1 min-h-0 min-w-0 relative hidden lg:block">
        <SearchMapClustered
          listings={mapListings}
          savedListingKeys={savedListingKeys}
          likedListingKeys={likedListingKeys}
          placeQuery={placeQuery}
          onMarkerClick={onMarkerClick}
          boundaryGeojson={boundaryGeojson}
          className="h-full w-full"
        />
      </div>
      {/* Mobile: list only (map on separate view) */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:hidden">
        <SearchResults
          initialListings={initialListings}
          totalCount={totalCount}
          initialPage={initialPage}
          filters={filters}
          view="split"
          hasActiveFilters={hasActiveFilters}
        />
      </div>
    </div>
  )
}
