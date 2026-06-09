'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getListingsInBounds, type MapBounds, type ListingTileRow } from '@/app/actions/listings'
import type { ListingForMap } from '@/components/SearchMapClustered'
import type { MapPolygonPoint } from '@/lib/map-polygon'
import { encodeMapPolygon } from '@/lib/map-polygon'

const SearchMapClustered = dynamic(
  () => import('@/components/SearchMapClustered'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
        style={{ minHeight: '320px' }}
      >
        Loading map…
      </div>
    ),
  }
)
import ListingTile, { type ListingTileListing } from '@/components/ListingTile'
import { MAP_DEFAULT_CENTER } from '@/lib/map-constants'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import type { GetListingsForMapOptions } from '@/app/actions/listings'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listingsBrowsePath } from '@/lib/slug'

const PER_PAGE = 20
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const

function areBoundsSimilar(a: MapBounds, b: MapBounds, epsilon = 0.0005): boolean {
  return (
    Math.abs(a.west - b.west) < epsilon &&
    Math.abs(a.south - b.south) < epsilon &&
    Math.abs(a.east - b.east) < epsilon &&
    Math.abs(a.north - b.north) < epsilon
  )
}

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i
function hasPlayableVideo(details: { Videos?: Array<{ Uri?: string }> } | null | undefined): boolean {
  const uris = details?.Videos?.map((v) => (v?.Uri ?? '').trim()).filter(Boolean) ?? []
  return uris.some((uri) => {
    try {
      return DIRECT_VIDEO_EXT.test(new URL(uri).pathname)
    } catch {
      return false
    }
  })
}

function toMapListing(row: ListingTileRow & { details?: { Videos?: Array<{ Uri?: string }> } }): ListingForMap {
  return {
    Latitude: row.Latitude,
    Longitude: row.Longitude,
    ListingKey: row.ListingKey ?? null,
    ListNumber: row.ListNumber ?? null,
    ListPrice: row.ListPrice ?? null,
    StreetNumber: row.StreetNumber ?? null,
    StreetName: row.StreetName ?? null,
    City: row.City ?? null,
    State: row.State ?? null,
    PostalCode: row.PostalCode ?? null,
    BedroomsTotal: row.BedroomsTotal ?? null,
    BathroomsTotal: row.BathroomsTotal ?? null,
    hasVideo: hasPlayableVideo(row.details),
  }
}

export type UnifiedMapListingsViewProps = GetListingsForMapOptions & {
  /** Optional place query to center/fit map (e.g. "Bend Oregon", "Tetherow Bend"). Default: Bend. */
  placeQuery?: string | null
  /** Title above the list (e.g. "Homes for Sale in Bend"). */
  pageTitle?: string
  /** Base path for "List view" link (e.g. /listings or /homes-for-sale/bend). */
  basePath?: string
  savedKeys?: string[]
  likedKeys?: string[]
  priceChangeKeys?: Set<string>
  signedIn?: boolean
  userEmail?: string | null
  prefs?: { downPaymentPercent?: number; interestRate?: number; loanTermYears?: number } | null
  /** Optional filter bar to render above the split (e.g. SearchFilterBar). */
  filterBar?: React.ReactNode
  /** Optional class for the root container (e.g. h-[70vh] for home page section). */
  containerClassName?: string
  /** Optional GeoJSON boundary (city/neighborhood/community) to draw on the map. */
  boundaryGeojson?: unknown
  /** Initial listings so the map shows markers on first paint (e.g. home page Bend listings). */
  initialListings?: ListingTileRow[]
  /** Total count when using initialListings (for "N results in this area"). */
  initialTotalCount?: number
  /** Optional preloaded polygon area filter (e.g. from URL saved search). */
  initialPolygon?: MapPolygonPoint[] | null
  /** Keep map drawing in URL so search can be shared/saved. */
  persistPolygonInUrl?: boolean
}

