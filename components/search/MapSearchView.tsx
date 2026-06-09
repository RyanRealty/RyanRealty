'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import { getViewportSearch, type SearchFilters } from '@/app/actions/search'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import type { ListingForMap } from '@/components/SearchMapClustered'
import type { MapPolygonPoint } from '@/lib/map-polygon'
import { listingDetailPath } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const SearchMapClustered = dynamic(() => import('@/components/SearchMapClustered'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground" style={{ minHeight: 320 }}>
      Loading map…
    </div>
  ),
})

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatAddress(l: ListingTileRow): string {
  return [
    [l.StreetNumber, l.StreetName].filter(Boolean).join(' ').trim(),
    l.City,
    l.State,
    l.PostalCode,
  ]
    .filter(Boolean)
    .join(', ')
}

function rowKey(l: ListingTileRow): string {
  return String(l.ListNumber ?? l.ListingKey ?? '').trim()
}

/** ListingTileRow carries TotalLivingAreaSqFt at runtime from the viewport fetch even though the base type omits it. */
function rowSqft(l: ListingTileRow): number | null {
  const v = (l as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt
  return v ?? null
}

function toMapListing(l: ListingTileRow): ListingForMap {
  return {
    Latitude: l.Latitude,
    Longitude: l.Longitude,
    ListingKey: l.ListingKey,
    ListNumber: l.ListNumber ?? null,
    ListPrice: l.ListPrice,
    StreetNumber: l.StreetNumber,
    StreetName: l.StreetName,
    City: l.City,
    State: l.State,
    PostalCode: l.PostalCode,
    BedroomsTotal: l.BedroomsTotal,
    BathroomsTotal: l.BathroomsTotal,
    PhotoURL: l.PhotoURL,
    TotalLivingAreaSqFt: rowSqft(l),
  }
}

/** Convert the page's URL filter object into the server-action SearchFilters shape. */
function toSearchFilters(f: SearchFiltersInitial): SearchFilters {
  return {
    city: f.city || undefined,
    subdivision: f.subdivision || undefined,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    beds: f.beds ? Number(f.beds) : undefined,
    baths: f.baths ? Number(f.baths) : undefined,
    status: f.status || 'Active',
    sort: f.sort || 'newest',
    minSqFt: f.minSqFt ? Number(f.minSqFt) : undefined,
    maxSqFt: f.maxSqFt ? Number(f.maxSqFt) : undefined,
    lotAcresMin: f.lotAcresMin != null && f.lotAcresMin !== '' ? Number(f.lotAcresMin) : undefined,
    lotAcresMax: f.lotAcresMax != null && f.lotAcresMax !== '' ? Number(f.lotAcresMax) : undefined,
    yearBuiltMin: f.yearBuiltMin ? Number(f.yearBuiltMin) : undefined,
    yearBuiltMax: f.yearBuiltMax ? Number(f.yearBuiltMax) : undefined,
    propertyType: f.propertyType || undefined,
    postalCode: f.postalCode || undefined,
    garageMin: f.garageMin ? Number(f.garageMin) : undefined,
    daysOnMarket: f.daysOnMarket || undefined,
    keywords: f.keywords || undefined,
    hasPool: f.hasPool === '1' ? true : undefined,
    hasView: f.hasView === '1' ? true : undefined,
    hasWaterfront: f.hasWaterfront === '1' ? true : undefined,
    hasFireplace: f.hasFireplace === '1' ? true : undefined,
    hasGolfCourse: f.hasGolfCourse === '1' ? true : undefined,
  }
}

export type MapSearchViewProps = {
  initialListings: ListingTileRow[]
  initialTotalCount: number
  initialCapped: boolean
  initialBounds: MapBounds
  filters: SearchFiltersInitial
  savedListingKeys: string[]
  likedListingKeys: string[]
  placeQuery: string
  boundaryGeojson?: unknown
  initialPolygon?: MapPolygonPoint[] | null
}

export default function MapSearchView({
  initialListings,
  initialTotalCount,
  initialCapped,
  initialBounds,
  filters,
  savedListingKeys,
  likedListingKeys,
  placeQuery,
  boundaryGeojson,
  initialPolygon = null,
}: MapSearchViewProps) {
  const [listings, setListings] = useState(initialListings)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [capped, setCapped] = useState(initialCapped)
  const [loading, setLoading] = useState(false)
  const [searchAsMove, setSearchAsMove] = useState(true)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [polygon, setPolygon] = useState<MapPolygonPoint[] | null>(initialPolygon)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  // Window the CARD list so the SSR payload + hydration cost stays small even
  // when the viewport returns hundreds of homes. The MAP still gets every pin
  // (mapListings below) — only the heavy cards are paged in. "Show more" reveals
  // the rest from already-loaded data (no extra fetch).
  const CARD_PAGE = 48
  const [visibleCount, setVisibleCount] = useState(CARD_PAGE)

  const listContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBoundsRef = useRef<MapBounds>(initialBounds)
  const reqIdRef = useRef(0)

  const searchFilters = useMemo(() => toSearchFilters(filters), [filters])
  const filtersSnapshot = JSON.stringify(filters)

  // Re-seed from server props whenever the URL filters change (new SSR payload).
  useEffect(() => {
    setListings(initialListings)
    setTotalCount(initialTotalCount)
    setCapped(initialCapped)
    setPolygon(initialPolygon)
    setVisibleCount(CARD_PAGE)
  }, [initialListings, initialTotalCount, initialCapped, initialPolygon, filtersSnapshot])

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runViewportSearch = useCallback(
    async (bounds: MapBounds, poly: MapPolygonPoint[] | null) => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      try {
        const res = await getViewportSearch(searchFilters, bounds, poly)
        // Ignore out-of-order responses (user kept panning).
        if (reqId !== reqIdRef.current) return
        setListings(res.listings)
        setTotalCount(res.totalCount)
        setCapped(res.capped)
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    [searchFilters]
  )

  const handleBoundsChanged = useCallback(
    (bounds: MapBounds) => {
      lastBoundsRef.current = bounds
      if (!searchAsMove) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        runViewportSearch(bounds, polygon)
      }, 350)
    },
    [searchAsMove, polygon, runViewportSearch]
  )

  const handlePolygonDrawn = useCallback(
    (poly: MapPolygonPoint[] | null) => {
      setPolygon(poly)
      runViewportSearch(lastBoundsRef.current, poly)
    },
    [runViewportSearch]
  )

  // When the user flips search-as-you-move ON, immediately sync to the current view.
  const toggleSearchAsMove = useCallback(() => {
    setSearchAsMove((prev) => {
      const next = !prev
      if (next) runViewportSearch(lastBoundsRef.current, polygon)
      return next
    })
  }, [polygon, runViewportSearch])

  const onListHover = useCallback((key: string | null) => setHoveredKey(key), [])
  const onMarkerHover = useCallback((key: string | null) => {
    setHoveredKey(key)
    if (key) {
      const el = listContainerRef.current?.querySelector(`[data-listing-key="${key}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  const mapListings = useMemo(() => listings.map(toMapListing), [listings])

  const countLabel = capped ? `${totalCount.toLocaleString()}+` : totalCount.toLocaleString()
  const headerText = `${countLabel} home${totalCount === 1 ? '' : 's'} in this area`

  const listPanel = (
    <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-muted">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {headerText}
        </p>
        {loading && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
      {listings.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-base font-medium text-foreground">No homes in this part of the map.</p>
          <p className="mt-1 text-sm">Zoom out or pan to a different area to see listings.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {listings.slice(0, visibleCount).map((l) => {
            const key = rowKey(l)
            const href = listingDetailPath(
              key,
              { streetNumber: l.StreetNumber, streetName: l.StreetName, city: l.City, state: l.State, postalCode: l.PostalCode },
              undefined,
              { mlsNumber: l.ListNumber ?? null }
            )
            const isHovered = hoveredKey === key
            const sqft = rowSqft(l)
            return (
              <Link
                key={key}
                href={href}
                data-listing-key={key}
                className="group block"
                onMouseEnter={() => onListHover(key)}
                onMouseLeave={() => onListHover(null)}
                onFocus={() => onListHover(key)}
                onBlur={() => onListHover(null)}
              >
                <article
                  className={cn(
                    'overflow-hidden rounded-lg bg-card shadow-sm transition-shadow',
                    isHovered ? 'shadow-lg ring-2 ring-primary' : 'hover:shadow-md'
                  )}
                >
                  <div className="relative aspect-[4/3] bg-border">
                    {l.PhotoURL ? (
                      <Image
                        src={l.PhotoURL}
                        alt={`${formatAddress(l)} property photo`}
                        fill
                        className="object-cover"
                        sizes="(max-width:1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                        No photo
                      </div>
                    )}
                    <div className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-sm font-semibold text-primary-foreground tabular-nums">
                      {formatPrice(l.ListPrice)}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate font-medium text-primary">{formatAddress(l)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      {l.BedroomsTotal ?? '—'} bd · {l.BathroomsTotal ?? '—'} ba
                      {sqft != null && ` · ${sqft.toLocaleString()} sqft`}
                    </p>
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
        {listings.length > visibleCount && (
          <div className="px-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((c) => c + CARD_PAGE)}
              className="w-full"
            >
              Show more homes
            </Button>
          </div>
        )}
        </>
      )}
    </div>
  )

  const mapPanel = (
    <div className="relative h-full min-h-0 min-w-0 flex-1">
      <SearchMapClustered
        listings={mapListings}
        savedListingKeys={savedListingKeys}
        likedListingKeys={likedListingKeys}
        placeQuery={placeQuery}
        boundaryGeojson={boundaryGeojson}
        onBoundsChanged={handleBoundsChanged}
        onPolygonDrawn={handlePolygonDrawn}
        initialPolygon={polygon}
        hoveredKey={hoveredKey}
        onMarkerHover={onMarkerHover}
        className="h-full w-full"
      />
      {/* Search-as-you-move toggle (Redfin/Zillow pattern). */}
      <Label className="absolute left-1/2 top-3 z-[100] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md">
        <Checkbox
          checked={searchAsMove}
          onCheckedChange={() => toggleSearchAsMove()}
        />
        Search as I move the map
      </Label>
    </div>
  )

  return (
    <div className="map-search-shell flex w-full flex-col overflow-hidden" style={{ contain: 'layout' }}>
      {/* Mobile segmented toggle */}
      <div className="flex shrink-0 border-b border-border bg-card lg:hidden">
        <ToggleGroup
          type="single"
          value={mobileView}
          onValueChange={(v) => { if (v === 'list' || v === 'map') setMobileView(v) }}
          className="w-full rounded-none border-0"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list" className="flex-1 py-3 rounded-none border-0 text-sm font-medium" aria-label="List view">
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="map" className="flex-1 py-3 rounded-none border-0 text-sm font-medium" aria-label="Map view">
            Map
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Desktop: list + map side by side */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <div className="map-search-rail flex shrink-0 flex-col border-r border-border">
          {listPanel}
        </div>
        {mapPanel}
      </div>

      {/* Mobile: one panel at a time */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        {mobileView === 'list' ? listPanel : mapPanel}
      </div>
    </div>
  )
}