export default function UnifiedMapListingsView({
  placeQuery = null,
  pageTitle = 'Central Oregon Real Estate & Homes For Sale',
  basePath = listingsBrowsePath(),
  savedKeys = [],
  likedKeys = [],
  priceChangeKeys = new Set(),
  signedIn = false,
  userEmail = null,
  prefs = null,
  filterBar,
  containerClassName,
  boundaryGeojson,
  initialListings,
  initialTotalCount,
  initialPolygon = null,
  persistPolygonInUrl = false,
  city,
  subdivision,
  statusFilter,
  includeClosed,
  minPrice,
  maxPrice,
  minBeds,
  maxBeds,
  minBaths,
  maxBaths,
  minSqFt,
  maxSqFt,
  postalCode,
  propertyType,
}: UnifiedMapListingsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null)
  const [listings, setListings] = useState<ListingTileRow[]>(() => initialListings ?? [])
  const [totalCount, setTotalCount] = useState(() => initialTotalCount ?? 0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [needsSearchThisArea, setNeedsSearchThisArea] = useState(false)
  const [, setPage] = useState(1)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc'>('newest')
  const [polygonFilter, setPolygonFilter] = useState<MapPolygonPoint[] | null>(initialPolygon)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPolygonFilter(initialPolygon ?? null)
  }, [initialPolygon])

  const syncPolygonToUrl = useCallback((polygon: MapPolygonPoint[] | null) => {
    if (!persistPolygonInUrl || !pathname) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const encoded = polygon ? encodeMapPolygon(polygon) : undefined
    if (encoded) params.set('poly', encoded)
    else params.delete('poly')
    if (!params.has('view')) params.set('view', 'map')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [persistPolygonInUrl, pathname, router, searchParams])

  const runSearchForBounds = useCallback(
    async (
      targetBounds: MapBounds,
      targetSort: 'newest' | 'oldest' | 'price_asc' | 'price_desc' = sort,
      polygon: MapPolygonPoint[] | null = polygonFilter
    ) => {
      setPage(1)
      setLoading(true)
      try {
        const { listings: rows, totalCount: total } = await getListingsInBounds({
          bounds: targetBounds,
          city: city ?? undefined,
          subdivision: subdivision ?? undefined,
          statusFilter: statusFilter ?? undefined,
          includeClosed,
          minPrice,
          maxPrice,
          minBeds,
          maxBeds,
          minBaths,
          maxBaths,
          minSqFt,
          maxSqFt,
          postalCode: postalCode ?? undefined,
          propertyType: propertyType ?? undefined,
          limit: PER_PAGE,
          offset: 0,
          sort: targetSort,
          polygon,
        })
        setListings(rows)
        setTotalCount(total)
        setSearchBounds(targetBounds)
        setNeedsSearchThisArea(false)
      } catch (err) {
        // A transient data-layer error (e.g. a cold statement timeout) must NOT
        // leave the map stuck on a loading spinner — that is the "search as I move
        // the map does nothing" symptom. Keep the prior results and re-offer the
        // "Search this area" button so the user can retry.
        console.error('[map-search] search-this-area failed:', err)
        setNeedsSearchThisArea(true)
      } finally {
        setLoading(false)
      }
    },
    [
      sort,
      polygonFilter,
      city,
      subdivision,
      statusFilter,
      includeClosed,
      minPrice,
      maxPrice,
      minBeds,
      maxBeds,
      minBaths,
      maxBaths,
      minSqFt,
      maxSqFt,
      postalCode,
      propertyType,
    ]
  )

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!searchBounds) return
      const opts = {
        bounds: searchBounds,
        city: city ?? undefined,
        subdivision: subdivision ?? undefined,
        statusFilter: statusFilter ?? undefined,
        includeClosed,
        minPrice,
        maxPrice,
        minBeds,
        maxBeds,
        minBaths,
        maxBaths,
        minSqFt,
        maxSqFt,
        postalCode: postalCode ?? undefined,
        propertyType: propertyType ?? undefined,
        limit: PER_PAGE,
        offset,
        sort,
        polygon: polygonFilter,
      }
      const { listings: rows, totalCount: total } = await getListingsInBounds(opts)
      if (append) {
        setListings((prev) => [...prev, ...rows])
      } else {
        setListings(rows)
      }
      setTotalCount(total)
    },
    [
      searchBounds,
      city,
      subdivision,
      statusFilter,
      includeClosed,
      minPrice,
      maxPrice,
      minBeds,
      maxBeds,
      minBaths,
      maxBaths,
      minSqFt,
      maxSqFt,
      postalCode,
      propertyType,
      sort,
      polygonFilter,
    ]
  )

  const onBoundsChanged = useCallback(
    (newBounds: MapBounds) => {
      setBounds(newBounds)
      if (!searchBounds) {
        runSearchForBounds(newBounds, sort, polygonFilter)
        return
      }
      setNeedsSearchThisArea(!areBoundsSimilar(newBounds, searchBounds))
    },
    [
      searchBounds,
      sort,
      polygonFilter,
      runSearchForBounds,
    ]
  )

  const onMarkerClick = useCallback((listingKey: string) => {
    const el = listRef.current?.querySelector(`[data-listing-key="${listingKey}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const loadMore = useCallback(() => {
    if (!searchBounds || loadingMore || listings.length >= totalCount) return
    setLoadingMore(true)
    const nextOffset = listings.length
    fetchPage(nextOffset, true).then(() => {
      setPage(Math.floor(nextOffset / PER_PAGE) + 1)
      setLoadingMore(false)
    })
  }, [searchBounds, loadingMore, listings.length, totalCount, fetchPage])

  const displayPrefs = {
    downPaymentPercent: prefs?.downPaymentPercent ?? DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: prefs?.interestRate ?? DEFAULT_DISPLAY_RATE,
    loanTermYears: prefs?.loanTermYears ?? DEFAULT_DISPLAY_TERM_YEARS,
  }

  const mapListings: ListingForMap[] = listings.map(toMapListing)
  const hasMore = totalCount > listings.length

  return (
    <div className={`flex flex-col overflow-hidden ${containerClassName ?? 'h-[calc(100vh-4rem)]'}`}>
      {filterBar != null && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          {filterBar}
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: scrollable sidebar — fixed width, list scrolls */}
        <div className="flex w-full flex-col min-h-0 border-r border-border bg-card md:w-[420px] lg:w-[480px] shrink-0">
          <div className="shrink-0 border-b border-border bg-card px-4 py-3">
            <h2 className="text-lg font-semibold text-primary">{pageTitle}</h2>
            {searchBounds != null && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {loading ? 'Loading…' : `${totalCount.toLocaleString()} result${totalCount !== 1 ? 's' : ''} in this area`}
              </p>
            )}
            {searchBounds == null && (
              <p className="mt-0.5 text-sm text-muted-foreground">Move or zoom the map to see listings in that area.</p>
            )}
            {searchBounds != null && needsSearchThisArea && (
              <p className="mt-1 text-sm text-muted-foreground">Map moved. Click Search this area to refresh results.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Sort:</span>
              <Select
                value={sort}
                onValueChange={(v) => {
                  const value = v as typeof sort
                  setSort(value)
                  const target = bounds ?? searchBounds
                  if (target) {
                    runSearchForBounds(target, value, polygonFilter)
                  }
                }}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {polygonFilter && polygonFilter.length >= 3 && (
                <Button
                  type="button"
                  onClick={() => {
                    setPolygonFilter(null)
                    syncPolygonToUrl(null)
                    const target = bounds ?? searchBounds
                    if (target) {
                      runSearchForBounds(target, sort, null)
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear drawn area
                </Button>
              )}
              {needsSearchThisArea && bounds && (
                <Button
                  type="button"
                  onClick={() => runSearchForBounds(bounds, sort, polygonFilter)}
                  size="sm"
                >
                  Search this area
                </Button>
              )}
            </div>
          </div>
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4">
            {loading && listings.length === 0 ? (
              <p className="text-muted-foreground">Loading listings…</p>
            ) : (
              <>
                <ul className="space-y-4">
                  {listings.map((listing, i) => {
                    const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
                    const price = Number(listing.ListPrice ?? 0)
                    const monthly =
                      price > 0
                        ? estimatedMonthlyPayment(
                            price,
                            displayPrefs.downPaymentPercent,
                            displayPrefs.interestRate,
                            displayPrefs.loanTermYears
                          )
                        : null
                    return (
                      <li key={key} data-listing-key={key}>
                        <ListingTile
                          listing={listing as ListingTileListing}
                          listingKey={key}
                          hasRecentPriceChange={priceChangeKeys.has(key)}
                          saved={signedIn ? savedKeys.includes(key) : undefined}
                          liked={signedIn ? likedKeys.includes(key) : undefined}
                          monthlyPayment={
                            monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
                          }
                          signedIn={signedIn}
                          userEmail={userEmail}
                        />
                      </li>
                    )
                  })}
                </ul>
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-primary shadow-sm hover:bg-muted disabled:opacity-60"
                    >
                      {loadingMore ? 'Loading…' : `Load more (${listings.length} of ${totalCount})`}
                    </Button>
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <Link
                    href={basePath}
                    className="rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
                  >
                    List view
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: map — fills remaining space; zoomed in (12) so Bend area is visible */}
        <div className="hidden flex-1 min-h-0 md:block relative">
          <SearchMapClustered
            listings={mapListings}
            savedListingKeys={savedKeys}
            likedListingKeys={likedKeys}
            onMarkerClick={onMarkerClick}
            placeQuery={placeQuery}
            initialCenter={MAP_DEFAULT_CENTER}
            initialZoom={12}
            onBoundsChanged={onBoundsChanged}
            boundaryGeojson={boundaryGeojson}
            initialPolygon={polygonFilter}
            onPolygonDrawn={(polygon) => {
              setPolygonFilter(polygon)
              syncPolygonToUrl(polygon)
              const target = bounds ?? searchBounds
              if (target) {
                runSearchForBounds(target, sort, polygon)
              }
            }}
            className="h-full"
          />
        </div>
      </div>

      {/* Mobile: map below list */}
      <div className="h-[320px] shrink-0 border-t border-border md:hidden">
        <SearchMapClustered
          listings={mapListings}
          savedListingKeys={savedKeys}
          likedListingKeys={likedKeys}
          onMarkerClick={onMarkerClick}
          placeQuery={placeQuery}
          initialCenter={MAP_DEFAULT_CENTER}
          initialZoom={12}
          onBoundsChanged={onBoundsChanged}
          boundaryGeojson={boundaryGeojson}
          initialPolygon={polygonFilter}
          onPolygonDrawn={(polygon) => {
            setPolygonFilter(polygon)
            syncPolygonToUrl(polygon)
            const target = bounds ?? searchBounds
            if (target) {
              runSearchForBounds(target, sort, polygon)
            }
          }}
          className="h-full"
        />
      </div>
    </div>
  )
}
